//! OpenRouter provider — 200+ models via single API key
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct OpenRouterProvider { api_key: String, model: String }
impl OpenRouterProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
        model: std::env::var("OPENROUTER_MODEL")
            .unwrap_or_else(|_| "anthropic/claude-sonnet-4-5".to_string()),
    }}
}
#[async_trait]
impl Provider for OpenRouterProvider {
    fn name(&self) -> &str { "openrouter" }
    fn default_model(&self) -> &str { "anthropic/claude-sonnet-4-5" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://openrouter.ai/api/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["anthropic/claude-sonnet-4-5".into(), "openai/gpt-4o".into(),
                "google/gemini-2.0-flash".into(), "meta-llama/llama-3.3-70b-instruct".into()])
    }
}
