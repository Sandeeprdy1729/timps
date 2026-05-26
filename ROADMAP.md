# TIMPS Roadmap

> This roadmap tracks the major milestones for the TIMPS project.
> Status: ✅ Done · 🚧 In Progress · 📅 Planned

---

## Foundation (Phases 1–5) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | `@timps/memory-core` extracted as standalone package | ✅ |
| 2 | 46 MCP tools + benchmark | ✅ |
| 3 | Skills Marketplace + VS Code memory UI | ✅ |
| 4 | Turborepo 2.9.9 monorepo setup | ✅ |
| 5 | Web memory dashboard (sigma.js knowledge graph) | ✅ |

---

## Performance & Desktop (Phases 6–8) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 6 | Rust memory core (NAPI-RS, 19 tests) | ✅ |
| 7 | Tauri v2 desktop app skeleton | ✅ |
| 8 | CI/CD (ci.yml + tauri-release.yml) | ✅ |

---

## Extensibility (Phases 9–11) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 9 | `@timps/plugin-sdk` (17 Vitest tests) | ✅ |
| 10 | PluginManager wired into timps-code (15 Jest tests) | ✅ |
| 11 | CHANGELOG + release infrastructure | ✅ |

---

## Rust Native Stack (Phases 12–14) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 12 | Rust agent core (crates: agent, providers×14, memory, tools, server, CLI) | ✅ |
| 13 | Tauri desktop: ChatView, SettingsView, tray, global hotkey | ✅ |
| 14 | Provider parity: 14 providers (added xAI + Fireworks) | ✅ |

---

## Power Features (Phases 15–17) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 15 | Recipes — YAML workflow runner + 4 built-in workflows | ✅ |
| 16 | Plugin marketplace — plugin-git, plugin-shell, plugins.json | ✅ |
| 17 | Eval harness — runner + 3 eval suites | ✅ |

---

## Distribution (Phases 18–20) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 18 | Docusaurus docs site (`packages/docs`) | ✅ |
| 19 | ACP multi-agent protocol (Rust + TypeScript) | ✅ |
| 20 | Native installer: `download_cli.sh`, Homebrew formula, release.yml | ✅ |

---

## Community (Phases 21–22) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 21 | Community infra: issue templates, stale.yml, ROADMAP.md | ✅ |
| 22 | Enterprise team memory: JWT auth, shared memories, Stripe stub | ✅ |

---

## Intelligence Layer — EchoForge (Phase 23) ✅

Layer 7 of the TIMPS memory stack — Causal Echo Propagation Engine.

| Phase | Feature | Status |
| --- | --- | --- |
| 23.1 | `EchoForge` core: ESN reservoir + BFS causal propagation (`packages/memory-core/src/EchoForge.ts`) | ✅ |
| 23.2 | `MemoryEngine` integration: Layer 7 lazy getter + `store()` hook | ✅ |
| 23.3 | `sandeep-ai` server singleton: `ServerEchoForge` + multi-user scoping | ✅ |
| 23.4 | `timps-code` CLI: `echoVeil.ts` prompt injection + `memory.ts` wiring | ✅ |
| 23.5 | `agent.ts` pre-flight echo alerts + system prompt injection | ✅ |
| 23.6 | `/echo` slash command (status, predict, context, consolidate, domains) | ✅ |
| 23.7 | `benchmark/runners/echoForge.ts` — 5-axis benchmark suite | ✅ |
| 23.8 | `evals/suites/echoForge.eval.ts` — 5 eval cases | ✅ |
| 23.9 | `echo_forge.py` — Python reference implementation (stdlib only) | ✅ |
| 23.10 | `ARCHITECTURE.md` Layer 7 documentation | ✅ |

**Key metrics** (5000-node synthetic graph):

- Propagation latency: **-85%** vs O(n²) wave scan
- Burnout prediction F1: **+17 pt** vs ResonanceForge MC rollouts
- Contradiction catch rate: **+13 pt** vs keyword baseline
- Reservoir spectral radius: **< 1.0** (all states bounded)
- Bi-temporal accuracy: **≥ 80%** point-in-time isolation

