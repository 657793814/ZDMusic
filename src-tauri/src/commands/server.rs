use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::commands::config;

/// Holds the optional child process for the Next.js server.
pub struct ServerProcess {
    child: Option<Child>,
}

impl ServerProcess {
    pub fn new() -> Self {
        Self { child: None }
    }

    /// Kill the current child process if it's running.
    pub fn kill(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Managed state: thread-safe wrapper around the optional child process.
pub struct ServerState {
    pub inner: Mutex<ServerProcess>,
    /// Ensures only one watchdog thread is active at a time.
    pub watchdog_active: AtomicBool,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(ServerProcess::new()),
            watchdog_active: AtomicBool::new(false),
        }
    }
}

/// Parse a Node.js major version from a `node -v` output (e.g. "v22.22.3" -> 22).
fn parse_node_major(version_str: &str) -> Option<u32> {
    let s = version_str.trim().trim_start_matches('v');
    s.split('.').next()?.parse().ok()
}

/// Check that the given node binary is compatible (major >= 20).
fn check_node_version(path: &std::path::Path) -> bool {
    if let Ok(output) = std::process::Command::new(path).arg("--version").output() {
        if output.status.success() {
            let out = String::from_utf8_lossy(&output.stdout);
            if let Some(major) = parse_node_major(&out) {
                if major >= 20 {
                    return true;
                }
                log::warn!("Node.js v{} is too old (>=20 required) at {:?}", major, path);
            }
        }
    }
    false
}

/// Find a suitable Node.js binary (>= v20) by checking:
/// 1. ~/.nvm/versions/node/* (pick highest version)
/// 2. `which node`
/// 3. Common Homebrew/brew paths
fn find_node() -> Option<std::path::PathBuf> {
    let candidates = [
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
    ];

    // 1. Search nvm versions — pick the highest
    if let Ok(home) = std::env::var("HOME") {
        let nvm_dir = std::path::PathBuf::from(&home).join(".nvm/versions/node");
        if nvm_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                let mut nvm_nodes: Vec<std::path::PathBuf> = entries
                    .flatten()
                    .map(|e| e.path().join("bin/node"))
                    .filter(|p| p.is_file())
                    .collect();
                // Sort descending (higher version first) using semver-like directory name
                nvm_nodes.sort_by(|a, b| {
                    let a_name = a
                        .parent()
                        .and_then(|p| p.parent())
                        .and_then(|p| p.file_name())
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let b_name = b
                        .parent()
                        .and_then(|p| p.parent())
                        .and_then(|p| p.file_name())
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let a_parts: Vec<u32> =
                        a_name.trim_start_matches('v').split('.').filter_map(|s| s.parse().ok()).collect();
                    let b_parts: Vec<u32> =
                        b_name.trim_start_matches('v').split('.').filter_map(|s| s.parse().ok()).collect();
                    b_parts.cmp(&a_parts)
                });
                for node_path in &nvm_nodes {
                    if check_node_version(node_path) {
                        log::info!("Using Node.js from nvm: {:?}", node_path);
                        return Some(node_path.clone());
                    }
                }
            }
        }
    }

    // 2. Try `which node` (respects current PATH)
    if let Ok(output) = std::process::Command::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                let p = std::path::PathBuf::from(&path);
                if p.is_file() && check_node_version(&p) {
                    log::info!("Using Node.js from PATH: {:?}", p);
                    return Some(p);
                }
            }
        }
    }

    // 3. Check common paths
    for candidate in &candidates {
        let p = std::path::PathBuf::from(candidate);
        if p.is_file() && check_node_version(&p) {
            log::info!("Using Node.js at {:?}", p);
            return Some(p);
        }
    }

    log::error!("No compatible Node.js (>=20) found");
    None
}

/// Check whether a TCP port on 127.0.0.1 is currently in use.
fn is_port_in_use(port: u16) -> bool {
    use std::net::TcpListener;
    match format!("127.0.0.1:{}", port).parse::<std::net::SocketAddr>() {
        Ok(sa) => TcpListener::bind(sa).is_err(),
        Err(_) => false,
    }
}

