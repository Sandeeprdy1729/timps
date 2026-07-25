# TIMPS Audit Fix Tracker

**Source:** `timps-audit.md` (388 verified issues across ~135k LOC)

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 11    | 11    | 0         |
| High     | 89    | 40    | 49        |
| Medium   | 208   | 0     | 208       |
| Low      | 80    | 0     | 80        |
| **Total**| **388** | **51** | **337** |

---

## ✅ Fixed — 11 Critical + 40 High

| ID | File | Issue | Fix Summary |
|----|------|-------|-------------|
| C4 | `benchmark/index.ts` | `rmSync` deletes OS temp dir and `~/.timps` | Added guard checks for root/tilde paths before deletion |
| C6 | `packages/memory-core/src/storage.ts` | `MAX_SEMANTIC=500` silent truncation | Increased to 100000 (env-overridable via `TIMPS_MAX_SEMANTIC`) |
| C8 | `timps-code/src/config/config.ts` | Project ID uses `path.basename` → hash inconsistency | Changed to `hashProject(path.resolve(p))` for consistent IDs |
| C11 | `timps-vscode/src/extension.ts` | TypeScript type annotations in webview inline script | Removed `: string` from arrow function params |
| C5 | `packages/memory-core/src/server/websocket.ts` | JWT HMAC signature never verified in `verifyToken` | Added `crypto.createHmac('sha256', TIMPS_JWT_SECRET)` with `timingSafeEqual` |
| C7 | `packages/server/api/routes.ts` | No auth on any route, all userId attacker-controlled | Added `requireAuth` + `requireUserId()` middlewares to 45+ routes |
| C9 | `timps-code/src/services/bridge/sessionManager.ts` | RCE via unsanitized `node --eval` injection | Replaced string interpolation with `process.env` vars |
| C10 | `timps-code/src/utils/gateway.ts` | No webhook signature verification for Feishu/WeCom | Added HMAC-SHA256 for Feishu, SHA1 for WeCom, `timingSafeEqual` |
| C1 | `apps/marketplace/src/app/api/integrations/[id]/proxy/route.ts` | No auth on integration proxy | Added `requireAuth` middleware (env: `MARKETPLACE_API_KEY`) |
| C2 | `apps/marketplace/src/app/api/plugins/[id]/run/route.ts` | No auth on plugin run | Added `requireAuth` middleware |
| C3 | `apps/marketplace/src/lib/plugins/api-client.ts` | SSRF via unvalidated URL fetch | Added `isBlockedUrl()` — blocks private IPs, localhost, cloud metadata |

## 📋 Remaining — 337 Issues

