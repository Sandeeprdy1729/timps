# AGENTS.md — TIMPS Codebase Guide

Canonical instruction doc for AI agents (OpenCode, Copilot, Claude, Cursor). If this conflicts with the README, **trust this file**.

## Repo layout

Monorepo workspace roots: `packages/*`, `apps/*`, `timps-code`, `timps-mcp`.

| Surface | Path | Package | Build | Test | Typecheck |
|---|---|---|---|---|---|---|
| CLI | `timps-code/` | `timps-code` | `tsc` (ESM, NodeNext) | `vitest` (unified) | `tsc --noEmit` |
| MCP server | `timps-mcp/` | `timps-mcp` | `tsup src/index.ts --format cjs --no-dts --out-dir dist` | `vitest` (unified) | `tsc --noEmit` (4GB heap) |
| VS Code ext | `timps-vscode/` | `timps-ai-coding-agent` | `npm run compile` (tsc) | `vitest` (unified) | `tsc --noEmit` |
| Full server | `packages/server/` | `@timps/server` | `tsc` (CJS) | `vitest` (unified) | `tsc --noEmit` |
| Memory engine | `packages/memory-core/` | `@timps/memory-core` | `tsup` (CJS + dts) | `vitest` (unified) | `tsc --noEmit` |

- `npm run build` — turbo run build (all packages; mobile/plugins/docs may need extra tooling).
- `npm run build:ci` — CI-targeted build that **excludes** 10 packages (mobile, plugins, docs, timps-code, timps-mcp).
- Build timps-code/timps-mcp individually: `cd timps-code && npm run build`.

## TypeScript config drift

- `timps-code` → ESM (`module: NodeNext`), `.js` extension in imports required.
- `timps-mcp` → CJS, `strict: false`, no declarations.
- `packages/server` → CJS, wide include.
- `packages/memory-core` → CJS, vitest resolves `.js` imports automatically.

## Agent entrypoints (timps-code)

- CLI: `src/bin/timps.ts` (run via `npm run dev` or `tsx src/bin/timps.ts`).
- Loop: `src/core/app.ts` → `AgentLoop.run()` → `src/core/agent.ts`.
- Tool registry: `src/tools/tools.ts` exports `ALL_TOOLS`, `getTool()`, `getToolDefinitions()`.
- Providers: `src/models/` — 6 adapters + OpenRouter routing (7 total, not "75+").
- Swarm: `src/swarm/` — 10 agent roles, DAG is local fan-out, not distributed.
- TUI: `src/ui/App.tsx` (Ink/React 19).
- MCP client: `src/services/mcp/`, auto-discovery at `src/tools/mcpDiscovery.ts`.

## Memory — unified implementations

1. **`packages/memory-core/`** — canonical, source of truth for 17 intelligence tools.
2. **`timps-code/src/memory/`** — thin adapter (337 lines), delegates to `MemoryEngine`.
3. **`packages/server/memory/`** — thin adapters over `MemoryEngine`, re-export forge types from `@timps/memory-core`.

22 forge layers: L1 Working → L2 Episodic → L3 Semantic → L4 Procedural → L5 ChronosForge → L6 ResonanceForge → L7 EchoForge → L8 AetherForgeERL → L9 HarmonicSheafWeaver → L10–L22 (EngramLog through BiasRevealer).

All 17 intelligence tools live in `packages/memory-core/src/intelligence/`, class-based, **no `Math.random()`**.

### IMemoryLayer interface

All forge classes implement `IMemoryLayer` (defined in `packages/memory-core/src/IMemoryLayer.ts`):

| Forge | File | store→storeData renamed? | Notes |
|---|---|---|---|
| EchoForge | `EchoForge.ts` | ✅ Yes | First IMemoryLayer implementation |
| ChronosForge | `ChronosForge.ts` | N/A (no conflict) | Weave-based store |
| HarmonicSheafWeaver | `HarmonicSheafWeaver.ts` | ✅ Yes | Persists via `persist()` |
| AetherForgeERL | `AetherForgeERL.ts` | ✅ Yes | Persists via `persist()` |

All provide: `store()`, `retrieve()`, `verify()`, `contradict()`, `archive()`, `getProvenance()`, `explain()`, `audit()`, `decay()`.

**Gotcha:** When implementing IMemoryLayer on a forge with a `private store` field, rename it to `private storeData` to avoid method/property conflict. Update ALL `this.store.` → `this.storeData.` references and any test code accessing `forge['store']` (via bracket notation) to `forge['storeData']`.

### StorageBackend abstraction (Phase 1b)

All forge layers and intelligence tools accept an optional `backend?: StorageBackend` parameter after `dir`. When provided, all file I/O routes through the backend instead of direct `fs` calls.

Interface defined in `packages/memory-core/src/backends/types.ts`:

```
read(key), write(key, value), delete(key), list(prefix?),
query(filter), exists(key), append(key, line), beginTxn()
```

