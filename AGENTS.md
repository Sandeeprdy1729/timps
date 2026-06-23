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
