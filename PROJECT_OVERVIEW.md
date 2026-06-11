# TIMPS — The Complete Project Guide

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [What is TIMPS?](#2-what-is-timps)
3. [Core Features](#3-core-features)
4. [Project Structure](#4-project-structure)
5. [Component Details](#5-component-details)
6. [Getting Started](#6-getting-started)
7. [Installation & Setup](#7-installation--setup)
8. [How It Works](#8-how-it-works)
9. [Memory System](#9-memory-system)
10. [Tools & Capabilities](#10-tools--capabilities)
11. [Configuration](#11-configuration)
12. [Usage Examples](#12-usage-examples)
13. [Troubleshooting](#13-troubleshooting)
14. [Development](#14-development)

---

## 1. Project Overview

| Attribute | Details |
|-----------|---------|
| **Project Name** | TIMPS |
| **Full Name** | The AI Coding Agent That Remembers |
| **Version** | 1.0.3 |
| **License** | MIT |
| **Language** | TypeScript (~45,500 LOC) |
| **Repository** | https://github.com/Sandeeprdy1729/timps |
| **npm Packages** | timps-code, timps-mcp, timps (sandeep-ai) |
| **Node Version** | >=18.0.0 |

---

## 2. What is TIMPS?

TIMPS is an AI coding agent that combines the power of Large Language Models (LLMs) with persistent memory that survives across sessions. Unlike Claude Code or Cursor which forget everything when you close them, TIMPS remembers your patterns, conventions, and decisions forever.

**Key Problem it Solves:**
> Claude Code forgets everything when you close it. TIMPS remembers — forever.

**Primary Use Cases:**
- AI-assisted coding with persistent memory
- Building project-specific intelligence over time
- Self-correcting agent that learns from its mistakes
- Running 100% locally (free) with Ollama
- Integration with Claude/Cursor/Windsurf via MCP

---

## 3. Core Features

### 3.1 Three-Layer Persistent Memory
- **Working Memory**: Current session goals, active files, recent errors
- **Episodic Memory**: Conversation summaries persisted to disk
- **Semantic Memory**: Permanent facts, patterns, conventions

### 3.2 Multiple Provider Support
- **Ollama** (free, local, default)
- **Claude** (Anthropic)
- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **OpenRouter**
- **DeepSeek**

### 3.3 MCP Integration
- 20 MCP tools for Claude/Cursor/Windsurf
- Gives persistent memory to external AI tools
- Works with or without full server

### 3.4 Self-Correcting Agent Loop
- Up to 3 retries on failure
- Analyzes errors and revises approach
- Streams results in real-time

### 3.5 Skills System
- Installable prompt packages
- Domain expertise that loads automatically
- Example: `/skills install react-patterns`

### 3.6 Intelligence Tools
- 17 tools: Contradiction Detector, Bug Pattern Prophet, Burnout Seismograph, Tech Debt Radar, and more

### 3.7 VS Code Extension
- TIMPS Chat panel
- Memory Explorer sidebar
- Inline agent support

---

## 4. Project Structure

```
timps/
├── .github/                    # GitHub workflows & PR template
├── assets/                      # Images, banners
├── benchmark/                  # Performance benchmarks
├── docs/                        # Documentation site
├── packages/                   # Additional packages
│   ├── acp/                    # Agent Control Plane
│   ├── docs/                   # Documentation package
│   ├── memory-core/            # Core memory system
│   ├── memory-core-rs/         # Rust memory core
│   ├── memory-dashboard/       # Web memory dashboard
│   ├── plugin-git/             # Git plugin
│   ├── plugin-sdk/             # Plugin SDK
│   ├── plugin-shell/          # Shell plugin
│   ├── timps-desktop/         # Desktop app
│   └��─ timps-enterprise/      # Enterprise features
├── timps-code/                 # CLI coding agent (npm install -g timps-code)
├── timps-mcp/                  # MCP server (npm install -g timps-mcp)
├── timps-vscode/               # VS Code extension
├── sandeep-ai/                # Full server + REST API + dashboard
├── .claude/                    # Claude settings & skills
├── node_modules/               # Dependencies
├── package.json                # Root package.json
├── README.md                   # Main README
├── ARCHITECTURE.md             # Technical architecture
├── AGENTS.md                  # AI agent guide
├── CHANGELOG.md               # Version history
├── ROADMAP.md                 # Future plans
├── contributing.md            # Contributing guidelines
├── SECURITY.md                # Security policy
└── docker-compose.yml        # Docker setup
```

---

## 5. Component Details

### 5.1 timps-code (CLI Agent)
- **Purpose**: CLI coding agent with agent loop, 25+ tools
- **Install**: `npm install -g timps-code`
- **Entry**: `timps` command
- **Size**: ~19,500 TypeScript LOC

```
timps-code/src/
├── agent/          # Coder, Planner, Verifier, Navigator agents
├── bin/            # CLI entry point (timps.ts)
├── commands/       # Slash command handlers (/memory, /skills, /branch…)
├── config/         # Provider and model configuration
├── core/           # app.ts (AgentLoop), agent.ts, toolRouter.ts
├── memory/         # 9-layer memory: snapshot.ts, memory.ts
├── models/         # Provider adapters: Claude, GPT, Gemini, Ollama, OpenRouter
├── swarm/          # Multi-agent orchestration
├── tools/          # 25+ tools: file, git, shell, web, memory
└── ui/             # Ink/React TUI (App.tsx, components)
```

### 5.2 timps-mcp (MCP Server)
- **Purpose**: Provides 20 MCP tools for Claude/Cursor/Windsurf
- **Install**: `npm install -g timps-mcp`
- **Size**: ~540 TypeScript LOC
- **Single File**: `src/index.ts` contains all tool definitions

### 5.3 timps-vscode (VS Code Extension)
- **Purpose**: IDE integration - chat panel, memory explorer
- **Install**: VS Marketplace (TIMPs.timps-ai-coding-agent)
- **Size**: ~5,200 TypeScript LOC

```
timps-vscode/src/
├── extension.ts          # Activation entry point
├── chatPanel.ts          # Webview chat UI
├── memory.ts             # Memory sidebar + episodic viewer
├── nexusExplorer.ts      # Memory graph explorer (WebView)
├── features/             # Individual extension features
└── client/              # timpsClient.ts — connects to sandeep-ai
```

### 5.4 sandeep-ai (Full Server)
- **Purpose**: REST API server, web dashboard, 17 intelligence tools
- **Entry**: `npm run server` or `docker compose up -d`
- **Port**: `http://localhost:3000`
- **Size**: ~20,300 TypeScript LOC
- **Dependencies**: PostgreSQL, Qdrant vector DB

```
sandeep-ai/src/
├── core/          # Agent loop, planner, executor, 17 intelligence tools
├── memory/       # Long-term + embedding memory
├── tools/        # Extended tool set (17 intelligence tools)
├── models/       # Provider adapters
├── api/          # Express REST routes
└── db/           # PostgreSQL + Qdrant vector DB
```

---

## 6. Getting Started

### Quick Start — CLI Only (No Server Required)

```bash
npm install -g timps-code
timps
```

TIMPS auto-detects Ollama if running, or walks you through picking a provider.

**One-shot commands:**
```bash
timps "add error handling to src/api.ts"
timps --provider claude "refactor this module"
timps --provider gemini "explain this codebase"
```

### Quick Start — Full Server + MCP (Docker)

```bash
git clone https://github.com/Sandeeprdy1729/timps
cd timps
docker compose up -d
npm install -g timps-mcp
```

Server: `http://localhost:3000`  
Dashboard: `http://localhost:3000/dashboard.html`

---

## 7. Installation & Setup

### Option 1: Global Installation (Recommended)

```bash
# CLI only
npm install -g timps-code
timps --help

# Full server
npm install -g timps
timps server

# MCP server
npm install -g timps-mcp
```

### Option 2: Docker Setup

```bash
# Clone repo
git clone https://github.com/Sandeeprdy1729/timps
cd timps

# Start all services
docker compose up -d

# Verify
curl http://localhost:3000/health
```

### Option 3: Manual Setup

```bash
# Clone and enter
git clone https://github.com/Sandeeprdy1729/timps
cd timps

# Install dependencies
npm install

# Build
npm run build

# Start server
cd sandeep-ai
cp .env.example .env  # Add your API keys
npm run server
```

### Option 4: Development Setup

```bash
# Clone
git clone https://github.com/Sandeeprdy1729/timps
cd timps

# Install
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Type check
npm run typecheck
```

---

## 8. How It Works

### Agent Loop Flow

```
User Input
    ↓
src/core/app.ts → AgentLoop.run()
    ↓
src/core/agent.ts → Build prompt (system + memory recall + user message)
    ↓
Provider API → Stream response
    ↓
Tool router → Execute tools in sequence
    ↓
Memory → Write observations back to episodic/semantic
    ↓
TUI → Stream tokens to src/ui/App.tsx
    ↓
Retry (× 3) → On tool error, revise approach and retry
```

### MCP Tool Flow

```
Claude/Cursor/Windsurf
    ↓
MCP Config → timps-mcp server
    ↓
HTTP Request → timps-mcp forwards to TIMPS server
    ↓
Memory Layer → Episodic + Semantic recall
    ↓
Tool Execution → 20 available tools
    ↓
Response → AI receives memory-enhanced response
```

---

## 9. Memory System

The 9-layer memory system is TIMPS's core differentiating feature.

### 9.1 Layer Architecture

| Layer | Storage | Persistence | Contents |
|-------|---------|-------------|----------|
| **L1 Working** | In-process | Reset on exit | Current goals, active files, recent errors |
| **L2 Episodic** | `~/.timps/memory/<hash>/episodes.jsonl` | Disk (append-only) | Conversation summaries, outcomes |
| **L3 Semantic** | `~/.timps/memory/<hash>/semantic.json` | Disk (permanent) | Patterns, conventions, decisions |
| **L4 Procedural** | `~/.timps/memory/<hash>/procedural.json` | Disk | Workflows, recipes, skills |
| **L5 ChronosForge** | `~/.timps/memory/<hash>/chronos/` | Disk | Causal graph, temporal dependencies |
| **L6 ResonanceForge** | `~/.timps/memory/<hash>/resonance.json` | Disk | Pattern harmonics, oscillation model |
| **L7 EchoForge** | `~/.timps/memory/<hash>/echo/` | Disk | Reservoir states, BFS context |
| **L8 SynapseQuench** | In-memory + disk | Cross-layer | Coherence scores, conflict map |
| **L9 HarmonicSheafWeaver** | `~/.timps/memory/<hash>/sheaf/` | Disk | Sheaf Laplacian, cohomology result |

### 9.2 Memory Keying

- Each project gets isolated memory
- Key is SHA256 hash of absolute project path
- Structure: `~/.timps/memory/<project-hash>/`

### 9.3 Recall Triggers

- **Working Memory**: Recalled on every turn
- **Episodic Memory**: Recalled on session start
- **Semantic Memory**: Recalled on context match

### 9.4 Example Usage

```
You: "Use the same pattern we always use for API routes"
TIMPS: [checks semantic memory]
→ "You prefer RESTful routes with /api/v1 prefix"
→ Found in conversation from March 15, 2025
```

---

## 10. Tools & Capabilities

### 10.1 CLI Tools (timps-code)
25+ built-in tools for file, git, shell, web, and memory operations.

### 10.2 MCP Tools (timps-mcp)
20 tools available via MCP protocol.

| Tool | Purpose |
|------|---------|
| `timps_get_memories` | Recall stored facts, goals, preferences |
| `timps_store_memory` | Permanently store a fact |
| `timps_check_contradiction` | Detect contradicting past decisions |
| `timps_check_regret` | Warn before repeating regretted decision |
| `timps_warn_bug_pattern` | Warn if coding context matches bug triggers |
| `timps_check_tech_debt` | Warn if code matches past incidents |
| `timps_burnout_analyze` | Burnout risk assessment |
| `timps_extract_commitments` | Extract action items from notes |
| + 12 more | Full list in README.md |

### 10.3 Intelligence Tools (sandeep-ai)
17 advanced tools for analyzing personal history.

| Tool | Purpose |
|------|---------|
| Contradiction Detector | Catches contradicting past positions |
| Regret Oracle | Warns before repeating regretted outcomes |
| Bug Pattern Prophet | Knows your personal coding anti-patterns |
| Burnout Seismograph | Monitors stress/burnout signals |
| Tech Debt Seismograph | Warns when code matches incidents |
| API Archaeologist | Remembers undocumented API quirks |
| Living Manifesto | Derives values from behavior |
| Dead Reckoning | Simulates future outcomes |
| Meeting Ghost | Extracts commitments from notes |
| + 8 more | Skill, velocity, team, memory tools |

### 10.4 Slash Commands (CLI)

| Command | Purpose |
|---------|---------|
| `/memory` | Show what TIMPS remembers |
| `/todo` | Manage task list |
| `/branch` | Snapshot memory into branch |
| `/merge` | Merge memory branch back |
| `/skills` | List and install skills |
| `/mcp` | List connected MCP servers |
| `/models` | List available models |
| `/doctor` | Diagnose config issues |

### 10.5 CLI Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--provider` | Select provider | `--provider claude` |
| `--model` | Select model | `--model gpt-4o` |
| `--config` | Setup wizard | `--config` |
| `--branch` | Start from branch | `--branch my-feature` |

---

## 11. Configuration

### 11.1 Provider Configuration

**Ollama (Default, Free)**
```bash
# Just run - auto-detected
timps
```

**Claude**
```bash
timps --provider claude --model claude-sonnet-4-5
# Set ANTHROPOIC_API_KEY environment variable
```

**OpenAI**
```bash
timps --provider openai --model gpt-4o
# Set OPENAI_API_KEY environment variable
```

**Gemini**
```bash
timps --provider gemini --model gemini-pro
# Set GOOGLE Generative AI API key
```

### 11.2 MCP Configuration

**Claude Code** (`~/.claude.json`)
```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "TIMPS_URL": "http://localhost:3000",
        "TIMPS_USER_ID": "1"
      }
    }
  }
}
```

**Cursor** → `~/.cursor/mcp.json`  
**Windsurf** → `~/.codeium/windsurf/mcp_config.json`

### 11.3 Environment Variables

```bash
# API Keys
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# TIMPS Settings
TIMPS_URL=http://localhost:3000
TIMPS_USER_ID=1

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

---

## 12. Usage Examples

### 12.1 One-Shot Tasks

```bash
# Add error handling
timps "add error handling to src/api.ts"

# Refactor module
timps --provider claude "refactor this module"

# Explain codebase
timps --provider gemini "explain this codebase"
```

### 12.2 Interactive Session

```bash
timps
# Then type commands interactively
# Use /memory, /todo, /skills etc.
```

### 12.3 Using MCP Tools

```bash
# In Claude/Cursor, call MCP tool
You: "What's TIMPS remember about this project?"
Claude: [calls timps_get_memories]
→ Returns stored facts, patterns, conventions
```

### 12.4 Using Intelligence Tools

```bash
# Via REST API
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "timps_burnout_analyze",
    "userId": "1"
  }'
```

---

## 13. Troubleshooting

### 13.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Ollama not detected | Not running | Start Ollama: `ollama serve` |
| API key missing | No env var | Set `ANTHROPIC_API_KEY` etc. |
| MCP not connecting | Server down | `docker compose up -d` or `timps server` |
| Memory not loading | Wrong project hash | Verify you're in correct directory |
| Port already in use | Service conflict | Stop conflicting service or change port |

### 13.2 Diagnostic Commands

```bash
# Check health
curl http://localhost:3000/health

# Run doctor
timps --doctor

# Check models
timps --models

# List MCP servers
timps /mcp
```

### 13.3 Logs

| Service | Log Location |
|---------|---------------|
| timps-code | Console output |
| timps-mcp | Console output |
| sandeep-ai | Console or Docker logs |
| Docker | `docker compose logs` |

---

## 14. Development

### 14.1 Building

```bash
# Build all packages
npm run build

# Build specific package
cd timps-code && npm run build
cd sandeep-ai && npm run build
cd timps-mcp && npm run build
```

### 14.2 Testing

```bash
# Test all
npm run test

# Test specific package
cd timps-code && npm test
```

### 14.3 Type Checking

```bash
# Type check all
npm run typecheck

# Type check specific package
cd timps-code && npx tsc --noEmit
```

### 14.4 Code Style

- All packages use TypeScript with `"module": "ESNext"` and strict mode
- Use `tsx` for development, `tsc` for production builds
- Output goes to `dist/`
- Imports use `.js` extensions (ESM requirement)

### 14.5 Contributing

See [contributing.md](contributing.md) and [AGENTS.md](AGENTS.md) for detailed guidelines.

---

## Quick Reference Card

| Action | Command |
|--------|---------|
| Install CLI | `npm install -g timps-code` |
| Run CLI | `timps` or `timps "task"` |
| Start server | `docker compose up -d` |
| Install MCP | `npm install -g timps-mcp` |
| Check status | `curl http://localhost:3000/health` |
| View docs | See `docs/` folder |

---

## Contact & Resources

- **GitHub**: https://github.com/Sandeeprdy1729/timps
- **Discord**: https://discord.gg/timps
- **npm**: https://www.npmjs.com/package/timps-code
- **VS Marketplace**: TIMPs.timps-ai-coding-agent

---

*Last Updated: May 2026*
*Version: 1.0.3*
*License: MIT*