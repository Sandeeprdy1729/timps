//! Gemini provider (via OpenAI-compat endpoint)
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct GeminiProvider { api_key: String, model: String }
impl GeminiProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("GEMINI_API_KEY").unwrap_or_default(),
        model: std::env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-2.0-flash".to_string()),
    }}
}
#[async_trait]
impl Provider for GeminiProvider {
    fn name(&self) -> &str { "gemini" }
    fn default_model(&self) -> &str { "gemini-2.0-flash" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let url = format!("https://generativelanguage.googleapis.com/v1beta/openai");
        let compat = OpenAICompat::new(url, &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["gemini-2.0-flash".into(), "gemini-1.5-pro".into(), "gemini-1.5-flash".into()])
    }
}
