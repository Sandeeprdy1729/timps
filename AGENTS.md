# AGENTS.md — TIMPS Codebase Guide

This file is the canonical instruction doc for AI agents (OpenCode, Copilot, Claude, Cursor). It is verified against the executable sources of truth (package.json, tsconfig.json, turbo.json, CI workflows, and grep over the actual source) — not the README. If a claim here conflicts with the README, **trust this file** and treat the README as marketing.

## Repo at a glance

Monorepo of four shippable surfaces + ~20 internal packages. Workspace roots are `packages/*`, `apps/*`, `timps-code`, `timps-mcp`, `docs` (see root `package.json` `workspaces`).

| Surface | Path | What it is | Package name | Version |
|---|---|---|---|---|
| CLI | `timps-code/` | Coding agent TUI + slash commands | `timps-code` | 2.0.1 |
| MCP server | `timps-mcp/` | 61 tools: 17 intelligence engines (39 wrappers) + 22 memory/CRUD for Claude/Cursor/Windsurf | `timps-mcp` | 1.0.0 |
| VS Code ext | `timps-vscode/` | Extension (publisher `TIMPs`) | `timps-ai-coding-agent` | 1.2.0 |
| Full server | `sandeep-ai/` | REST API + dashboard + 17 intel tool routes | `timps` | 2.0.4 |
| Memory engine | `packages/memory-core/` | Shared memory lib + 17 intelligence tools | `@timps/memory-core` | 0.1.0 |
| Desktop | `packages/timps-desktop/` | Tauri v2 app | `@timps/desktop` | — |
| Integration tests | `packages/integration-tests/` | Vitest e2e | `@timps/integration-tests` | private |
| Rust crates | `crates/` | Re-implementation (timps-agent, timps-cli, timps-memory, timps-providers, timps-server, timps-tools) | — | — |

**.npmignore excludes everything except `sandeep-ai/` + root files** — only `sandeep-ai` is actually published under the root `timps` name on npm. The other packages ship via their own package names.

## Build, test, typecheck — per package

Build systems are **not uniform**. Don't assume one command works for the whole repo.

| Package | Build | Test | Typecheck | Output dir |
|---|---|---|---|---|
| `timps-code` | `tsc` (ESM, `module: NodeNext`) | `jest --config jest.config.cjs` (Jest 30) | `tsc --noEmit` | `dist/` |
| `timps-mcp` | `tsup src/index.ts --format cjs --no-dts --out-dir dist` | none in repo | `tsc --noEmit` w/ 4 GB heap | `dist/` |
| `timps-vscode` | `npm run compile` (tsc) | none | `tsc --noEmit` | **`out/`** (not `dist/`) |
| `sandeep-ai` | `tsc` (CJS) | `npx ts-node test_tool5.ts` ⚠️ see below | `tsc --noEmit` | `dist/` |
| `packages/memory-core` | `tsup` (CJS + dts) | `jest --config jest.config.cjs` (Jest 29) | `tsc --noEmit` | `dist/` |
| `packages/integration-tests` | n/a | `vitest` (NOT jest) | n/a | n/a |

### Root `npm run build/test/typecheck`

The root scripts use Turborepo with **long `--filter` chains that exclude many packages** (mobile, docusaurus, docs, plugin-sdk, plugin-git, plugin-shell, memory-dashboard, timps-code, timps-mcp). If you need a specific excluded package, run it inside its directory. Don't waste time debugging why `npm run build` from root "misses" things.

### `sandeep-ai` test is not real

`npm test` in `sandeep-ai/` just executes `test_tool5.ts` via ts-node — a single integration smoke test that requires a running server (`http://localhost:3000`). Real unit tests for sandeep-ai live in `sandeep-ai/test/aetherForge.test.ts`, `nexusForge.test.ts`, etc. with no runner wired up.

### `benchmark/` runs without a build step

`benchmark/index.ts` is a single-file runner that imports `MemoryEngine` directly from `../packages/memory-core/src/MemoryEngine.js` (no build). Run with `npx tsx benchmark/index.ts [--quick]`. The benchmark writes JSON results to `.timps/benchmarks/` in the cwd.

## TypeScript configuration drift

Per-package tsconfigs differ. Don't apply the root `tsconfig.json` blindly:

- `timps-code` → `module: NodeNext`, `moduleResolution: NodeNext`, **ESM** (`"type": "module"` in package.json), JSX `react-jsx`, **excludes test files from compile**.
- `timps-mcp` → `module: commonjs`, `strict: false`, no declaration files.
- `sandeep-ai` → CJS, includes `**/*.ts` at root (very wide), excludes `test/`.
- `packages/memory-core` → CJS, uses `moduleNameMapper` to strip `.js` extensions so Node resolves `.ts` under jest.

