//! DeepSeek provider — cost-effective
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct DeepSeekProvider { api_key: String, model: String }
impl DeepSeekProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("DEEPSEEK_API_KEY").unwrap_or_default(),
        model: std::env::var("DEEPSEEK_MODEL").unwrap_or_else(|_| "deepseek-chat".to_string()),
    }}
}
#[async_trait]
impl Provider for DeepSeekProvider {
    fn name(&self) -> &str { "deepseek" }
    fn default_model(&self) -> &str { "deepseek-chat" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let compat = OpenAICompat::new("https://api.deepseek.com/v1", &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["deepseek-chat".into(), "deepseek-coder".into(), "deepseek-reasoner".into()])
    }
}
