# TIMPS Documentation

## Installation

### CLI
```bash
npm install -g timps-code
cd your-project
timps
```

### MCP Server (Claude Code, Cursor, Windsurf)
```bash
npm install -g timps-mcp
```

Add to your MCP client config:
```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "PROJECT_PATH": "/path/to/project" }
    }
  }
}
```

### VS Code Extension
Search for **"TIMPS — AI Coding Agent"** in the Extensions Marketplace, or:
```bash
code --install-extension TIMPs.timps-ai-coding-agent
```

### Library
```bash
npm install @timps/memory-core
```

---

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic (Claude) API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `TIMPS_MODEL` | `claude-3-5-sonnet-20241022` | Model string (prefix with `ollama/` for local) |
| `TIMPS_URL` | — | Remote timps server URL (MCP mode) |
| `TIMPS_TOKEN` | — | Auth token for remote server |
| `PROJECT_PATH` | `process.cwd()` | Project root for memory scoping |

### Model selection

```bash
# Use Claude Sonnet (default)
timps

# Use GPT-4o
TIMPS_MODEL=gpt-4o timps

# Use local Ollama (free, no API key)
TIMPS_MODEL=ollama/mistral timps

# Use Gemini 2.0 Flash
TIMPS_MODEL=gemini-2.0-flash-exp timps
```

### Memory location

All memory is stored at `~/.timps/memory/<project-hash>/`:

```
~/.timps/memory/<hash>/
├── episodes.jsonl    # Episodic memory (session history)
├── semantic.json     # Semantic memory (facts + patterns)
└── working.json      # Working memory (current session)
```

The hash is SHA-256 of the absolute project path. Installed skills live at `~/.timps/skills/<id>.md`.

---

## Vision

TIMPS is a **persistent memory layer for code AI agents**. Unlike every other coding agent that starts from scratch each session, TIMPS remembers your project's architecture, past decisions, bug patterns, team knowledge, and technical debt — across sessions, across tools, across your entire team.

### Who is this for?

- **Solo developers** who want an AI that actually learns your codebase
- **Teams** who want shared project memory (server mode)
- **Anyone tired of re-explaining** their project to Claude/GPT every time

---

## 17 Intelligence Tools

The following table lists the intelligence tools available in `packages/memory-core/` (the canonical memory implementation). Each tool is a named class in `packages/memory-core/src/intelligence/`.

| # | Tool | What it does |
|---|---|---|
| 1 | **AetherWeft** | Analyzes code sentiment and emotional patterns in commit messages |
| 2 | **ApexSynapse** | Cross-reference detection between concepts |
| 3 | **AtomChain** | Semantic chunking of large documents |
| 4 | **BindWeave** | Links related facts into knowledge clusters |
| 5 | **ChronosVeil** | Temporal pattern detection and anomaly detection |
| 6 | **CurateTier** | Automatic memory importance scoring |
| 7 | **EchoForge** | Generates analogies and metaphors for concepts |
| 8 | **ForgeLink** | Creates bidirectional links between knowledge nodes |
| 9 | **GovernTier** | Memory access control and policy enforcement |
| 10 | **LayerForge** | Manages hierarchical memory layer transitions |
| 11 | **NexusForge** | Identifies central concepts and hub nodes |
| 12 | **PolicyMetabol** | Extracts and enforces project policies from memory |
| 13 | **SkillWeave** | Composes skills into coherent system prompts |
| 14 | **SynapseMetabolon** | Cross-session pattern synthesis and insight generation |
| 15 | **TemporaTree** | Manages temporal knowledge graphs with decay |

---

## Universal Provider Mesh

TIMPS routes every request through a provider-agnostic adapter layer. No matter which LLM you use — local or cloud — the memory system, tool execution, and agent loop are identical.

```
                  timps CLI / MCP / VS Code
                         │
              ┌──────────┴──────────┐
              │  Provider Router     │
              │  (auto-detect)       │
              └──────────┬──────────┘
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐  ┌──▼───┐  ┌──▼────┐
         │ Claude │  │GPT-4o│  │Gemini │
         └────┬───┘  └──┬───┘  └──┬────┘
              │          │          │
         ┌────▼───┐  ┌──▼───┐  ┌──▼────┐
         │Ollama  │  │ Groq │  │OpenRouter
         └────────┘  └──────┘  └───────┘
```

```bash
# Auto-detect Ollama, else ask
timps "analyze this codebase"

# Explicit provider
timps --provider claude "refactor auth"
timps --provider gemini "explain architecture"
timps --provider ollama "quick fix"
timps --provider openrouter "complex task"
```

