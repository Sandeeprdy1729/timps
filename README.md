# TIMPS — Open-Source AI Coding Agent

<div align="center">

[![npm](https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen)](https://www.npmjs.com/package/timps-code)
[![npm](https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=blue)](https://www.npmjs.com/package/timps-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![CI](https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml/badge.svg)](https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml)

**A CLI coding agent like Claude Code — runs on Ollama, has persistent memory across sessions, and is fully open source.**

[Install](#-30-second-install) · [MCP Tools](#-timps-mcp--30-tools-for-claudecursorwindsurf) · [VS Code](#-timps-vscode-extension) · [Full Server](#-timps-server-17-intelligence-tools) · [Contributing](contributing.md)

</div>

---

## ⚡ 30-second install

```bash
npm install -g timps-code
timps
```

That's it. TIMPS auto-detects Ollama if it's running, or walks you through picking a provider. No config file required to start.

```bash
# One-shot
timps "add error handling to src/api.ts"

# Interactive session (persistent memory across runs)
timps

# Use a specific provider
timps --provider claude "refactor this module"
timps --provider gemini "explain this codebase"
```

**Providers:** Ollama (free, local) · Claude · OpenAI · Gemini · OpenRouter · DeepSeek

---

## Why TIMPS instead of Claude Code / Cursor?

| | TIMPS | Claude Code | Cursor |
|---|---|---|---|
| **Cost** | Free (Ollama) | ~$20-100/mo | ~$20/mo |
| **Runs 100% locally** | ✅ | ❌ | ❌ |
| **Persistent memory** | ✅ 3-layer | ❌ session only | ❌ session only |
| **Open source** | ✅ MIT | ❌ | ❌ |
| **MCP tools for Claude/Cursor** | ✅ 20 tools | ❌ | ❌ |
| **VS Code extension** | ✅ | ❌ | built-in |
| **Self-correcting agent** | ✅ | ✅ | partial |

---

## What "persistent memory" actually means

TIMPS stores memory in **3 layers** that persist across every session:

- **Layer 1 (Working)** — active files, current goal, recent errors this session
- **Layer 2 (Episodic)** — summaries of past conversations, what was built and why
- **Layer 3 (Semantic)** — facts, patterns, conventions your codebase uses

When you say "use the pattern we always use for API routes", TIMPS knows what you mean because it remembered it last week.

---

## 🔧 TIMPS MCP — 20 Tools for Claude/Cursor/Windsurf

The biggest differentiator: **TIMPS ships as an MCP server** that plugs straight into Claude Code, Cursor, or Windsurf and gives your AI assistant long-term intelligence it doesn't have natively.

```bash
npm install -g timps-mcp
# Start the TIMPS server first (see Full Server section below)
```

Add to your AI tool's MCP config:

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

**Claude Code** → `~/.claude.json` | **Cursor** → `~/.cursor/mcp.json` | **Windsurf** → `~/.codeium/windsurf/mcp_config.json`

### What Claude/Cursor gains instantly

| MCP Tool | What it does |
|---|---|
| `timps_chat` | Full conversation with all intelligence tools active |
| `timps_get_memories` | Recall stored facts, goals, and preferences |
| `timps_store_memory` | Permanently store a fact across sessions |
| `timps_check_contradiction` | Detects when you contradict a past decision |
| `timps_get_positions` | Lists all tracked positions and conflict counts |
| `timps_check_regret` | Warns before you repeat a decision you regretted |
| `timps_log_decision` | Records a decision outcome for future warnings |
| `timps_burnout_analyze` | Current burnout risk assessment |
| `timps_record_signal` | Log a behavioral signal (overwork, skip, late) |
| `timps_warn_bug_pattern` | Warns if coding context matches your personal bug triggers |
| `timps_record_bug` | Record a bug to build your personal bug profile |
| `timps_check_tech_debt` | Warns if a code pattern matches past production incidents |
| `timps_record_incident` | Record a production incident for future pattern matching |
| `timps_lookup_api` | Retrieve known quirks for an API you've hit before |
| `timps_record_api_quirk` | Save a discovered API gotcha |
| `timps_extract_commitments` | Extract action items from meeting notes |
| `timps_get_pending_commitments` | List all open commitments you made |
| `timps_relationship_check` | Check relationship health and drift alerts |
| `timps_simulate_decision` | Simulate future outcomes before committing |
| `timps_get_manifesto` | Your living manifesto — actual values derived from behavior |

**Example in action:**
```
You: "I'm going to use setTimeout for synchronization here"
Claude: [calls timps_warn_bug_pattern]
⚠️  This matches a past incident: "setTimeout for async sync → race condition"
    Happened in src/queue.ts, took 12h to debug (March 2025)
```

```
You: "Remote teams don't work, everyone in office"
Claude: [calls timps_check_contradiction]
⚠️  CONTRADICTION (82%) — You argued the opposite 47 days ago:
    "Remote work increases productivity and should be the default"
```

---

## 📁 What's in this repo

```
timps/
├── timps-code/     ← CLI coding agent  (npm install -g timps-code)
├── timps-mcp/      ← MCP server        (npm install -g timps-mcp)
├── timps-vscode/   ← VS Code extension (VS Marketplace)
└── sandeep-ai/     ← Full server with 17 intelligence tools + REST API + dashboard
```

---

## 💻 TIMPS Code (CLI) — full feature list

```bash
npm install -g timps-code
```

### Slash commands (inside interactive session)

```
/help           — all commands
/memory         — show what TIMPS remembers about this project
/todo           — manage task list
/branch <name>  — snapshot current memory state into a named branch
/merge <name>   — merge a memory branch back
/skills         — list and install skills
/mcp            — list connected MCP servers
/git            — git status + diff
/models         — list available models
/doctor         — diagnose config issues
```

### Flags

```bash
timps --provider <name>   # claude | openai | gemini | ollama | openrouter | hybrid
timps --model <model>     # e.g. gpt-4o, claude-sonnet-4-5
timps --dir <path>        # working directory
timps --config            # setup wizard
timps --branch <name>     # start from a memory branch
```

### Tools available to the agent (25 tools)

| Category | Tools |
|---|---|
| File ops | `read_file`, `write_file`, `edit_file`, `multi_edit`, `patch_file` |
| Search | `find_files`, `search_code`, `grep` |
| Git | `get_git_status`, `git_diff`, `git_log`, `git_commit` |
| Shell | `run_bash` |
| Code quality | `run_tests`, `lint`, `type_check` |
| Reasoning | `think`, `plan` |
| Web | `web_search`, `web_fetch` |
| Tasks | `todo_create`, `todo_list`, `todo_update` |

---

## 🧩 TIMPS VSCode Extension

Install from VS Code Marketplace:
```
ext install TIMPs.timps-ai-coding-agent
```

Or manually from the `.vsix` in `timps-vscode/`:
```bash
code --install-extension timps-vscode/timps-ai-coding-agent-1.2.0.vsix
```

**Keyboard shortcuts:**
- `Cmd+Esc` — Open TIMPS terminal
- `Cmd+Shift+C` — Open chat panel

**Sidebar panels:**
- **TIMPS Chat** — Full agent chat with file context
- **Memory Explorer** — Browse what TIMPS remembers about your project (episodic memory graph)

---

## 🖥️ TIMPS Server (17 Intelligence Tools)

The full server backs the MCP server and web dashboard. Run it with Docker:

```bash
# One command — starts Postgres, Qdrant, and the TIMPS server
docker compose up -d
```

Or run manually:
```bash
cd sandeep-ai
cp .env.example .env   # edit with your API keys
npm install
npm run server
```

Server runs at `http://localhost:3000`. Web dashboard at `http://localhost:3000/dashboard.html`.

### 17 Intelligence Tools

| # | Tool | What it does |
|---|---|---|
| 1 | **Temporal Mirror** | Tracks behavioral patterns over time |
| 2 | **Regret Oracle** | Warns before you repeat regretted decisions |
| 3 | **Living Manifesto** | Derives your actual values from behavior (not stated values) |
| 4 | **Burnout Seismograph** | Monitors stress signals and burnout risk |
| 5 | **Contradiction Detector** | Catches you contradicting past positions mid-conversation |
| 6 | **Dead Reckoning** | Simulates future outcomes for decisions |
| 7 | **Skill Shadow** | Tracks skill gaps and growth |
| 8 | **Curriculum Architect** | Suggests learning paths based on gaps |
| 9 | **Tech Debt Seismograph** | Warns when code patterns match past incidents |
| 10 | **Bug Pattern Prophet** | Knows your personal bug triggers before you write the bug |
| 11 | **API Archaeologist** | Remembers undocumented API quirks you've discovered |
| 12 | **Codebase Anthropologist** | Explains why architectural decisions were made |
| 13 | **Institutional Memory** | Preserves decision rationale across team changes |
| 14 | **Chemistry Engine** | Analyzes team collaboration dynamics |
| 15 | **Meeting Ghost** | Extracts and tracks commitments from meeting notes |
| 16 | **Collective Wisdom** | Shares relevant solutions from your past sessions |
| 17 | **Relationship Intelligence** | Monitors relationship health and drift |

---

## Contributing

See [contributing.md](contributing.md). Issues and PRs welcome — the project is MIT licensed.

---

## Star History

<a href="https://www.star-history.com/?repos=Sandeeprdy1729%2Ftimps&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Sandeeprdy1729/timps&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Sandeeprdy1729/timps&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Sandeeprdy1729/timps&type=date&legend=top-left" />
  </picture>
</a>

---

## License

MIT
