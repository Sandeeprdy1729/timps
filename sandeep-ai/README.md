# TIMPS — Persistent AI Memory Layer

[![npm](https://img.shields.io/npm/v/timps?color=brightgreen)](https://www.npmjs.com/package/timps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Sandeeprdy1729/timps/blob/main/LICENSE)
[![CI](https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml/badge.svg)](https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml)

**Claude Code forgets everything when you close it. TIMPS remembers — forever.**

TIMPS is the persistent memory server that backs the CLI agent, MCP tools, and VS Code extension. It stores 3 layers of memory (working, episodic, semantic) and exposes 17 intelligence tools over a REST API.

---

## Quick Start (Docker — recommended)

```bash
# Clone and start everything in one command
git clone https://github.com/Sandeeprdy1729/timps
cd timps
docker compose up -d
```

Server starts at `http://localhost:3000`. Dashboard at `http://localhost:3000/dashboard.html`.

---

## Quick Start (manual)

```bash
cd sandeep-ai
cp .env.example .env   # add your API keys
npm install
npm run server
```

---

## This package is the TIMPS server

For the individual packages see:

| Package | Install | Purpose |
|---|---|---|
| [`timps-code`](https://www.npmjs.com/package/timps-code) | `npm install -g timps-code` | CLI coding agent (start here) |
| [`timps-mcp`](https://www.npmjs.com/package/timps-mcp) | `npm install -g timps-mcp` | MCP server for Claude/Cursor/Windsurf |
| `timps` | `npm install -g timps` | Full server (this package) |

---

## What TIMPS remembers

- **Working memory** — current goal, active files, recent errors this session
- **Episodic memory** — summaries of past conversations and what was built
- **Semantic memory** — facts, patterns, and conventions your codebase uses

> "Use the same pattern we always use for API routes" — TIMPS knows what you mean because it remembered it last week.

---

## 17 Intelligence Tools

| Tool | What it does |
|---|---|
| Contradiction Detector | Catches you contradicting past positions |
| Regret Oracle | Warns before you repeat a regretted decision |
| Bug Pattern Prophet | Knows your personal bug triggers before you write the bug |
| Burnout Seismograph | Monitors stress signals and burnout risk |
| Tech Debt Seismograph | Warns when code matches past production incidents |
| API Archaeologist | Remembers undocumented API quirks you've discovered |
| Living Manifesto | Derives your actual values from behavior |
| Dead Reckoning | Simulates future outcomes for decisions |
| Meeting Ghost | Extracts and tracks commitments from meeting notes |
| + 8 more | See [full docs](https://github.com/Sandeeprdy1729/timps#-timps-server-17-intelligence-tools) |

---

## Full documentation

**→ [github.com/Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps)**

---

## License

MIT
