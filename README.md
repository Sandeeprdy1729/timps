<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — AI Coding Agent" width="100%">
</p>

<h1 align="center">TIMPS — The AI Coding Agent That Remembers</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm timps-code"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm timps-mcp"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent"><img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode" alt="VS Code Extension"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="https://discord.gg/timps"><img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

<p align="center">
  <b>Claude Code forgets everything when you close it. TIMPS remembers — forever.</b><br>
  <i>Free (Ollama), open source, runs 100% locally, works in Claude/Cursor/Windsurf via MCP.</i>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-timps-mcp--20-tools-for-claudecursorwindsurf">MCP Tools</a> ·
  <a href="#-timps-vscode-extension">VS Code</a> ·
  <a href="#-full-server-setup">Full Server</a> ·
  <a href="contributing.md">Contributing</a> ·
  <a href="https://discord.gg/timps">Discord</a>
</p>

---

<table>
<tr><td><b>3-layer persistent memory</b></td><td>Working → Episodic → Semantic. TIMPS builds a deepening model of your project across every session. Say "use the pattern we always use for routes" — it knows what you mean.</td></tr>
<tr><td><b>Runs free, 100% locally</b></td><td>Default provider is Ollama — no API key, no data leaving your machine, no monthly bill. Switch to Claude, GPT-4o, Gemini, or OpenRouter in one flag.</td></tr>
<tr><td><b>20 MCP tools for Claude/Cursor</b></td><td>Give Claude Code and Cursor the persistent memory they were born without. Install <code>timps-mcp</code> and connect it in 30 seconds.</td></tr>
<tr><td><b>VS Code extension</b></td><td>TIMPS Chat panel, Memory Explorer, and inline agent — right inside your editor. Install from the VS Marketplace.</td></tr>
<tr><td><b>Self-correcting agent loop</b></td><td>When a command fails, TIMPS analyzes the error, revises its plan, and retries automatically. Up to 3 retries with a different approach each time.</td></tr>
<tr><td><b>Skills system</b></td><td>Install reusable prompt packages (<code>/skills install react-patterns</code>) for domain expertise that loads automatically when relevant.</td></tr>
<tr><td><b>17 intelligence tools</b></td><td>Contradiction Detector, Bug Pattern Prophet, Burnout Seismograph, Tech Debt Radar, and more — all wired to your personal history.</td></tr>
</table>

---

## What "persistent memory" actually means

TIMPS stores memory in **3 layers** that survive every session restart:

- **Working** — current goal, active files, recent errors (this session)
- **Episodic** — summaries of past conversations: what was built and why
- **Semantic** — facts, patterns, conventions your codebase uses (permanent)

> "Use the same pattern we always use for API routes." — TIMPS knows what you mean because it remembered it last week.

---

## ⚡ Quick Start

### CLI only (no server required)

```bash
npm install -g timps-code
timps
```

TIMPS auto-detects Ollama if it's running, or walks you through picking a provider. No config file required.

```bash
timps "add error handling to src/api.ts"          # one-shot
timps --provider claude "refactor this module"     # use Claude
timps --provider gemini "explain this codebase"    # use Gemini
```

**Providers:** Ollama (free, local) · Claude · OpenAI · Gemini · OpenRouter · DeepSeek

### Full server + MCP tools (Docker, recommended)

```bash
git clone https://github.com/Sandeeprdy1729/timps
cd timps
docker compose up -d
npm install -g timps-mcp
```

The server starts at `http://localhost:3000`. Then add `timps-mcp` to your AI tool's MCP config (see [MCP section](#-timps-mcp--20-tools-for-claudecursorwindsurf) below).

---

## Why TIMPS instead of Claude Code / Cursor?

| | TIMPS | Claude Code | Cursor |
|---|---|---|---|
| **Cost** | Free (Ollama) | ~$20–100/mo | ~$20/mo |
| **Runs 100% locally** | ✅ | ❌ | ❌ |
| **Persistent memory** | ✅ 3-layer | ❌ session only | ❌ session only |
| **Open source** | ✅ MIT | ❌ | ❌ |
| **MCP tools for Claude/Cursor** | ✅ 20 tools | ❌ | ❌ |
| **VS Code extension** | ✅ | ❌ | built-in |

---

## 🔧 TIMPS MCP — 20 Tools for Claude/Cursor/Windsurf

Install the MCP package and add it to your AI tool's config to give it long-term intelligence it doesn't have natively.

```bash
npm install -g timps-mcp
```

### Claude Code (`~/.claude.json`)

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

**Cursor** → `~/.cursor/mcp.json` | **Windsurf** → `~/.codeium/windsurf/mcp_config.json` (same JSON structure)

### What Claude/Cursor gains instantly

