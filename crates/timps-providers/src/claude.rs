//! Anthropic Claude provider (messages API with SSE).
use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use crate::{Message, Provider, ProviderStream, Role, StreamEvent, ToolCall};

pub struct ClaudeProvider { api_key: String, model: String }

impl ClaudeProvider {
    pub fn from_env() -> Self {
        Self {
            api_key: std::env::var("ANTHROPIC_API_KEY").unwrap_or_default(),
            model: std::env::var("CLAUDE_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-5".to_string()),
        }
    }

    fn to_claude_messages(messages: &[Message]) -> Vec<Value> {
        messages.iter()
            .filter(|m| m.role != Role::System)
            .map(|m| {
                let role = match m.role {
                    Role::User => "user",
                    Role::Assistant | Role::Tool => "assistant",
                    Role::System => "user",
                };
                json!({ "role": role, "content": m.content })
            })
            .collect()
    }
}

#[async_trait]
impl Provider for ClaudeProvider {
    fn name(&self) -> &str { "claude" }
    fn default_model(&self) -> &str { "claude-sonnet-4-5" }

    async fn complete(&self, system: &str, messages: &[Message], tools: &[Value]) -> Result<ProviderStream> {
        let (tx, rx) = mpsc::channel(64);
        let client = Client::new();
        let api_key = self.api_key.clone();
        let model = self.model.clone();
        let system = system.to_string();
        let msgs = Self::to_claude_messages(messages);
        let tools = tools.to_vec();

        tokio::spawn(async move {
            let mut body = json!({
                "model": model,
                "max_tokens": 8096,
                "system": system,
                "messages": msgs,
                "stream": true,
            });
            if !tools.is_empty() {
                body["tools"] = json!(tools);
            }

            let resp = match client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send().await {
                    Ok(r) => r,
                    Err(e) => { let _ = tx.send(StreamEvent::Error(e.to_string())).await; return; }
                };

            let text = resp.text().await.unwrap_or_default();
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() { continue; }
                let data = line.strip_prefix("data: ").unwrap_or(line);
                if let Ok(obj) = serde_json::from_str::<Value>(data) {
                    match obj["type"].as_str() {
                        Some("content_block_delta") => {
                            if let Some(t) = obj["delta"]["text"].as_str() {
                                let _ = tx.send(StreamEvent::Token(t.to_string())).await;
                            }
                        }
                        Some("content_block_start") => {
                            if obj["content_block"]["type"] == "tool_use" {
                                // tool use starts here — args will be in subsequent deltas
                            }
                        }
                        Some("message_stop") => { let _ = tx.send(StreamEvent::Done).await; }
                        _ => {}
                    }
                }
            }
            let _ = tx.send(StreamEvent::Done).await;
        });
        Ok(rx)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![
            "claude-opus-4-5".into(), "claude-sonnet-4-5".into(),
            "claude-haiku-3-5".into(), "claude-3-opus-20240229".into(),
        ])
    }
}
