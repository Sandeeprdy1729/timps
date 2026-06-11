# AGENTS.md — TIMPS Codebase Guide

Canonical instruction doc for AI agents (OpenCode, Copilot, Claude, Cursor). If this conflicts with the README, **trust this file**.

## Repo layout

Monorepo workspace roots: `packages/*`, `apps/*`, `timps-code`, `timps-mcp`.

| Surface | Path | Package | Build | Test | Typecheck |
|---|---|---|---|---|---|
| CLI | `timps-code/` | `timps-code` | `tsc` (ESM, NodeNext) | `jest` (Jest 30) | `tsc --noEmit` |
| MCP server | `timps-mcp/` | `timps-mcp` | `tsup src/index.ts --format cjs --no-dts --out-dir dist` | none | `tsc --noEmit` (4GB heap) |
| VS Code ext | `timps-vscode/` | `timps-ai-coding-agent` | `npm run compile` (tsc) | none | `tsc --noEmit` |
| Full server | `sandeep-ai/` | `@timps/server` | `tsc` (CJS) | `npx ts-node test_tool5.ts` ⚠️ requires server | `tsc --noEmit` |
| Memory engine | `packages/memory-core/` | `@timps/memory-core` | `tsup` (CJS + dts) | `jest` (Jest 29) | `tsc --noEmit` |

- `npm run build` — turbo run build (all packages; mobile/plugins/docs may need extra tooling).
- `npm run build:ci` — CI-targeted build that **excludes** 10 packages (mobile, plugins, docs, timps-code, timps-mcp).
- Build timps-code/timps-mcp individually: `cd timps-code && npm run build`.

## TypeScript config drift

- `timps-code` → ESM (`module: NodeNext`), `.js` extension in imports required.
- `timps-mcp` → CJS, `strict: false`, no declarations.
- `sandeep-ai` → CJS, wide include.
- `packages/memory-core` → CJS, `moduleNameMapper` strips `.js` for jest.

## Agent entrypoints (timps-code)

- CLI: `src/bin/timps.ts` (run via `npm run dev` or `tsx src/bin/timps.ts`).
- Loop: `src/core/app.ts` → `AgentLoop.run()` → `src/core/agent.ts`.
- Tool registry: `src/tools/tools.ts` exports `ALL_TOOLS`, `getTool()`, `getToolDefinitions()`.
- Providers: `src/models/` — 6 adapters + OpenRouter routing (7 total, not "75+").
- Swarm: `src/swarm/` — 10 agent roles, DAG is local fan-out, not distributed.
- TUI: `src/ui/App.tsx` (Ink/React 19).
- MCP client: `src/services/mcp/`, auto-discovery at `src/tools/mcpDiscovery.ts`.

## Memory — three implementations

1. **`packages/memory-core/`** — canonical, source of truth for 17 intelligence tools.
2. **`timps-code/src/memory/`** — runtime wrappers + L8 SynapseQuench.
3. **`sandeep-ai/memory/`** — server-side re-implementations, may drift.

9 layers: L1 Working → L2 Episodic → L3 Semantic → L4 Procedural → L5 ChronosForge → L6 ResonanceForge → L7 EchoForge → L8 SynapseQuench → L9 HarmonicSheafWeaver.

All 17 intelligence tools live in `packages/memory-core/src/intelligence/`, class-based, file-based JSON storage, **no `Math.random()`**.

## Style & conventions

- ESM in `timps-code`; CJS elsewhere.
- No pre-commit hooks, no `.cursor/rules/`, no `CLAUDE.md`.
- Changesets in `.changeset/`. Versioned packages: timps-code, timps-mcp, timps-vscode, sandeep-ai.
- Don't commit: `dist/`, `out/`, `node_modules/`, `target/`, `.env`, `*.vsix`, `.timps/`.
- IDs: `crypto.randomBytes(3).toString('hex')` (not `Math.random()`).

## Don't change without discussion

- `timps-mcp` tool names (downstream configs depend on them).
- VS Code extension activation events.
- Memory on-disk schema (backwards compat).
- Public CLI flags, slash commands, env vars.
- The 17-tool count and their `MemoryEngine` lazy getter names.

## PR checklist

- [ ] `npx tsc --noEmit` passes in affected package (`--max-old-space-size=4096` for timps-mcp).
- [ ] Tests pass: `cd <pkg> && npm test` (Jest for timps-code/memory-core, vitest for integration-tests).
- [ ] Benchmark passes: `npx tsx benchmark/index.ts --quick` → 17/17 tools green, R@5 ≥ 90%.
- [ ] `grep -c "Math.random" benchmark/` returns 0.
- [ ] If you added a tool, updated `ALL_TOOLS` and added smoke test to `benchmark/index.ts`.
- [ ] If you changed memory on-disk format, add migration in `timps-code/src/migrations/`.
- [ ] Changeset added for timps-code, timps-mcp, timps-vscode, or sandeep-ai.
- [ ] Updated `AGENTS.md` if public API changed.

## Gotchas

- `npm run build` builds all packages (mobile/plugins/docs may need extra tooling). Use `build:ci` in CI.
- `sandeep-ai` package.json version (2.0.4) doesn't match npm (2.0.0). Don't assume alignment.
- Rust crates in `crates/` are parallel re-implementation, not usable from TS.
- `MemoryEngine.contradiction.check(statement, autoStore?)` defaults `autoStore=true` — pass `false` in tests.
- ContradictionDetector requires >50% Jaccard vocabulary overlap to trigger. Exact phrasings needed for `CONTRADICTION`.