| Backend | File | Sync/Async | Driver | Notes |
|---|---|---|---|---|
| `FileBackend` | `backends/FileBackend.ts` | sync | `fs` | Default. WAL journaling: write → .wal → fsync → rename |
| `InMemoryBackend` | `backends/InMemoryBackend.ts` | sync | `Map` | For tests |
| `PostgresBackend` | `backends/PostgresBackend.ts` | async | `pg` | Lazy-loaded, key/value JSONB table |
| `SQLiteBackend` | `backends/SQLiteBackend.ts` | sync | `better-sqlite3` | Lazy-loaded, WAL mode |
| `RedisBackend` | `backends/RedisBackend.ts` | async | `ioredis` | Lazy-loaded, STRING + SET |

Usage:
```ts
const engine = new MemoryEngine(dir, { backend: new InMemoryBackend() });
// Forge layers automatically use engine._backend
```

When no backend is provided, `MemoryEngine` creates a `FileBackend` via `getBackend(dir)` in `storage.ts`. The `getBackend()` cache is shared across all forges using the same directory.

**Gotcha:** The Rust native addon (`@timps/memory-core-rs`) writes episodes in JSONL format (`episodes.jsonl`), but the backend uses JSON array (`episodes.json`). To prevent format mismatch, all storage helpers in `storage.ts` (`appendEpisode`, `loadEpisodes`, `episodeCount`, `loadSemantic`, `saveSemantic`, `loadWorking`, `saveWorking`) bypass the native addon and use the backend. Native is still used for pure compute (`jaccardSimilarity`, `searchEntries`).

**Gotcha:** `FileBackend.write()` uses WAL: serialize to JSON → write to `{key}.wal` → fsync → rename to `{key}`. On startup, orphaned `.wal` files are replayed. This guarantees no half-written JSON even on process kill.

**Gotcha:** Episodic storage format changed from JSONL (`episodes.jsonl`, one JSON per line) to JSON array (`episodes.json`). Migration `v1_to_v2` handles this automatically on startup. Also update any hardcoded `episodes.jsonl` paths in tests, docs, and dependent packages.

### Schema migrations (Phase 1c)

Memory directories carry a `schema-version.json` file tracking the on-disk format version. On construction, `MemoryEngine` runs a `MigrationEngine` that detects the current version, runs any pending migrations sequentially, and updates the version file. Migrations live in `packages/memory-core/src/migrations/`:

| Migration | From | To | What it does |
|---|---|---|---|
| `v1_to_v2` | v1 (JSONL) | v2 (JSON array) | Converts `episodes.jsonl` → `episodes.json`, merges existing data, cleans `.wal` files |
| `v2_to_v3` | v2 (no _meta) | v3 (with _meta) | Adds `_meta` block (`schemaVersion`, `layerName`, `createdAt`, `migratedAt`) to all forge state files |

To add a new migration:
1. Create `vN_to_v{N+1}.ts` exporting a `Migration` object
2. Add it to `ALL_MIGRATIONS` in `migrations/index.ts`
3. Bump `CURRENT_SCHEMA_VERSION` in `migrations/types.ts`
4. Write tests in `migrations/migrations.test.ts`

**Gotcha:** Migrations run through the `StorageBackend` interface, not `fs` directly. The `v1_to_v2` migration uses `fs` because old JSONL files are outside the backend abstraction. All subsequent migrations should use `backend.read/write`.

## Style & conventions

- ESM in `timps-code`; CJS elsewhere.
- No pre-commit hooks, no `.cursor/rules/`, no `CLAUDE.md`.
- Changesets in `.changeset/`. Versioned packages: timps-code, timps-mcp, timps-vscode, packages/server.
- Don't commit: `dist/`, `out/`, `node_modules/`, `target/`, `.env`, `*.vsix`, `.timps/`.
- IDs: `crypto.randomBytes(3).toString('hex')` (not `Math.random()`).

## Don't change without discussion

- `timps-mcp` tool names (downstream configs depend on them).
- VS Code extension activation events.
- Memory on-disk schema (backwards compat).
- Public CLI flags, slash commands, env vars.
- The 17-tool count and their `MemoryEngine` lazy getter names.
- `StorageBackend` interface methods (backends must stay compatible).
- Episodic storage format (`episodes.json` JSON array — not JSONL).

## PR checklist

- [ ] `npx tsc --noEmit` passes in affected package (`--max-old-space-size=4096` for timps-mcp).
- [ ] Tests pass: `npm test` (root vitest run).
- [ ] Coverage passes: `npm run test:coverage` meets 80% threshold.
- [ ] Benchmark passes: `npx tsx benchmark/index.ts --quick` → 17/17 tools green, R@5 ≥ 90%.
- [ ] `grep -c "Math.random" benchmark/` returns 0.
- [ ] If you added a tool, updated `ALL_TOOLS` and added smoke test to `benchmark/index.ts`.
- [ ] If you changed memory on-disk format, add migration in `timps-code/src/migrations/`.
- [ ] Changeset added for timps-code, timps-mcp, timps-vscode, or packages/server.
- [ ] Updated `AGENTS.md` if public API changed.
- [ ] If you added a new StorageBackend, implement all interface methods including `beginTxn()`, `exists()`, `append()`, and `query()`.
- [ ] If you added a forge layer, ensure it accepts `backend?: StorageBackend` as a constructor param after `dir` and uses `this._backend.read/write` when available.

