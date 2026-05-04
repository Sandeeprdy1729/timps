# TIMPS Code — Open-Source CLI Coding Agent

[![npm](https://img.shields.io/npm/v/timps-code?color=brightgreen)](https://www.npmjs.com/package/timps-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

**A CLI coding agent like Claude Code — runs on Ollama (free, local), has persistent memory across sessions, and is fully open source.**

```bash
npm install -g timps-code
timps
```

---

## What makes TIMPS different

**Persistent memory.** TIMPS remembers your project across sessions using a 3-layer memory system:

- **Working memory** — current goal, active files, recent errors (this session)
- **Episodic memory** — summaries of past conversations stored to disk
- **Semantic memory** — facts, patterns, and conventions your project uses (permanent)

When you start a new session and say "use the same pattern we always use for API routes", TIMPS knows what you mean.

**Runs 100% locally.** The default provider is Ollama. No API keys, no data leaving your machine, no monthly bill.

**Self-correcting.** When a command fails, the agent analyzes the error, fixes its approach, and retries — up to 3 times by default.

---

## Install

```bash
npm install -g timps-code
```

Requirements: Node.js 18+ | For local AI: [Ollama](https://ollama.com)

---

## Usage

```bash
# Interactive session (persistent memory, full agent loop)
timps

# One-shot mode
timps "add input validation to src/api.ts"
timps "write tests for the payment module"
timps "explain why src/queue.ts uses a semaphore"

# Specify provider
timps --provider ollama "refactor this"
timps --provider claude "review this PR diff"
timps --provider gemini "suggest architecture improvements"

# Setup wizard (first time)
timps --config
```

---

## Providers

| Provider | Setup | Cost |
|---|---|---|
| **Ollama** (default) | `ollama serve` | Free |
| **Claude** | `ANTHROPIC_API_KEY=...` | Paid |
| **OpenAI** | `OPENAI_API_KEY=...` | Paid |
| **Gemini** | `GEMINI_API_KEY=...` | Free tier available |
| **OpenRouter** | `OPENROUTER_API_KEY=...` | Pay per use |
| **Hybrid** | Ollama + API fallback | Mixed |

TIMPS auto-detects Ollama on startup. If Ollama is running, it uses it without any config.

---

## CLI Flags

```bash
timps --provider <name>   # claude | openai | gemini | ollama | openrouter | hybrid
timps --model <model>     # e.g. gpt-4o, claude-sonnet-4-5, llama3.1:8b
timps --dir <path>        # set working directory (default: cwd)
timps --config            # run setup wizard
timps --branch <name>     # start from a named memory branch
timps --merge <name>      # merge a memory branch into current context
```

---

## Slash commands (inside interactive session)

```
/help           — list all commands
/memory         — show what TIMPS remembers about this project
/todo           — manage task list with the agent
/branch <name>  — snapshot current memory into a named branch
/merge <name>   — merge a memory branch back
/skills         — list and install skills
/mcp            — list connected MCP servers
/git            — git status and diff
/models         — list available Ollama models
/doctor         — diagnose config and connection issues
/clear          — clear session working memory
```

---

## Tools available to the agent

TIMPS ships with 25 tools. The agent picks them automatically:

| Category | Tools |
|---|---|
| File ops | `read_file`, `write_file`, `edit_file`, `multi_edit`, `patch_file` |
| Search | `find_files`, `search_code`, `grep` |
| Git | `get_git_status`, `git_diff`, `git_log`, `git_commit` |
| Shell | `run_bash` |
| Code quality | `run_tests`, `lint`, `type_check` |
| Reasoning | `think`, `plan` |
| Web | `web_search`, `web_fetch` |
| Task management | `todo_create`, `todo_list`, `todo_update` |

---

## Memory system in practice

TIMPS stores memory per-project in `~/.timps/memory/<project-hash>/`:

```
semantic.json     — long-term facts and patterns
episodes.jsonl    — past session summaries (rolling 100)
working.json      — current session state
```

You can view it with `/memory` inside a session, or inspect the files directly.

**Branching:** `timps --branch feature-x` snapshots the current memory state before you start a risky refactor. `timps --merge main` merges it back.

---

## Skills system

TIMPS can install reusable skills — small prompt packages that add domain expertise:

```bash
# Inside a session:
/skills list       — browse available skills
/skills install react-patterns
/skills install test-driven-development
```

Skills are stored in `~/.timps/skills/` and injected into the system prompt when relevant.

---

## Connect to TIMPS MCP (optional)

If you're running the full TIMPS server (`docker compose up -d` from the repo root), you can connect it to Claude Code, Cursor, or Windsurf for persistent memory inside those tools too. See [timps-mcp](../timps-mcp/README.md).

---

## Configuration

On first run, TIMPS creates `~/.timps/config.json`. You can also set via environment:

```bash
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434   # default
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b   # default
```

Only set the keys for providers you actually use. Ollama needs no key.

---

## License

MIT — [github.com/Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps)