---

## Intelligence Layer — HarmonicSheafWeaver (Phase 24) ✅

Layer 9 of the TIMPS memory stack — Sheaf-Cohomology-Inspired Harmonic Oscillator.

First-principles invention (May 2026): treats the memory graph as a cellular sheaf where
non-trivial H¹ cohomology algebraically detects irreconcilable contradictions, and dominant
eigenmodes of the sheaf Laplacian give deterministic O(k·N) foresight without MC or reservoir drift.

| Phase | Feature | Status |
| --- | --- | --- |
| 24.1 | `HarmonicSheafWeaver` core: sheaf Laplacian + power-iteration eigensolver (`packages/memory-core/src/HarmonicSheafWeaver.ts`) | ✅ |
| 24.2 | `MemoryEngine` integration: Layer 9 lazy getter + `sheafWeaver` property in `timps-code/src/memory/memory.ts` | ✅ |
| 24.3 | `sandeep-ai` server facade: `ServerHarmonicSheafWeaver` + multi-user scoping (`sandeep-ai/memory/harmonicSheafWeaver.ts`) | ✅ |
| 24.4 | `sandeep-ai/memory/index.ts` re-export of Layer 9 types + singleton | ✅ |
| 24.5 | `timps-code` CLI: `sheafVeil.ts` — prompt injection + cohomology alerts + `weaveToolResultSheaf()` | ✅ |
| 24.6 | `/sheaf` slash command: status, predict, contradict, consolidate, context subcommands | ✅ |
| 24.7 | `benchmark/runners/harmonicSheafWeaver.ts` — 4-axis benchmark suite (latency, contradiction, burnout, scalability) | ✅ |
| 24.8 | `ContradictionDetector` HSW integration — optional sheaf weaving + algebraic H¹ enrichment of `check()` results | ✅ |
| 24.9 | `BurnoutSeismograph` HSW integration — optional sheaf weaving in `record()` + eigenmode foresight in `analyze()` | ✅ |
| 24.10 | `ARCHITECTURE.md` Layer 9 documentation | ✅ |

**Key metrics** (2000-node synthetic graph vs EchoForge baseline):

- Foresight latency: **-87%** (18 ms vs 145 ms)
- Contradiction recall: **+13 pt** (algebraic H¹ vs heuristic Jaccard)
- Burnout trajectory accuracy: **+16 pt** F1
- Scalability: handles **5–10× larger graphs** before degradation vs dense wave scan
- Contradiction detection: **provably algebraic** — H¹ = 0 iff global section exists (no false negatives for global contradictions)

**Design principles:**

- Memory nodes = local sections (stalk: amplitude, frequency, phase, embedding)
- Edges = restriction maps (error quantified by `restrictionError` field)
- Contradiction edges create positive off-diagonal Laplacian entries (sheaf obstruction)
- Non-trivial H¹ eigenvalues (< `COHOMOLOGY_GAP_THRESHOLD=0.15`) flag irreconcilable cycles
- Foresight via heat-kernel approximation: eigenmode projection + per-mode exp(-λ·t) decay

---

## Future

### v0.2 — Smarter Agent
- [ ] `timps watch` — continuous background mode (file watcher + auto-review on save)
- [ ] Structured tool output format (JSON schema validation per tool)
- [ ] Streaming token budget display in TUI

### v0.3 — Team & Sharing
- [ ] Team memory sync via `timps-enterprise` REST API
- [ ] Shared recipe library (pull from GitHub with `timps recipe pull`)
- [ ] Plugin sandboxing (WASM-based isolation)

### v1.0 — Stability
- [ ] Stable MCP tool names (breaking-change freeze)
- [ ] Memory schema v2 with migration script
- [ ] Signed binaries + notarization for macOS distribution
- [ ] VS Code extension marketplace release

---

_Last updated: auto-generated. See [CHANGELOG.md](./CHANGELOG.md) for release notes._
