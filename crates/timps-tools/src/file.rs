//! File tools: read_file, write_file, list_dir
use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use crate::{Tool, ToolResult};

// ── ReadFile ────────────────────────────────────────────────────────────────
pub struct ReadFileTool;

#[async_trait]
impl Tool for ReadFileTool {
    fn name(&self) -> &str { "read_file" }
    fn description(&self) -> &str { "Read the contents of a file at the given path." }
    fn schema(&self) -> Value {
        json!({
            "type": "function",
            "function": {
                "name": "read_file",
                "description": self.description(),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative file path" },
                        "start_line": { "type": "integer", "description": "First line to read (1-based, optional)" },
                        "end_line": { "type": "integer", "description": "Last line to read (1-based, optional)" }
                    },
                    "required": ["path"]
                }
            }
        })
    }

    async fn execute(&self, args: Value) -> ToolResult {
        let path = match args["path"].as_str() {
            Some(p) => p,
            None => return ToolResult::err("'path' is required"),
        };
        match fs::read_to_string(path) {
            Ok(content) => {
                let start = args["start_line"].as_u64().map(|n| (n as usize).saturating_sub(1));
                let end = args["end_line"].as_u64().map(|n| n as usize);
                if start.is_none() && end.is_none() {
                    return ToolResult::ok(content);
                }
                let lines: Vec<&str> = content.lines().collect();
                let from = start.unwrap_or(0);
                let to = end.unwrap_or(lines.len()).min(lines.len());
                ToolResult::ok(lines[from..to].join("\n"))
            }
            Err(e) => ToolResult::err(format!("Cannot read {path}: {e}")),
        }
    }
}

// ── WriteFile ───────────────────────────────────────────────────────────────
pub struct WriteFileTool;

#[async_trait]
impl Tool for WriteFileTool {
    fn name(&self) -> &str { "write_file" }
    fn description(&self) -> &str { "Write content to a file. Creates parent directories if needed." }
    fn schema(&self) -> Value {
        json!({
            "type": "function",
            "function": {
                "name": "write_file",
                "description": self.description(),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                }
            }
        })
    }

    async fn execute(&self, args: Value) -> ToolResult {
        let path = match args["path"].as_str() {
            Some(p) => p,
            None => return ToolResult::err("'path' is required"),
        };
        let content = match args["content"].as_str() {
            Some(c) => c,
            None => return ToolResult::err("'content' is required"),
        };
        if let Some(parent) = std::path::Path::new(path).parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                return ToolResult::err(format!("Cannot create dirs: {e}"));
            }
        }
        match fs::write(path, content) {
            Ok(_) => ToolResult::ok(format!("Written {} bytes to {path}", content.len())),
            Err(e) => ToolResult::err(format!("Cannot write {path}: {e}")),
        }
    }
}

// ── ListDir ─────────────────────────────────────────────────────────────────
pub struct ListDirTool;

#[async_trait]
impl Tool for ListDirTool {
    fn name(&self) -> &str { "list_dir" }
    fn description(&self) -> &str { "List files and directories at the given path." }
    fn schema(&self) -> Value {
        json!({
            "type": "function",
            "function": {
                "name": "list_dir",
                "description": self.description(),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Directory path" }
                    },
                    "required": ["path"]
                }
            }
        })
    }

    async fn execute(&self, args: Value) -> ToolResult {
        let path = match args["path"].as_str() {
            Some(p) => p,
            None => return ToolResult::err("'path' is required"),
        };
        match fs::read_dir(path) {
            Ok(entries) => {
                let mut names: Vec<String> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        if e.path().is_dir() { format!("{name}/") } else { name }
                    })
                    .collect();
                names.sort();
                ToolResult::ok(names.join("\n"))
            }
            Err(e) => ToolResult::err(format!("Cannot list {path}: {e}")),
        }
    }
}
