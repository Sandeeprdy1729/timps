//! timps-agent — Core agent loop for TIMPS.
//!
//! Orchestrates: provider (LLM calls) + tools (execution) + memory (context injection).
//! This is the hot path that replaces the TypeScript agent loop in timps-code/src/core/agent.ts.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;

pub mod recipes;
pub mod acp;

pub use timps_memory::{MemoryStore, SemanticEntry, EpisodicEntry};
pub use timps_providers::{Provider, Message, Role, ProviderStream};
pub use timps_tools::{Tool, ToolCall, ToolResult};

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOptions {
    /// Max tool-call retries on failure
    pub max_retries: u8,
    /// Max loop iterations for the agent (prevents infinite loops)
    pub max_iterations: u32,
    /// Inject relevant semantic memories before each turn
    pub inject_memory: bool,
    /// Max semantic entries to inject
    pub memory_context_limit: usize,
    /// System prompt prefix
    pub system_prompt: Option<String>,
}

impl Default for AgentOptions {
    fn default() -> Self {
        Self {
            max_retries: 3,
            max_iterations: 25,
            inject_memory: true,
            memory_context_limit: 10,
            system_prompt: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnResult {
    pub output: String,
    pub tool_calls_made: usize,
    pub memories_injected: usize,
    pub retries: u8,
}

/// Events streamed back to the caller during a turn.
#[derive(Debug, Clone)]
pub enum AgentEvent {
    Token(String),
    ToolCallStart { name: String },
    ToolCallEnd { name: String, result: ToolResult },
    MemoryInjected { count: usize },
    TurnComplete(TurnResult),
    Error(String),
}

// ── Agent ──────────────────────────────────────────────────────────────────

pub struct Agent {
    provider: Arc<dyn Provider>,
    tools: Vec<Arc<dyn Tool>>,
    memory: Arc<MemoryStore>,
    opts: AgentOptions,
}

impl Agent {
    pub fn new(
        provider: Arc<dyn Provider>,
        tools: Vec<Arc<dyn Tool>>,
        memory: Arc<MemoryStore>,
        opts: AgentOptions,
    ) -> Self {
        Self { provider, tools, memory, opts }
    }

    /// Build the system prompt, optionally injecting relevant memories.
    async fn build_system_prompt(&self, task: &str) -> Result<String> {
        let base = self.opts.system_prompt.clone().unwrap_or_else(|| {
            "You are TIMPS, an AI coding agent with persistent memory. \
             You remember past sessions, patterns, and user preferences. \
             Use the available tools to complete tasks precisely."
                .to_string()
        });

        if !self.opts.inject_memory {
            return Ok(base);
        }

        let entries = self.memory.search_relevant(task, self.opts.memory_context_limit).await?;
        if entries.is_empty() {
            return Ok(base);
        }

        let mem_block = entries
            .iter()
            .map(|e| format!("- [{}] {}", e.key, e.value))
            .collect::<Vec<_>>()
            .join("\n");

        Ok(format!("{base}\n\n## Relevant memories from past sessions:\n{mem_block}"))
    }

    /// Build tool schemas for the LLM.
    fn tool_schemas(&self) -> Vec<serde_json::Value> {
        self.tools.iter().map(|t| t.schema()).collect()
    }

    /// Execute a single tool call and return the result.
    async fn execute_tool(&self, call: &ToolCall) -> ToolResult {
        match self.tools.iter().find(|t| t.name() == call.name) {
            None => ToolResult {
                is_error: true,
                content: format!("Unknown tool: {}", call.name),
            },
            Some(tool) => {
                tool.execute(call.args.clone()).await
            }
        }
    }

    /// Run one agent turn: prompt → LLM → tool calls → final answer.
    /// Streams events through `tx`.
    pub async fn run(
        &self,
        user_input: &str,
        history: Vec<Message>,
        tx: mpsc::Sender<AgentEvent>,
    ) -> Result<TurnResult> {
        let system = self.build_system_prompt(user_input).await?;
        let mem_count = if self.opts.inject_memory {
            self.memory.search_relevant(user_input, self.opts.memory_context_limit)
                .await.map(|v| v.len()).unwrap_or(0)
        } else { 0 };

        let _ = tx.send(AgentEvent::MemoryInjected { count: mem_count }).await;

        let mut messages = history;
        messages.push(Message { role: Role::User, content: user_input.to_string() });

        let mut tool_calls_total = 0;
        let mut retries = 0u8;
        let mut final_output = String::new();
        let mut iterations = 0u32;

        loop {
            iterations += 1;
            if iterations > self.opts.max_iterations {
                final_output = format!("Agent stopped after {} iterations (max: {})", iterations - 1, self.opts.max_iterations);
                break;
            }
            let tools = self.tool_schemas();
            let mut stream = self.provider.complete(&system, &messages, &tools).await?;

            let mut assistant_text = String::new();
            let mut pending_tool_calls: Vec<ToolCall> = vec![];

            // Drain the provider stream
            while let Some(event) = stream.recv().await {
                match event {
                    timps_providers::StreamEvent::Token(t) => {
                        let _ = tx.send(AgentEvent::Token(t.clone())).await;
                        assistant_text.push_str(&t);
                    }
                    timps_providers::StreamEvent::ToolCall(tc) => {
                        pending_tool_calls.push(ToolCall { id: tc.id, name: tc.name, args: tc.args });
                    }
                    timps_providers::StreamEvent::Done => break,
                    timps_providers::StreamEvent::Error(e) => {
                        let _ = tx.send(AgentEvent::Error(e.clone())).await;
                        if retries < self.opts.max_retries {
                            retries += 1;
                            continue;
                        }
                        return Err(anyhow::anyhow!(e));
                    }
                }
            }

            // If no tool calls, we're done
            if pending_tool_calls.is_empty() {
                final_output = assistant_text.clone();
                break;
            }

            // Execute tool calls
            messages.push(Message {
                role: Role::Assistant,
                content: assistant_text,
            });

            for tc in &pending_tool_calls {
                let _ = tx.send(AgentEvent::ToolCallStart { name: tc.name.clone() }).await;
                let result = self.execute_tool(tc).await;
                let _ = tx.send(AgentEvent::ToolCallEnd {
                    name: tc.name.clone(),
                    result: result.clone(),
                }).await;
                tool_calls_total += 1;

                // Feed result back into messages
                messages.push(Message {
                    role: Role::Tool,
                    content: serde_json::to_string(&result).unwrap_or_default(),
                });

                // Store episode on tool failure (memory moat)
                if result.is_error {
                    let _ = self.memory.append_episode(EpisodicEntry {
                        task: format!("tool:{}", tc.name),
                        outcome: "failed".to_string(),
                        summary: result.content.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    }).await;
                }
            }
        }

        // Store successful episode
        let _ = self.memory.append_episode(EpisodicEntry {
            task: user_input.to_string(),
            outcome: "success".to_string(),
            summary: final_output.chars().take(200).collect(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).await;

        let result = TurnResult {
            output: final_output,
            tool_calls_made: tool_calls_total,
            memories_injected: mem_count,
            retries,
        };
        let _ = tx.send(AgentEvent::TurnComplete(result.clone())).await;
        Ok(result)
    }
}

// ── AgentBuilder ───────────────────────────────────────────────────────────

pub struct AgentBuilder {
    provider: Option<Arc<dyn Provider>>,
    tools: Vec<Arc<dyn Tool>>,
    memory: Option<Arc<MemoryStore>>,
    opts: AgentOptions,
}

impl AgentBuilder {
    pub fn new() -> Self {
        Self {
            provider: None,
            tools: vec![],
            memory: None,
            opts: AgentOptions::default(),
        }
    }

    pub fn provider(mut self, p: Arc<dyn Provider>) -> Self {
        self.provider = Some(p); self
    }

    pub fn tool(mut self, t: Arc<dyn Tool>) -> Self {
        self.tools.push(t); self
    }

    pub fn memory(mut self, m: Arc<MemoryStore>) -> Self {
        self.memory = Some(m); self
    }

    pub fn opts(mut self, o: AgentOptions) -> Self {
        self.opts = o; self
    }

    pub fn build(self) -> Result<Agent> {
        Ok(Agent::new(
            self.provider.ok_or_else(|| anyhow::anyhow!("provider required"))?,
            self.tools,
            self.memory.ok_or_else(|| anyhow::anyhow!("memory required"))?,
            self.opts,
        ))
    }
}
