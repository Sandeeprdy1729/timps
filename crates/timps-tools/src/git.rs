//! Git tools: git_status, git_diff, git_log
use async_trait::async_trait;
use serde_json::{json, Value};
use std::process::Command;
use crate::{Tool, ToolResult};

fn git(args: &[&str], cwd: Option<&str>) -> ToolResult {
    let mut cmd = Command::new("git");
    cmd.args(args);
    if let Some(dir) = cwd { cmd.current_dir(dir); }
    match cmd.output() {
        Ok(o) => {
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            if o.status.success() { ToolResult::ok(out) }
            else { ToolResult::err(format!("{out}{err}")) }
        }
        Err(e) => ToolResult::err(format!("git error: {e}")),
    }
}

pub struct GitStatusTool;
#[async_trait]
impl Tool for GitStatusTool {
    fn name(&self) -> &str { "git_status" }
    fn description(&self) -> &str { "Show working tree status (modified, staged, untracked files)." }
    fn schema(&self) -> Value {
        json!({"type":"function","function":{"name":"git_status","description":self.description(),"parameters":{"type":"object","properties":{"cwd":{"type":"string"}},"required":[]}}})
    }
    async fn execute(&self, args: Value) -> ToolResult {
        git(&["status", "--short"], args["cwd"].as_str())
    }
}

pub struct GitDiffTool;
#[async_trait]
impl Tool for GitDiffTool {
    fn name(&self) -> &str { "git_diff" }
    fn description(&self) -> &str { "Show unstaged or staged diff. Pass staged:true for staged changes." }
    fn schema(&self) -> Value {
        json!({"type":"function","function":{"name":"git_diff","description":self.description(),"parameters":{"type":"object","properties":{"staged":{"type":"boolean"},"file":{"type":"string"},"cwd":{"type":"string"}},"required":[]}}})
    }
    async fn execute(&self, args: Value) -> ToolResult {
        let mut git_args = vec!["diff"];
        if args["staged"].as_bool().unwrap_or(false) { git_args.push("--staged"); }
        if let Some(f) = args["file"].as_str() { git_args.push(f); }
        git(&git_args, args["cwd"].as_str())
    }
}

pub struct GitLogTool;
#[async_trait]
impl Tool for GitLogTool {
    fn name(&self) -> &str { "git_log" }
    fn description(&self) -> &str { "Show recent git commit log. n=number of commits (default 10)." }
    fn schema(&self) -> Value {
        json!({"type":"function","function":{"name":"git_log","description":self.description(),"parameters":{"type":"object","properties":{"n":{"type":"integer"},"cwd":{"type":"string"}},"required":[]}}})
    }
    async fn execute(&self, args: Value) -> ToolResult {
        let n = args["n"].as_u64().unwrap_or(10);
        let n_str = format!("-{n}");
        git(&["log", "--oneline", &n_str], args["cwd"].as_str())
    }
}
