<div align="center">

![Status](https://img.shields.io/badge/v2.0-INVESTOR%20READY-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Tools](https://img.shields.io/badge/Intelligence%20Tools-17-purple)

**A professional memory system that understands, recalls, and evolves with you.**

<p align="center">
  <img src="https://api.star-history.com/svg?repos=Sandeeprdy1729/timps&type=Date" />
</p>

[Quick Start](#quick-start) • [Features](#features) • [17 Tools](#17-intelligence-tools-new-in-v20) • [Commands](#commands) • [TUI Guide](TUI_README.md) • [Dashboard](#dashboard-new) • [Roadmap](#roadmap)

</div>

---

## What is TIMPs?

TIMPs is an **AI-powered memory partner** that:
- **Understands** your context and learns from conversations
- **Remembers** important facts and patterns across sessions
- **Retrieves** memories when relevant using semantic search
- **Evolves** by reflecting on retrieved memories
- **Interfaces** via beautiful TUI (Terminal UI), CLI, or Web UI
- **Isolates** memories by project to prevent contamination
- **Performs** dual-search (SQL + vectors) for accuracy
- **Detects** contradictions, burnout, regret patterns, and relationship drift *(new in v2.0)*

---

## What's New in v2.0

### 17 Intelligence Tools
TIMPs now ships with 17 specialized tools that are only possible with longitudinal memory. See [full list below](#17-intelligence-tools-new-in-v20).

### Tool Router
A two-layer routing system that decides which tools to activate per message — instant keyword matching (zero LLM cost) for obvious triggers, plus an LLM-based router for ambiguous messages. The agent no longer sends all 20 tool definitions on every request, making tool calling reliable and fast.

### Planner + Executor Wired
`planner.ts` and `executor.ts` were built but unused in v1.0. They are now fully integrated. For complex requests, the agent automatically builds a multi-step plan, executes each step in dependency order, and synthesizes a final response.

### Web Dashboard
New `dashboard.html` at `http://localhost:3000/dashboard` — shows your Living Manifesto, stored positions with conflict counts, relationship map, memory grid, and all 17 tools' data in one view.

### OpenRouter Support
New model provider supporting every major model (Claude, GPT-4o, Gemini, Llama) through a single API key. Add to `.env`:
```env
DEFAULT_MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-haiku
```

### Auto User Creation
The server now auto-creates user rows on first contact. No more foreign key errors on fresh databases.

### Static File Path Fix
`server.ts` now resolves the `public/` directory correctly for both `ts-node` and compiled `dist/` execution.

---

## System Overview

TIMPs is a production-ready AI agent system featuring:

- **Premium TUI Interface**: Professional 4-panel terminal UI with blessed
- **Web Chat + Dashboard**: Browser-based chat and intelligence dashboard
- **Memory-First Architecture**: 14-field schema with project isolation
- **Dual Search**: SQL (ILIKE) + Vector (Qdrant) semantic search
- **17 Intelligence Tools**: Contradiction detection, burnout prediction, relationship tracking, and more
- **Smart Tool Router**: Keyword + LLM routing — activates only relevant tools per message
- **Multi-Step Planning**: Planner + Executor for complex coordinated tasks
- **Model-Agnostic Design**: OpenRouter, OpenAI, Gemini, Ollama
- **Safe Deletion**: Confirmation-required commands with preview
- **Ephemeral Mode**: Temporary conversations for sensitive topics
- **CLI & REST API**: Multiple interfaces for integration

---

## Architecture

```
User Message
     │
     ▼
Tool Router ── keyword patterns + LLM routing ── selects 1-5 relevant tools
     │
     ▼
Planner ── breaks complex tasks into ordered steps
     │
     ▼
Agent Loop ── runs with focused tool set (not all 20 tools every time)
     │
     ▼
Memory Layer ── PostgreSQL (structured) + Qdrant (vector search)
     │
     ▼
Response + Reflection ── stores behavioral signals for future use
```

```
sandeep-ai/
├── main.ts                    # CLI entrypoint, --tui routing
├── package.json
├── tsconfig.json
├── .env
│
├── api/
│   ├── routes.ts             # API endpoints (+ 17-tool endpoints)
│   └── server.ts             # HTTP server (auto user creation, path fix)
│
├── config/
│   ├── env.ts                # Type-safe env (+ openrouter support)
│   └── index.ts
│
├── core/
│   ├── agent.ts              # Agent (+ tool router + planner/executor)  ← UPDATED
│   ├── toolRouter.ts         # Keyword + LLM tool routing                ← NEW
│   ├── executor.ts           # Task execution                             ← NOW WIRED
│   ├── planner.ts            # Planning logic                             ← NOW WIRED
│   ├── reflection.ts
│   └── index.ts
│
├── db/
│   ├── postgres.ts           # PostgreSQL (+ 17-tool tables)
│   ├── vector.ts
│   └── index.ts
│
├── interfaces/
│   ├── cli.ts
│   ├── tui.ts
│   └── tuiHandlers.ts
│
├── memory/
│   ├── embedding.ts
│   ├── index.ts
│   ├── longTerm.ts
│   ├── shortTerm.ts
│   └── memoryIndex.ts
│
├── models/
│   ├── baseModel.ts          # Interface
│   ├── openaiModel.ts        # OpenAI adapter
│   ├── geminiModel.ts        # Gemini adapter
│   ├── ollamaModel.ts        # Ollama adapter
│   ├── openRouterModel.ts    # OpenRouter adapter
│   └── index.ts              # Provider factory
│
├── tools/
│   ├── baseTool.ts
│   ├── fileTool.ts
│   ├── webSearchTool.ts
│   ├── contradictionTool.ts  ← NEW (Tool 5)
│   ├── positionStore.ts      ← NEW (Tool 5 data layer)
│   ├── allTools.ts           ← NEW (Tools 1-4, 6-17)
│   ├── toolsDb.ts            ← NEW (DB migrations for all 17 tools)
│   └── index.ts             ← UPDATED (all 17 registered)
│
└── public/
    ├── index.html            ← UPDATED (Dashboard link added)
    ├── chat.html             ← UPDATED (Arg DNA panel, OpenRouter option)
    └── dashboard.html        ← NEW (Intelligence dashboard)
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Ollama or OpenAI/OpenRouter API key
- Qdrant (optional — falls back to SQL search)

---

## Quick Start

### 1. Install Dependencies
```bash
cd sandeep-ai
npm install
```

### 2. Start Services
```bash
# Terminal 1: PostgreSQL (Docker recommended)
docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sandeep_ai \
  -p 5432:5432 postgres:17

# Terminal 2: Ollama (for embeddings)
ollama pull nomic-embed-text
ollama serve

# Terminal 3: Qdrant (optional)
docker run -p 6333:6333 qdrant/qdrant
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` — minimum required:
```env
DEFAULT_MODEL_PROVIDER=openrouter          # or ollama, openai, gemini
OPENROUTER_API_KEY=sk-or-v1-your-key       # get free at openrouter.ai
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-haiku

POSTGRES_HOST=localhost
POSTGRES_DB=sandeep_ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Embeddings — keep on Ollama even when using other providers
EMBEDDINGS_PROVIDER=ollama
EMBEDDINGS_MODEL=nomic-embed-text
EMBEDDINGS_DIMENSION=768
```

### 4. Run
```bash
npm run server
```

All database tables (including all 17 tool tables) are created automatically on first start.

### 5. Open
```
http://localhost:3000          ← Landing page
http://localhost:3000/chat     ← Chat interface
http://localhost:3000/dashboard ← Intelligence dashboard (NEW)
```

**You're done!** See [Full Setup Guide](QUICKSTART.md)

---

## Usage

### Web Interface (Recommended for v2.0)
Open `http://localhost:3000` and click **Start Session** or **Dashboard**.

### TUI Mode
```bash
npm run tui -- --user-id 1
npm run tui -- --user-id 1 --username "Developer"
npm run tui -- --user-id 1 --mode ephemeral
npm run tui -- --user-id 1 --provider openai
```

### CLI Mode
```bash
npm run cli -- --user-id 1 --interactive
```

---

## Commands

#### !blame \<keyword\>
Search memories containing keyword.

#### !forget \<keyword\>
Delete memories with confirmation.

#### !audit
Show last 10 memories with metadata.

#### !dna \<statement\> *(new)*
Check if a statement contradicts your stored positions:
```
> !dna Remote work kills collaboration

CONTRADICTION DETECTED — 78%
You argued the opposite on Sep 12: "Remote work significantly
increases developer productivity and should be the default."
```

---

## 17 Intelligence Tools *(new in v2.0)*

All tools are activated automatically by the Tool Router based on conversation context. You can also call them explicitly.

| # | Tool | Triggered when you... |
|---|------|-----------------------|
| 1 | **Temporal Mirror** | ...chat regularly — builds behavioral model over time |
| 2 | **Regret Oracle** | ...say "should I" or mention a past mistake |
| 3 | **Living Manifesto** | ...ask "what do I actually value" |
| 4 | **Burnout Seismograph** | ...mention stress, exhaustion, or being overwhelmed |
| 5 | **Argument DNA Mapper** | ...state an opinion or use `!dna` |
| 6 | **Dead Reckoning** | ...ask about long-term consequences or "what if" |
| 7 | **Skill Shadow** | ...say you're stuck or ask for advice |
| 8 | **Curriculum Architect** | ...want to learn something |
| 9 | **Tech Debt Seismograph** | ...describe code you're writing |
| 10 | **Bug Pattern Prophet** | ...mention a bug or debugging |
| 11 | **API Archaeologist** | ...ask about an API or mention undocumented behavior |
| 12 | **Codebase Anthropologist** | ...ask "why does this code do X" |
| 13 | **Institutional Memory** | ...want to preserve a decision's rationale |
| 14 | **Chemistry Engine** | ...ask about working with someone |
| 15 | **Meeting Ghost** | ...paste meeting notes |
| 16 | **Collective Wisdom** | ...want to know what others in your situation did |
| 17 | **Relationship Intelligence** | ...mention someone you haven't talked to in a while |

---

## Dashboard *(new)*

`http://localhost:3000/dashboard` shows:

- **Stat cards** — total memories, positions, pending commitments, tracked relationships
- **Living Manifesto** — your derived values from behavioral data
- **Burnout Seismograph** — signal history vs personal baseline
- **Argument DNA** — all stored positions with conflict counts
- **Relationship Map** — health scores and drift alerts
- **Meeting Ghost** — pending commitments with person and status
- **Bug Pattern Prophet** — your personal bug fingerprint
- **Memory Log** — recent 12 memories in a grid

---

## REST API

```bash
# Chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"message":"I think remote work is bad for teams"}'

# Memory
curl http://localhost:3000/api/memory/1

# Positions (Argument DNA)
curl http://localhost:3000/api/positions/1

# Contradiction check
curl -X POST http://localhost:3000/api/contradiction/check \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"text":"Remote work should be mandatory"}'

# Meeting commitments
curl http://localhost:3000/api/health
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_MODEL_PROVIDER` | openrouter / ollama / openai / gemini | ollama |
| `OPENROUTER_API_KEY` | OpenRouter key (openrouter.ai) | — |
| `OPENROUTER_DEFAULT_MODEL` | Any model slug from openrouter.ai | claude-3.5-haiku |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `GEMINI_API_KEY` | Gemini API key | — |
| `OLLAMA_BASE_URL` | Ollama server URL | http://localhost:11434 |
| `OLLAMA_DEFAULT_MODEL` | Ollama model name | llama3.1:8b |
| `POSTGRES_HOST` | Database host | localhost |
| `POSTGRES_PORT` | Database port | 5432 |
| `POSTGRES_DB` | Database name | sandeep_ai |
| `POSTGRES_USER` | Database user | postgres |
| `POSTGRES_PASSWORD` | Database password | — |
| `QDRANT_URL` | Vector store URL | http://localhost:6333 |
| `NODE_ENV` | Environment | development |
| `EMBEDDINGS_MODEL` | Embedding model | nomic-embed-text |
| `EMBEDDINGS_DIMENSION` | Embedding dimensions | 768 |
| `PORT` | API server port | 3000 |
| `API_KEY` | Optional API key for authentication | — |

### Database Schema

**Core tables** (unchanged from v1.0):
- `memories` — 14-field long-term memory store
- `users`, `conversations`, `messages`, `goals`, `preferences`, `projects`

**New tables added in v2.0** (created automatically):
- `positions` + `contradiction_history` — Argument DNA Mapper
- `behavioral_events`, `decisions` — Temporal Mirror, Regret Oracle
- `value_observations`, `manifestos` — Living Manifesto
- `burnout_signals`, `burnout_baseline` — Burnout Seismograph
- `workflow_patterns`, `life_simulations` — Skill Shadow, Dead Reckoning
- `learning_events`, `curricula` — Curriculum Architect
- `code_incidents`, `bug_patterns` — Tech Debt + Bug Prophet
- `api_knowledge`, `codebase_culture` — API Archaeologist + Codebase Anthropologist
- `institutional_knowledge` — Institutional Memory
- `behavioral_profiles`, `compatibility_scores` — Chemistry Engine
- `meeting_commitments` — Meeting Ghost
- `wisdom_contributions` — Collective Wisdom
- `relationship_signals`, `relationship_health` — Relationship Intelligence

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Store memory | 150ms | Async PostgreSQL + Qdrant |
| SQL search | 10ms | Indexed by (user_id, project_id) |
| Vector search | 50ms | Qdrant, top-10 results |
| Tool routing (keyword) | ~0ms | Pure regex, no LLM |
| Tool routing (LLM) | 300–800ms | Only for ambiguous messages >15 words |
| Contradiction check | 400–900ms | Embed + Qdrant search + LLM score |
| Multi-step plan | 2–8s | Planner + N executor steps |
| Reflection | 1–5s | LLM-dependent |
| TUI render | <30ms | Per frame |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check PostgreSQL: `docker ps` or `brew services start postgresql` |
| "fetch failed" on chat | Check model provider — set `DEFAULT_MODEL_PROVIDER` and matching API key in `.env` |
| "Site can't be reached" | Server not running or static file path issue — check `npm run server` output for `Serving static files from:` |
| "Cannot find module 'blessed'" | Run: `npm install` |
| "TUI doesn't render" | Try: `export TERM=xterm-256color` |
| "No response from Ollama" | Check: `curl localhost:11434/api/tags` |
| Tools not firing | Check `toolsActivated` field in API response — if empty, routing didn't trigger |

---

## Keyboard Shortcuts (TUI)

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+L` | Show audit log |
| `Tab` | Switch panels |
| `Ctrl+C` | Exit |
| `↑/↓` | Scroll history |
| `hjkl` | Vim navigation |

---

## Extending the System

### Adding a New Tool
```bash
# 1. Add class to tools/allTools.ts extending BaseTool
# 2. Add DB tables to tools/toolsDb.ts
# 3. Register in tools/index.ts
# 4. Add keyword patterns to core/toolRouter.ts
```

### Adding a New Model Provider
```bash
# 1. Create models/newModel.ts extending BaseModel
# 2. Add to config/env.ts interface + loadConfig()
# 3. Register in models/index.ts createModel() switch
# 4. Add to chat.html settings dropdown
```

---

## Deployment

### Railway (recommended)
```bash
# railway.toml is included — push repo and connect
railway up
```

### Render
```bash
# render.yaml is included — import repo in Render dashboard
```

### Docker
```bash
docker compose up
```

---

## Roadmap

- [x] TUI implementation (v1.0)
- [x] 17 intelligence tools (v2.0)
- [x] Tool router — keyword + LLM activation (v2.0)
- [x] Planner + Executor wired (v2.0)
- [x] Web dashboard (v2.0)
- [x] OpenRouter support (v2.0)
- [ ] npm package (`npx timps start`)
- [ ] VS Code extension (Tools 9+10 in-editor)
- [ ] Slack integration (Tool 15 auto-extracts commitments)
- [x] Docker Compose one-command setup
- [ ] TIMPS Team — shared engineering team memory
- [ ] TIMPS Guard — security pattern prevention
- [ ] TIMPS Docs — automated documentation

---

## Contributing

Pull requests welcome!

- [x] TUI (v1.0)
- [x] 17 intelligence tools (v2.0)
- [x] Docker Compose setup
- [ ] VS Code extension
- [ ] Additional LLM providers
- [ ] Performance optimizations

See [contributing.md](contributing.md) for full guide.

---

## License

MIT