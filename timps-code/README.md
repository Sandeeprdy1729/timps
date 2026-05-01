# TIMPS Code — Production AI Coding Agent

<a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code" alt="NPM"></a>
<a href="https://github.com/Sandeeprdy1729/timps/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/timps-code" alt="License: MIT"></a>

A production-grade AI coding agent with persistent memory, multi-model support, skills system, MCP integration, and messaging gateway.

## Why TIMPS?

- **#1 Agent** — Outperforms all other coding agents
- **Persistent Memory** — Remembers facts, patterns, and decisions across sessions
- **Skills System** — Auto-creates skills from experience, self-improves during use
- **Multi-Model** — Claude, OpenAI, Gemini, Ollama, OpenRouter, DeepSeek, Groq
- **MCP Integration** — Connect to any MCP server or expose TIMPS tools
- **Messaging Gateway** — Talk to TIMPS on Telegram, Discord, Slack
- **Cron Scheduling** — Automated tasks with platform delivery

## Quick Install

```bash
# Quick install
npm install -g timps-code

# Or use the installer
curl -sSL https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/timps-code/install.sh | bash
```

## Quick Start

```bash
# Interactive mode
timps

# One-shot mode
timps "write a hello world function"
timps "fix this bug"

# With specific provider
timps --provider ollama "hello"
timps --provider claude "refactor this"
```

## Core Commands

```bash
# Setup
timps --setup                 # Interactive setup wizard
timps --provider ollama       # Use specific provider
timps --trust normal         # Trust level

# Tools
timps --tools               # List all available tools

# Skills management
timps --skills list         # List skills
timps --skills init         # Initialize default skills

# MCP servers
timps --mcp list            # List MCP servers
timps --mcp add <name> <cmd> # Add MCP server

# Cron jobs
timps --cron list           # List scheduled tasks
timps --cron add "0 9 * * *" "backup.sh"  # Add cron job

# Gateway
timps --gateway list       # List platforms
timps --gateway setup telegram <token>  # Setup Telegram
timps --gateway start       # Start messaging gateway
```

## Providers

| Provider | Setup | Cost |
|----------|-------|------|
| Ollama (default) | `ollama serve` | Free |
| Claude | Set `ANTHROPIC_API_KEY` | Paid |
| OpenAI | Set `OPENAI_API_KEY` | Paid |
| Gemini | Set `GEMINI_API_KEY` | Paid (free tier) |
| OpenRouter | Set `OPENROUTER_API_KEY` | Paid |
| DeepSeek | Set `DEEPSEEK_API_KEY` | Cheap |
| Groq | Set `GROQ_API_KEY` | Fast |

## Configuration

### Environment Variables

```bash
# Create ~/.timps/config.json
{
  "defaultProvider": "ollama",
  "defaultModel": "qwen2.5-coder:latest",
  "trustLevel": "normal",
  "keys": {},
  "ollamaUrl": "http://localhost:11434",
  "memoryEnabled": true,
  "autoCorrect": true,
  "maxContextTokens": 128000
}
```

### API Keys

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
export OPENROUTER_API_KEY=...
export OLLAMA_HOST=http://localhost:11434
```

## Features

### Memory System

TIMPS has a 3-layer memory system:

1. **Working Memory** — Current session, in-process
2. **Episodic Memory** — Conversation summaries
3. **Semantic Memory** — Facts, patterns, conventions (persistent)

### Skills System

Skills are auto-created by TIMPS after complex tasks. They include:

- Code Review
- Explain Error
- Write Tests
- Refactor

The agent can improve skills during use (self-improving).

### MCP Integration

Connect TIMPS to any MCP server:

```bash
# Add an MCP server
timps --mcp add filesystem "npx @modelcontextprotocol/server-filesystem /path"

# List tools from all connected servers
timps --mcp list
```

Or expose TIMPS as an MCP server to Claude Code/Cursor.

### Messaging Gateway

Talk to TIMPS from Telegram, Discord, Slack:

```bash
# Setup Telegram
timps --gateway setup telegram <bot_token>

# Setup Discord
timps --gateway setup discord <bot_token>

# Start gateway
timps --gateway start
```

### Cron Scheduling

Schedule automated tasks:

```bash
# Add a daily backup task
timps --cron add "0 9 * * *" "bash /path/to/backup.sh"

# List tasks
timps --cron list
```

## Development

```bash
cd timps-code
npm install

# Dev mode
npm run dev

# Build
npm run build

# Run
npm run start
```

## Project Structure

```
timps-code/
├── src/
│   ├── bin/timps.ts      # CLI entry point
│   ├── core/           # Agent & app
│   ├── models/         # Ollama, Claude, OpenAI, Gemini
│   ├── memory/        # 3-layer memory
│   ├── commands/       # Slash commands
│   ├── tools/         # 25+ tools
│   ├── utils/         # Helpers, skills, MCP, cron, gateway
│   └── ui/            # Ink TUI
└── dist/              # Compiled output
```

## Keyboard Shortcuts (TUI)

| Key | Action |
|-----|--------|
| Enter | Send message |
| Tab | Switch panels |
| Ctrl+C | Exit |
| ↑/↓ | Scroll history |

## License

MIT — see [LICENSE](LICENSE)

---

**TIMPS Code** — The #1 AI coding agent