//! timps-tools — built-in tool implementations for the TIMPS Rust agent.
//! Mirrors the TypeScript tools in timps-code/src/tools/ but in Rust.
//! Each tool implements the `Tool` trait and is registered in `ToolRegistry`.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

pub mod shell;
pub mod file;
pub mod git;
pub mod web;
pub mod memory_tool;

// ── Core types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub is_error: bool,
    pub content: String,
}

impl ToolResult {
    pub fn ok(content: impl Into<String>) -> Self {
        Self { is_error: false, content: content.into() }
    }
    pub fn err(content: impl Into<String>) -> Self {
        Self { is_error: true, content: content.into() }
    }
}

// ── Tool trait ──────────────────────────────────────────────────────────────

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn schema(&self) -> Value;
    async fn execute(&self, args: Value) -> ToolResult;
}

// ── ToolRegistry ───────────────────────────────────────────────────────────

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: HashMap::new() }
    }

    /// Register all built-in tools
    pub fn with_builtins() -> Self {
        let mut r = Self::new();
        r.register(Arc::new(shell::ShellTool));
        r.register(Arc::new(file::ReadFileTool));
        r.register(Arc::new(file::WriteFileTool));
        r.register(Arc::new(file::ListDirTool));
        r.register(Arc::new(git::GitStatusTool));
        r.register(Arc::new(git::GitDiffTool));
        r.register(Arc::new(git::GitLogTool));
        r.register(Arc::new(web::WebFetchTool));
        r
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(name).cloned()
    }

    pub fn all(&self) -> Vec<Arc<dyn Tool>> {
        self.tools.values().cloned().collect()
    }

    pub fn schemas(&self) -> Vec<Value> {
        self.tools.values().map(|t| t.schema()).collect()
    }
}
