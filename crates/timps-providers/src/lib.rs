//! timps-providers — LLM provider adapters.
//! Implements the Provider trait for: Ollama, OpenAI, Claude, Gemini, OpenRouter,
//! Azure, Bedrock, Groq, Mistral, Cohere, TogetherAI, DeepSeek, Perplexity.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

pub mod ollama;
pub mod openai;
pub mod claude;
pub mod gemini;
pub mod openrouter;
pub mod groq;
pub mod mistral;
pub mod cohere;
pub mod together;
pub mod deepseek;
pub mod perplexity;
pub mod azure;
pub mod xai;
pub mod fireworks;
pub mod config;

pub use config::ProviderConfig;

// ── Core types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: serde_json::Value,
}

/// Events streamed from providers.
#[derive(Debug)]
pub enum StreamEvent {
    Token(String),
    ToolCall(ToolCall),
    Done,
    Error(String),
}

pub type ProviderStream = mpsc::Receiver<StreamEvent>;

// ── Provider trait ─────────────────────────────────────────────────────────

#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    fn default_model(&self) -> &str;

    async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[serde_json::Value],
    ) -> Result<ProviderStream>;

    /// List available models from this provider.
    async fn list_models(&self) -> Result<Vec<String>>;
}

// ── ProviderRegistry ───────────────────────────────────────────────────────

use std::collections::HashMap;
use std::sync::Arc;

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn Provider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self { providers: HashMap::new() }
    }

    pub fn register(&mut self, provider: Arc<dyn Provider>) {
        self.providers.insert(provider.name().to_string(), provider);
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Provider>> {
        self.providers.get(name).cloned()
    }

    pub fn names(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }

    /// Build registry from environment — registers all providers with API keys set.
    pub fn from_env() -> Self {
        let mut registry = Self::new();

        registry.register(Arc::new(ollama::OllamaProvider::from_env()));

        if std::env::var("OPENAI_API_KEY").is_ok() {
            registry.register(Arc::new(openai::OpenAIProvider::from_env()));
        }
        if std::env::var("ANTHROPIC_API_KEY").is_ok() {
            registry.register(Arc::new(claude::ClaudeProvider::from_env()));
        }
        if std::env::var("GEMINI_API_KEY").is_ok() {
            registry.register(Arc::new(gemini::GeminiProvider::from_env()));
        }
        if std::env::var("OPENROUTER_API_KEY").is_ok() {
            registry.register(Arc::new(openrouter::OpenRouterProvider::from_env()));
        }
        if std::env::var("GROQ_API_KEY").is_ok() {
            registry.register(Arc::new(groq::GroqProvider::from_env()));
        }
        if std::env::var("MISTRAL_API_KEY").is_ok() {
            registry.register(Arc::new(mistral::MistralProvider::from_env()));
        }
        if std::env::var("COHERE_API_KEY").is_ok() {
            registry.register(Arc::new(cohere::CohereProvider::from_env()));
        }
        if std::env::var("TOGETHER_API_KEY").is_ok() {
            registry.register(Arc::new(together::TogetherProvider::from_env()));
        }
        if std::env::var("DEEPSEEK_API_KEY").is_ok() {
            registry.register(Arc::new(deepseek::DeepSeekProvider::from_env()));
        }
        if std::env::var("PERPLEXITY_API_KEY").is_ok() {
            registry.register(Arc::new(perplexity::PerplexityProvider::from_env()));
        }
        if std::env::var("AZURE_OPENAI_API_KEY").is_ok() {
            registry.register(Arc::new(azure::AzureOpenAIProvider::from_env()));
        }
        if let Ok(key) = std::env::var("XAI_API_KEY") {
            registry.register(Arc::new(xai::XaiProvider::new(key, None)));
        }
        if let Ok(key) = std::env::var("FIREWORKS_API_KEY") {
            registry.register(Arc::new(fireworks::FireworksProvider::new(key, None)));
        }

        registry
    }
}
