---
slug: /
sidebar_position: 1
---

# Introduction

**TIMPS** is a persistent cognitive partner that remembers, evolves, and builds with you across every session.

Unlike stateless AI assistants, TIMPS maintains a **3-layer memory system** that survives process restarts, accumulates project knowledge, and surfaces relevant context exactly when you need it.

## What makes TIMPS different?

| Feature | TIMPS | Stateless AI |
|---|---|---|
| Remembers past sessions | ✅ | ❌ |
| Learns project patterns | ✅ | ❌ |
| Detects contradictions | ✅ | ❌ |
| Works offline (Ollama) | ✅ | ❌ |
| Skill extensibility | ✅ | ❌ |

## Packages

The TIMPS ecosystem has four packages:

| Package | Install | Purpose |
|---|---|---|
| `timps-code` | `npm install -g timps-code` | CLI coding agent |
| `timps-mcp` | `npm install -g timps-mcp` | MCP server (Claude Code, Cursor, Windsurf) |
| `@timps/memory-core` | `npm install @timps/memory-core` | Standalone memory engine |
| `timps-ai-coding-agent` | VS Code Marketplace | VS Code extension |

## Quickstart

```bash
# Install the CLI agent
npm install -g timps-code

# Start in your project
cd my-project
timps
```

See [Installation](./getting-started/installation) for full setup instructions.
