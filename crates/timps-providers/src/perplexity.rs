//! Perplexity provider — search-augmented answers
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct PerplexityProvider { api_key: String, model: String }
impl PerplexityProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("PERPLEXITY_API_KEY").unwrap_or_default(),
        model: std::env::var("PERPLEXITY_MODEL")
            .unwrap_or_else(|_| "sonar-pro".to_string()),
    }}
}
#[async_trait]
impl Provider for PerplexityProvider {
    fn name(&self) -> &str { "perplexity" }
    fn default_model(&self) -> &str { "sonar-pro" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.perplexity.ai", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["sonar-pro".into(), "sonar".into(), "sonar-reasoning".into()])
    }
}
