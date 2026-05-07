//! Groq provider — fastest inference (~300 tok/s)
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct GroqProvider { api_key: String, model: String }
impl GroqProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("GROQ_API_KEY").unwrap_or_default(),
        model: std::env::var("GROQ_MODEL")
            .unwrap_or_else(|_| "llama-3.3-70b-versatile".to_string()),
    }}
}
#[async_trait]
impl Provider for GroqProvider {
    fn name(&self) -> &str { "groq" }
    fn default_model(&self) -> &str { "llama-3.3-70b-versatile" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.groq.com/openai/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["llama-3.3-70b-versatile".into(), "llama-3.1-8b-instant".into(),
                "mixtral-8x7b-32768".into(), "gemma2-9b-it".into()])
    }
}
