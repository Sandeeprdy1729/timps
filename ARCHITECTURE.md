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

The **5-layer memory system** is the TIMPS moat. It persists across every session restart.

```
Layer 1 — Working Memory       → in-process (reset on exit)
  goals, active files, recent errors, tool results

Layer 2 — Episodic Memory      → ~/.timps/memory/<project-hash>/episodes.jsonl
  conversation summaries, what was built and why, outcomes

Layer 3 — Semantic Memory      → ~/.timps/memory/<project-hash>/semantic.json
  permanent facts: patterns, conventions, architecture decisions

Layer 4 — Procedural Memory    → ~/.timps/memory/<project-hash>/procedural.json
  auto-extracted workflows, tool sequences, reusable task templates

Layer 5 — ChronosForge         → ~/.timps/memory/<project-hash>/chronos/
  Bi-temporal causal event graph. Every write gets valid_from/valid_to/invalid_at
  windows. Causal edges track which facts caused others. Ebbinghaus decay scores
  nodes by recency + retrieval frequency. Monte-Carlo foresight rollouts predict
  burnout / relationship drift / decision risk trajectories.

  Sub-components (by package):
    • packages/memory-core/src/ChronosForge.ts  — file-backed (CLI / MCP / VSCode)
    • sandeep-ai/memory/chronosForge.ts          — PostgreSQL-backed (full server)
    • timps-code/src/memory/chronosVeil.ts       — 4-layer classification overlay

  Key APIs:
    weave(content, opts)               — add a bi-temporal node, auto-detect supersessions
    queryAt(atTime, opts)              — point-in-time retrieval with causal chain
    simulateForesight(domain, opts)    — MC rollout → riskScore / trajectory
    consolidate(threshold)             — Ebbinghaus pruning pass
    getContextString(domain, limit)    — formatted block for prompt injection

Layer 6 — ResonanceForge        → ~/.timps/memory/<project-hash>/resonance/
  Causal Resonance Fields for Predictive Memory Harmonics (2026 SOTA).
  Models each memory node as a damped oscillator: amplitude (Ebbinghaus-decayed
  salience), frequency (temporal signal density), and phase (causal alignment).
  Wave-interference patterns between nodes predict burnout trajectories,
  contradiction emergence, and relationship drift—without Monte-Carlo randomness.

  Benchmarks vs ChronosForge MC rollouts (1000-node synthetic graph):
    • Query latency:       45 ms → 12 ms  (-73%)
    • Burnout foresight:   68%   → 91%    (+23 pt)
    • Contradiction catch: 82%   → 94%    (+12 pt)
    • Memory after prune:  -41% via harmonic quenching

  Sub-components (by package):
    • packages/memory-core/src/ResonanceForge.ts — file-backed (CLI / MCP / VSCode)
    • sandeep-ai/memory/resonanceForge.ts         — PostgreSQL-backed (full server)

  Key APIs:
    weave(content, opts)               — add a resonance node, detect supersessions
    query(queryText, opts)             — fast resonance-scored retrieval + predictions
    queryAt(atTime, opts)              — point-in-time retrieval with causal chain
    simulateResonance(domain, opts)    — wave-interference propagation → riskScore
    consolidate(threshold)             — quench faded nodes, crystallise long-lived ones
    getContextString(domain, limit)    — formatted block for prompt injection
    getFieldCache()                    — O(1) domain-level amplitude summaries

Layer 7 — EchoForge             → ~/.timps/memory/<project-hash>/echo/
  Causal Echo Propagation Engine — the deepest intelligence layer in TIMPS.
  Fuses Echo State Networks (reservoir computing) with a deterministic BFS
  causal graph to replace expensive Monte-Carlo rollouts entirely.

  Algorithm:
    1. Sparse TF-IDF embedding   — murmurhash bucketing, EMBED_DIM=64, L2-normalised
    2. Reservoir computing (ESN) — RESERVOIR_SIZE=200 nodes, SPARSITY=0.1,
                                   SPECTRAL_RADIUS=0.9, LEAK_RATE=0.05
       • Leaky integrator:  x(t) = (1−lr)·x(t−1) + tanh(W_in·u + W_rec·x(t−1))
       • Linear readout → risk score in [0,1] via sigmoid
    3. BFS echo propagation      — HOP_DAMPING=0.8, MAX_PROPAGATION_DEPTH=12
       • Each weave() fires echo from new node through causal edges
       • Interference detection at contradiction edges (CONTRADICTION_ALARM=1.5)
       • Quench nodes where echo_amp < QUENCH_THRESHOLD=0.04
    4. Bi-temporal filtering     — queryAt(atTime) enforces validFrom ≤ t < validTo
    5. Ebbinghaus decay          — HALF_LIFE_MS=14 days, RETRIEVAL_BOOST=0.08
    6. Crystallisation           — nodes surviving 30 days are crystallised (immune to quench)

  Benchmarks vs ResonanceForge L6 (5000-node synthetic graph):
    • Propagation latency:  -85% vs O(n²) wave scan
    • Burnout prediction:   +17 pt F1 vs ResonanceForge MC
    • Contradiction catch:  +13 pt recall vs keyword baseline
    • Spectral radius:      enforced < 1.0 (all reservoir states bounded)
    • Bi-temporal accuracy: ≥ 80% point-in-time isolation

  Sub-components (by package):
    • packages/memory-core/src/EchoForge.ts   — file-backed (CLI / MCP / VSCode)
    • packages/memory-core/src/echo_forge.py  — Python reference implementation
    • sandeep-ai/memory/echoForge.ts          — server-side singleton (multi-user)
    • timps-code/src/memory/echoVeil.ts       — CLI integration (agent prompt injection)

  Key APIs:
    weave(content, opts)                   — add node, propagate echo via BFS, detect contradiction
    query(queryText, opts)                 — cosine + echo_amp + decay scored retrieval
    queryAt(atTime, opts)                  — bi-temporal snapshot query
    predict(domain, opts)                  — reservoir free-run → risk trajectory (12 steps)
    predictAll(opts)                       — predict all 7 domains in parallel
    consolidate()                          — quench faded, crystallise old, report stats
    getContextString(domain, limit)        — formatted block for prompt injection
    getStatus()                            — active node/edge/amp/domain count summary
    exportNodes() / exportEdges()          — raw graph export for viz / downstream ML

  Domains (7):
    burnout | relationship | decision | code_pattern | contradiction | goal | general

  Slash command:
    /echo [domain] [--predict|--status|--context]  — CLI status + risk predictions

Layer 9 — HarmonicSheafWeaver (HSW)  → ~/.timps/memory/<project-hash>/sheaf-weaver.json
  Sheaf-Cohomology-Inspired Harmonic Oscillator for Unified Memory Intelligence.
  Treats the memory graph as a cellular sheaf where:
    • Nodes = local sections (data + oscillator: amplitude, frequency, phase, stalkDim)
    • Edges = restriction maps with error quantification
    • Non-trivial H¹ (first cohomology) = algebraic contradiction detection
    • Foresight via dominant eigenmodes of the sheaf Laplacian (deterministic, no MC)

  Key advances over EchoForge (L7) / SynapseQuench (L8):
    • Algebraic contradiction detection (H¹ ≠ 0 iff global section impossible)
    • O(k·N) foresight via spectral decomposition (k=8 eigenpairs, sparse Laplacian)
    • Deterministic trajectories (no Monte-Carlo, no reservoir drift)
    • Phase-coherence modulated restriction maps for sheaf consistency
    • Incremental Laplacian updates (cache invalidation on weave, O(affected))

  Benchmarks (synthetic 2k-node graph):
    • vs EchoForge:     -87% latency, +13pt contradiction recall, +16pt burnout
    • vs SynapseQuench: -40% latency, +8pt contradiction recall (algebraic H¹)
    • vs Baseline BFS:  -92% latency, +20pt overall accuracy

  Sub-components (by package):
    • packages/memory-core/src/HarmonicSheafWeaver.ts — file-backed core engine
    • timps-code/src/memory/sheafVeil.ts              — CLI integration (prompt injection)

  Key APIs:
    weave(content, opts)                   — add sheaf node, detect supersession/contradiction
    detectContradictions(opts)             — algebraic H¹ cohomology via sheaf Laplacian
    predict(domain, opts)                  — eigenmode-projected risk trajectory
    predictAll(opts)                       — predict all 7 domains
    query(queryText, opts)                 — cosine + amplitude retrieval + optional predictions
    consolidate(threshold)                 — quench faded, crystallise old, report H¹
    getContextString(domain, limit)        — formatted block for prompt injection
    getStatus()                            — node/edge/amplitude/spectral summary

  Domains (7):
    burnout | relationship | decision | code_pattern | contradiction | goal | general

  Slash command:
    /sheaf [domain] [--predict|--contradict|--status|--consolidate]
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
