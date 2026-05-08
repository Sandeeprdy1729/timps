//! Provider configuration loaded from ~/.timps/config.toml or environment.

use serde::{Deserialize, Serialize};
use std::fs;
use dirs::home_dir;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderConfig {
    pub provider: String,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

impl ProviderConfig {
    pub fn load() -> Self {
        let config_path: Option<std::path::PathBuf> = home_dir()
            .map(|h| h.join(".timps").join("config.toml"))
            .filter(|p: &std::path::PathBuf| p.exists());

        if let Some(path) = config_path {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(cfg) = toml::from_str::<Self>(&content) {
                    return cfg;
                }
            }
        }

        // Fall back to environment
        Self {
            provider: std::env::var("TIMPS_PROVIDER").unwrap_or_else(|_| "ollama".to_string()),
            model: std::env::var("TIMPS_MODEL").ok(),
            api_key: None,
            base_url: None,
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let dir = home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot find home dir"))?
            .join(".timps");
        fs::create_dir_all(&dir)?;
        let content = toml::to_string_pretty(self)?;
        fs::write(dir.join("config.toml"), content)?;
        Ok(())
    }
}
