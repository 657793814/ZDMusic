mod commands;

use commands::server::{stop_server_sync, start_server_sync, ServerState};
use std::net::TcpStream;
use std::thread;
use std::time::Duration;
use tauri::menu::{MenuBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // Enable logging for both debug and release builds
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Register server process state
            app.manage(ServerState::new());

            // Build system tray menu
            let show_i = tauri::menu::MenuItemBuilder::with_id("show", "显示窗口")
                .accelerator("CmdOrCtrl+Shift+A")
                .build(app)?;
            let play_pause_i =
                tauri::menu::MenuItemBuilder::with_id("play_pause", "播放 / 暂停")
                    .accelerator("CmdOrCtrl+Shift+P")
                    .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_i = tauri::menu::MenuItemBuilder::with_id("quit", "退出")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_i)
                .item(&play_pause_i)
                .item(&separator)
                .item(&quit_i)
                .build()?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "play_pause" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval(
                                "window.__tauriTrayPlayPause && window.__tauriTrayPlayPause()",
                            );
                        }
                    }
                    "quit" => {
                        stop_server_sync(app);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Production: auto-start Next.js server
            if !cfg!(debug_assertions) {
                let handle = app.handle().clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(1));
                    if let Err(e) = start_server_sync(&handle, 3000) {
                        log::error!("Failed to start server: {}", e);
                        return;
                    }
                    for i in 0..60 {
                        if TcpStream::connect("127.0.0.1:3000").is_ok() {
                            log::info!("Server ready after ~{}s", (i + 1) / 2);
                            break;
                        }
                        thread::sleep(Duration::from_millis(500));
                    }
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.eval("window.location.href = 'http://localhost:3000'");
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .on_window_event(|window, event| {
            // Hides window instead of quitting on close
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
            if let tauri::WindowEvent::Destroyed = event {
                stop_server_sync(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            stop_server_sync(app_handle);
        }
    });
}
