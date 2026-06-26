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

## Phase 2d — Real-Time Sync (June 2026)

New/updated files in `packages/memory-core/`:

| File | Purpose |
|------|---------|
| `src/crdt/MemoryCRDT.ts` | LWW-Register-MV CRDT: `incrementClock`, `mergeClocks`, `compareClocks`, `mergeEntries` |
| `src/server/ProjectRoom.ts` | Project-scoped agent room: `join/leave/broadcast`, auto Redis Pub/Sub on `room:{projectId}:events` |
| `src/types.ts` | New fields on `MemoryEntry`: `vectorClock`, `actorId`, `crdtStatus`, `conflicts`, `mergedFrom`. New types: `VectorClock`, `CrdtStatus`, `ConflictEvent`, `ConflictResolutionAction`, `ConflictResolutionRequest` |

Updated files in `packages/memory-core/`:

| File | What changed |
|------|-------------|
| `src/events/EventBus.ts` | Added `subscribeRaw`/`publishRaw`/`unsubscribeRaw` for dynamic `room:` prefixed channels; widened `EventBusChannel` type |
| `src/intelligence/contradiction.ts` | Added `checkBeforeStore(newEntry, existingEntries)` — synchronous Jaccard-based check against semantic entries |
| `src/MemoryEngine.ts` | Added `getSemanticEntries()`, `saveSemanticEntries()`, `checkBeforeStore(content)` convenience methods |
| `src/server/routes.ts` | Store handler runs sync conflict check before write; returns `409 Conflict` on hit. New endpoints: `GET /conflicts`, `GET /conflicts/:id`, `POST /resolve-conflict`, `POST /cancel-conflict` |
| `src/server/grpc.ts` | Store handler runs sync conflict check. New RPCs: `ResolveConflict`, `CancelConflict`, `ListConflicts`. `AgentStream` pushes `ConflictEvent` to affected agents |
| `src/server/MemoryServer.ts` | ProjectRoom lifecycle: `getOrCreateRoom`, `joinProjectRoom`, `leaveProjectRoom`. REST endpoints: `POST /room/join`, `POST /room/leave`, `GET /room/:projectId/agents` |
| `src/server/websocket.ts` | New `WsEvent` variants: `conflict_detected`, `conflict_resolved`, `agent_joined`, `agent_left`, `project_event` |
| `src/client/MemoryClient.ts` | New methods: `resolveConflict`, `cancelConflict`, `listConflicts`, `joinRoom`, `leaveRoom`, `getRoomAgents` |
| `src/client/grpc.ts` | New RPC wrappers: `resolveConflict`, `cancelConflict`, `listConflicts` |
| `src/index.ts` | Exports new CRDT functions and ProjectRoom class |
| `proto/timps/memory/v1/memory.proto` | Added `project_id` to `StoreRequest`, `conflict_id`/`message` to `StoreResponse`. New messages: `ResolveConflictRequest/Response`, `CancelConflictRequest/Response`, `ConflictInfo`, `ListConflictsResponse`, `ProjectEvent`. Added `project_event` to `AgentStreamMessage` oneof. New RPCs: `ResolveConflict`, `CancelConflict`, `ListConflicts` |

Updated file in `timps-code/`:

| File | What changed |
|------|-------------|
| `src/memory/memoryCoordinator.ts` | SSE stub replaced with thin backward-compat adapter. SSE server removed — use gRPC + WebSocket instead. Leases/conflict queue delegated to memory-core CRDT infrastructure. |

### Gotchas

- `MemoryEngine.getSemanticEntries()` returns the raw semantic entries array (not a copy). Mutation is safe since `loadSemantic` re-reads from disk.
- Synchronous conflict detection runs at write time in both REST and gRPC Store handlers. If a conflict is found, the store is aborted and a `409 Conflict` response is returned with the `ConflictEvent` payload.
- To bypass conflict detection (e.g., for internal writes), use `(engine as any).contradiction?.checkBeforeStore(...)` is called from routes/grpc — internal engine methods (`engine.store()`) do NOT run conflict detection.
- `EventBus.subscribeRaw` returns an unsubscribe function. ProjectRoom stores this for cleanup on `destroy()`.
- gRPC `AgentStream` now pushes `ConflictEvent` memory insights to agents when they `check_conflicts` or emit `stored_memory` events.
- `ProjectRoom` auto-subscribes to `room:{projectId}:events` on Redis. When `agentCount` drops to 0, `destroy()` is called and the subscription is released.
- The `memoryCoordinator.ts` SSE stub in `timps-code` is now a shell — all real-time coordination goes through the MemoryServer gRPC/WebSocket endpoints.

## Phase 2e — Project-Scoped Isolation at Scale (June 2026)

New types and utilities:

| File | What changed |
|------|-------------|
| `src/types.ts` | Added `OrgScope = { orgId: string; teamId?: string; projectId: string }` |
| `src/backends/types.ts` | Added `OrgScope` re-export, `buildKey()`, `scopeListPrefix()` — stable key derivation `memory:{orgId}:{teamId}:{projectId}:{key}` |
| `src/rateLimiter.ts` | `RateLimiter` class: Redis-backed with in-memory fallback, per-org sliding window counters with Lua scripts |

Backend changes (all backends):

- **`StorageBackend` interface** — new methods `setScope(scope)`, `getScope()`. All `read/write/delete/list/exists/append` accept optional `scope` param that overrides active scope.
- **`InMemoryBackend`** — scope-aware Map storage, `_activeScope` state, `_resolveScope()` picks active scope or explicit param, keys prefixed with `memory:{org}:{team}:{project}:{key}`.
- **`PostgresBackend`** — `setScope` manages session-level `org_id/team_id/project_id` via `SET SESSION` variables; RLS policies on `mem_store` table; `buildKey` generates scoped keys for non-RLS tables.
- **`RedisBackend`** — `setScope` sets `_activeScope`, all keys prefixed with scope prefix for logical database partitioning.
- **`QdrantBackend`** — `setScope` sets `_activeScope`, upsert/search inject `org_id` payload filter to enforce tenant isolation. Renamed internal `_generateId` → `_generateUuid` for clarity.
- **`FileBackend`** — unchanged (no scope support; scope-aware backends are the future).