---

## Swarm Architecture

TIMPS includes a **10-agent swarm** that decomposes complex tasks across specialist agents:

| Agent | Job |
|---|---|
| **Product Manager** | Requirements decomposition |
| **Architect** | System design and technology selection |
| **Code Generator** | Implementation |
| **Reviewer** | Code review and quality checks |
| **QA** | Test generation |
| **Security** | Security audit |
| **Performance** | Performance analysis |
| **DevOps** | Deployment configuration |
| **Documentation** | Docstring and README generation |
| **Orchestrator** | Coordinates the DAG |

The swarm fan-out is **local** — all agents run in-process, not distributed. Launch via:

```bash
timps --swarm "design a microservices auth system"
```

Or from the REPL with `/swarm`.

---

## MCP Ecosystem

TIMPS exposes 46 tools as an MCP server (`timps-mcp`) so any MCP-compatible client (Claude Code, Cursor, Windsurf, Continue, Aider...) gets memory, intelligence, and velocity tracking.

```
Claude Code / Cursor / Windsurf / any MCP client
         │
    ┌────▼────┐
    │timps-mcp│  npm install -g timps-mcp
    └────┬────┘
         │
    ┌────▼────┐
    │ Memory  │  46 tools across 6 categories
    │Engine   │  + 17 intelligence tools
    └─────────┘
```

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000" }
    }
  }
}
```

---

## Multi-Surface Support

| Surface | Status | Package |
|---|---|---|
| **CLI** | 🟢 Stable | `timps-code` |
| **MCP Server** | 🟢 Stable | `timps-mcp` |
| **VS Code** | 🟢 Stable | `timps-ai-coding-agent` |
| **Mobile** | 🟡 Experimental | `@timps/mobile` |
| **Docker** | 🟢 Stable | `compose.yaml` |
| **npm library** | 🟢 Stable | `@timps/memory-core` |

---

## Git-Style Memory Branching

```
main          ●────────●────────●────────●
                   \         /
