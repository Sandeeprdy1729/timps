//! Cohere provider — Command R+
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct CohereProvider { api_key: String, model: String }
impl CohereProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("COHERE_API_KEY").unwrap_or_default(),
        model: std::env::var("COHERE_MODEL").unwrap_or_else(|_| "command-r-plus".to_string()),
    }}
}
#[async_trait]
impl Provider for CohereProvider {
    fn name(&self) -> &str { "cohere" }
    fn default_model(&self) -> &str { "command-r-plus" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.cohere.ai/compatibility/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["command-r-plus".into(), "command-r".into(), "command-light".into()])
    }
}
