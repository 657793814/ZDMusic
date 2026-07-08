use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub music_dir: Option<String>,
    #[serde(default)]
    pub env_vars: Option<HashMap<String, String>>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_music = dirs::audio_dir()
            .or_else(|| dirs::home_dir().map(|p| p.join("Music")))
            .map(|p| p.to_string_lossy().to_string());
        Self {
            music_dir: default_music,
            env_vars: None,
        }
    }
}

/// Returns the config directory path (platform-specific).
fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("com.zdmusic")
}

/// Returns the config file path.
pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

/// Load config from disk, returns default if file doesn't exist or is invalid.
pub fn load_config() -> AppConfig {
    let path = config_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

/// Save config to disk, creating directory if needed.
#[allow(dead_code)]
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create config dir: {}", e))?;

    let json = serde_json::to_string_pretty(config).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(config_path(), json).map_err(|e| format!("Cannot write config: {}", e))?;

    log::info!("Config saved to {:?}", config_path());
    Ok(())
}
