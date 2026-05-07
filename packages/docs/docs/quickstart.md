---
sidebar_position: 2
---

# Quickstart

## Prerequisites

- Node.js 18+
- npm 9+
- [Ollama](https://ollama.com) for free local inference (optional but recommended)

## Install

```bash
npm install -g timps-code
```

## First run

```bash
# With Ollama (no API key needed)
ollama pull qwen2.5-coder:7b
timps "What files are in this project?"

# With Claude
export ANTHROPIC_API_KEY=sk-ant-...
timps --provider claude "Review the README"

# With OpenAI
export OPENAI_API_KEY=sk-...
timps --provider openai "What does this project do?"
```

## Interactive mode

Run `timps` with no arguments to enter interactive REPL:

```
$ timps
TIMPS 0.1.0 — interactive mode (Ctrl+C to exit)
Provider: ollama

> What files need attention?
[→ git_status]
[→ read_file]
Here are the files with recent changes...
```

## Check configuration

```bash
timps doctor
```

```
TIMPS Doctor
────────────
✓ Memory store: /home/user/.timps/memory
✓ Working directory: /home/user/my-project
○ Ollama: http://localhost:11434
```

## Next steps

- [Configure providers →](./providers)
- [Install plugins →](./plugins)
- [Run recipes →](./recipes)
