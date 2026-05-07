//! Memory tools exposed to the agent — store_memory, get_memory, search_memory.
use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use crate::{Tool, ToolResult};
use timps_memory::{MemoryStore, SemanticEntry};

pub struct StoreMemoryTool(pub Arc<MemoryStore>);
pub struct GetMemoryTool(pub Arc<MemoryStore>);

#[async_trait]
impl Tool for StoreMemoryTool {
    fn name(&self) -> &str { "store_memory" }
    fn description(&self) -> &str { "Permanently store a fact across sessions. key=short identifier, value=the fact." }
    fn schema(&self) -> Value {
        json!({"type":"function","function":{"name":"store_memory","description":self.description(),"parameters":{"type":"object","properties":{"key":{"type":"string"},"value":{"type":"string"},"importance":{"type":"number","description":"0.0-1.0"},"tags":{"type":"array","items":{"type":"string"}}},"required":["key","value"]}}})
    }
    async fn execute(&self, args: Value) -> ToolResult {
        let key = match args["key"].as_str() { Some(k) => k.to_string(), None => return ToolResult::err("key required") };
        let value = match args["value"].as_str() { Some(v) => v.to_string(), None => return ToolResult::err("value required") };
        let importance = args["importance"].as_f64().unwrap_or(0.5) as f32;
        let tags = args["tags"].as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        match self.0.store_semantic(SemanticEntry { key: key.clone(), value, importance, tags }).await {
            Ok(_) => ToolResult::ok(format!("Memory stored: {key}")),
            Err(e) => ToolResult::err(format!("Failed: {e}")),
        }
    }
}

#[async_trait]
impl Tool for GetMemoryTool {
    fn name(&self) -> &str { "get_memory" }
    fn description(&self) -> &str { "Search stored memories. Returns matching semantic entries." }
    fn schema(&self) -> Value {
        json!({"type":"function","function":{"name":"get_memory","description":self.description(),"parameters":{"type":"object","properties":{"query":{"type":"string"},"limit":{"type":"integer"}},"required":["query"]}}})
    }
    async fn execute(&self, args: Value) -> ToolResult {
        let query = match args["query"].as_str() { Some(q) => q, None => return ToolResult::err("query required") };
        let limit = args["limit"].as_u64().unwrap_or(10) as usize;
        match self.0.search_relevant(query, limit).await {
            Ok(entries) => {
                if entries.is_empty() { return ToolResult::ok("No matching memories found."); }
                let out = entries.iter()
                    .map(|e| format!("[{}] {} (importance: {:.1})", e.key, e.value, e.importance))
                    .collect::<Vec<_>>().join("\n");
                ToolResult::ok(out)
            }
            Err(e) => ToolResult::err(format!("Search failed: {e}")),
        }
    }
}
