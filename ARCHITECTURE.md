# TIMPS — Architecture

> Last updated: May 2026

## Codebase size (verified)

Counted with: `find . -type f -name "*.ts" ! -name "*.d.ts" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/out/*" | xargs wc -l`

| Package | TypeScript LOC | Purpose |
|---|---|---|
| `timps-code` | ~19,500 | CLI coding agent, agent loop, 25+ tools, TUI |
| `packages/server` | ~20,300 | Full server, REST API, dashboard, 17 intelligence tools |
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
│       ├── memory/      # 9-layer memory: snapshot.ts, memory.ts
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
│       └── client/              # timpsClient.ts — connects to packages/server
│
└── packages/server/          # Full server (@timps/server)
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
    • packages/server/memory/chronosForge.ts          — PostgreSQL-backed (full server)
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
    • packages/server/memory/resonanceForge.ts         — PostgreSQL-backed (full server)

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
    • packages/server/memory/echoForge.ts          — server-side singleton (multi-user)
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

## Intelligence tools (packages/server)

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

---

## Memory architecture — three implementations

This trips up every new agent. Memory is implemented in three places that overlap and are out of sync:

1. **`packages/memory-core/`** — canonical library, exports `MemoryEngine` + the advanced layers (ChronosForge, ResonanceForge, EchoForge, HarmonicSheafWeaver) + the 17 intelligence tools. Used by `timps-code` via `@timps/memory-core` import. **This is the source of truth for intelligence tool behavior.**
2. **`timps-code/src/memory/`** — runtime wrappers + the early-layer files (snapshot, procedural, knowledgeGraph, hybridRetriever, sqliteStore, chronosVeil, etc.) and the L8 SynapseQuench that does NOT live in memory-core.
3. **`packages/server/memory/`** — server-side re-implementations (longTerm, shortTerm, embedding, plus its own copies of EchoForge/ResonanceForge/ChronosForge/harmonicSheafWeaver). The 17 intelligence tool logic here is a different code path that may drift from memory-core.

Layers in the active memory stack (per `timps-code/src/memory/memory.ts`):
- L1 Working, L2 Episodic, L3 Semantic, L4 Procedural, L5 ChronosForge, L6 ResonanceForge, L7 EchoForge, L8 SynapseQuench, L9 HarmonicSheafWeaver.

When changing memory behavior, identify which of the three implementations your code path uses **first**. Don't edit memory-core expecting it to affect packages/server.

## 17 intelligence tools — canonical list (memory-core)

All 17 are in `packages/memory-core/src/intelligence/`, all are class-based with a `(dir: string)` constructor, all use file-based JSON storage under `~/.timps/memory/<hash>/`, **none of them use `Math.random()`** (verified by grep). Accessed via lazy getters on `MemoryEngine`.

| # | Tool | Engine class | File | What it does |
|---|---|---|---|---|
| 1 | Contradiction Detector | `ContradictionDetector` | `contradiction.ts` | Catches you contradicting a past decision. Algorithm: Jaccard word similarity × 1.4 (with sentiment flip); verdict = `CONTRADICTION` if score > 0.7, `PARTIAL` if > 0.35, `CLEAN` otherwise. |
| 2 | Burnout Seismograph | `BurnoutSeismograph` | `burnout.ts` | Records behavioral signals, computes baseline, alerts on >20% deviation. **Requires explicit `computeBaseline()` call** between baseline signals and deviation signals — `analyze()` alone does not compute the baseline. |
| 3 | Regret Oracle | `RegretOracle` | `regretOracle.js` | Warns before you repeat a regretted outcome. Method: `log(decision, context, regret_score, category)` then `check(situation)`. Returns `{ warning, matching_past_decision, similarity_score, message }` (field is `warning`, not `warn`). |
| 4 | Tech Debt Seismograph | `TechDebtSeismograph` | `techDebt.ts` | Pattern matching against past incidents. Returns `{ warning }` (not `hasDebt`). |
| 5 | Bug Pattern Prophet | `BugPatternProphet` | `bugPattern.ts` | Records bug types + trigger context, warns on context overlap. Returns `{ alert, risk_level, likely_bug_types, reason, suggestion }`. |
| 6 | API Archaeologist | `APIArchaeologist` | `apiArchaeologist.ts` | Stores undocumented API quirks. Returns `{ api, quirks, total }` (not `found`). |
| 7 | Velocity Tracker | `VelocityTracker` | `velocityTracker.ts` | Workflow pattern learning + coaching. Use `observe(pattern_type, description, success_rate)` then `coach(situation)` → `{ advice, relevant_pattern, confidence, action_now }`. |
| 8 | Architecture Drift Detector | `ArchitectureDriftDetector` | `architectureDrift.ts` | Detects deviation from past arch decisions. Use `recordInsight(insight_type, description, project_id?, evidence?)` (NOT `recordDecision`); `insight_type` enum: `'architectural_decision' \| 'cultural_allergy' \| 'workaround' \| 'rejected_approach' \| 'convention' \| 'constraint'`. Then `driftCheck(patterns)` → `{ hasDrift }`. |
| 9 | Pattern Learner | `PatternLearner` | `patternLearner.ts` | General observation deduplication. |
| 10 | Meeting Ghost | `MeetingGhost` | `meetingGhost.ts` | Extracts commitments ("@alice will fix X by Friday") from meeting notes via regex + participant detection. Methods: `extract(notes, title)`, `getPending()`, `complete(idPrefix)`. |
| 11 | Dead Reckoning | `DeadReckoning` | `deadReckoning.ts` | Simulates likely outcomes of a decision from similar past decisions. Methods: `log(decision, context, regret_score, outcome)`, `simulate(scenario, horizon_months?)`. Jaccard-weighted vote, returns `{ predicted_outcome, confidence, rationale, similar_past }`. |
| 12 | Living Manifesto | `LivingManifesto` | `livingManifesto.ts` | Derives your actual values from behavior, not stated beliefs. Methods: `ingest(text)`, `generate()` → `{ values, anti_patterns, decisions_analyzed }`. Mines from positions.json + decisions.json + architecture_insights.json automatically on init. |
| 13 | Relationship Intelligence | `RelationshipIntelligence` | `relationship.ts` | Tracks contacts, alerts on contact drift >90 days. Methods: `recordMention(name, context)`, `check(name?)`, `driftAlerts()`. No calendar integration — purely text-based. |
| 14 | Skill Shadow | `SkillShadow` | `skillShadow.ts` | Coach using your own workflow patterns. Method: `shadow(situation)` → `{ pattern_id, context, your_approach, confidence }`. Reads VelocityTracker's `workflow_patterns.json` directly. |
| 15 | Curriculum Architect | `CurriculumArchitect` | `curriculum.ts` | Identifies topics you keep asking about but never decide on. Methods: `logQuestion(q)`, `plan()` → `{ gaps, generated_at, topics_analyzed }`. Gap score = mentions / max(1, decisions). |
| 16 | Codebase Anthropologist | `CodebaseAnthropologist` | `codebaseAnthropologist.ts` | Surfaces cultural norms from stored decisions. Method: `culture()` → `{ norms, taboos, decisions_mined }`. 15 norm patterns hard-coded (async/await, TypeScript, tests, REST, PostgreSQL, Redis, Docker, pnpm, Ollama, Tailwind, Zod, React, GitHub Actions, observability). |
| 17 | Institutional Memory | `InstitutionalMemory` | `institutionalMemory.ts` | Preserves departed contributors' decisions and quirks. Methods: `record(contributor, kind, text)`, `markActive(contributor, date?)`, `departed()` (returns those >90 days dormant with their contributions), `contributionsBy(contributor)`. `DORMANT_DAYS = 90`. |