MemoryEngine changes:

- Accepts `orgScope` in `MemoryEngineOptions`.
- Constructor calls `backend.setScope(orgScope)` and passes `this._backend` to all storage functions (`loadSemantic(dir, backend)`, `saveSemantic(dir, data, backend)`, etc.) — fixing the previous gap where `storage.ts` functions bypassed the engine's backend.
- New method `multiProjectRecall(query, projectIds, options?)` — iterates project scopes, temporarily switches backend scope, calls `recall()`, restores original scope. Falls back to single-project recall when no orgScope set.
- New static method `deriveProjectId(remoteUrl, branch?)` — stable 12-char hex hash from git remote + branch for cross-machine project ID consistency.
- New static method `extractOrgScope(req)` — reads `x-org-id`, `x-team-id`, `x-project-id` headers from request-like objects.
- New getter `backend` — exposes the underlying `StorageBackend`.
- `store()` enriches stored entries with `org:`, `team:`, `project:` tags from `orgScope`.

Auth middleware (`src/server/auth.ts`):

- `requireOrgScope` middleware reads `x-org-id`/`x-team-id`/`x-project-id` headers and attaches them to the request.
- Token/API key auth can now include `orgClaim`, `teamClaim`, `projectClaim`.
- `requireAuth` exported alongside `authenticateRequest`.

MemoryServer changes (`src/server/MemoryServer.ts`):

- Rate limiter middleware (`rateLimiter.check(orgId, endpoint)`) on all write endpoints.
- `GET /health/readiness` probes Postgres, Redis, EventBus, Cache, RateLimiter.
- Server creates `RateLimiter` instance, injects into route handlers.

Migration v3→v4 (`src/migrations/v3_to_v4.ts`):

- Scans all backend keys, skips DATA_FILES (`episodes.json`, `semantic.json`, `working.json`) and meta files.
- Writes `.org-scope.json` sidecar with `defaultScope: { orgId: "default", projectId: dirNameHash }`.
- Adds `orgScope` to `_meta` blocks of layer state files.
- Added to `ALL_MIGRATIONS`, `CURRENT_SCHEMA_VERSION` bumped to 4.

New exports (`src/index.ts`):

- `RateLimiter`, `OrgScope` type, `buildKey`, `scopeListPrefix`, `deriveProjectId`.

### `storage.ts` changes

All storage functions now accept an optional `backend?: StorageBackend` parameter:
- `loadWorking(dir, backend?)`
- `saveWorking(dir, state, backend?)`
- `appendEpisode(dir, episode, backend?)`
- `loadEpisodes(dir, count, backend?)`
- `episodeCount(dir, backend?)`
- `loadSemantic(dir, backend?)`
- `saveSemantic(dir, entries, backend?)`

When `backend` is omitted, falls back to `getBackend(dir)` (legacy FileBackend). MemoryEngine always passes `this._backend`.

### Gotchas

- **Arg order:** `saveSemantic(dir, entries, backend?)` — backend is the **3rd** param. `appendEpisode(dir, episode, backend?)` — backend is the **3rd** param. `loadSemantic(dir, backend?)` — backend is the **2nd** param. Double-check arg order when calling from MemoryEngine.
- **Jaccard dedup triggers on short strings:** Content like `'A: pattern 1'` vs `'A: pattern 2'` have Jaccard similarity >0.8, triggering dedup. Use sufficiently distinct content strings in tests.
- **Multi-project recall requires shared backend:** `multiProjectRecall` works by temporarily switching scope on the engine's backend. Engines with separate backends cannot cross-project recall. Use a single `InMemoryBackend` shared across scope-managed engines in tests.
- **Pre-existing test failure:** `ContextVector — L19 > match returns empty when no similar contexts` fails because time/day matching (TimeDiff < 60min, same dayOfWeek) always triggers on captures/matches within the same second. Unrelated to Phase 2e.
- **`StorageBackend.setScope()` is one-way:** Once set, all subsequent ops use that scope until changed. `multiProjectRecall` restores the original scope after each project iteration.
- **Migration v3→v4 does NOT wrap data files:** `episodes.json`, `semantic.json`, `working.json` are raw arrays. They get a `.org-scope.json` sidecar instead of being wrapped with `_meta`. Layer state files (with `_meta`) get inline `orgScope` metadata.
- **`CURRENT_SCHEMA_VERSION`** is now 4. Bump for any on-disk format change.

## Phase 3a — Skill/Plugin Marketplace (WASM Sandbox + Registry + Static Analysis)

New files in `packages/memory-core/`:

| File | Purpose |
|------|---------|
| `src/marketplace/types.ts` | Plugin manifest, permissions, dependencies, submission, analytics types |
| `src/marketplace/scanner.ts` | Static analysis pipeline — pattern scanning, permission validation, npm audit, checksum verification |
| `src/marketplace/registry.ts` | `PluginRegistry` — CRUD, submit, search, rate/review, analytics tracking, all backed by `StorageBackend` |
| `src/marketplace/resolver.ts` | Dependency resolver — semver constraint matching, version conflict detection |
| `src/sandbox/WasmSandbox.ts` | `WasmSandbox` — install/uninstall WASM plugins, execute via `wasmtime` or JS proxy with ABI permission enforcement |
| `src/server/marketplaceRoutes.ts` | Express router — `POST /marketplace/submit`, `GET /marketplace/plugins`, `GET /marketplace/plugins/:name`, `POST /plugins/:name/rate`, `GET /plugins/:name/reviews`, `POST /marketplace/events` |
| `src/marketplace.test.ts` | 14 tests: scanner (clean code, eval rejection, undeclared perms, size limit, checksum), registry (submit/approve/reject, list, search, downloads, ratings), resolver (simple, conflict, empty) |

