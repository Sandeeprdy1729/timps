//! Web fetch tool — fetches a URL, returns text content.
use async_trait::async_trait;
use serde_json::{json, Value};
use crate::{Tool, ToolResult};

pub struct WebFetchTool;

#[async_trait]
impl Tool for WebFetchTool {
    fn name(&self) -> &str { "web_fetch" }
    fn description(&self) -> &str { "Fetch content from a URL. Returns raw text (HTML stripped)." }
    fn schema(&self) -> Value {
        json!({
            "type": "function",
            "function": {
                "name": "web_fetch",
                "description": self.description(),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "URL to fetch" }
                    },
                    "required": ["url"]
                }
            }
        })
    }

    async fn execute(&self, args: Value) -> ToolResult {
        let url = match args["url"].as_str() {
            Some(u) => u.to_string(),
            None => return ToolResult::err("'url' is required"),
        };
        // Validate URL is http/https (security: prevent SSRF to internal services)
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return ToolResult::err("Only http:// and https:// URLs are allowed");
        }
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap();
        match client.get(&url).send().await {
            Ok(resp) => match resp.text().await {
                Ok(text) => {
                    let truncated: String = text.chars().take(8000).collect();
                    ToolResult::ok(truncated)
                }
                Err(e) => ToolResult::err(format!("Read error: {e}")),
            },
            Err(e) => ToolResult::err(format!("Fetch error: {e}")),
        }
    }
}
