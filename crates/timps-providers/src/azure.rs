//! Azure OpenAI provider — enterprise deployments
use anyhow::Result; use async_trait::async_trait;
use serde_json::Value; use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream}; use crate::compat::OpenAICompat;

pub struct AzureOpenAIProvider { api_key: String, model: String, endpoint: String, api_version: String }
impl AzureOpenAIProvider {
    pub fn from_env() -> Self { Self {
        api_key: std::env::var("AZURE_OPENAI_API_KEY").unwrap_or_default(),
        model: std::env::var("AZURE_OPENAI_DEPLOYMENT").unwrap_or_else(|_| "gpt-4o".to_string()),
        endpoint: std::env::var("AZURE_OPENAI_ENDPOINT").unwrap_or_default(),
        api_version: std::env::var("AZURE_OPENAI_API_VERSION")
            .unwrap_or_else(|_| "2024-12-01-preview".to_string()),
    }}
}
#[async_trait]
impl Provider for AzureOpenAIProvider {
    fn name(&self) -> &str { "azure" }
    fn default_model(&self) -> &str { "gpt-4o" }
    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let base = format!("{}/openai/deployments/{}", self.endpoint.trim_end_matches('/'), self.model);
        let url = format!("{base}?api-version={}", self.api_version);
        let compat = OpenAICompat::new(url, &self.api_key, &self.model);
        let (s, m, t) = (system.to_string(), messages.to_vec(), tools.to_vec());
        tokio::spawn(async move { let _ = compat.complete(&s, &m, &t, tx).await; });
        Ok(rx)
    }
    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["gpt-4o".into(), "gpt-4o-mini".into(), "gpt-4-turbo".into()])
    }
}