Updated files:

| File | What changed |
|------|-------------|
| `src/index.ts` | Exports `PluginRegistry`, `runStaticAnalysis`, `verifyChecksum`, `approved`, `resolveDependencies`, `WasmSandbox`, `createMarketplaceRoutes`, all marketplace types |
| `src/server/MemoryServer.ts` | Mounts `createMarketplaceRoutes` at `/marketplace` |
| `packages/plugin-sdk/src/types.ts` | Added `Permission` type, `timps` field to `PluginManifest` (version, permissions, dependencies) |
| `timps-code/src/commands/plugin.ts` | `pluginInstall` now resolves marketplace plugins (fetches from `/marketplace/plugins/:name` API, resolves dependencies), `pluginList` shows `[marketplace]`/`[npm]` tags + permissions |
| `apps/marketplace/src/components/PluginGrid.tsx` | Fetches plugins from live `/marketplace/plugins` API (falls back to empty on error) |
| `apps/marketplace/src/components/PluginCard.tsx` | Shows rating + download count from API data |

### Architecture

```
Plugin Author                         TIMPS User
       │                                     │
       │  1. POST /marketplace/submit         │
       │  ──→ PluginRegistry.submit() ──→     │
       │     │                                │
       │     ├─ 2. Static analysis             │
       │     │   (scanner.ts)                 │
       │     │   - pattern scanning            │
       │     │   - permission validation       │
       │     │   - npm audit                   │
       │     │   - checksum verification       │
       │     │   - package size check          │
       │     │                                │
       │     ├─ 3. Auto-approved or queued     │  4. Browse marketplace
       │     │                                │  ←── GET /marketplace/plugins
       │     │                                │  5. Install: timps install <name>
       │     │                                │  ──→ Fetches plugin info, resolves deps
       │     │                                │  6. Plugin runs in WasmSandbox
       │     │                                │     (permission enforcement via ABI proxy)
       │     │                                │
       │     │  7. Usage telemetry ──→         │
       │     │   POST /marketplace/events      │
       │     │                                │
       │     └─ 8. Ratings/reviews ──→         │
       │        POST /plugins/:name/rate      │
```

### Key design decisions

- **Scanner rejects on `eval`, `Function()`, `child_process`, undeclared network/fs access, oversized packages** — not just warnings
- **Dependency resolver uses semver matching** — `^` and `~` constraints, version conflict detection
- **WasmSandbox uses subprocess WASM execution** — `wasmtime` CLI for native WASM, JS proxy fallback for Node.js
- **Marketplace API is a flat Express router** mounted alongside memory routes in MemoryServer
- **PluginRegistry stores everything via `StorageBackend`** — works with InMemoryBackend (tests), PostgresBackend (production), RedisBackend (caching)
- **CLI resolves dependencies at install time** — marketplace API returns full plugin info with dependency graph

### Gotchas

- **Scanner requires a base64-decoded payload** — `runStaticAnalysis(payload, manifest)` takes base64-encoded plugin content
- **`PluginRegistry.submit()` rejects on checksum mismatch before any analysis** — saves CPU on invalid submissions
- **`WasmSandbox.executeJS()` creates a temporary script per execution** — permissions are baked into the script via `__permissions` const
- **Marketplace frontend uses `NEXT_PUBLIC_MARKETPLACE_API`** env var — defaults to `localhost:4100`, configure in production
- **CLI's `pluginInstall` auto-detects marketplace plugins** — if the name has no npm scope prefix (`@`), it tries the marketplace first
- **Dependency resolver has no package registry fallback** — it only resolves from the `available` map passed in. For production, wire to the PluginRegistry.
- **All 14 marketplace tests must pass before push** — run `npx vitest run packages/memory-core/src/marketplace.test.ts`
- **Pre-existing test failure:** `ContextVector — L19` still fails (unrelated to Phase 3a)

## Phase 3b — Observability & Telemetry (Privacy-Preserving)

New files in `packages/memory-core/`:

| File | Purpose |
|------|---------|
| `src/telemetry/types.ts` | Telemetry level (`off`/`local`/`anonymous`), config, span, metric, histogram, anonymous payload types |
| `src/telemetry/MetricsRegistry.ts` | Counter, histogram, gauge storage with Prometheus text export and percentile computation |
| `src/telemetry/TracerProvider.ts` | Lightweight tracer with span lifecycle, no-op fallback, `SpanHandle` for safe usage |
| `src/telemetry/RedactionPipeline.ts` | Privacy redaction — strips all content/identifiers, preserves only safe structural attributes |
| `src/telemetry/TelemetryManager.ts` | Central config — `off` (zero alloc), `local` (in-memory + /metrics), `anonymous` (+ redacted hourly export) |
| `src/telemetry/instrumentation.ts` | Proxy-based wrappers for `IMemoryLayer` (9 methods) and `StorageBackend` (read/write/delete/list/exists/append); CRDT conflict recording |
| `src/telemetry/telemetry.test.ts` | 16 tests covering metrics, spans, redaction, telemetry manager, layer/backend/CRDT instrumentation |
| `src/server/telemetryRoutes.ts` | Express router: `GET /metrics` (Prometheus), `GET /metrics/json`, `POST /metrics/reset` |
| `deploy/prometheus/prometheus.yml` | Prometheus scrape config for memory-server /metrics endpoint |
| `deploy/otel/otel-collector.yml` | OTel Collector config: OTLP receiver → batch processor → Prometheus exporter + debug |
| `deploy/grafana/dashboards.yml` | Grafana dashboard provisioning config (auto-loads from /var/lib/grafana/dashboards) |
| `deploy/grafana/dashboard-memory-health.json` | Panel: stores by layer, storage growth, contradiction rate, cache hit rate |
| `deploy/grafana/dashboard-performance.json` | Panel: recall latency p50/p95/p99, store latency, backend breakdown, ops/sec |
| `deploy/grafana/dashboard-agent-activity.json` | Panel: CRDT conflicts, merge latency, concurrent agents, events/sec |
| `deploy/grafana/dashboard-system.json` | Panel: CPU, RSS, GC pauses, Qdrant index size, Redis memory |

