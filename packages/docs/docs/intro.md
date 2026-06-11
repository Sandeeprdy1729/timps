---
sidebar_position: 1
slug: /
---

# TIMPS — The AI Coding Agent That Remembers

TIMPS is an open-source AI coding agent with **persistent memory** across sessions.

Unlike ChatGPT or Cursor, TIMPS **remembers** what you've told it — across sessions, projects, and restarts.

## Key Features

| Feature | Details |
|---------|---------|
| **9-layer memory** | Working + Episodic + Semantic + Procedural + ChronosForge + ResonanceForge + EchoForge + SynapseQuench + HarmonicSheafWeaver |
| **15+ LLM providers** | Ollama, Claude, OpenAI, Gemini, Groq, Mistral, and more |
| **Plugin system** | Install community plugins, create your own |
| **Recipes** | Multi-step YAML workflows (code review, deploy check, debug) |
| **Desktop app** | Tauri + React memory cockpit with chat UI |
| **MCP server** | 20+ tools compatible with Claude Desktop, Cursor |
| **Eval harness** | Benchmark quality across providers |

## Packages

```
timps-code     — CLI coding agent (npm install -g timps-code)
timps-mcp      — MCP server (memory tools for Claude Desktop)
timps-vscode   — VS Code extension
plugin-sdk     — Build your own TIMPS plugins
```

## Quick Example

```bash
# Install
npm install -g timps-code

# Run (uses Ollama locally by default)
timps "Refactor my auth module to use JWT"

# With Claude
ANTHROPIC_API_KEY=... timps --provider claude "Review the PR diff"

# Run a recipe
timps run workflow_recipes/code-review.yaml
```

## How Memory Works

TIMPS stores three types of memory per project (scoped by SHA-256 project path hash):

1. **Working memory** (`working.json`) — current session goals, active files, recent errors
2. **Episodic memory** (`episodes.jsonl`) — log of past tasks and outcomes
3. **Semantic memory** (`semantic.json`) — long-term facts (API keys locations, patterns, preferences)

Before each LLM call, relevant semantic memories are injected into the system prompt — so TIMPS always has context.
