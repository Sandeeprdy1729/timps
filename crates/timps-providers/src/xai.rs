//! xAI / Grok provider — uses OpenAI-compatible endpoint.
use crate::{compat::OpenAICompat, Message, Provider, ProviderStream};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::mpsc;

pub struct XaiProvider {
    api_key: String,
    model: String,
}

impl XaiProvider {
    pub fn new(api_key: impl Into<String>, model: Option<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.unwrap_or_else(|| "grok-3-mini".to_string()),
        }
    }
}

#[async_trait]
impl Provider for XaiProvider {
    fn name(&self) -> &str { "xai" }
    fn default_model(&self) -> &str { "grok-3-mini" }

    async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Value],
    ) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.x.ai/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![
            "grok-3".to_string(),
            "grok-3-mini".to_string(),
            "grok-beta".to_string(),
        ])
    }
}