Updated files:

| File | What changed |
|------|-------------|
| `src/MemoryEngine.ts` | Added `telemetry?: TelemetryConfig` to `MemoryEngineOptions`; initializes `TelemetryManager`, instruments backend on construction; wraps 4 IMemoryLayer forges (Chronos, Echo, Harmonic, Aether) via Proxy; adds spans + metrics to `store()`, `recall()`, `consolidate()`; adds `telemetry` getter |
| `src/server/MemoryServer.ts` | Added `telemetry?: TelemetryConfig` to `MemoryServerOptions`; creates `TelemetryManager` and injects into engine; mounts `/metrics` from `telemetryRoutes`; adds telemetry health check to `/health/readiness`; adds `telemetryManager` getter |
| `src/index.ts` | Exports `TelemetryManager`, `MetricsRegistry`, `Tracer`, `NoopTracer`, `RedactionPipeline`, `instrumentLayer`, `instrumentBackend`, `instrumentCRDT` + all types |
| `docker-compose.yml` | Added `prometheus`, `grafana`, `otel-collector` services; added `TIMPS_TELEMETRY_LEVEL` and `TIMPS_TELEMETRY_OTEL_ENDPOINT` env vars to memory service; added volumes for prometheus, grafana |

### Telemetry Architecture

```
MemoryServer (instrumented)
  │
  ├─ /metrics (Prometheus text) ←─ Prometheus (scrape)
  ├─ POST /metrics/reset
  └─ OTLP exporter (optional) → OTel Collector → Jaeger/Grafana Tempo
```

### Three Modes

| Level | Metrics | Traces | Export | Privacy |
|-------|---------|--------|--------|---------|
| `off` | None (no-op tracer, zero alloc) | None | None | N/A |
| `local` | In-memory counter/histogram/gauge | In-memory spans (ring buffer, capped 10k) | Prometheus scrape at `/metrics` | All data stays on server |
| `anonymous` | Same as local | Same as local | Hourly redacted export (aggregates only) | Redaction pipeline strips content + identifiers |

### Redaction Guarantee

The `RedactionPipeline` enforces privacy at the attribute level. **Safe** keys preserved: `timps.layer`, `timps.version`, `db.system`, `db.operation`, `error.type`, `backend.type`, `cache.hit`, `plugin.name`, `resolution`, `exception.*`, `http.*`, `net.*`. **Stripped** keys: `content`, `query`, `query.text`, `org_id`, `project_id`, `actor_id`, `file.path`, `user.*`, `agent.*`, `entry.id`, any custom keys in `extraRedactKeys`.

### Grafana Dashboards

4 pre-built dashboards at `deploy/grafana/dashboard-*.json`:
1. **Memory Health** — stores by layer (stacked), storage growth, contradiction rate, cache hit rate
2. **Performance** — recall/store latency p50/p95/p99, backend breakdown, ops/sec
3. **Multi-Agent Activity** — CRDT conflict rate, merge latency, concurrent agents, event throughput
4. **System Resources** — CPU, RSS, GC pauses, Qdrant index size, Redis memory

### Architecture Notes

- **No OTel SDK dependency.** Telemetry is pure TypeScript with zero runtime dependencies. OTel Collector receives metrics via Prometheus scrape, not OTLP push (by default). For full OTLP tracing, add `@opentelemetry/sdk-node` as an optional peer dependency.
- **Proxy-based instrumentation.** `instrumentLayer()` uses `Proxy` to intercept IMemoryLayer methods without modifying forge classes. Non-IMemoryLayer methods pass through transparently.
- **Anonymous export runs hourly.** The `TelemetryManager` sets a `setInterval` that calls `onAnonymousExport` with the redacted payload. Wire this to an HTTP endpoint or file sink in production.
- **Prometheus `/metrics` endpoint** is mounted at the MemoryServer when telemetry level is `local` or `anonymous`. The OTel Collector in `docker-compose` can be configured to scrape this endpoint.

### Gotchas

- **Anonymous export is opt-in only.** Setting `level: 'anonymous'` enables hourly redacted export. By default (`level: 'off'`), zero telemetry is collected.
- **Telemetry config must be set before MemoryEngine construction.** The `telemetry` field in `MemoryEngineOptions` is read during construction to wrap the backend and forge layers.
- **Proxy wrapping is shallow.** Only the 9 IMemoryLayer methods (store, retrieve, verify, contradict, archive, getProvenance, explain, audit, decay) are instrumented. Forge-specific methods like `weave()`, `foresight()`, `predict()` are not wrapped — they appear on the forge classes but not on IMemoryLayer. Instrument them directly in MemoryEngine's store/recall methods instead.
- **Histogram buckets** are fixed: `[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` ms. Tune these for your latency range.
- **CRDT metrics** are only collected when `instrumentCRDT()` is called with an active telemetry manager. The CRDT module itself is not modified.
- **Pre-existing test failure:** `ContextVector — L19` still fails (unrelated to Phase 3b).

## Phase 3d+3e — Secure Config, Rate Limits, Auth, Billing Removal (June 2026)

### Phase 3d — Secure LLM Key Vault + Rate Limiter + User Store

New files in `timps-code/`:

| File | Purpose |
|------|---------|
| `src/config/keyVault.ts` | AES-256-GCM encrypt/decrypt for LLM API keys at rest. Output format: `hexIV:hexTag:hexCiphertext`. `isEncrypted()` regex `/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/` |
| `src/services/providerRateLimiter.ts` | Per-provider sliding-window rate limiter: daily cap + min delay between requests. Persists usage to `.timps/rate-limits/`. Resets at midnight UTC. |
| `src/services/userStore.ts` | Local user store with scrypt password hashing, session tokens (24h expiry), stored in `~/.timps/users.json`. Tokens validated via `crypto.timingSafeEqual`. |

