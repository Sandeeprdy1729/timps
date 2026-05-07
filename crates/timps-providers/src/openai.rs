//! OpenAI provider
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream};
use crate::compat::OpenAICompat;

pub struct OpenAIProvider { api_key: String, model: String }

impl OpenAIProvider {
    pub fn from_env() -> Self {
        Self {
            api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            model: std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".to_string()),
        }
    }
}

#[async_trait]
impl Provider for OpenAIProvider {
    fn name(&self) -> &str { "openai" }
    fn default_model(&self) -> &str { "gpt-4o" }

    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.openai.com/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["gpt-4o".into(), "gpt-4o-mini".into(), "gpt-4-turbo".into(), "gpt-3.5-turbo".into()])
    }
}
