//! Mistral provider — EU data residency
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct MistralProvider { api_key: String, model: String }
impl MistralProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("MISTRAL_API_KEY").unwrap_or_default(),
        model: std::env::var("MISTRAL_MODEL").unwrap_or_else(|_| "mistral-large-latest".to_string()),
    }}
}
#[async_trait]
impl Provider for MistralProvider {
    fn name(&self) -> &str { "mistral" }
    fn default_model(&self) -> &str { "mistral-large-latest" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.mistral.ai/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["mistral-large-latest".into(), "mistral-medium-latest".into(), "codestral-latest".into()])
    }
}