Updated files in `timps-code/`:

| File | What changed |
|------|-------------|
| `src/config/types.ts` | Added `TimpsConfig` fields: `providerLimits`, `rateLimitStrategy`, `fallbackChain` |
| `src/config/config.ts` | Auto-encrypts API keys on save, auto-decrypts on load; avoids double-encryption with `isEncrypted()` check |
| `src/models/providerMesh.ts` | `streamWithFallback()` enhanced with rate limit checks before each provider call; reads `providerLimits` from config |

CLI commands (all in `src/commands/executor.ts`):

| Command | Action |
|---------|--------|
| `/config:encrypt-key <key>` | Encrypt an API key and store in config |
| `/config:set` | Set config values (provider, model, etc.) |
| `/config:show` | Display current config (keys masked) |
| `/config:set-provider` | Set provider, model, and API key |
| `/config:provider-config` | List/configure provider configs |
| `/config:delete-key` | Remove a key from config |
| `/auth:login <username> <password>` | Login with password, get session token |
| `/auth:status` | Show current login status |
| `/auth:register <username> <password>` | Register new user |
| `/auth:logout` | Clear session token |
| `/auth:reset-password <username> <old> <new>` | Change password |
| `/limits:show` | Show provider usage limits |

### Phase 3e — Eval Bug Fixes + Bridge Stub Deletion

**Bug fixes:**
- `packages/memory-core/src/eval/storage.ts` — `InMemoryBackend.read()` returns already-parsed object; removed extraneous `JSON.parse()` on the return value that caused double-parse errors.
- `packages/memory-core/src/eval/regression.ts` — `RegressionDetector.check()` when `baselineValue === undefined` must still compare `metric.value` against `threshold`. Previously a missing baseline file made the gate pass everything.
- `timps-code/src/commands/executor.ts` — `eval:run` handler: await async `evaluateDataset()` call (was returning Promise to CLI instead of EvalResult). Regression summary formatting: `seenBaselines` Map type narrowed from `Map<string, any>` to `Map<string, MetricInfo>`.

**Bridge stub deletion:**
- Deleted `timps-code/src/services/bridge.ts` (85 lines) — empty stubs for `bridge.cloud.sync()`, `bridge.monitor.getStatus()`, `bridge.plugins.getAnalytics()`, `bridge.billing.getSavedAmount()`.
- Deleted `timps-code/src/services/__tests__/bridge.test.ts` — tests for deleted stubs.

### Key design decisions

- All billing/SaaS stubs removed — TIMPS is always 100% free, self-hosted.
- API keys encrypted at rest with AES-256-GCM; IV+tag+ciphertext concatenated with `:` delimiters.
- Rate limits protect user's own LLM budget, not a tiered-pricing structure.
- Fallback chain in `providerMesh` handles 429/5xx by trying next provider in chain.
- Auth is simple local username/password — no enterprise SSO, no OAuth.
- Session tokens expire after 24h with no refresh mechanism (re-login required).

### Gotchas

- `keyVault.encrypt()` output format is `hexIV:hexTag:hexCiphertext`. `isEncrypted()` tests with regex `/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/`.
- `providerRateLimiter` stores usage in `.timps/rate-limits/` as JSON files, one per day per provider.
- User sessions expire after 24 hours; tokens stored in `~/.timps/auth-token.json`.
- Rate limits are checked before each provider call in `streamWithFallback()` — a blocked provider triggers fallback to next in chain.
- The `/config:encrypt-key` handler changes the old plaintext key to the encrypted version in-memory, then saves; it does NOT add a separate encryption step on load since `config.ts` auto-decrypts.

## Phase 4a — Vector Search at Scale (June 2026)

`recall()` is now **async** — all callers must `await` it.

### Architecture

```
store() ──→ sync write (BM25 index) ──→ async EmbeddingQueue ──→ Qdrant (dense + sparse vectors)
                                                                       │
recall() ──→ Stage 1a: BM25 MiniSearch (always, fast-path for <1K) ────┤
             Stage 1b: Qdrant hybridSearch (dense + sparse, >1K) ──────┤
             Stage 1c: KG expansion (shared-tag overlap) ──────────────┤
             Stage 1d: RRF fusion (k=60) ←─────────────────────────────┘
             Stages 2-7: ProvenanceForge, ConfidenceCalibrator, FalseMemoryDetector, ContextVector, RehearsalEngine
```

New files in `packages/memory-core/src/`:

| File | Purpose |
|------|---------|
| `embedding/types.ts` | `EmbeddingConfig`, `EmbeddingResult`, `QueueItem`, `EmbeddingStatus` types |
| `embedding/EmbeddingService.ts` | Provider-agnostic embedding via Ollama (`nomic-embed-text`, 384d) or OpenAI (`text-embedding-3-small`, 768d). Batched API calls, graceful fallback to zero-vectors. |
| `embedding/EmbeddingQueue.ts` | Async queue with configurable batch size (16) and flush interval (500ms). In-memory queue + StorageBackend crash recovery. Background worker auto-drains on flush. |
| `embedding/index.ts` | Re-exports |
| `search/rrf.ts` | Reciprocal Rank Fusion: `rrfFuse(lists, k=60)`, `rrfFuseWithNames(namedLists, k=60)`. Scores computed as sum(1/(k + rank)). Results deduplicated by content. |
| `search/hybridRetriever.ts` | `hybridRecall(entries, query, options?, qdrantBackend?)` — orchestrates BM25 + Qdrant + KG → RRF fusion. Returns top-50 candidates. Graceful degradation on Qdrant failure. |

Updated files in `packages/memory-core/src/`:

| File | What changed |
|------|-------------|
| `backends/QdrantBackend.ts` | HNSW config: `m:32`, `ef_construct:128`, `indexing_threshold:50000`, `on_disk`. Sparse vector support (`bm25` named sparse). New methods: `hybridSearch()`, `textToSparseVector()` (TF-based with stopword filtering, hash to 0-65535), `upsertWithSparseVector()`, `upsertVectorsWithSparse()`, `addEmbedding()`, `addEmbeddings()` |
| `types.ts` | `SearchOptions` extended: `useHybrid`, `useMiniSearch` flags |
| `MemoryEngine.ts` | `recall()` → **async** (breaking change). Adds `qdrantBackend?: QdrantBackend` + `embedding?: EmbeddingConfig` to `MemoryEngineOptions`. `store()` fires async embedding queue (fire-and-forget). `recall()` uses hybrid search when Qdrant configured & entries >1K. New methods: `backfillEmbeddings()`, `dispose()`, `embeddingStatus` getter. |
| `index.ts` | Exports `EmbeddingService`, `EmbeddingQueue`, `rrfFuse`, `rrfFuseWithNames`, `hybridRecall`, `QdrantBackend` hybrid methods |
| `server/routes.ts` | New endpoints: `POST /embedding/backfill`, `GET /embedding/status` |

Updated files in `timps-code/`:

| File | What changed |
|------|-------------|
| `src/memory/memory.ts` | Added `backfillEmbeddings()`, `embeddingStatus`, async `searchFacts()`. `getContextString()` → async |
| `src/commands/executor.ts` | New handlers: `/memory:embed-backfill`, `/memory:embed-status` |

### Key design decisions

- **MiniSearch kept for <1K entries** — Qdrant only delegated when entry count exceeds 1K, avoiding network overhead for small projects.
- **RRF with k=60** — standard hybrid search parameter; lists with different lengths weighted fairly by rank position.
- **Embedding queue backed by in-memory array + StorageBackend crash recovery** — not Redis-only, so single-process deployments don't require Redis running.
- **Sparse vectors computed client-side** — simple TF-based extraction with stopword filtering and hash-to-index mapping (0-65535), avoids external tokenizer dependency.
- **Knowledge graph expansion via shared-tag overlap** — 2+ shared tags between a top-BM25 result and another memory creates a KG edge. No external graph DB needed.
- **Graceful degradation** — if Qdrant returns error or embedding provider down, search falls back to BM25-only with zero data loss.
- **Async embedding is fire-and-forget** — store() returns immediately without waiting for embedding. BM25 handles immediate recall queries. Embedding computed in background batch.
- **Embedding config per engine instance** — passed via `MemoryEngineOptions`, not ambient from config file. Different engines can use different providers.

### Gotchas

- **`recall()` is now async.** All callers must use `await`. This includes `MemoryEngine.getContextString()`, `multiProjectRecall()`, `Memory.searchFacts()`, and all REST/gRPC handlers and tests.
- **Hybrid search pipeline:** Stage 1a BM25 (always) → Stage 1b Qdrant hybrid (dense + sparse BM25 vectors) → Stage 1c KG expansion (shared-tag overlap) → Stage 1d RRF fusion. Stages 2-7 (ProvenanceForge, ConfidenceCalibrator, FalseMemoryDetector, ContextVector, RehearsalEngine) run on the fused results.
- **Qdrant HNSW params:** `m: 32`, `ef_construct: 128`, `indexing_threshold: 50000`. Collection includes named sparse vector `bm25` for native BM25-vector search.
- **Sparse vector format:** `{ indices: number[], values: number[] }` where indices are hash values (0-65535) and values are `1 + log2(TF)`.
- **Embedding queue:** accumulates items for max 500ms, then sends batch of up to 16 to embedding provider. Returns zero-vectors on failure (graceful degradation).
- **Store-then-immediately-recall** finds the memory via BM25 (sync) before embedding completes (async). The embedding arrives eventually in Qdrant.
- **Pre-existing eval import errors** in `timps-code/src/commands/executor.ts` (`seedEngineWithDataset`, `loadAllDatasets`, etc. not exported from `@timps/memory-core`) are unrelated to Phase 4a.
- **`MemoryEngine.test.ts` and `memory-unified.test.ts`** both test `recall()` synchronously with `await`. If a new test file calls `recall()` without `await`, the result will be a Promise, not an array — the test will silently pass with wrong assertions.

## Phase 4b — Incremental Layer Computation (June 2026)

New files in `packages/memory-core/src/computation/`:

| File | Purpose |
|------|---------|
| `types.ts` | Task types (`eigenmode`, `contradiction`, `decay_scores`, `materialized_view`, `full_recompute`), `ComputationTask`, `MaterializedView<T>`, view entry types, `ComputationHandlers` |
| `ComputationQueue.ts` | Background batch queue — in-memory + StorageBackend crash recovery (16-item batch, 500ms interval), generic string-dispatch to registered handlers |
| `MaterializedViews.ts` | View get/set/isStale/refresh/delete by name. Pre-defined: `contradictions` (60s TTL), `working_memory` (30s TTL), `velocity` (120s TTL), `drift` (120s TTL). Backed by `StorageBackend` under `views:` prefix. |
| `LSHIndex.ts` | Locality-sensitive hashing index — random projection (4 tables × 8 bits, embed dim 64). `insert(id, content)`, `delete(id)`, `query(content, maxResults?)` returns candidate IDs. No generic type parameter — stores `string` IDs keyed by `string` content. |

Updated files:

