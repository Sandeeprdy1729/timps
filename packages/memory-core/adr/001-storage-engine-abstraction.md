# ADR 001: Storage Engine Abstraction (Phase 1b)

**Status:** Accepted (June 2026)  
**Deciders:** Memory Core Team  
**Tags:** storage, arch, interfaces, forges

---

## Context

Memory-core started with 22 forge layers and 17+ intelligence tools, each calling `fs.readFileSync`/`fs.writeFileSync` directly against `~/.timps/memory/<hash>/`. Over time this caused three problems:

1. **No crash safety** — a process kill mid-write produces half-written JSON files.
2. **Untestable at scale** — every test touches real disk (slow) or requires `mock-fs`.
3. **Inflexible** — swapping disk for Postgres/SQLite/Redis means rewriting every forge.

Phase 1b introduces a unified `StorageBackend` interface that every forge and tool uses, backed by a WAL-journaled `FileBackend` by default.

## Decision

Introduce a `StorageBackend` interface at `packages/memory-core/src/backends/types.ts` with these operations:

```
read(key)          → returns parsed value or null
write(key, value)  → upsert
delete(key)        → no-op if missing
list(prefix?)      → sorted key scan
query(filter)      → filtered list with timestamp/custom predicate/limit
exists(key)        → boolean
append(key, line)  → JSONL log-style write
beginTxn()         → Transaction { write, delete, commit, rollback }
```

Four implementations ship in-tree:

| Backend | Location | Sync/Async | Driver | WAL |
|---|---|---|---|---|
| `FileBackend` | `backends/FileBackend.ts` | sync | `fs` (built-in) | ✅ `.wal` → rename on POSIX |
| `InMemoryBackend` | `backends/InMemoryBackend.ts` | sync | `Map` (built-in) | n/a |
| `PostgresBackend` | `backends/PostgresBackend.ts` | async | `pg` (optional) | PostgreSQL WAL |
| `SQLiteBackend` | `backends/SQLiteBackend.ts` | sync | `better-sqlite3` (optional) | SQLite WAL mode |
| `RedisBackend` | `backends/RedisBackend.ts` | async | `ioredis` (optional) | AOF |

### Architecture

```
MemoryEngine
 ├── _backend: StorageBackend (passed via constructor options)
 │    └── FileBackend({ baseDir }) ← default
 │    └── PostgresBackend({ connectionString })
 │    └── InMemoryBackend() ← used in tests
 ├── EchoForge(this.dir, this._backend)
 ├── ChronosForge(this.dir, this._backend)
 ├── ResonanceForge(this.dir, this._backend)
 ├── ...20+ more forge layers...
 └── 25 intelligence tools (same pattern)
```

Key invariants:
- Every forge/tool receives `backend` as optional second/third constructor param.
- When `backend` is omitted, the forge falls back to direct `fs` calls (preserving backward compat).
- `MemoryEngine` always passes its `_backend` to every forge it creates.
- Top-level storage helpers in `storage.ts` (`appendEpisode`, `loadEpisodes`, `episodeCount`, etc.) use `getBackend(dir)` which creates/caches a `FileBackend`.

### WAL Protocol (FileBackend)

```
write(key, value):
  1. serialize to JSON string
  2. write to <key>.wal + fsync
  3. rename .wal → <key>  (atomic on POSIX)

_startup:
  walk baseDir for orphaned *.wal files
  if .wal mtime > target mtime → replay
  remove .wal
```

## Consequences

### Positive

- **Crash safety**: WAL journaling guarantees no half-written JSON; process kill recovery is automatic.
- **Testability**: `InMemoryBackend` lets all 467 tests run without disk I/O (currently they still use disk because `MemoryEngine` default is `FileBackend`, but switching to `InMemoryBackend` is a one-liner).
- **Pluggable storage**: Adding Postgres/SQLite/Redis requires zero changes to forge layers — just pass a different backend.
- **Cleaner forge code**: All file I/O is abstracted; forges call `this.backend.read('key')` instead of `fs.readFileSync(path.join(this.dir, '...'))`.

### Negative

- **All forge layers accept `backend` as a new param**: 35+ files touched, constructor signatures changed.
- **Performance overhead**: `FileBackend` serializes/deserializes JSON on every read/write. Forges that cached raw data internally (e.g., `EchoForge` with a 275KB reservoir state) now parse it on every load. Mitigated by the fact that forges load once at construction and write once on `store()`/`persist()`.
- **No migration path for existing JSONL data**: Episodic storage format changed from newline-delimited JSON (`episodes.jsonl`) to JSON array (`episodes.json`). Old data is not auto-migrated.

### Risks

- **Native addon bypass**: `@timps/memory-core-rs` (Rust NAPI addon) was writing `episodes.jsonl` in JSONL format, while the backend wrote `episodes.json` — causing `episodeCount` to return 0 when native was loaded. **Mitigation**: Removed all native fast-paths from `storage.ts`. Native is still used for pure compute (`jaccardSimilarity`, `searchEntries`).
- **Backward compat**: Forge layers that don't receive a `backend` param must still work. All constructors check `if (this._backend)` before using it, falling back to direct `fs` calls.

## Alternatives Considered

### Keep direct `fs` calls everywhere
Rejected — WAL journaling, testability, and pluggability are worth the abstraction cost. The project has 22+ forges and >25 tools; the ad-hoc approach doesn't scale.

### Use an ORM / query builder (Knex, Prisma)
Rejected — forges store plain JSON objects, not relational rows. An ORM adds complexity without benefit. The `StorageBackend` interface is intentionally smaller than a full ORM.

### Make `MemoryEngine` extend a subclass to inject backend
Rejected — constructor DI is simpler and more explicit than subclassing. Every forge already takes `dir` as a constructor param; adding `backend` alongside it is consistent.

## Additional Context

- Design doc: `TIMPS_Memory_Architecture_Master_Plan.md` (Phase 1b section)
- Implementation PR: (pending)
- Benchmarks: R@5 = 95% (≥ 90% threshold), 467/467 tests passing
