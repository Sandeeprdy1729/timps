//! Shared OpenAI-compatible REST helper used by OpenAI, Groq, Mistral, Together, DeepSeek, Perplexity.

use anyhow::Result;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;
use tokio_util::io::StreamReader;
use crate::{Message, Role, StreamEvent, ToolCall};

#[derive(Default)]
struct ToolCallDelta {
    id: String,
    name: String,
    args: String,
}

pub struct OpenAICompat {
    pub client: Client,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    /// Optional query parameters appended to the URL (e.g. api-version for Azure)
    pub query_params: Vec<(String, String)>,
    /// Custom auth header value instead of `Authorization: Bearer <key>` (e.g. "api-key" for Azure)
    pub auth_header: Option<String>,
}

impl OpenAICompat {
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
            api_key: api_key.into(),
            model: model.into(),
            query_params: vec![],
            auth_header: None,
        }
    }

    /// Builder-style: set query parameters.
    pub fn with_query(mut self, params: Vec<(String, String)>) -> Self {
        self.query_params = params;
        self
    }

    /// Builder-style: use a custom auth header name instead of `Authorization: Bearer`.
    pub fn with_auth_header(mut self, header: impl Into<String>) -> Self {
        self.auth_header = Some(header.into());
        self
    }

    fn messages_to_json(system: &str, messages: &[Message]) -> Vec<Value> {
        let mut out = vec![json!({ "role": "system", "content": system })];
        for m in messages {
            match m.role {
                Role::User => out.push(json!({ "role": "user", "content": m.content })),
                Role::Assistant => {
                    let mut msg = json!({ "role": "assistant", "content": m.content });
                    if let Some(tcs) = &m.tool_calls {
                        if !tcs.is_empty() {
                            msg["tool_calls"] = json!(tcs.iter().map(|tc| {
                                json!({
                                    "id": tc.id,
                                    "type": "function",
                                    "function": {
                                        "name": tc.name,
                                        "arguments": tc.args.to_string(),
                                    }
                                })
                            }).collect::<Vec<_>>());
                        }
                    }
                    out.push(msg);
                }
                Role::System => out.push(json!({ "role": "system", "content": m.content })),
                Role::Tool => {
                    let mut msg = json!({ "role": "tool", "content": m.content });
                    if let Some(id) = &m.tool_call_id {
                        msg["tool_call_id"] = json!(id);
                    }
                    out.push(msg);
                }
            };
        }
        out
    }

    /// Fetch available model IDs from the provider's `/models` endpoint.
    /// Returns an empty Vec on failure so callers fall back gracefully.
    pub async fn fetch_models(&self) -> Vec<String> {
        let mut req = self.client.get(format!("{}/models", self.base_url));
        if let Some(header) = &self.auth_header {
            req = req.header(header, &self.api_key);
        } else {
            req = req.bearer_auth(&self.api_key);
        }
        if !self.query_params.is_empty() {
            req = req.query(&self.query_params);
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(_) => return vec![],
        };
        let json: Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return vec![],
        };
        json["data"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|m| m["id"].as_str().map(String::from))
            .collect()
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

        let mut req = self.client
            .post(format!("{}/chat/completions", self.base_url));

        if let Some(header) = &self.auth_header {
            req = req.header(header, &self.api_key);
        } else {
            req = req.bearer_auth(&self.api_key);
        }

        if !self.query_params.is_empty() {
            req = req.query(&self.query_params);
        }

        let resp = req.json(&body).send().await?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            let _ = tx.send(StreamEvent::Error(err)).await;
            return Ok(());
        }

        // Stream SSE line-by-line for true real-time token delivery
        let byte_stream = resp.bytes_stream().map(|r| {
            r.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        });
        let reader = StreamReader::new(byte_stream);
        let mut lines = BufReader::new(reader).lines();
        let mut tool_calls: Vec<ToolCallDelta> = Vec::new();

        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    let line = line.trim();
                    if line.is_empty() || line == "data: [DONE]" { continue; }
                    let data = match line.strip_prefix("data: ") {
                        Some(d) => d,
                        None => continue,
                    };
                    let obj: Value = match serde_json::from_str(data) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if let Some(choices) = obj["choices"].as_array() {
                        for choice in choices {
                            let delta = &choice["delta"];
                            if let Some(content) = delta["content"].as_str() {
                                if !content.is_empty() {
                                    let _ = tx.send(StreamEvent::Token(content.to_string())).await;
                                }
                            }
                            if let Some(tcs) = delta["tool_calls"].as_array() {
                                for tc in tcs {
                                    let index = tc["index"].as_u64().unwrap_or(0) as usize;
                                    let id = tc["id"].as_str().unwrap_or("").to_string();
                                    let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                                    let args_delta = tc["function"]["arguments"].as_str().unwrap_or("");

                                    if index >= tool_calls.len() {
                                        tool_calls.resize_with(index + 1, || ToolCallDelta {
                                            id: String::new(),
                                            name: String::new(),
                                            args: String::new(),
                                        });
                                    }

                                    let call = &mut tool_calls[index];
                                    if !id.is_empty() { call.id = id; }
                                    if !name.is_empty() { call.name = name; }
                                    if !args_delta.is_empty() { call.args.push_str(args_delta); }
                                }
                            }
                        }
                    }
                }
                Ok(None) => break,
                Err(e) => {
                    let _ = tx.send(StreamEvent::Error(e.to_string())).await;
                    break;
                }
            }
        }

        for call in tool_calls {
            if !call.name.is_empty() {
                let args: Value = serde_json::from_str(&call.args).unwrap_or(json!({}));
                let _ = tx.send(StreamEvent::ToolCall(ToolCall { id: call.id, name: call.name, args })).await;
            }
        }
        let _ = tx.send(StreamEvent::Done).await;
        Ok(())
    }
}