| File | What changed |
|------|-------------|
| `HarmonicSheafWeaver.ts` | `weave()` sets `_dirtyEigenmodes` flag + tracks `_pendingNodeIds` instead of clearing spectral cache. `detectContradictions()` and `predict()` use `computeEigenpairsWarm()` (8 iterations, seeded from cached eigenvectors) instead of `computeSmallestEigenpairs()` (40 iterations). Added `computeEigenpairsWarm()` function. Added `isEigenmodeDirty` getter and `refreshEigenmodes()`. |
| `AetherForgeERL.ts` | Same pattern as HSW: `_dirtyEigenmodes`, `_pendingNodeIds`, warm-started eigenpair computation, `isEigenmodeDirty` getter, `refreshEigenmodes()` |
| `EchoForge.ts` | `_decayScoreCache: Map<string, number>` — cached `effectiveEcho()` results. `_cachedEcho(nodeId, atMs)` returns cached score or computes + caches. `_invalidateDecayScore()`/`_invalidateAllDecayScores()`. All `effectiveEcho()` call sites replaced with `_cachedEcho()`. Cache invalidated on `verify()`, `contradict()`, `archive()`, `store()` retrieval increment, and `consolidate()` changes. `refreshDecayScores()` for ComputationQueue worker. |
| `intelligence/contradiction.ts` | `LSHIndex` field. Constructor rebuilds LSH from existing positions. `check()` queries LSH buckets for candidates (max 16 per claim) instead of O(N) scan. Falls back to full scan when LSH returns empty (cold start). `store()` inserts into LSH; `delete()` removes from LSH; 200-position cap also removes from LSH. |
| `MemoryEngine.ts` | New fields: `_computationQueue`, `_materializedViews`. Constructor initializes both. `_computationHandlers()` registers `eigenmode`, `contradiction`, `decay_scores`, `materialized_view` handlers. `store()` enqueues 4 fire-and-forget tasks per write. `dispose()` calls `_computationQueue.stop()`. Exports `computationQueue` and `materializedViews` getters. |
| `computation/types.ts` | Exports `ViewEntry` union type. `ComputationHandlers` changed to `Record<string, (task) => Promise<void>>`. |
| `computation/MaterializedViews.ts` | Exports constant names `CONTRADICTION_VIEW`, `WORKING_MEMORY_VIEW`, `VELOCITY_VIEW`, `DRIFT_VIEW`. All internal method references use constant names. |
| `computation/LSHIndex.ts` | Changed from generic `LSHIndex<T extends { id: string; content: string }>` to non-generic `LSHIndex`. `insert(item: T)` → `insert(id: string, content: string)`. `query` returns `string[]` of IDs. `getAll()` returns `string[]`. |

### Key design decisions

- **ComputationQueue follows EmbeddingQueue pattern** — in-memory array + StorageBackend crash recovery, not Redis-dependent.
- **All forge incremental updates are fire-and-forget** — `store()` enqueues tasks but returns immediately; BM25 handles immediate recall queries; incremental compute arrives eventually.
- **Warm-started eigenmode computation** — cached eigenvectors seeded as initial guesses for power iteration (2-5 iterations vs 40 from scratch). Uses `computeEigenpairsWarm()` in both HSW and AetherForgeERL.
- **LSHIndex is non-generic** — stores string IDs keyed by content. Simpler interface for contradiction detector integration.
- **Materialized views have per-view TTL** — stale views trigger fresh computation on read. Views stored under `views:` prefix in the same StorageBackend.
- **Decay score cache is in-memory only** — not persisted. Invalidated on any mutation (verify, contradict, archive, retrieval increment). `refreshDecayScores()` recomputes all scores on a periodic cycle.

### Gotchas

- **ComputationQueue constructor arg order:** `new ComputationQueue(handlers, backend?, config?)` — handlers first, then optional backend and config.
- **`computeEigenpairsWarm()` signature:** `(n, triples, k, cachedValues?, cachedVectors?, cachedN?, maxIter?)`. Uses `cachedVectors[i * prevK + vec]` interpolation for warm-start seeding. Falls back to deterministic seeding (`Math.sin`) when cache doesn't match dimension.
- **EchoForge `_cachedEcho()` returns 0 for unknown node IDs** — not `undefined`. Consumers get a valid number.
- **LSH query candidates are limited to 16 per claim** — tunable by `maxResults` parameter on `query()`. Falls back to full O(N) scan when LSH returns 0 candidates.
- **ContradictionDetector `check()` calls `this._lsh.query(claim, 16)`** — returns `string[]` IDs. The `autoStore=true` default still stores each claim after checking.
- **MemoryEngine `_computationHandlers()` register per-task-type handlers** — `eigenmode`, `contradiction`, `decay_scores`, `materialized_view`. Worker routes task.type to the matching handler via `this.handlers[task.type]`.
- **`MaterializedViews.refresh(name, computeFn)` requires a compute function** — the materialized_view handler passes `async () => []` as fallback. Override in production by registering a real compute handler at engine level.
- **Pre-existing test failure:** `ContextVector — L19 > match returns empty when no similar contexts` fails (unrelated to Phase 4b). Time/day matching triggers on captures within the same second.

## Phase 4c — Memory Compaction (June 2026)

3-tier compaction (classify → cluster → consolidate → compress → archive → delete) that reduces active storage by ~79% at scale while improving recall quality.

### Architecture

```
Scheduler (6h / manual `timps compact`)
  │
  └─→ CompactionPipeline.run(entries)
        │
        ├─ Step 1: MemoryClassifier.classifyAll()
        │   └─ Assigns each entry → hot / warm / cold / deleted
        │      Based on age, recall frequency, importance, contradiction status, pin status
        │
        ├─ Step 2: ClusterEngine.cluster()
        │   ├─ With embeddings: k-means++ (cosine distance, sqrt(N/2) clusters)
        │   └─ Without embeddings: layer + first-tag fallback grouping
        │
        ├─ Step 3: LLMConsolidationEngine.consolidate()
        │   ├─ Sends cluster to user's LLM (BYOK — OpenAI/Ollama/Anthropic compatible)
        │   ├─ Constitutional system prompt with 10 guardrail rules
        │   ├─ ConstitutionalGuardrails post-processing:
        │   │   ├─ Fabrication check (keyword verification against source)
        │   │   ├─ Instruction leakage strip
        │   │   ├─ Contradiction preservation check
        │   │   └─ Confidence scoring (high/medium/low)
        │   └─ Falls back to rule-based concatenation when no LLM configured
        │
        ├─ Step 4: ContentCompressor.compress()
        │   ├─ Lossy: shorten verbose content, preserve first sentence + key entities
        │   └─ Lossless: embedding always kept, error messages preserved
        │
        ├─ Step 5: ArchiveBackend.archiveBatch()
        │   ├─ Cold memories → gzipped JSON files (archive_{ts}.json.gz)
        │   ├─ Index maintained for quick listing/restore
        │   └─ Not indexed in Qdrant — archive is cold storage
        │
        ├─ Step 6: Purge deleted originals
        │   └─ Entries marked 'deleted' (consolidated >30 days ago) removed from active store
        │
        └─ Step 7: Enqueue materialized view refresh + eigenmode recompute
```

