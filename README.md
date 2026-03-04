# TIMPs 1.0 — Trustworthy Interactive Memory Partner System



<p align="center">
  <img src="https://api.star-history.com/svg?repos=Sandeeprdy1729/timps&type=Date" />
</p>

<div align="center">

![Status](https://img.shields.io/badge/v1.0-LAUNCH%20READY-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

**A professional memory system that understands, recalls, and evolves with you.**

[Quick Start](#quick-start) • [Features](#features) • [Commands](#commands) • [TUI Guide](TUI_README.md) • [Roadmap](#roadmap)

</div>

---

## What is TIMPs?

TIMPs is an **AI-powered memory partner** that:
- **Understands** your context and learns from conversations
- **Remembers** important facts and patterns across sessions  
- **Retrieves** memories when relevant using semantic search
- **Evolves** by reflecting on retrieved memories
- **Interfaces** via beautiful TUI (Terminal UI) or CLI
- **Isolates** memories by project to prevent contamination
- **Performs** dual-search (SQL + vectors) for accuracy

## System Overview

TIMPs is a **v1.0 production-ready** AI agent system featuring:

- **Premium TUI Interface**: Professional 4-panel terminal UI with blessed
- **Memory-First Architecture**: 14-field schema with project isolation
- **Dual Search**: SQL (ILIKE) + Vector (Qdrant) semantic search
- **Model-Agnostic Design**: Pluggable interface for OpenAI, Gemini, and Ollama
- **Safe Deletion**: Confirmation-required commands with preview
- **Ephemeral Mode**: Temporary conversations for sensitive topics
- **CLI & REST API**: Multiple interfaces for integration

## Architecture

```
sandeep-ai/
├── main.ts                 # CLI entrypoint, --tui routing
├── package.json            # Dependencies (blessed, pg, @qdrant/js-client)
├── tsconfig.json           # TypeScript config
├── .env                    # Configuration
│
├── api/                    # Express REST handlers
│   ├── routes.ts          # API endpoints
│   └── server.ts          # HTTP server
│
├── config/                # Configuration management
│   ├── env.ts             # Type-safe env loading
│   └── index.ts           # Config exports
│
├── core/                  # AI Agent logic
│   ├── agent.ts           # Main agent class (robust JSON parsing)
│   ├── executor.ts        # Task execution
│   ├── planner.ts         # Planning logic
│   ├── reflection.ts      # Memory extraction & scoring
│   └── index.ts           # Exports
│
├── db/                    # Database layer
│   ├── postgres.ts        # PostgreSQL (14-field schema)
│   ├── vector.ts          # Qdrant integration
│   └── index.ts           # Exports
│
├── interfaces/
│   ├── cli.ts             # CLI commands (!blame, !forget, !audit)
│   ├── tui.ts             # Blessed TUI (4-panel layout) 
│   └── tuiHandlers.ts     # Reusable command handlers
│
├── memory/                # Memory system
│   ├── embedding.ts       # Vector generation
│   ├── index.ts           # Memory index
│   ├── longTerm.ts        # Persistent storage
│   ├── shortTerm.ts       # Session cache
│   └── memoryIndex.ts     # Memory manager (composite keys)
│
├── models/                # LLM providers
│   ├── baseModel.ts       # Interface
│   ├── openaiModel.ts     # OpenAI adapter
│   ├── geminiModel.ts     # Gemini adapter
│   ├── ollamaModel.ts     # Ollama adapter
│   └── index.ts           # Provider factory
│
├── tools/                 # External tools
│   ├── baseTool.ts        # Tool interface
│   ├── fileTool.ts        # File access
│   ├── webSearchTool.ts   # Web search
│   └── index.ts           # Exports
│
├── QUICKSTART.md          # 5-minute setup guide
├── TUI_README.md          # Full TUI documentation
└── README.md              # This file
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Ollama or OpenAI API (for LLM)
- Qdrant (optional, can use SQL-only)

## Quick Start

### 1. Install Dependencies
```bash
cd sandeep-ai
npm install
```

### 2. Start Services
```bash
# Terminal 1: PostgreSQL
brew services start postgresql  # macOS
# or: sudo systemctl start postgresql  # Linux

# Terminal 2: Ollama (recommended for local)
ollama serve
ollama pull mistral  # or llama2, neural-chat

# Terminal 3: Qdrant (optional)
docker run -p 6333:6333 qdrant/qdrant
```

### 3. Configure Environment
Edit `.env`:
```env
PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=sandeep_ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
QDRANT_URL=http://localhost:6333
```

### 4. Initialize Database
```bash
npm run init-db
```

### 5. Launch TUI
```bash
npm run tui -- --user-id 1
```

**You're done!** See [Full Setup Guide](QUICKSTART.md)

## Usage

### TUI Mode (Recommended)
```bash
# Default
npm run tui -- --user-id 1

# With username
npm run tui -- --user-id 1 --username "Developer"

# Ephemeral mode (no persistence)
npm run tui -- --user-id 1 --mode ephemeral

# Different model
npm run tui -- --user-id 1 --provider openai
```

### CLI Mode (Scripts/Automation)
```bash
npm run cli -- --user-id 1 --interactive
```

### Commands

#### !blame \<keyword\>
Search for memories containing keyword:
```
> !blame TypeScript

🔍 Found 2 memory item(s):
  [2] REFLECTION ⭐⭐⭐⭐⭐ favorite language is TypeScript
  [1] EXPLICIT ⭐⭐ TypeScript helps catch bugs early
```

#### !forget \<keyword\>
Delete memories with confirmation:
```
> !forget React

⚠️ Found 1 memory - preview:
  [1] React is my favorite UI framework

Delete? [Y/n]: Y
✅ Deleted 1 memory
```

#### !audit
Show last 10 memories with metadata:
```
> !audit

📋 AUDIT LOG
[2] REFLECTION ⭐⭐⭐⭐⭐
    favorite language is TypeScript
    Created: 2/16/2026, 6:47:52 PM | Retrieved: 1x

[1] EXPLICIT ⭐⭐
    React is my favorite UI framework  
    Created: 2/16/2026, 6:50:15 PM | Retrieved: 0x
```

### REST API

```bash
# Chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "username": "User",
    "message": "I like TypeScript"
  }'

# Get memory
curl http://localhost:3000/api/memory/1

# Get goals  
curl http://localhost:3000/api/goals/1
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROVIDER` | LLM provider (ollama/openai/gemini) | ollama |
| `OLLAMA_API_URL` | Ollama server URL | http://localhost:11434 |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GEMINI_API_KEY` | Gemini API key | - |
| `POSTGRES_HOST` | Database host | localhost |
| `POSTGRES_PORT` | Database port | 5432 |
| `POSTGRES_DATABASE` | Database name | sandeep_ai |
| `POSTGRES_USER` | Database user | postgres |
| `POSTGRES_PASSWORD` | Database password | - |
| `QDRANT_URL` | Vector store URL | http://localhost:6333 |
| `NODE_ENV` | Environment | development |
| `PORT` | API server port | 3000 

### Database Schema

**memories table** (14 fields):
```sql
CREATE TABLE memories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  memory_type ENUM('explicit', 'reflection'),
  importance INT (1-5),
  retrieval_count INT DEFAULT 0,
  last_retrieved_at TIMESTAMP,
  source_conversation_id UUID,
  source_message_id BIGINT,
  tags VARCHAR(255)[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project ON memories(user_id, project_id);
CREATE INDEX idx_updated ON memories(updated_at DESC);
```

<!-- ## Memory System Features

### 6 Complete Phases (v1.0)

**PHASE 1: Schema Design** ✅
- 14-field memory schema with type safety
- Audit trail (created_at, updated_at, last_retrieved_at)
- Importance scoring (1-5 stars)
- Retrieval tracking for analytics

**PHASE 2: Project Isolation** ✅
- Composite key: `userId:projectId`
- Prevents cross-project memory leakage
- Support for multiple projects per user

**PHASE 3: Search & Recall (!blame)** ✅
- Dual-search: SQL ILIKE + Qdrant vectors
- Merge and deduplicate results
- Auto-increment retrieval counter
- Smart sorting by importance + frequency

**PHASE 4: Safe Deletion (!forget)** ✅
- Preview memories before deletion
- Confirmation required (Y/N)
- Atomic delete from PostgreSQL + Qdrant
- Audit logging of deletions

**PHASE 5: Memory Introspection (!audit)** ✅
- View last 10 memories with full metadata
- Shows importance, type, retrieval count
- Formatted display with timestamps
- Real-time in TUI right panel

**PHASE 6: Ephemeral Mode** ✅
- Temporary conversations
- No storage to persistent layer
- Perfect for sensitive/private discussions
- Flag: `--mode ephemeral` -->

<!-- ### Memory Types

**EXPLICIT** — Facts directly stated
- "I like TypeScript" 
- Importance: 2-3 stars (user-direct)

**REFLECTION** — AI-discovered patterns
- "User prefers type-safe languages"
- Importance: 4-5 stars (inferred) -->

## Database Schema

The system automatically creates these tables:

- `memories` - Long-term memories (14 fields)
- `users` - User accounts
- `conversations` - Chat sessions
- `messages` - Individual messages
- `goals` - User goals
- `preferences` - User preferences
- `projects` - User projects

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Store memory | 150ms | Async PostgreSQL + Qdrant |
| SQL search | 10ms | Indexed by (user_id, project_id) |
| Vector search | 50ms | Qdrant, top-10 results |
| Merge results | 5ms | Deduplication in-memory |
| Total !blame | ~65ms | Sequential: SQL + vec + merge |
| Reflection | 1-5s | LLM-dependent |
| TUI render | <30ms | Per frame |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check PostgreSQL: `brew services start postgresql` |
| "Cannot find module 'blessed'" | Run: `npm install` |
| "TUI doesn't render" | Try: `export TERM=xterm-256color` |
| "No response from Ollama" | Check: `curl localhost:11434/api/tags` |
| "JSON parsing error" | Fixed in v1.0 ✅ |
| "!blame finds nothing" | Use `!audit` to verify memories exist |

## Extending the System

<!-- ### Adding a New Language Model

1. Create `models/newModel.ts` extending `BaseModel`
2. Implement `generate()` and `getEmbedding()` methods
3. Add to `models/index.ts` provider factory
4. Set `PROVIDER=newmodel` in .env

### Adding a Tool

1. Create `tools/newTool.ts` extending `BaseTool`
2. Implement `execute()` and `getDefinition()` methods
3. Add to `tools/index.ts`
4. AI will auto-call when contextually relevant -->

## Keyboard Shortcuts (TUI)

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+L` | Show audit log |
| `Tab` | Switch panels |
| `Ctrl+C` | Exit |
| `↑/↓` | Scroll history |
| `hjkl` | Vim navigation |

<!-- ## Roadmap for v1.1+

- [ ] Web UI dashboard (React)
- [ ] Docker Compose one-command setup
- [ ] Database export/analytics
- [ ] Fuzzy search + RegExp
- [ ] Memory visualization timeline
- [ ] Multi-user collaboration
- [ ] Redis caching layer
- [ ] Plugin system
- [ ] Advanced theme support -->

## Contributing

Pull requests welcome! Areas that need help:

- [x] TUI implementation (completed v1.0)
- [ ] Web UI dashboard
- [ ] Docker Compose setup
- [ ] Performance optimizations
- [ ] Additional LLM providers
- [ ] Tool system expansion

## License

MIT
