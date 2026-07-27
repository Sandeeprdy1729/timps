//! Fireworks AI provider — fast open-source model inference.
use crate::{compat::OpenAICompat, Message, Provider, ProviderStream};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::mpsc;

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
        messages: &[Message],
        tools: &[Value],
    ) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.fireworks.ai/inference/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let compat = OpenAICompat::new("https://api.fireworks.ai/inference/v1", &self.api_key, &self.model);
        let models = compat.fetch_models().await;
        if models.is_empty() {
            Ok(vec!["accounts/fireworks/models/llama-v3p3-70b-instruct".to_string()])
        } else {
            Ok(models)
        }
    }
}