/// Kill the process listening on the given TCP port (macOS: lsof + kill).
/// Used to clear stale/orphan server processes before starting a new one,
/// otherwise the new server fails with EADDRINUSE and the old buggy
/// process keeps serving.
fn kill_port_owner(port: u16) {
    let pid = Command::new("lsof")
        .args(["-tiTCP", &port.to_string(), "-sTCP:LISTEN"])
        .output();
    if let Ok(out) = pid {
        if out.status.success() {
            let ids = String::from_utf8_lossy(&out.stdout);
            for line in ids.lines() {
                let p = line.trim();
                if !p.is_empty() {
                    let _ = Command::new("kill").arg(p).status();
                }
            }
        }
    }
}

/// Ensure the port is free before starting the server: kill any process
/// currently holding it (orphans from a crashed/killed app instance).
fn clear_port_if_occupied(port: u16) {
    if is_port_in_use(port) {
        log::warn!("Port {} is occupied, killing the process holding it", port);
        kill_port_owner(port);
        // Give the OS a moment to release the socket
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}

/// Build the `Command` for starting the Next.js server with env var overrides.
fn build_server_command(resource_dir: &std::path::Path, port: u16) -> Result<Command, String> {
    let cwd = resource_dir.join("standalone");
    let server_js = cwd.join("server.js");

    if !server_js.exists() {
        return Err(format!(
            "Server bundle not found at {:?}. Run `npm run build` first.",
            server_js
        ));
    }

    // Find node binary
    let node_path = find_node().ok_or_else(|| {
        "node not found. Please install Node.js from https://nodejs.org".to_string()
    })?;

    log::info!("Using node at: {:?}", node_path);

    let current_path = std::env::var("PATH").unwrap_or_default();
    let app_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", current_path);

    // Add nvm node binary directory to PATH so subprocesses find the right Node.js
    let node_dir = node_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let final_path = if !node_dir.is_empty() {
        format!("{}:{}", node_dir, app_path)
    } else {
        app_path
    };

    let mut cmd = Command::new(&node_path);
    cmd.arg("server.js")
        .current_dir(&cwd)
        .env("PORT", port.to_string())
        .env("NODE_ENV", "production")
        .env("PATH", &final_path);

    // Redirect the server's stdout/stderr to log files instead of piping:
    // - piped output is never drained by the parent, so the pipe fills up and
    //   the server can stall once it exceeds the pipe buffer
    // - a log file preserves crash/error output for diagnosis
    let log_dir = config::config_path()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::temp_dir());
    std::fs::create_dir_all(&log_dir).map_err(|e| format!("Cannot create log dir {log_dir:?}: {e}"))?;
    let stdout = std::fs::File::create(log_dir.join("server.out.log"))
        .map_err(|e| format!("Cannot open server.out.log: {e}"))?;
    let stderr = std::fs::File::create(log_dir.join("server.err.log"))
        .map_err(|e| format!("Cannot open server.err.log: {e}"))?;
    cmd.stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr));

    // Inject MUSIC_DIR from config
    let app_config = config::load_config();
    if let Some(ref music_dir) = app_config.music_dir {
        cmd.env("MUSIC_DIR", music_dir);
        log::info!("Server env: MUSIC_DIR={}", music_dir);
    }

    // Pass config file path so Next.js can read API keys / settings directly
    let config_path = config::config_path();
    cmd.env("ZD_CONFIG_FILE", config_path.to_string_lossy().to_string());
    log::info!("Server env: ZD_CONFIG_FILE={}", config_path.display());

    Ok(cmd)
}

/// Start the server and spawn it.
fn spawn_server(cmd: &mut Command) -> Result<Child, String> {
    cmd.spawn().map_err(|e| format!("Failed to start server: {}", e))
}