## MCP server (`timps-mcp`)

- **Single file**: all 61 tools are defined inline in `src/index.ts` (~1247 lines). There is no `src/tools/` directory. Count: 61 `registerTool` calls (verified by grep).
- 61 tools = 17 intelligence engines (39 tool wrappers: 17 read + ~22 write companions like `timps_record_mention`, `timps_log_past_decision`, `timps_complete_commitment`, etc.) + 22 memory/CRUD wrappers (`timps_chat`, `timps_get_memories`, `timps_store_memory`, `timps_chronos_*`, `timps_nexus_*`, `timps_synapse_*`, etc.).
- All 17 intelligence tools work in LOCAL mode (no `TIMPS_URL` needed). SERVER mode proxies to `packages/server` HTTP API for the higher-level memory layers (Chronos, Nexus, Synapse).
- Built with `tsup` (CJS, no dts) because `tsc` on the full MCP SDK types OOMs. The CI workflow has a comment about this — preserve it.
- Typecheck needs `--max-old-space-size=4096`. The script in `package.json` already does this; don't shorten it.

## Benchmark (`benchmark/`)

- `benchmark/index.ts` is the canonical, honest benchmark. Uses real `MemoryEngine` against a 50-fact corpus. **No `Math.random()`** (verified by grep — 0 actual usages; 1 comment on line 3 documenting the policy).
- `benchmark/runners/harmonicSheafWeaver.ts:115` was fixed (was using `Math.random()` for causal parent selection) → now deterministic `nodeIds[i % nodeIds.length]`.
- Real numbers (run `npx tsx benchmark/index.ts --quick`):
  - Recall@1: **75%**, R@5: **95%**, R@10: **95%**, MRR: **0.82**, NDCG: **0.85**
  - Contradiction detection: **100% (10/10)**
  - Intelligence tools: **100% (17/17)**
  - Scalability: **0.2–0.6ms mean / 1ms p95** at 50/200/500 facts
- Results saved to `.timps/benchmarks/run_<timestamp>.json` in cwd.
- SWE-bench and Terminal-Bench are intentionally NOT in the suite — they require an LLM execution loop we don't have. The benchmark prints an explicit "we do not report scores we cannot verify" note.

## Demo (`demo/`)

- `demo/quick_demo.sh` — 2-minute terminal walkthrough. Pre-flight (Node 20+), build memory-core, run benchmark, optional Ollama CLI demo, MCP config dump.
- `demo/demo.tape` — VHS recipe. Run `vhs demo/demo.tape` to produce `demo/quick_demo.gif` + `demo/quick_demo.mp4` in one command.
- `demo/README.md` — Why VHS over plain macOS screen capture (reproducible, GIF+MP4 in one command, CI-friendly).
- `demo/HACKER_NEWS_POST.md` — Three title options + full body draft for the HN launch post, with posting-time advice and a comment-reply playbook.
- `demo/quick_demo.gif` — recorded output (167 KB) of the benchmark running.

## CI (`.github/workflows/`)

Ten workflows. The `ci.yml` matrix runs **timps-code on Ubuntu/macOS/Windows × Node 18/20/22**. Other packages run on Node 20 only. Each package job sets its own `working-directory` and uses that package's own `package-lock.json` for npm cache.