| MCP Tool | What it does |
|---|---|
| `timps_get_memories` | Recall stored facts, goals, and preferences |
| `timps_store_memory` | Permanently store a fact across sessions |
| `timps_check_contradiction` | Detects when you contradict a past decision |
| `timps_check_regret` | Warns before you repeat a decision you regretted |
| `timps_warn_bug_pattern` | Warns if coding context matches your personal bug triggers |
| `timps_check_tech_debt` | Warns if a code pattern matches past production incidents |
| `timps_burnout_analyze` | Current burnout risk assessment |
| `timps_extract_commitments` | Extract action items from meeting notes |
| + 12 more | See [full tool list](#full-mcp-tool-list) |

**Example:**
```
You: "I'm going to use setTimeout for synchronization here"
Claude: [calls timps_warn_bug_pattern]
⚠️  Matches past incident: "setTimeout for async sync → race condition"
    Happened in src/queue.ts, took 12h to debug (March 2025)
```

---

## 🧩 TIMPS VSCode Extension

```
ext install TIMPs.timps-ai-coding-agent
```

**Panels:** TIMPS Chat · Memory Explorer (episodic memory graph)
**Shortcuts:** `Cmd+Esc` open terminal · `Cmd+Shift+C` open chat

---

## 💻 CLI — Slash Commands & Flags

```bash
# Inside interactive session
/memory      — show what TIMPS remembers about this project
/todo        — manage task list
/branch      — snapshot current memory into a named branch
/merge       — merge a memory branch back
/skills      — list and install skills
/mcp         — list connected MCP servers
/models      — list available models
/doctor      — diagnose config issues
```

```bash
timps --provider <name>   # claude | openai | gemini | ollama | openrouter
timps --model <model>     # e.g. gpt-4o, claude-sonnet-4-5
timps --config            # setup wizard
timps --branch <name>     # start from a memory branch
```

---

## 🖥️ Full Server Setup

The full server enables MCP tools, the web dashboard, and the 17 intelligence tools.

**Docker (easiest):**
```bash
docker compose up -d
# Server: http://localhost:3000
# Dashboard: http://localhost:3000/dashboard.html
```

**Manual:**
```bash
cd sandeep-ai
cp .env.example .env   # add your API keys
npm install
npm run server
```

### 17 Intelligence Tools

| Tool | What it does |
|---|---|
| Contradiction Detector | Catches you contradicting past positions |
| Regret Oracle | Warns before you repeat a regretted decision |
| Bug Pattern Prophet | Knows your personal bug triggers |
| Burnout Seismograph | Monitors stress signals and burnout risk |
| Tech Debt Seismograph | Warns when code matches past incidents |
| API Archaeologist | Remembers undocumented API quirks |
| Living Manifesto | Derives your actual values from behavior |
| Dead Reckoning | Simulates future outcomes for decisions |
| Meeting Ghost | Extracts commitments from meeting notes |
| + 8 more | Skill tracking, team chemistry, institutional memory, and more |

---

## 📁 Repo structure

```
timps/
├── timps-code/     ← CLI coding agent   (npm install -g timps-code)
├── timps-mcp/      ← MCP server         (npm install -g timps-mcp)
├── timps-vscode/   ← VS Code extension  (VS Marketplace)
└── sandeep-ai/     ← Full server + REST API + dashboard
```

---

## Full MCP tool list

| Tool | What it does |
|---|---|
| `timps_chat` | Full conversation with all intelligence tools active |
| `timps_get_memories` | Recall stored facts, goals, and preferences |
| `timps_store_memory` | Permanently store a fact across sessions |
| `timps_check_contradiction` | Detects when you contradict a past decision |
| `timps_get_positions` | Lists all tracked positions and conflict counts |
| `timps_check_regret` | Warns before you repeat a regretted decision |
| `timps_log_decision` | Records a decision outcome for future warnings |
| `timps_burnout_analyze` | Current burnout risk assessment |
| `timps_record_signal` | Log a behavioral signal (overwork, skip, late) |
| `timps_warn_bug_pattern` | Warns if coding context matches your personal bug triggers |
| `timps_record_bug` | Record a bug to build your personal bug profile |
| `timps_check_tech_debt` | Warns if a code pattern matches past incidents |
| `timps_record_incident` | Record a production incident for future pattern matching |
| `timps_lookup_api` | Retrieve known quirks for an API you've used before |
| `timps_record_api_quirk` | Save a discovered API gotcha |
| `timps_extract_commitments` | Extract action items from meeting notes |
| `timps_get_pending_commitments` | List all open commitments |
| `timps_relationship_check` | Check relationship health and drift alerts |
| `timps_simulate_decision` | Simulate future outcomes before committing |
| `timps_get_manifesto` | Your living manifesto derived from behavior |

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
