//! Ollama provider — local models, no API key required.
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream, StreamEvent};
use crate::compat::OpenAICompat;

pub struct OllamaProvider {
    base_url: String,
    model: String,
}

impl OllamaProvider {
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434/v1".to_string()),
            model: std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "qwen2.5-coder:7b".to_string()),
        }
    }
}

#[async_trait]
impl Provider for OllamaProvider {
    fn name(&self) -> &str { "ollama" }
    fn default_model(&self) -> &str { "qwen2.5-coder:7b" }

    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new(&self.base_url, "", &self.model);
        let system = system.to_string();
        let messages = messages.to_vec();
        let tools = tools.to_vec();
        tokio::spawn(async move { let _ = compat.complete(&system, &messages, &tools, tx).await; });
        Ok(rx)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let client = reqwest::Client::new();
        let resp = client.get(format!("{}/api/tags",
            self.base_url.trim_end_matches("/v1"))).send().await?;
        let json: serde_json::Value = resp.json().await?;
        Ok(json["models"].as_array().unwrap_or(&vec![])
            .iter()
            .filter_map(|m| m["name"].as_str().map(String::from))
            .collect())
    }
}