### High (49)
| ID | File | Issue | Fix Summary |
|----|------|-------|-------------|
| H1 | `.github/workflows/eval.yml` | Eval baseline never persisted, `github.ref_name` never `"main"` on PR | Added `actions/cache` for baseline dir, fixed branch detection with `github.event_name == 'push' && github.ref == 'refs/heads/main'` |
| H2 | `apps/marketplace/src/lib/credentials.ts` | Hardcoded encryption key + static salt | Requires `MARKETPLACE_ENCRYPTION_KEY` env var (fails closed), generates random salt per-install |
| H3 | `apps/marketplace/src/lib/integrations/jira.ts`, `salesforce.ts` | SSRF + data exfiltration via user-supplied `instanceUrl` | Added `validateUrl()` blocking private IPs/localhost; stripped response body from error messages |
| H4 | `apps/mobile/package.json` | Missing `@react-native-async-storage/async-storage` dep | Added to `dependencies` |
| H5 | `crates/timps-agent/src/lib.rs` | Retry `continue` resumes dead stream instead of re-calling provider | Changed to labeled `continue 'turn` to restart the outer provider loop |
| H6 | `crates/timps-cli/src/main.rs` | Tools constructed but never registered with AgentBuilder | Added `.tool(t)` loop in `run_one_shot` and `run_interactive` from `tools.all()` |
| H7 | `crates/timps-providers/src/azure.rs`, `compat.rs` | Azure URL has `?api-version` before `/chat/completions`; uses Bearer auth instead of `api-key` header | Added `with_query()` and `with_auth_header()` builders to `OpenAICompat`; Azure now uses `api-key` header and `api-version` as query param |
| H8 | `crates/timps-providers/src/claude.rs` | Tool call stub is empty (never emits `ToolCall`), `Role::Tool` mapped to `"assistant"`, no HTTP status check, `resp.text()` buffers entire response | Added `PendingTool` state machine + `input_json_delta` accumulation; `Role::Tool` → `tool_result` content block; status check before body; chunked SSE streaming |
| H9 | `download_cli.sh` | Always dies with 'Could not determine latest version' because repo has zero releases | Falls back to `git clone` + `cargo build --release` when no GitHub release is found |
| H10 | `evals/suites/chronos-forge.ts` | Baseline metrics fabricated with `Math.random()` dice-rolls, fake improvement deltas | Replaced with real computations: trigram Jaccard for temporal recall + contradiction detection, count-based heuristic for foresight, measured latency |
| H11 | `Formula/timps.rb` | Homebrew formula has all-zero sha256 placeholders and points to non-existent release assets | Rewritten as head-only formula that builds from source via `cargo install` |
| H12 | `install.sh` | Interactive `read` prompts break `curl|bash`; `npm bin -g` removed in npm 9; `sudo npm install -g` in piped script | Added `PIPED` detection (`[[ -t 0 ]]`), all prompts guarded and use `</dev/tty`; replaced `npm bin -g` with `npm root -g`; replaced `sudo` fallback with manual instructions |
| H13 | `packages/cache/src/index.ts` | Extra stray `};` after `cacheWithTTL` arrow function makes the file a SyntaxError | Removed the unmatched closing brace |
| H14 | `packages/connection-manager/src/index.ts` | API keys/OAuth tokens stored in plaintext in localStorage | Added AES-256-GCM encryption via Web Crypto API; key in sessionStorage (ephemeral); credentials encrypted before serialization, decrypted on load |
| H15 | `packages/date-utils/src/index.ts` | Two missing closing parentheses (`endOfWeek` line 96, `min` line 236) cause SyntaxError | Added the missing `)` on both lines |
| H16 | `packages/event-bus/src/index.ts`, `packages/connection-manager/src/index.ts`, `packages/timps-desktop/src/components/IntegrationSettings.tsx` | Triple-dead activity feed: wildcard filter never matches (strict equality), no publisher bridges to EventBus, subscription leaks on remount | Added `matchWildcard()` to EventBus (supports `*`-suffix patterns); bridged `ConnectionManager.emit()` → `eventBus.publish()`; stored sub ID and unsub on cleanup |
| H17 | `packages/logger/src/index.ts` + `package.json` | Two issues: `picocolors` has no named export `c` (TypeError on load), and neither `winston` nor `picocolors` declared as dependencies — module resolution fails | Changed import to `import pc from 'picocolors'` + `pc.` throughout; added `winston` and `picocolors` to package.json dependencies; ran `npm install` |
| H18 | `packages/memory-core/src/native.ts`, `packages/memory-core/src/search.ts`, `packages/memory-core-rs/bench/bench.ts` | NativeCore interface, search.ts, and benchmark declare 9 storage/search/hashing functions that Rust addon doesn't export (only computeBatchSimilarity, kmeansClusterFlat, eigenmodeWarmStart, RustLsh exist) | Removed phantom function declarations from NativeCore interface; removed dead `n.searchEntries()` call + `getNative` import from search.ts; stripped native benchmark section that would crash at runtime |
| H19 | `packages/memory-core/deploy/k8s/timps-memory.yaml` | Three k8s anti-patterns: emptyDir wipes data on pod eviction (defeats "persistent memory"), 3 replicas with no session affinity produce divergent state, image is unpinned `:latest` | Replaced emptyDir with PVC (10Gi ReadWriteOnce); added `sessionAffinity: ClientIP` (1h timeout); pinned image tag with `TIMPS_VERSION` env var; added doc comment explaining scaling assumptions |
| H20 | `packages/memory-core/src/server/start.ts` (new), `packages/memory-core/docker-compose.yml`, `packages/memory-core/deploy/k8s/timps-memory.yaml`, `packages/memory-core/Dockerfile`, `packages/memory-core/package.json` | 13 env vars (POSTGRES_PRIMARY, REDIS_URL, QDRANT_URL, MEMORY_PORT, TIMPS_TELEMETRY_*, etc.) passed to memory service in docker-compose + k8s but never read by the server — the entire horizontal scale stack (Postgres primary+2 replicas, Redis, Qdrant, PgBouncer) is scenery | Created `src/server/start.ts` entry point that reads all env vars and dynamically imports the correct backends (PostgresBackend, CacheManager, QdrantBackend, EventBus, TelemetryManager); updated tsup build, Dockerfile CMD, and manifests with doc comments confirming the env vars are now consumed |
| H21 | `packages/memory-core/Dockerfile` + `src/server/index.ts` | Dockerfile CMD points to barrel file (re-exports only) — container loads module and exits immediately; CrashLoopBackOff | Fixed as part of H20: CMD now points to `dist/server/start.js` which bootstraps and runs the MemoryServer |
| H22 | `packages/memory-core/evals/datasets/*.json`, `src/eval/types.ts`, `src/eval/runner.ts`, `src/MemoryEngine.ts` | 4 eval datasets don't test what they claim: long-context has no distractors, multi-agent lacks actorIds, contradictions have <30% Jaccard overlap, temporal ordering all uses same timestamp | Added 57 distractors (long-context), seeds with actorId (multi-agent), >50% Jaccard-overlap pairs (adversarial), explicit timestamps months apart (temporal); added EvalEntrySeed type; seedEngineWithDataset consumes seeds/distractors; MemoryEngine.store() accepts optional timestamp |
| H23 | `packages/memory-core/src/EchoForge.ts` | ReservoirReadout generates hash-seeded random weights on every call — untrained, content-independent pseudo-noise centred on 0.5 | Replaced with 4-factor content-aware scoring: reservoir activation energy (35%), active node density (30%), contradiction edge weight (20%), recency-weighted echo amplitude (15%) |
| H24 | `packages/memory-core/src/EngramLog.ts` | recover() JSON.parses last line with no try/catch — torn write bricks all memory stores | Added try/catch with backward walk skipping unparseable lines; same fix in verifyChain() and query() |
| H25 | `packages/memory-core/src/EngramLog.ts` | Plain SHA-256 chain with no secret and no external head anchor — in-place edits and truncation pass verifyChain() | Switched to HMAC-SHA256 with auto-generated project-local secret; added engram.head.json written atomically per append; verifyChain() checks anchor for truncation |
| H26 | `packages/memory-core/src/MemoryEngine.ts` | store() passes null provenance to ConstitutionalGuard → always rejected but write proceeds anyway (only lowers confidence) | Now passes minimal provenance with confidence+evidenceCount; store() returns early when guard rejects; logs rejection to EngramLog |
| H27 | `packages/memory-core/src/MemoryEngine.ts` | L6 ResonanceForge missing entirely, L8 AetherForgeERL and L9 HarmonicSheafWeaver have getters but never receive store data; ~9K lines of forge code is shelf-ware | Added resonanceForge getter; wired all 3 into store() weave pipeline alongside L5/L7; fixed layer number comments |
| H28 | `packages/memory-core/src/MemoryEngine.ts` | multiProjectRecall mutates shared backend scope without try/finally — exception leaves foreign scope active permanently; concurrent ops see wrong tenant | Wrapped setScope/recall/restore in try/finally so scope always restores |
| H29 | `packages/memory-core/src/MemoryEngine.ts` | audit({since}) passes timestamp as strict-equality filter to EngramLog.query() — zero entries match because millisecond-exact timestamps never hit | Removed `filter.timestamp = since` from audit(); loop's >= range check already handles it |
| H30 | `packages/memory-core/src/ProvenanceForge.ts`, `MemoryEngine.ts` | ProvenanceForge.record() generates content-hash ID (sha256) and saves as {hash}.json, but _recallCompute/provenanceForge.explain(entry.id) looks up by memory entry ID (mem_xxx) — file never exists; entire intelligence pipeline operates on defaults | record() accepts optional overrideId; store() passes the memory entry ID so provenance is keyed by the same ID used in lookups |
| H31 | `packages/memory-core/src/sandbox/Sandbox.ts` | 3 sub-issues: (1) BashSandbox has no network block when network:none, (2) NodeSandbox only shadows require() leaving fetch/ESM import/process.binding open, (3) memoryMb/cpuShares never enforced | (1) Bash function overrides + PATH no-op wrappers for 13 network tools, (2) globalThis.fetch/XMLHttpRequest/Request/WebSocket blocked, process.binding deleted, (3) ulimit -v for bash, V8 --max-old-space-size/--max-semi-space-size for Node, (4) buildEnv drops credentials/SSH/proxy vars |
| H32 | `packages/memory-core/src/sandbox/WasmSandbox.ts` | 3 sub-issues: (1) runNode passes ...process.env leaking all secrets, (2) dead ternary (both branches 'null') makes permission check a no-op, (3) createAbiProxy returns 'stub_' strings instead of real results or denial errors | (1) Stripped env to PATH:/usr/bin:/bin + NODE_OPTIONS + TIMPS_SANDBOXED, (2) require() shadowed for 13 dangerous modules; _timsOrigRequire deleted before main(), (3) ABI proxy checks perms.includes(m), denies or emits JSON-lines marker, (4) dead ternary removed |
| H33 | `packages/memory-core/src/server/auth.ts:50` | timingSafeEqual called outside try/catch; RangeError on mismatched-length signature propagates 500 instead of 401 | Moved timingSafeEqual inside try block — catch returns null, middleware sends 401 |
| H34 | `packages/memory-core/src/telemetry/MetricsRegistry.ts:252` | prometheusExport() emits dots in metric names and two adjacent label blocks — Prometheus rejects the scrape payload | Sanitize dots → underscores at output; merge labels into single block (e.g. `{layer="echo",le="5"}`); fix test assertions |
| H35 | `packages/plugin-git/src/index.ts:21`, `packages/plugin-shell/src/index.ts:14` | Both plugins define tools as Array with `{content}` returns, but SDK requires `manifest.tools: ToolSpec[]` + `tools: Record<string, ToolHandler>` returning `{output, error}` — `allTools()` skips them, contributing zero tools | Added `manifest.tools` (5 specs for git, 3 for shell); rewrote `tools` as Record; handlers now return `{output, error}` and accept `_ctx` param. All 8 tools now resolve via registry. |
| H36 | `packages/server/tools/toolsDb.ts:787` | `CREATE INDEX USING GIN(gist)` on plain `TEXT` column — stock Postgres has no default GIN opclass for text; migration aborts mid-way, dropping all downstream tables | Changed to `(gist)` — default b-tree index works correctly on TEXT |
| H38 | `packages/timps-desktop/src-tauri/src/commands.rs:97` | All storage paths derived from `HOME` env var (5 locations in commands.rs, 1 in nexus_bridge.rs) — Windows GUI processes use `USERPROFILE`, not `HOME`, so memory resolves to `C:\Program Files\TIMPS\.timps` making the entire desktop app non-functional on Windows | Created `pub(crate) fn home_dir()` checking `HOME` → `USERPROFILE` → `.`; replaced all 6 direct `HOME` references |
| H39 | `packages/timps-desktop/src-tauri/src/commands.rs:97` | Desktop memory reader triply broken: (1) `project_hash_inner` uses 31-multiply→base36 while memory-core uses SHA-256→12 hex chars so directory names never match, (2) `load_episodes` reads `episodes.jsonl` but v1→v2 migration converts to `episodes.json` and deletes `.jsonl`, (3) nexus_bridge.rs duplicates the wrong hash | Replaced `project_hash_inner` with SHA-256→12 hex chars matching memory-core; `load_episodes` now reads `episodes.json` JSON array; nexus_bridge delegates to `crate::commands::project_hash_inner`; `sha2`+`hex` deps added to Cargo.toml |
| H40 | `packages/timps-desktop/src-tauri/src/commands.rs:613` | 4 semantic.json writers (store_memory, passive_store, delete_memory, run_background_summarizer) do bare fs::read→modify→fs::write with no locking; clipboard watcher thread races with Tauri commands and summarizer; `fs::write` truncates first so a concurrent reader parses truncated JSON as empty, then rewrites file with only its entry — silent full memory wipe | Added `SEMANTIC_LOCK: Mutex<()>` serializing all read-modify-write cycles; added `write_json_atomic()` (write to .tmp + rename); lock held only during critical section in summarizer (not during expensive episode analysis) |

⏸️ Paused — awaiting user instruction to proceed

### Medium (208)
⏸️ Paused — awaiting user instruction to proceed

### Low (80)
⏸️ Paused — awaiting user instruction to proceed

---

## How to proceed

Run the following command to view the audit file and send specific issue IDs:

```
cat /path/to/timps-audit.md | grep "H[0-9]"  # see high severity issues
```

Or tell me: `fix H1`, `fix H1-H5`, etc.