## Gotchas

- `npm run build` builds all packages (mobile/plugins/docs may need extra tooling). Use `build:ci` in CI.
- `packages/server` package.json version (2.0.4) doesn't match npm (2.0.0). Don't assume alignment.
- Rust crates in `crates/` are parallel re-implementation, not usable from TS.
- `MemoryEngine.contradiction.check(statement, autoStore?)` defaults `autoStore=true` — pass `false` in tests.
- ContradictionDetector requires >50% Jaccard vocabulary overlap to trigger. Exact phrasings needed for `CONTRADICTION`.
- **Unified test runner:** Vitest across all packages. Run `npm test` (root) or `vitest run` for all tests. Coverage: `npm run test:coverage` (80% threshold enforced).
- `packages/server` is missing `@timps/memory-core` in its package.json `dependencies` — it's installed by hoisting but won't resolve in `npm ci --production`.
- `timps-desktop` has a JSX parsing issue in `global.d.ts` (missing space before `declare` keyword after a JSX block). If `npx tsc --noEmit` fails for timps-desktop, check `.d.ts` files for similar syntax issues.
- `test-coverage.yml` matrix includes `config`, `integration-base` packages that no longer exist. Drop them from the matrix if they're removed from the workspace.
- `supply-chain-audit.yml` uses `google/osv-scanner-action@v1.0.2` (old). Update to `v2.3.8` if the action fails.
- `packages/server` `check` script is `tsc` but TypeScript isn't installed as a devDependency — it's hoisted from the root. CI may fail on strict isolated environments unless `typescript` is added to its devDependencies.

## Phase 2c — Horizontal Scaling (June 2026)

New files in `packages/memory-core/`:

| File | Purpose |
|------|---------|
| `src/events/EventBus.ts` | Redis Pub/Sub with 10 typed channels, auto-skip own messages, async subscribe/unsubscribe |
| `src/cache/CacheManager.ts` | Redis-backed cache with TTL, get-or-compute `wrap()`, pattern scan invalidation |
| `src/backends/QdrantBackend.ts` | Vector store backend — `upsertVector/searchVectors` for embedding similarity search |
| `docker-compose.yml` | Full stack: Postgres primary+2 replicas + PgBouncer + Redis + Qdrant + N MemoryServers |
| `Dockerfile` | Minimal node:20-alpine image, ESM dist + proto files |
| `deploy/pgbouncer/pgbouncer.ini` | PgBouncer config (transaction pooling, 200 clients, 50 pool) |
| `deploy/k8s/timps-memory.yaml` | K8s Deployment + HPA (2-10 pods, CPU 70%) + readiness probe |
| `deploy/k8s/kustomization.yaml` | Kustomize overlay |
| `src/chaos.test.ts` | 7 resilience tests: stateless recovery, shared backend, concurrent writes, graceful degradation |

### Public API additions

- `MemoryEngineOptions.cacheManager?: CacheManager` — Redis cache for forge state (get-or-compute with TTL)
- `MemoryEngineOptions.eventBus?: EventBus` — Redis Pub/Sub for cross-server events
- `MemoryEngine.cacheManager` / `MemoryEngine.eventBus` — getters
- `store()` publishes `memory:stored` event, `recall()` publishes `memory:recalled` (for queries >10 chars), `consolidate()` publishes `memory:consolidated`
- `MemoryServerOptions.eventBus?: { url? } | false` — enables EventBus in server, auto-injects into engine
- `MemoryServerOptions.serverId?: string` — server identity for event bus message dedup
- `GET /health/readiness` — probes Postgres, Redis, EventBus, Cache, returns 503 if any fail
- `PostgresBackend` now takes `primary` (writes) + optional `replicas[]` (reads, round-robin)
- `PostgresBackend.health()` — ping primary + first replica
- Exports: `EventBus`, `CacheManager`, `QdrantBackend` (via backends index)

### Gotchas

- `PostgresBackend` constructor changed: was `connectionString`, now `primary` + optional `replicas[]`.
- EventBus requires `ioredis` at runtime (lazy `require`). CacheManager also requires `ioredis`.
- QdrantBackend requires `@qdrant/js-client-rest` at runtime (lazy `require`).
- MemoryServer forwards event bus messages to WebSocket clients via `wsServer.broadcast()`.
- The `memory:stored` event payload includes `id`, `content` (truncated 200), `type`, `tags`, `confidence`, `actorId`.
- The `memory:recalled` event only fires for queries >10 chars to reduce noise.
- Scale out: `docker compose up -d --scale memory=3` spins 3 server instances.
- The 6s StreamContext polling timer remains — Phase 2c replaces it with reactive forge-layer event pushes. This is marked as the gap before Phase 2d.