memory/auth-feat   ●───────●
```

Feature branches get their own memory namespace, isolated from `main`.

```
timps --branch auth-refactor "analyze the auth module"
```

When the branch is merged, the memory is:

- **Merged** into main if patterns are generally useful
- **Archived** if branch-specific
- **Discarded** if abandoned

Data is not deleted — it's moved to an `archived/` subtree. A `--branch` flag on any command scopes memory operations to that branch.

---

## The 9-Layer Memory System

```
L1  Working        Current session state, ephemeral
L2  Episodic       Append-only session log
L3  Semantic       Facts, patterns, decisions (long-term)
L4  Procedural     Workflow scripts, runbook fragments
L5  ChronosForge   Temporal pattern weaving across sessions
L6  ResonanceForge Cross-project insight discovery
L7  EchoForge      Analogical reasoning (metaphors, analogies)
L8  SynapseQuench  Multi-agent context compression
L9  HarmonicSheafWeaver  Unified knowledge graph
```

L1–L3 ship in `packages/memory-core`. L4–L9 are available as intelligence tools but require explicit activation.

---

## Architecture

```
timps/
├── timps-code/              # CLI agent
│   ├── src/tools/           # Tool definitions (ALL_TOOLS)
│   ├── src/core/            # Agent loop, app entry
│   ├── src/models/          # 7 provider adapters
│   ├── src/services/mcp/    # MCP client for tools
│   ├── src/memory/          # Runtime memory wrappers
│   └── src/ui/              # Ink/React 19 TUI
├── timps-mcp/               # MCP server (46 tools)
│   └── src/index.ts
├── timps-vscode/            # VS Code extension
├── packages/memory-core/    # Canonical memory implementation
│   ├── src/intelligence/    # 17 intelligence tools
│   ├── src/memory/          # L1–L3 storage
│   └── __tests__/
├── crates/                  # Rust re-implementations
│   ├── timps-memory/
│   ├── timps-agent/
│   └── timps-cli/
└── sandeep-ai/              # Full server + REST API
```

---

## Why TIMPS vs. The Competition

| Feature | TIMPS | Claude Code | Cursor | Copilot | Aider |
|---|---|---|---|---|---|
| Persistent memory | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| Local-first | ✅ Free w/ Ollama | ❌ API-key | ❌ API-key | ❌ API-key | ⚠️ API-key |
| Open source | ✅ MIT | ❌ | ❌ | ❌ | ✅ MIT |
| Swarm (10 agents) | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| MCP server | ✅ 46 tools | ❌ | ❌ | ❌ | ❌ |
| VS Code extension | ✅ Yes | ❌ | ✅ Yes | ✅ Yes | ❌ |
| Cross-model | ✅ 7 providers | ❌ Claude only | ⚠️ Limited | ❌ GPT only | ⚠️ Limited |

---

## Built for Local-First Developers

TIMPS runs fully local — no telemetry, no API keys required (with Ollama).

| Concern | How TIMPS handles it |
|---|---|
| **Privacy** | 100% local with Ollama. No code sent to third parties |
| **Cost** | Free inference with Ollama. Pay only for cloud models when you want |
| **Offline** | Works on a plane with Ollama |
| **Speed** | Local inference has no round-trip. ~10ms memory operations |
| **Control** | Full memory visibility at `~/.timps/memory/`. Clear it anytime you like |

```bash
# Free local setup — no API key needed
brew install ollama
ollama pull mistral
npm install -g timps-code
timps "what does this codebase do?"
```

## Benchmarks

| Benchmark | Target | Current | Status |
|---|---|---|---|
| **Memory Recall (R@5)** | 95%+ | **95%** | 🟢 Achieved |
| **Memory Recall (R@1)** | 70%+ | **75%** | 🟢 Achieved |
| **MRR** | 0.80+ | **0.82** | 🟢 Achieved |
| **Contradiction Detection** | 95%+ | **100% (10/10)** | 🟢 Achieved |
| **Intelligence Tool Coverage** | 100% | **100% (17/17)** | 🟢 Achieved |
| **Scalability @ 500 facts** | <50ms | **~1ms** | 🟢 Achieved |

```bash
npx tsx benchmark/index.ts
```

Versioned dataset at [`benchmark/dataset/`](benchmark/dataset/) · SHA256: `f1e0387495e6e111`.

---

## Performance-Critical Core

The memory engine ships in two languages:
- **TypeScript** (`packages/memory-core`) — default, easy to hack
- **Rust** (`crates/timps-memory`) — NAPI-RS bindings, 19 tests, used for hot paths

Plus `crates/timps-agent`, `crates/timps-cli`, `crates/timps-providers`, `crates/timps-server`, `crates/timps-tools` for maximum throughput.

---

## CLI Reference

### Interactive session

```bash
timps                      # Start interactive REPL
timps "query or task"      # One-shot mode
```

### Slash commands

| Command | Description |
|---|---|
| `/help` | Show help |
| `/memory stats` | Memory usage statistics |
| `/memory search <q>` | Search semantic memory |
| `/memory clear` | Clear working memory |
| `/memory reset` | Wipe all memory for this project |
| `/skills list` | Browse skill marketplace |
| `/skills search <q>` | Search available skills |
| `/skills install <id>` | Install a skill |
| `/skills show <id>` | View installed skill content |
| `/git status` | Git status |
| `/git diff` | Working tree diff |
| `/git diff --staged` | Staged diff |
| `/git commit` | Write commit message with context |
| `/git branch` | Branch timeline from memory |
| `/git log` | Log with memory annotations |
| `/swarm` | Launch multi-agent swarm analysis |
| `/exit` | Save snapshot and exit |

---

## Memory System

TIMPS maintains a persistent 9-layer memory system that survives restarts.

### L1 — Working Memory

Current session state — reset each session.

```typescript
interface WorkingMemory {
  goal: string;
  activeFiles: string[];
  discoveredPatterns: string[];
  pendingQuestions: string[];
  context: Record<string, unknown>;
}
```

Stored at `working.json`. API: `engine.setWorkingMemory()`, `engine.getWorkingMemory()`.

### L2 — Episodic Memory

Append-only log of every session.

```typescript
interface Episode {
  id: string;
  summary: string;
  startedAt: string;
  endedAt: string;
  filesChanged: string[];
  decisions: string[];
  outcome: 'success' | 'partial' | 'abandoned';
  tags: string[];
}
```

Stored at `episodes.jsonl` (JSONL format, never deleted). API: `engine.startEpisode()`, `engine.endEpisode()`, `engine.loadEpisodes()`.

### L3 — Semantic Memory

Distilled facts about the project — patterns, decisions, constraints, preferences.

```typescript
interface MemoryEntry {
  id: string;
  type: 'architecture' | 'pattern' | 'preference' | 'bug-pattern' | 'constraint' | 'tech-debt';
  content: string;
  importance: number;       // 0.0 to 1.0
  accessCount: number;
  lastAccessedAt: string;
  createdAt: string;
  tags: string[];
  source?: string;
}
```

Stored at `semantic.json` (upserted by content hash). Retrieved via MiniSearch full-text search, ranked by relevance + importance.

```typescript
const facts = await engine.recall('payment processing', { limit: 5, type: 'architecture' });
const contradictions = await engine.detectContradictions();
```

### L4–L9

L4 Procedural → L5 ChronosForge → L6 ResonanceForge → L7 EchoForge → L8 SynapseQuench → L9 HarmonicSheafWeaver.
See the [9-Layer Memory System section](#the-9-layer-memory-system) above.

---

## MCP Tools (`timps-mcp`)

46 tools across 6 categories:

### Core memory (5)
`timps_remember`, `timps_recall`, `timps_start_episode`, `timps_end_episode`, `timps_get_stats`

### Semantic analysis (8)
`timps_detect_contradiction`, `timps_get_architecture_insights`, `timps_record_decision`, `timps_get_decisions`, `timps_add_tech_debt`, `timps_get_tech_debt`, `timps_record_bug_pattern`, `timps_get_bug_patterns`

### Velocity tracking (5)
`timps_record_velocity`, `timps_get_velocity_trend`, `timps_get_velocity_patterns`, `timps_predict_completion`, `timps_record_blocker`

### Team memory (6)
`timps_add_team_member`, `timps_get_team_context`, `timps_record_standup`, `timps_get_standups`, `timps_add_ownership`, `timps_get_ownership`

### Institutional memory (7)
`timps_record_incident`, `timps_get_incidents`, `timps_add_runbook`, `timps_get_runbook`, `timps_record_meeting`, `timps_get_meetings`, `timps_get_commitments`

### Intelligence tools (15)
Aether Weft, Apex Synapse, Atom Chain, Bind Weave, Chronos Veil, Curate Tier, Echo Forge, Forge Link, Govern Tier, Layer Forge, Nexus Forge, Policy Metabol, Skill Weave, Synapse Metabolon, Tempora Tree.

---

## VS Code Extension

The **TIMPS — AI Coding Agent** extension provides:

- **Chat panel** — full agent chat powered by your configured model
- **Memory Layers view** — live tree of working/episodic/semantic memory
- **Skills support** — installed skills loaded automatically at startup
- **Remote server** — optionally connects to a shared team memory server

### Memory Layers tree view

```
🧠 Semantic Facts (42)
  ├── [architecture] Uses event sourcing for orders   ★★ accessed 5×
  ├── [pattern] Always use zod for API input validation   ★ accessed 2×
  └── ... (top 50 by importance/access count)

