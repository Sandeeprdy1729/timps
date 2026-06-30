# TIMPS — AI Coding Agent with Persistent Memory (VS Code)

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Install-blue)](https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

22-layer persistent memory for VS Code. Chat with AI (Ollama/OpenAI/Gemini), memory-aware autocomplete, contradiction detection, NexusForge knowledge graph, Chronos Veil causal tracking, and SynapseMetabolon memory consolidation.

## Features

- **Chat panel** — streaming AI chat with session history, file context, and memory
- **Memory-aware autocomplete** — completions informed by project history and patterns
- **Contradiction detection** — inline warnings when edits contradict stored memories
- **Memory panel** — view relevant memories for the current file
- **Memory explorer** — NexusForge knowledge graph visualization, 9-layer TreeView
- **Edit watcher** — auto-records file changes as episodic memories
- **LSP integration** — proxy wraps real language servers, injects TIMPS diagnostics
- **NexusForge + Chronos Veil + SynapseMetabolon** — knowledge graph exploration and causal tracking

## Quick Start

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent)
2. `Cmd+Shift+T` → Chat | `Cmd+Shift+M` → Memory Panel | `Cmd+Shift+R` → Recall

## Commands (`Cmd+Shift+P`)

`TIMPS: Open Chat`, `TIMPS: Open Memory Panel`, `TIMPS: Recall`, `TIMPS: Ask About Selection`, `TIMPS: Explain Code`, `TIMPS: Fix Code`, `TIMPS: Generate Tests`, `TIMPS: Toggle LSP`, `TIMPS: Memory Stats`

## Settings

`timps.provider`, `timps.model`, `timps.serverUrl`, `timps.token`, `timps.enableAutocomplete`, `timps.enableWatcher`, `timps.enableContradictionCheck`, `timps.ollamaUrl`, `timps.lsp.*`