ESM rule for `timps-code`: `import { foo } from './bar.js'` (the `.js` is required even though the source is `.ts`).

## Memory architecture — there are three of them

This trips up every new agent. Memory is implemented in three places that overlap and are out of sync:

1. **`packages/memory-core/`** — canonical library, exports `MemoryEngine` + the advanced layers (ChronosForge, ResonanceForge, EchoForge, HarmonicSheafWeaver) + the 17 intelligence tools. Used by `timps-code` via `@timps/memory-core` import. **This is the source of truth for intelligence tool behavior.**
2. **`timps-code/src/memory/`** — runtime wrappers + the early-layer files (snapshot, procedural, knowledgeGraph, hybridRetriever, sqliteStore, chronosVeil, etc.) and the L8 SynapseQuench that does NOT live in memory-core.
3. **`sandeep-ai/memory/`** — server-side re-implementations (longTerm, shortTerm, embedding, plus its own copies of EchoForge/ResonanceForge/ChronosForge/harmonicSheafWeaver). The 17 intelligence tool logic here is a different code path that may drift from memory-core.

Layers in the active memory stack (per `timps-code/src/memory/memory.ts`):
- L1 Working, L2 Episodic, L3 Semantic, L4 Procedural, L5 ChronosForge, L6 ResonanceForge, L7 EchoForge, L8 SynapseQuench, L9 HarmonicSheafWeaver.

When changing memory behavior, identify which of the three implementations your code path uses **first**. Don't edit memory-core expecting it to affect sandeep-ai.

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

## Agent entrypoints and architecture (timps-code)

- CLI entry: `src/bin/timps.ts` (run via `npm run dev` or `tsx src/bin/timps.ts`).
- Loop: `src/core/app.ts` → `AgentLoop.run()` → `src/core/agent.ts` builds prompt, calls provider, routes tool calls via `src/tools/tools.ts`.
- Tool registry: `src/tools/tools.ts` exports `ALL_TOOLS`, `getTool()`, `getToolDefinitions()`. Every tool exports a `definition` (JSON Schema) and `execute`. **Tool descriptions are the routing signal** — keep them accurate when adding a tool.
- Providers: `src/models/` has `claude.ts`, `openai.ts`, `gemini.ts`, `ollama.ts`, `hybrid.ts`, `providerMesh.ts`. The "75+ providers" claim in README is marketing; the actual adapters are these 6 files plus OpenRouter routing (`openai.ts` exports `createOpenRouterProvider`). 7 providers total.
- Swarm: `src/swarm/` has `agents.ts`, `executor.ts`, `graph.ts`, `dynamicOrchestrator.ts`, `server.ts`, `cli.ts`. Ten agent roles defined. `graph.ts:executeAgent()` actually calls the agent's configured provider/model via `createProvider()` (no more `// TODO` stub) and returns the real LLM response. Falls back to `[name] SKIPPED (provider unavailable: <msg>)` if the key is missing or Ollama isn't running. "DAG distributed" in README is aspirational — actual execution is local fan-out.
- Memory lazy-init: intelligence layers (L5–L9) and all 17 intelligence tools are accessed via getters on the `MemoryEngine` and constructed on first use.
- TUI: `src/ui/App.tsx` + `src/ui/panels/` and `src/ui/components/`. Built on Ink/React 19.
- MCP client: `src/services/mcp/` for outbound MCP, `src/tools/mcpDiscovery.ts` for auto-discovery from package.json/requirements.txt/Cargo.toml.

## MCP server (`timps-mcp`)

- **Single file**: all 61 tools are defined inline in `src/index.ts` (~1247 lines). There is no `src/tools/` directory. Count: 61 `registerTool` calls (verified by grep).
- 61 tools = 17 intelligence engines (39 tool wrappers: 17 read + ~22 write companions like `timps_record_mention`, `timps_log_past_decision`, `timps_complete_commitment`, etc.) + 22 memory/CRUD wrappers (`timps_chat`, `timps_get_memories`, `timps_store_memory`, `timps_chronos_*`, `timps_nexus_*`, `timps_synapse_*`, etc.).
- All 17 intelligence tools work in LOCAL mode (no `TIMPS_URL` needed). SERVER mode proxies to `sandeep-ai` HTTP API for the higher-level memory layers (Chronos, Nexus, Synapse).
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

## Style and conventions

