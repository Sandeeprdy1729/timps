---
sidebar_position: 1
---

# VS Code Extension Overview

The **TIMPS — AI Coding Agent** extension brings the full TIMPS experience into VS Code.

## Features

- **Chat panel** — full agent chat powered by your configured model
- **Memory Layers view** — live tree view of working, episodic, and semantic memory
- **Skills support** — installed skills from `~/.timps/skills/` are loaded automatically
- **Remote server** — optionally connects to a `timps` server for shared team memory

## Installation

Search for **"TIMPS — AI Coding Agent"** in the Extensions Marketplace, or:

```bash
code --install-extension TIMPs.timps-ai-coding-agent
```

## Activity bar

The TIMPS activity bar icon opens a sidebar with three views:

1. **Chat** — talk to the agent
2. **Memory Layers** — browse the 3-layer memory tree
3. **Memory Graph** — (coming in Phase 5) sigma.js knowledge graph

## Configuration

Set in VS Code settings (`Ctrl+,` / `Cmd+,`):

| Setting | Default | Description |
|---|---|---|
| `timps.model` | `claude-3-5-sonnet-20241022` | Model to use |
| `timps.serverUrl` | — | Remote server URL |
| `timps.serverToken` | — | Auth token |