### New files in `packages/memory-core/src/compaction/`

| File | Purpose |
|------|---------|
| `types.ts` | `CompactionConfig`, `ClassifiedMemory`, `ConsolidatedFact`, `CompressionResult`, `ArchiveManifest`, `CompactionReport`, `LLMConsolidationRequest/Response`, `GuardrailCheckResult` |
| `MemoryClassifier.ts` | Tier assignment: hot/warm/cold/deleted based on age, importance, recall count, contradiction status, pin status |
| `ClusterEngine.ts` | k-means++ clustering on embedding vectors (cosine distance, random projection). Falls back to layer + tag grouping |
| `LLMConsolidationEngine.ts` | OpenAI-compatible LLM summarization with constitutional guardrail prompt. BYOK — falls back to rule-based |
| `ConstitutionalGuardrails.ts` | Post-processing: fabrication check, instruction leakage detection/strip, contradiction preservation, confidence scoring |
| `ContentCompressor.ts` | Lossy compression: shortens verbose content while keeping embeddings. Preserves errors, extracts first sentence + key entities |
| `ArchiveBackend.ts` | Cold storage: gzipped JSON archive files, index for listing/restore, batch operations |
| `CompactionPipeline.ts` | Orchestrator: classify → cluster → consolidate → compress → archive → delete. Individual steps callable via `classifyOnly()`, `archiveOnly()`, `consolidateOnly()` |
| `index.ts` | Re-exports |

### Updated files

| File | What changed |
|------|-------------|
| `MemoryEngine.ts` | `compaction` getter (lazy `CompactionPipeline`), `archiveBackend` getter, `compactionConfig` getter, `runCompaction()` method, `_buildCompactionMetadata()`, `_buildProtectedIds()`. `MemoryEngineOptions.compaction` accepts `Partial<CompactionConfig>`. |
| `index.ts` | Exports all Phase 4c modules and types |

### Compaction config defaults

```ts
{
  archiveAfterDays: 90,              // Memories older than this with no recall → cold
  warmImportanceThreshold: 0.4,      // Importance below this with few recalls → warm
  coldImportanceThreshold: 0.2,      // Importance below this + old → cold
  warmRecallThreshold: 3,            // Recalls below this → consolidation candidate
  clusterMinSize: 50,               // Minimum cluster size for LLM consolidation
  clusterMaxSize: 200,              // Maximum cluster size for LLM consolidation
  deleteAfterConsolidationDays: 30,  // Originals deleted 30 days after consolidation
  clusterEmbedDim: 64,               // Embedding dimension for clustering
  constitutionalGuardrails: true,    // Enable post-processing guardrails
}
```

### 3 Tiers

| Tier | What | Storage | Recall |
|------|------|---------|--------|
| Hot | <90 days, high importance, frequent recall, pinned, in contradiction | Full fidelity in Postgres + Qdrant | Full vector search |
| Warm | Medium age/importance, few recalls | LLM-consolidated facts in Qdrant, originals archived | Consolidated summary via vector search |
| Cold | >90 days, never recalled, low importance | Gzipped JSON archive files, not in Qdrant | Not searchable via recall; restorable |
| Deleted | Consolidated >30 days ago, originals purged | Only the consolidated fact remains | Consolidated summary only |

### Constitutional guardrails

The LLM summarization is protected by 4 post-processing checks:

1. **Fabrication check** — verifies key terms in the summary appear in source episodes
2. **Instruction leakage detection** — strips any text matching the system prompt structure
3. **Contradiction preservation** — ensures source contradictions are noted in the summary
4. **Confidence scoring** — assigns high/medium/low based on source count, pattern density, summary length

If guardrails detect issues, the LLM is retried once with an explicit warning.

### Gotchas

- **LLM is BYOK** — the user's API key is used; no TIMPS-hosted LLM. Falls back to rule-based concatenation when no LLM configured.
- **Archive is cold storage** — archived entries are NOT in Qdrant and not vector-searchable. They can be restored via `ArchiveBackend.restoreAll()`.
- **Protected IDs** — memories involved in contradictions are protected from archival/deletion. The `_buildProtectedIds()` method checks all entries via ContradictionDetector.
- **`CompactionPipeline` can run individual steps** — `classifyOnly()`, `archiveOnly()`, `consolidateOnly()` for targeted operations.
- **`MemoryEngine.runCompaction()`** applies changes (delete, compress) after the pipeline report is generated, then enqueues materialized view refresh.
- **Cluster count formula**: `max(1, round(sqrt(N/2)))` — for 100 warm memories → 7 clusters, for 1000 → 22 clusters.
- **k-means++ initialization** uses weighted random selection for the first centroid, then distance-squared weighting for remaining centroids.
- **ArchiveBackend stores gzipped JSON** — each batch is one `archive_{timestamp}.json.gz` file. Index is a stripped manifest list.
- **Compression ratio for verbose content**: typically 2-7x. Embedding is always preserved.
- **Pre-existing test failure:** `ContextVector — L19 > match returns empty when no similar contexts` fails (unrelated to Phase 4c).