📖 Recent Sessions (15)
  ├── Implement payment retry logic   2026-05-07
  └── ...

⚡ Working Memory (3 files)
  ├── Goal: Add webhook retry mechanism
  ├── src/payments/retry.ts
  └── Pattern: Idempotency key pattern used
```

Auto-refreshes via `fs.watch` on memory files. Manual refresh with `TIMPS: Refresh Memory` command.

### Extension settings

| Setting | Default | Description |
|---|---|---|
| `timps.model` | `claude-3-5-sonnet-20241022` | Model to use |
| `timps.serverUrl` | — | Remote server URL |
| `timps.serverToken` | — | Auth token |

---

## Skills

Skills are Markdown documents that inject domain knowledge into the agent's system prompt.

### Browse
```
/skills list
/skills search security
```

### Install
```
/skills install nextjs-patterns
```

Skills are written to `~/.timps/skills/<id>.md` and loaded at agent startup. No network request — entirely local.

### Create a skill

Skills are JSON entries in `timps-code/src/skills/registry.json`:

```typescript
interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  version: string;
  content: string;        // Markdown injected into system prompt
}
```

Submit a PR with `feat(skills): add <id>` to contribute.

---

## Contributing

### Repo layout

```
timps/
├── packages/memory-core/   # @timps/memory-core
├── timps-code/             # CLI agent
├── timps-mcp/              # MCP server
├── timps-vscode/           # VS Code extension
├── crates/                 # Rust implementations
└── sandeep-ai/             # Full server + REST API
```

### PR checklist

- `npx tsc --noEmit` passes in affected package
- Tests pass: `npm test`
- New tools have accurate descriptions
- Memory schema changes are backwards compatible
- Update `CHANGELOG.md` under `[Unreleased]`

### Build

```bash
npm run build         # turbo run build (all packages)
npm run build:ci      # CI-targeted build (excludes mobile/plugins/docs/timps-code/timps-mcp)
npm test              # turbo run test
npm run typecheck     # turbo run typecheck
```

### Changesets

```bash
npx changeset         # Add a changeset for versioned packages
```
