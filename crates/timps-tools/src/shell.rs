//! Shell execution tool — runs arbitrary commands in the project directory.
use async_trait::async_trait;
use serde_json::{json, Value};
use std::process::Command;
use crate::{Tool, ToolResult};

pub struct ShellTool;

#[async_trait]
impl Tool for ShellTool {
    fn name(&self) -> &str { "shell" }
    fn description(&self) -> &str {
        "Execute a shell command. Returns stdout + stderr combined. Use for npm, cargo, git, tests, etc."
    }
    fn schema(&self) -> Value {
        json!({
            "type": "function",
            "function": {
                "name": "shell",
                "description": self.description(),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cmd": { "type": "string", "description": "Shell command to run" },
                        "cwd": { "type": "string", "description": "Working directory (optional)" }
                    },
                    "required": ["cmd"]
                }
            }
        })
    }

    async fn execute(&self, args: Value) -> ToolResult {
        let cmd = match args["cmd"].as_str() {
            Some(c) => c.to_string(),
            None => return ToolResult::err("'cmd' argument is required"),
        };
        let cwd = args["cwd"].as_str();

        // Basic command injection prevention: reject shell metacharacters
        // that could be used for command chaining
        let dangerous_chars = [';', '`', '$', '|', '&', '\n', '\r'];
        if cmd.chars().any(|c| dangerous_chars.contains(&c)) {
            return ToolResult::err("Command contains dangerous shell metacharacters");
        }

        let mut builder = Command::new("sh");
        builder.arg("-c").arg(&cmd);
        if let Some(dir) = cwd {
            builder.current_dir(dir);
        }

        match builder.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let combined = if stderr.is_empty() { stdout } else { format!("{stdout}{stderr}") };
                if output.status.success() {
                    ToolResult::ok(combined)
                } else {
                    ToolResult::err(format!("Exit {}: {}", output.status.code().unwrap_or(-1), combined))
                }
            }
            Err(e) => ToolResult::err(format!("Failed to run command: {e}")),
        }
    }
}
