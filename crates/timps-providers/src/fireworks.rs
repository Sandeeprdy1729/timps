//! Fireworks AI provider — fast open-source model inference.
use crate::{compat::OpenAICompat, Message, Provider, ProviderStream, ToolCall};
use anyhow::Result;
use async_trait::async_trait;

pub struct FireworksProvider {
    api_key: String,
    model: String,
}

impl FireworksProvider {
    pub fn new(api_key: impl Into<String>, model: Option<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.unwrap_or_else(|| "accounts/fireworks/models/llama-v3p3-70b-instruct".to_string()),
        }
    }
}

#[async_trait]
impl Provider for FireworksProvider {
    fn name(&self) -> &str { "fireworks" }
    fn default_model(&self) -> &str { "accounts/fireworks/models/llama-v3p3-70b-instruct" }

    async fn complete(
        &self,
        system: &str,
        messages: Vec<Message>,
        tools: &[ToolCall],
    ) -> Result<ProviderStream> {
        let compat = OpenAICompat {
            base_url: "https://api.fireworks.ai/inference/v1".to_string(),
            api_key: self.api_key.clone(),
            model: self.model.clone(),
        };
        compat.complete(system, messages, tools).await
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![
            "accounts/fireworks/models/llama-v3p3-70b-instruct".to_string(),
            "accounts/fireworks/models/qwen2p5-72b-instruct".to_string(),
            "accounts/fireworks/models/deepseek-r1".to_string(),
            "accounts/fireworks/models/mixtral-8x7b-instruct".to_string(),
        ])
    }
}
