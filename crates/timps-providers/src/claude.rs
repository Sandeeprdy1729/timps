//! Anthropic Claude provider (messages API with SSE).
use anyhow::Result;
use async_trait::async_trait;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_util::io::StreamReader;
use tokio::io::AsyncBufReadExt;
use crate::{Message, Provider, ProviderStream, Role, StreamEvent, ToolCall};

struct PendingTool {
    id: String,
    name: String,
    args_buf: String,
}

pub struct ClaudeProvider { api_key: String, model: String }

impl ClaudeProvider {
    pub fn from_env() -> Self {
        Self {
            api_key: std::env::var("ANTHROPIC_API_KEY").unwrap_or_default(),
            model: std::env::var("CLAUDE_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-5".to_string()),
        }
    }

    /// Convert internal messages to Anthropic API format.
    ///
    /// Tool results must be `user` messages with `tool_result` content blocks.
    /// Since the `Message` type lacks `tool_use_id`, we assign sequential
    /// placeholder IDs so the API accepts the turn.
    fn to_claude_messages(messages: &[Message]) -> Vec<Value> {
        let mut idx = 0u32;
        messages.iter()
            .filter(|m| m.role != Role::System)
            .map(|m| match m.role {
                Role::User => json!({ "role": "user", "content": m.content }),
                Role::Assistant => json!({ "role": "assistant", "content": m.content }),
                Role::Tool => {
                    idx += 1;
                    json!({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": format!("toolu_placeholder_{idx}"),
                            "content": m.content,
                        }]
                    })
                }
                Role::System => unreachable!(), // filtered above
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

            // Check HTTP status before reading body.
            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_default();
                let detail = json!({ "status": status.as_u16(), "body": text });
                let _ = tx.send(StreamEvent::Error(detail.to_string())).await;
                let _ = tx.send(StreamEvent::Done).await;
                return;
            }

            // Stream SSE via line-delimited chunks.
            let byte_stream = resp.bytes_stream().map(|r| r.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)));
            let reader = StreamReader::new(byte_stream);
            let mut lines = reader.lines();

            let mut pending: Option<PendingTool> = None;

            loop {
                let line = match lines.next_line().await {
                    Ok(Some(l)) => l,
                    Ok(None) => break,
                    Err(e) => { let _ = tx.send(StreamEvent::Error(e.to_string())).await; break; }
                };

                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                let data = match line.strip_prefix("data: ") {
                    Some(d) => d.to_string(),
                    None => continue,
                };

                let obj: Value = match serde_json::from_str(&data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                match obj["type"].as_str() {
                    Some("content_block_start") => {
                        if obj["content_block"]["type"] == "tool_use" {
                            pending = Some(PendingTool {
                                id: obj["content_block"]["id"].as_str().unwrap_or("").to_string(),
                                name: obj["content_block"]["name"].as_str().unwrap_or("").to_string(),
                                args_buf: String::new(),
                            });
                        }
                    }
                    Some("content_block_delta") => {
                        if let Some(t) = obj["delta"]["text"].as_str() {
                            let _ = tx.send(StreamEvent::Token(t.to_string())).await;
                        }
                        if let Some(json_str) = obj["delta"]["input_json_delta"].as_str() {
                            if let Some(ref mut p) = pending {
                                p.args_buf.push_str(json_str);
                            }
                        }
                    }
                    Some("content_block_stop") => {
                        if let Some(p) = pending.take() {
                            let args: Value = serde_json::from_str(&p.args_buf).unwrap_or(Value::Null);
                            let _ = tx.send(StreamEvent::ToolCall(ToolCall {
                                id: p.id,
                                name: p.name,
                                args,
                            })).await;
                        }
                    }
                    Some("message_stop") => {
                        let _ = tx.send(StreamEvent::Done).await;
                        return;
                    }
                    Some("error") => {
                        let msg = obj["error"]["message"].as_str().unwrap_or("unknown error");
                        let _ = tx.send(StreamEvent::Error(msg.to_string())).await;
                        let _ = tx.send(StreamEvent::Done).await;
                        return;
                    }
                    _ => {}
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