- ESM in `timps-code`; CJS in `timps-mcp`, `sandeep-ai`, `memory-core`. Don't mix.
- No pre-commit hooks (no `.husky/`, no `.pre-commit-config.yaml`).
- No `opencode.json`, `.cursor/rules/`, `CLAUDE.md`, or `.github/copilot-instructions.md` — this file is the only agent instruction source.
- Changesets live in `.changeset/`. Add a changeset for user-facing changes; the `config.json` lists `timps-code`, `timps-mcp`, `timps-vscode`, `sandeep-ai` as the only versioned packages.
- Do not commit `dist/`, `out/`, `node_modules/`, `target/`, `.env`, `*.vsix`, `*.tsbuildinfo`, `.timps/`, `M3_HANDOFF.html` (all in `.gitignore`).
- **No `Math.random()` for IDs in new benchmark code.** For general-purpose IDs, `crypto.randomBytes(3).toString('hex')` is the canonical pattern (see `storage.ts:generateId`).

## What NOT to change without discussion

- `timps-mcp` tool names — downstream users wire these into Claude/Cursor configs.
- VS Code extension activation events — affects startup perf.
- Memory on-disk schema (`~/.timps/memory/<hash>/episodes.jsonl`, `semantic.json`, `positions.json`, `decisions.json`, `architecture_insights.json`, `commitments.json`, `past_decisions.json`, `relationships.json`, `institutional_memory.json`, `curriculum_log.json`, `culture_decisions.json`, `manifesto_signals.json`, `workflow_patterns.json`, `bug_patterns.json`, `code_incidents.json`, `burnout_baseline.json`) — backwards compat for users with existing data.
- Public CLI surface (flags, slash commands under `src/commands/`, env var names).
- The 17-tool count and the per-tool method names in `MemoryEngine` lazy getters — both are part of the public API and the benchmark smoke test asserts on them.

## PR checklist

- [ ] `npx tsc --noEmit` passes in the affected package (use `--max-old-space-size=4096` for `timps-mcp`).
- [ ] Tests pass: `cd <pkg> && npm test` (Jest for timps-code/memory-core, vitest for `packages/integration-tests`).
- [ ] Benchmark passes: `npx tsx benchmark/index.ts --quick` shows **17/17** intelligence tools green and R@5 ≥ 90%.
- [ ] `grep -c "Math.random" benchmark/` returns 0 (the policy comment in `benchmark/index.ts:3` is fine).
- [ ] If you added a tool, updated `ALL_TOOLS`, wrote a clear `definition.description` (this is how the agent picks the tool), and added a smoke test to `benchmark/index.ts:runIntelligenceTools()`.
- [ ] If you changed memory on-disk format, add a migration in `timps-code/src/migrations/`.
- [ ] Changeset added under `.changeset/` for changes to `timps-code`, `timps-mcp`, `timps-vscode`, or `sandeep-ai`.
- [ ] Updated `AGENTS.md` if you added an intelligence tool, provider, package, or changed public API.

## Common gotchas

- Running `npm run build` from the **root** skips `timps-code` and `timps-mcp` (the filter chain). Build them individually if needed.
- `sandeep-ai` package.json version (2.0.4) does not match what is on npm (2.0.0) or what `timps-code` depends on. Don't assume they align.
- The `swarm` system depends on a running message queue / orchestrator; tests for it are sparse. `graph.ts:executeAgent()` calls the real LLM but the DAG routing in `runSwarmDAG` is keyword-based, not semantic.
- The Rust crates in `crates/` are a parallel re-implementation — most don't have parity with the TypeScript version. Don't import from `crates/` from TypeScript code.
- `packages/memory-core` exports use `.js` extensions internally — if you add a file, follow the same convention or the CJS jest config will break.
- The website is a static `index.html` in `timps-website/` (not a Docusaurus build). Marketing site, not docs.
- `MemoryEngine.contradiction.check(statement, autoStore?)` — the `autoStore` arg defaults to `true` and will auto-insert the statement as a new position if no match is found. **Always pass `false`** in benchmark/test code, or you'll pollute the corpus.
- `ContradictionDetector` algorithm requires the statement to share **>50% Jaccard vocabulary** with a stored claim to even consider it. Real phrasings like "switch from JWT to session cookies" return `PARTIAL` (0.6) not `CONTRADICTION` because the verb "switch" doesn't match the stored verb "use" after tokenization. To get a `CONTRADICTION` verdict, mirror the stored claim's exact vocabulary with a negator.
- The website is a static `index.html` in `timps-website/` (not a Docusaurus build). Marketing site, not docs.
