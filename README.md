# TIMPS — AI Coding Agent Ecosystem

An AI-powered coding agent ecosystem with persistent memory, multi-model support, and beautiful CLI.

<div align="center">

[![Status](https://img.shields.io/badge/v2.0-INVESTOR%20READY-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Tools](https://img.shields.io/badge/Intelligence%20Tools-17+-purple)

**TIMPS = Trustworthy Interactive Memory Partner System**

</div>

---

## Project Overview

```
testbot/
├── timps-code/         ← CLI agent (this is your new coding agent)
├── timps-vscode/       ← VS Code extension
├── timps-mcp/         ← MCP server for Claude Code/Cursor
└── sandeep-ai/       ← Full server with 17 intelligence tools
```

### Choose Your Interface

| Interface | Install | Use Case |
|-----------|---------|----------|
| **TIMPS Code** | `npm install -g timps-code` | CLI agent with memory |
| **TIMPS VSCode** | VS Marketplace | In-editor AI coding |
| **TIMPS MCP** | `npm install -g timps-mcp` | Connect to Claude Code/Cursor |
| **TIMPS Server** | `cd sandeep-ai && npm run server` | Full web + 17 tools |

---

## Quick Start

### 1. Install TIMPS Code (CLI)

```bash
npm install -g timps-code
timps "hello"
```

### 2. Or Use VS Code Extension

[Install from VS Marketplace](https://marketplace.visualstudio.com/items?itemName=sandeeprdy1729.timps-vscode)

### 3. Or Connect MCP to Claude Code

```bash
npm install -g timps-mcp
# Configure ~/.claude.json
```

---

## TIMPS Code (CLI)

A powerful AI coding agent with persistent memory and beautiful CLI.

```bash
# Interactive mode
timps

# One-shot mode
timps "write a hello world function"
timps --provider ollama "hello"
timps --provider gemini "hello"
```

### Features

- **Persistent Memory** — Remembers facts across sessions
- **Self-Correcting** — Auto-heals errors
- **Multi-Model** — Claude, OpenAI, Gemini, Ollama, Hybrid
- **Beautiful CLI** — Ink-based TUI with dashboard
- **Data Pipeline** — Bug mining, synthetic generation

### Providers

| Provider | Setup | Cost |
|----------|-------|------|
| **Ollama** (default) | `ollama serve` | Free |
| **Claude** | Set `ANTHROPIC_API_KEY` | Paid |
| **OpenAI** | Set `OPENAI_API_KEY` | Paid |
| **Gemini** | Set `GEMINI_API_KEY` | Paid (free tier) |
| **Hybrid** | Ollama + API | Mixed |

---

## TIMPS VSCode

VS Code extension for in-editor AI coding.

### Features

- **Cmd+Esc** — Open TIMPS terminal
- **Cmd+Shift+C** — Open chat panel
- **Context awareness** — Auto-shares current file
- **Memory** — Remembers your patterns

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=sandeeprdy1729.timps-vscode)

---

## TIMPS MCP

Connect to Claude Code, Cursor, or Windsurf.

### Setup

```bash
npm install -g timps-mcp
```

Configure in your AI tool's MCP settings:
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

---

## TIMPS Server (sand-eep-ai)

Full server with 17 intelligence tools.

```bash
cd sandeep-ai
npm run server
```

### 17 Intelligence Tools

| # | Tool | What it does |
|---|------|-------------|
| 1 | Temporal Mirror | Tracks behavioral patterns |
| 2 | Regret Oracle | Warns before repeating mistakes |
| 3 | Living Manifesto | Derives values from behavior |
| 4 | Burnout Seismograph | Monitors stress signals |
| 5 | Argument DNA Mapper | Detects contradictions |
| 6 | Dead Reckoning | Simulates future outcomes |
| 7 | Skill Shadow | Tracks skill gaps |
| 8 | Curriculum Architect | Suggests learning paths |
| 9 | Tech Debt Seismograph | Warns on code patterns |
| 10 | Bug Pattern Prophet | Knows your bug triggers |
| 11 | API Archaeologist | Remembers API quirks |
| 12 | Codebase Anthropologist | Explains code decisions |
| 13 | Institutional Memory | Preserves decision rationale |
| 14 | Chemistry Engine | Analyzes team dynamics |
| 15 | Meeting Ghost | Tracks commitments |
| 16 | Collective Wisdom | Shares others' solutions |
| 17 | Relationship Intelligence | Monitors relationship health |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           TIMPS Ecosystem                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐     ┌──────────────┐      │
│  │TIMPS Code    │     │TIMPS VSCode │      │
│  │(CLI)        │     │(Extension) │      │
│  └──────┬───────┘     └──────┬───────┘      │
│         │                  │              │
│         ▼                  ▼              │
│  ┌─────────────────────────────────────┐   │
│  │    TIMPS MCP Server            │   │
│  │    (connects agents to memory)       │   │
│  └─────────────────────────────────────┘   │
│                    │                        │
│                    ▼                        │
│  ┌─────────────────────────────────────┐   │
│  │      sandeep-ai Server               │   │
│  │      (17 intelligence tools)        │   │
│  │  ┌──────────┐  ┌─────────┐         │   │
│  │  │PostgreSQL│  │ Qdrant   │         │   │
│  │  │(memory) │  │(vectors) │         │   │
│  │  └──────────┘  └─────────┘         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

Create `.env` in timps-code folder:

```env
GEMINI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
OPENROUTER_API_KEY=your-key
```

### Config File

`~/.timps/config.json`:

```json
{
  "defaultProvider": "ollama",
  "defaultModel": "qwen2.5-coder:latest",
  "ollamaUrl": "http://localhost:11434",
  "trustLevel": "normal"
}
```

---

## Development

```bash
# TIMPS Code CLI
cd timps-code
npm install
npm run build
npm run start

# TIMPS VSCode
cd timps-vscode
npm install
npm run watch

# TIMPS MCP
cd timps-mcp
npm install

# Full Server
cd sandeep-ai
npm install
npm run server
```

---

## Keyboard Shortcuts (CLI/TUI)

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Tab` | Switch panels |
| `Ctrl+C` | Exit |
| `↑/↓` | Scroll history |

---

## License

MIT