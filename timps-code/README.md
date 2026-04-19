# TIMPS Code — AI Coding Agent

A powerful AI coding agent with persistent memory, multi-model support, and beautiful CLI.

[![CLI](https://img.shields.io/badge/CLI-TIMPS%20Code-blue)](https://www.npmjs.com/package/timps-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Persistent Memory** — Remembers facts, patterns, and decisions across sessions
- **Self-Correcting** — Auto-heals errors and retries failed operations
- **Multi-Model** — Claude, OpenAI, Gemini, Ollama, Hybrid mode
- **Beautiful CLI** — Ink-based TUI with dashboard
- **Data Pipeline** — Bug mining, synthetic generation, GRPO training
- **Local-First** — 100% private, works offline with Ollama

---

## Quick Start

### Install

```bash
npm install -g timps-code
```

### Run

```bash
# Interactive mode (default - auto-detects Ollama)
timps

# One-shot mode
timps "write a hello world function"

# With specific provider
timps --provider ollama "hello"
timps --provider gemini "hello"
timps --provider claude "hello"
```

### Configure

```bash
# Run setup wizard
timps --config

# Or edit ~/.timps/config.json directly
```

---

## Providers

| Provider | Setup | Cost |
|----------|-------|------|
| **Ollama** (default) | `ollama serve` | Free |
| **Claude** | Set `ANTHROPIC_API_KEY` | Paid |
| **OpenAI** | Set `OPENAI_API_KEY` | Paid |
| **Gemini** | Set `GEMINI_API_KEY` | Paid (free tier) |
| **OpenRouter** | Set `OPENROUTER_API_KEY` | Paid |
| **Hybrid** | Ollama + any API | Mixed |

---

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/provider` | Switch AI provider |
| `/model` | Change model |
| `/memory` | View memory dashboard |
| `/todo` | Manage tasks |
| `/skills` | Install skill plugins |
| `/doctor` | Health check |

---

## Project Structure

```
timps-code/
├── src/
│   ├── bin/timps.ts      # CLI entry point
│   ├── core/           # Agent & app
│   ├── models/         # Ollama, Claude, OpenAI, Gemini
│   ├── memory/        # 3-layer memory
│   ├── commands/       # Slash commands
│   ├── tools/         # 24 tools
│   ├── data-pipeline/  # Bug mining, GRPO
│   ├── team/         # Team collaboration
│   ├── utils/        # Helpers
│   └── ui/           # Ink TUI
└── dist/             # Compiled output
```

---

## Data Pipeline

TIMPS includes powerful data mining and training tools:

```bash
# Bug mining
timps --mine-bugs --bug-source github-pr --mine-count 100

# Synthetic generation
timps --synthesize --synth-count 1000

# Full pipeline
timps --build-dataset --dataset-target 10000
```

---

## Configuration

### Environment Variables

Create `.env` in project root:

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
cd timps-code
npm install

# Dev mode (runs directly)
npm run dist/bin/timps.js

# Build
npm run build

# Start
npm run start
```

---

## Keyboard Shortcuts (TUI)

| Key | Action |
|-----|-------|
| `Enter` | Send message |
| `Tab` | Switch panels |
| `Ctrl+C` | Exit |
| `↑/↓` | Scroll history |

---

## License

MIT