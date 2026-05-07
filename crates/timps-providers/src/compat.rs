//! Shared OpenAI-compatible REST helper used by OpenAI, Groq, Mistral, Together, DeepSeek, Perplexity.

use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use crate::{Message, Role, StreamEvent, ToolCall};

pub struct OpenAICompat {
    pub client: Client,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl OpenAICompat {
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
            api_key: api_key.into(),
            model: model.into(),
        }
    }

    fn messages_to_json(system: &str, messages: &[Message]) -> Vec<Value> {
        let mut out = vec![json!({ "role": "system", "content": system })];
        for m in messages {
            let role = match m.role {
                Role::User => "user",
                Role::Assistant => "assistant",
                Role::Tool => "tool",
                Role::System => "system",
            };
            out.push(json!({ "role": role, "content": m.content }));
        }
        out
    }

    pub async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Value],
        tx: mpsc::Sender<StreamEvent>,
    ) -> Result<()> {
        let mut body = json!({
            "model": self.model,
            "messages": Self::messages_to_json(system, messages),
            "stream": true,
        });

        if !tools.is_empty() {
            body["tools"] = json!(tools);
        }

        let resp = self.client
            .post(format!("{}/chat/completions", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            let _ = tx.send(StreamEvent::Error(err)).await;
            return Ok(());
        }

        // Parse SSE stream
        let text = resp.text().await?;
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line == "data: [DONE]" { continue; }
            let data = line.strip_prefix("data: ").unwrap_or(line);
            if let Ok(obj) = serde_json::from_str::<Value>(data) {
                if let Some(choices) = obj["choices"].as_array() {
                    for choice in choices {
                        let delta = &choice["delta"];
                        if let Some(content) = delta["content"].as_str() {
                            if !content.is_empty() {
                                let _ = tx.send(StreamEvent::Token(content.to_string())).await;
                            }
                        }
                        // Tool calls
                        if let Some(tcs) = delta["tool_calls"].as_array() {
                            for tc in tcs {
                                let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                                let args_str = tc["function"]["arguments"].as_str().unwrap_or("{}");
                                let args: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                                let id = tc["id"].as_str().unwrap_or("").to_string();
                                let _ = tx.send(StreamEvent::ToolCall(ToolCall { id, name, args })).await;
                            }
                        }
                    }
                }
            }
        }
        let _ = tx.send(StreamEvent::Done).await;
        Ok(())
    }
}
