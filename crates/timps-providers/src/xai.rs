//! xAI / Grok provider — uses OpenAI-compatible endpoint.
use crate::{compat::OpenAICompat, Message, Provider, ProviderStream, ToolCall};
use anyhow::Result;
use async_trait::async_trait;

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
        messages: Vec<Message>,
        tools: &[ToolCall],
    ) -> Result<ProviderStream> {
        let compat = OpenAICompat {
            base_url: "https://api.x.ai/v1".to_string(),
            api_key: self.api_key.clone(),
            model: self.model.clone(),
        };
        compat.complete(system, messages, tools).await
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![
            "grok-3".to_string(),
            "grok-3-mini".to_string(),
            "grok-beta".to_string(),
        ])
    }
}