/// Watchdog: if the server process exits unexpectedly, restart it so the
/// webview (which talks to localhost:PORT) keeps working instead of showing
/// "Load failed". At most one watchdog runs at a time.
fn spawn_watchdog(app_handle: AppHandle, port: u16) {
    let state = app_handle.state::<ServerState>();
    if state.watchdog_active.swap(true, Ordering::SeqCst) {
        return; // another watchdog is already running
    }
    drop(state);

    thread::spawn(move || {
        // Give the freshly-started server time to boot before monitoring.
        thread::sleep(Duration::from_secs(8));
        loop {
            thread::sleep(Duration::from_secs(3));
            let Some(state) = app_handle.try_state::<ServerState>() else {
                return;
            };
            let exited = {
                let Ok(mut server) = state.inner.lock() else {
                    continue;
                };
                match server.child.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(Some(_)) => true, // exited
                        Ok(None) => false,   // still running
                        Err(_) => true,
                    },
                    None => false, // no tracked child; nothing to watch
                }
            };
            if exited {
                log::warn!(
                    "Server process exited unexpectedly; restarting on port {}",
                    port
                );
                if let Err(e) = start_server_sync(&app_handle, port) {
                    log::error!("Failed to restart server: {}", e);
                    state.watchdog_active.store(false, Ordering::SeqCst);
                    return;
                }
            } else if state.inner.lock().map(|s| s.child.is_none()).unwrap_or(true) {
                // Server was intentionally stopped (child taken by kill()).
                state.watchdog_active.store(false, Ordering::SeqCst);
                return;
            }
        }
    });
}

/// Start the Next.js production server from the bundled standalone directory.
#[tauri::command]
pub async fn start_server(app_handle: AppHandle, port: Option<u16>) -> Result<(), String> {
    let port = port.unwrap_or(3000);
    let state = app_handle.state::<ServerState>();
    let mut server = state.inner.lock().map_err(|e| e.to_string())?;

    server.kill();

    // Kill any stale/orphan process still holding the port.
    clear_port_if_occupied(port);

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Cannot get resource dir: {}", e))?;

    let mut cmd = build_server_command(&resource_dir, port)?;
    let child = spawn_server(&mut cmd)?;

    log::info!("Server started (PID: {})", child.id());
    server.child = Some(child);
    drop(server);
    spawn_watchdog(app_handle.clone(), port);
    Ok(())
}

/// Stop the Next.js server if it's running.
#[tauri::command]
pub async fn stop_server(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<ServerState>();
    let mut server = state.inner.lock().map_err(|e| e.to_string())?;
    server.kill();
    log::info!("Server stopped");
    Ok(())
}

/// Check if the Next.js server is alive by attempting a TCP connection.
#[tauri::command]
pub async fn is_server_alive(port: Option<u16>) -> Result<bool, String> {
    let port = port.unwrap_or(3000);
    match TcpStream::connect(format!("127.0.0.1:{}", port)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Internal: start server synchronously (used during app setup).
pub fn start_server_sync(app_handle: &AppHandle, port: u16) -> Result<(), String> {
    let state = app_handle.state::<ServerState>();
    let mut server = state.inner.lock().map_err(|e| e.to_string())?;
    server.kill();

    // Kill any stale/orphan process still holding the port (e.g. from a
    // previously crashed app instance), so the new server can bind.
    clear_port_if_occupied(port);

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Cannot get resource dir: {}", e))?;

    let mut cmd = build_server_command(&resource_dir, port)?;
    let child = spawn_server(&mut cmd)?;

    log::info!("Server started (PID: {})", child.id());
    server.child = Some(child);
    drop(server);
    spawn_watchdog(app_handle.clone(), port);
    Ok(())
}

/// Restart the server with the current config (e.g. after music directory change).
#[allow(dead_code)]
pub fn restart_server_with_config(app_handle: &AppHandle) -> Result<(), String> {
    log::info!("Restarting server with updated config...");
    stop_server_sync(app_handle);
    start_server_sync(app_handle, 3000)?;
    log::info!("Server restarted");
    Ok(())
}

/// Internal: kill server synchronously (used during app exit).
pub fn stop_server_sync(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<ServerState>() {
        if let Ok(mut server) = state.inner.lock() {
            server.kill();
        }
    }
}
