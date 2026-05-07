# TIMPS — Architecture

> Last updated: May 2026

## Codebase size (verified)

Counted with: `find . -type f -name "*.ts" ! -name "*.d.ts" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/out/*" | xargs wc -l`

| Package | TypeScript LOC | Purpose |
|---|---|---|
| `timps-code` | ~19,500 | CLI coding agent, agent loop, 25+ tools, TUI |
| `sandeep-ai` | ~20,300 | Full server, REST API, dashboard, 17 intelligence tools |
| `timps-vscode` | ~5,200 | VS Code extension, chat panel, memory explorer |
| `timps-mcp` | ~540 | MCP server, 20 persistent-memory tools |
| **Total** | **~45,500** | |

## Package map

```
timps/
├── timps-code/          # npm install -g timps-code
│   └── src/
│       ├── agent/       # Coder, Planner, Verifier, Navigator agents
│       ├── bin/         # CLI entry point (timps.ts)
│       ├── commands/    # Slash command handlers (/memory, /skills, /branch…)
│       ├── config/      # Provider and model configuration
│       ├── core/        # app.ts (AgentLoop), agent.ts, toolRouter.ts
│       ├── memory/      # 3-layer memory: snapshot.ts, memory.ts
│       ├── models/      # Provider adapters: Claude, GPT, Gemini, Ollama, OpenRouter
│       ├── swarm/       # Multi-agent orchestration
│       ├── tools/       # 25+ tools: file, git, shell, web, memory
│       └── ui/          # Ink/React TUI (App.tsx, components)
│
├── timps-mcp/           # npm install -g timps-mcp
│   └── src/
│       └── index.ts     # 20 MCP tool definitions (single-file server)
│
├── timps-vscode/        # VS Code Marketplace: TIMPs.timps-ai-coding-agent
│   └── src/
│       ├── extension.ts         # Activation entry point
│       ├── chatPanel.ts         # Webview chat UI
│       ├── memory.ts            # Memory sidebar + episodic viewer
│       ├── nexusExplorer.ts     # Memory graph explorer (WebView)
│       ├── features/            # Individual extension features
│       └── client/              # timpsClient.ts — connects to sandeep-ai
│
└── sandeep-ai/          # npm install -g timps (full server)
    └── src/
        ├── core/        # Agent loop, planner, executor, 17 intelligence tools
        ├── memory/      # Long-term + embedding memory
        ├── tools/       # Extended tool set (17 intelligence tools)
        ├── models/      # Provider adapters
        ├── api/         # Express REST routes
        └── db/          # PostgreSQL + Qdrant vector DB
```

## Memory architecture

The 3-layer memory system is the TIMPS moat. It persists across every session restart.

```
Working Memory       → in-process (reset on exit)
  goals, active files, recent errors, tool results

Episodic Memory      → ~/.timps/memory/<project-hash>/episodes.jsonl
  conversation summaries, what was built and why, outcomes

Semantic Memory      → ~/.timps/memory/<project-hash>/semantic.json
  permanent facts: patterns, conventions, architecture decisions
```

Memory is keyed by a SHA256 hash of the absolute project path, so each project has isolated memory.

## Agent loop (timps-code)

```
User input
  → src/core/app.ts   AgentLoop.run()
  → src/core/agent.ts  build prompt = system + memory recall + user message
  → Provider API       stream response
  → Tool router        execute tools in sequence
  → Memory             write observations back to episodic/semantic
  → TUI                stream tokens to src/ui/App.tsx
  → Retry (× 3)        on tool error, revise approach and retry
```

## Intelligence tools (sandeep-ai)

17 tools that analyze your personal history to give advice no general LLM can:

| Tool | What it detects |
|---|---|
| Contradiction Detector | When you contradict a past decision |
| Regret Oracle | Before you repeat a regretted outcome |
| Bug Pattern Prophet | Your personal coding anti-patterns |
| Burnout Seismograph | Stress/burnout signals from behavior |
| Tech Debt Seismograph | Code patterns that caused past incidents |
| API Archaeologist | Undocumented quirks you've discovered |
| Living Manifesto | Your actual values derived from behavior |
| Dead Reckoning | Simulated outcome of a pending decision |
| Meeting Ghost | Commitments extracted from meeting notes |
| + 8 more | Skill, velocity, team, institutional memory… |

## CI matrix

All packages are tested on Ubuntu, macOS, and Windows with Node 18, 20, and 22.
See [.github/workflows/ci.yml](../.github/workflows/ci.yml).

## Roadmap (next phases)

| Phase | Goal |
|---|---|
| Phase 1 | Extract `@timps/memory-core` as standalone npm package |
| Phase 2 | Publish memory recall benchmark + expand MCP 20→40 tools |
| Phase 3 | Skills marketplace + VS Code memory graph UI |
| Phase 4 | Turborepo migration + Docusaurus docs site |
| Phase 5 | Web memory dashboard (sigma.js graph) |
| Phase 6 | Rust memory core (10× performance) |
| Phase 7 | Tauri desktop app (macOS/Linux/Windows) |
| Phase 8 | CI/CD for all packages + cross-platform Tauri binary distribution |
| Phase 9 | `@timps/plugin-sdk` — formal agent plugin interface (types, registry, loader, reference plugin) |
| Phase 10 | Plugin runtime integration — `PluginManager` wired into `timps-code` agent loop + `/plugin` slash command |

See [CHANGELOG.md](../CHANGELOG.md) for recent changes.
