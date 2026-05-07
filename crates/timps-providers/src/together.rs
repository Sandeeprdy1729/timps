//! TogetherAI provider — open model hosting
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct TogetherProvider { api_key: String, model: String }
impl TogetherProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("TOGETHER_API_KEY").unwrap_or_default(),
        model: std::env::var("TOGETHER_MODEL")
            .unwrap_or_else(|_| "meta-llama/Llama-3.3-70B-Instruct-Turbo".to_string()),
    }}
}
#[async_trait]
impl Provider for TogetherProvider {
    fn name(&self) -> &str { "together" }
    fn default_model(&self) -> &str { "meta-llama/Llama-3.3-70B-Instruct-Turbo" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.together.xyz/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["meta-llama/Llama-3.3-70B-Instruct-Turbo".into(),
                "mistralai/Mixtral-8x7B-Instruct-v0.1".into(),
                "Qwen/Qwen2.5-Coder-32B-Instruct".into()])
    }
}
