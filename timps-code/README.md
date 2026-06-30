# @timps-ai/timps-code

[![npm](https://img.shields.io/npm/v/@timps-ai/timps-code?color=brightgreen)](https://www.npmjs.com/package/@timps-ai/timps-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

**CLI coding agent with persistent memory across sessions.** 47 tools, 6 LLM providers, 22-layer memory, swarm mode, multimodal vision, and a self-improving agent loop.

```bash
npm install -g @timps-ai/timps-code
timps
```

## What it does

- **22-layer memory** — working, episodic, semantic, procedural + 18 forge layers (Chronos, Echo, HarmonicSheaf, Aether, EngramLog, Consolidation, SynapticPruner, Provenance, SpacedRepetition, ConstitutionalGuard, Audit, ProspectiveTrigger, BiasRevealer, ContextVector, Rehearsal, SchemaDistorter, ConfidenceCalibrator)
- **47 agent tools** — file ops (read/write/edit/patch/multi-edit/search/list), git (status/diff/log/commit/stash), shell (bash), web (search/fetch), reasoning (think/plan), MCP, todo, project info, diagnostics, browser automation, workflow pipeline, remote trigger, cron scheduling, team management
- **6 providers** — Ollama, OpenAI, Gemini, Claude, OpenRouter, hybrid fallback chain
- **Swarm** — 10 agent roles for multi-agent DAG execution
- **Self-improving agent** — tracks mistakes, builds prevention instructions, GRPO training data
- **Multimodal memory** — image embedding (Gemma 3 via Ollama), audio reference, diagram storage, terminal capture, cross-modal recall
- **LSP proxy** — wraps real language servers, injects contradiction + bug-pattern diagnostics
- **MCP client** — auto-discovers 15+ MCP servers (postgres, sqlite, redis, github, slack, sentry, puppeteer, etc.)
- **WASM sandbox** — install/uninstall plugins with permission enforcement
- **LLM key vault** — AES-256-GCM encrypted API key storage
- **Provider rate limiter** — per-provider sliding window, daily cap, automatic fallback
- **Keybinding-powered TUI** — Ink/React 19 terminal UI with streaming

## Install & Run

```bash
npm install -g @timps-ai/timps-code
timps                           # Interactive session
timps "add validation to api"   # One-shot
timps --provider ollama         # Specify provider
timps --config                  # Setup wizard
```

## Flags

`--provider`, `--model`, `--dir`, `--config`, `--branch`, `--merge`, `--tui`, `--war-room`, `--binary-synth`

## Slash Commands

`/help`, `/memory`, `/todo`, `/branch`, `/merge`, `/skills`, `/mcp`, `/git`, `/models`, `/doctor`, `/clear`, `/vision`, `/audio`, `/screenshot`, `/diagram`, `/terminal`, `/crossmodal`, `/audit`, `/improve`, `/config:encrypt-key`, `/auth:login`, `/limits:show`, and more.

## Architecture

```
User input → AgentLoop.run() → Agent (plan + execute)
  ├─ 47 tools (file, git, shell, web, MCP, memory, etc.)
  ├─ 22-layer memory (working → episodic → semantic → forged)
  ├─ 6 model providers with fallback
  └─ self-improving loop (mistake tracking → prevention injection)
```
