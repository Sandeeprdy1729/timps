# @timps-ai/timps-mcp

## 2.0.4

### Patch Changes

- 6b1ce25: ### `timps setup` now installs memory-usage instructions — auto-capture is on by default

  - **What changed:** `timps setup` appends a marker-fenced block (`<!-- timps:memory:start/end -->`) to each detected agent's global rule file telling it to pull TIMPS context at session start and store user data as it happens. Memory capture no longer depends on model whims.
  - **Files written:** `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, and a Cursor rule `~/.cursor/rules/timps.mdc` (`alwaysApply: true` frontmatter). Windsurf gets MCP registration only (no user-level instruction file).
  - **Idempotent + reversible:** re-running `timps setup` is a no-op when the block is present; `timps setup --uninstall` removes it. `--no-instructions` skips it; `--dry-run` previews without writing.
  - **Gemini detection** now also fires when `~/.gemini/GEMINI.md` exists.
  - **Fixed misleading message:** "no change (timps not registered)" → "already registered (no config change)".

  ### New CLI commands — context anywhere
  - `timps recall "<query>" [--limit N] [--project <path>]` — search TIMPS memory from any terminal (defaults to the current project).
  - `timps context [--project <path>]` — print the full memory context string, same one agents get.

  ### Path canonicalization for shared stores
  - `projectHash()` now resolves symlinks (`fs.realpathSync`) so a project reachable via multiple path spellings (e.g. `/tmp/…` vs `/private/tmp/…` on macOS) maps to **one** memory store. Agent-stored memories and terminal recall now always converge on the same `~/.timps/memory/<hash>/`.

- 25502cd: ### `timps_check_contradiction` — checks stored memories + no more self-match false positives

  - The tool now also compares the claim against **stored semantic memories** via `MemoryEngine.checkBeforeStore()`, not just past positions. A claim that opposes an existing memory returns `⚠️ CONTRADICTION with stored memory (N%)` with the stored text.
  - A `negates()` gate (no/not/never/don't/doesn't/cannot/won't/isn't/without…) distinguishes real opposition from duplicates and near-duplicates. Self-matches and same-sentiment paraphrases are demoted to `✓ Consistent…` / `✓ Already stored` instead of being flagged as contradictions (previously identical claims auto-stored as positions then re-flagged at 60–100%).
  - Applied consistently to both local (binary/embedded engine) and server (`memoryClient`) paths.

- 316e2f4: ### 8 new intelligence tools (17 total, all real, all benchmarked)

  Eight new deterministic engines in `packages/memory-core/src/intelligence/`,
  each <150 LOC, no LLM, no `Math.random()`:

  - **Meeting Ghost** — extracts commitments ("@alice will fix X by Friday") from
    meeting notes via regex + participant detection
  - **Dead Reckoning** — simulates likely outcomes of a decision from similar
    past decisions (Jaccard-weighted vote over regret scores)
  - **Living Manifesto** — derives your actual values from behavior, not stated
    beliefs (frequency analysis of stored decisions)
  - **Relationship Intelligence** — tracks contacts, alerts on drift >90 days
  - **Skill Shadow** — reframes `VelocityTracker` advice as "how YOU do this work"
  - **Curriculum Architect** — identifies topics you keep asking about but never decide
  - **Codebase Anthropologist** — surfaces cultural norms from stored decisions
  - **Institutional Memory** — preserves departed contributors' decisions and quirks

  All 25 tools verified by `benchmark/index.ts` smoke test (100% pass).

  ### Real benchmark, real numbers
  - `benchmark/index.ts` rewritten. Previously used `Math.random()` to fake
    R@5/R@10/MRR/NDCG and SWE-bench/Terminal-Bench/LongMemEval claims.
    Now runs the actual `MemoryEngine` against a 50-fact corpus and reports:
    R@1 75%, R@5 95%, R@10 95%, MRR 0.82, NDCG 0.85, contradiction 10/10,
    intel tools 17/17, scalability 0.2–0.6ms at 50/200/500 facts.
  - `benchmark/runners/harmonicSheafWeaver.ts:115` — `Math.random()` replaced
    with deterministic `nodeIds[i % nodeIds.length]`.

  ### Honest README
  - No more "75+ providers" (we ship 7), no more "9 tools" (we ship 17), no
    fabricated benchmark rows.
  - New "Built for Local-First Developers (Especially in India)" section with
    Ollama quickstart, ₹30,000-laptop framing, $0/month cost comparison.

  ### Working swarm DAG
  - `timps-code/src/swarm/graph.ts` — `executeAgent()` calls the agent's
    configured provider/model with its system prompt and streams the real LLM
    response. No more `[name] Completed: task` placeholder.

  ### Runnable demo + screen recording
  - `demo/quick_demo.sh` — 2-minute terminal walkthrough
  - `demo/demo.tape` — VHS recipe producing both `quick_demo.gif` and
    `quick_demo.mp4` from a single command
  - `demo/README.md` — why VHS over plain macOS screen capture

- 9d1c81d: ### timps-mcp: secure the HTTP transport, real version, --version/--help

  - **Security:** `--http` mode listened on every interface with
    `Access-Control-Allow-Origin: *` and no auth, so anyone on the network — or
    any web page the user visited (directly or via DNS rebinding) — could read and
    write their memory. It now binds to `127.0.0.1` by default (`--host` /
    `TIMPS_MCP_HOST` to change), rejects cross-site browser origins (loopback
    origins and `TIMPS_MCP_ALLOWED_ORIGINS` are allowed), rejects non-loopback
    `Host` headers when bound to loopback, and requires
    `Authorization: Bearer $TIMPS_MCP_TOKEN` when that variable is set.
  - Malformed JSON now gets a JSON-RPC parse error (400) instead of a 500, and
    request bodies are capped at 4 MB (413).
  - The server reported version `1.0.0` and its startup line always pointed at
    `http://localhost:3000`, even in local mode. It now reports the package
    version, the actual mode (local project path or server URL) and the tool count.
  - `/health` reported a hardcoded 67 tools; it now reports the real count (69).
  - `--version`/`-v` and `--help`/`-h` print and exit instead of starting a
    server, and the memory engine is no longer created at import time.

- e407784: ### 12 new MCP tool wrappers (61 total, was 49)

  In `timps-mcp/src/index.ts` (now 1247 lines), all 5 previously-server-only
  intelligence tools are now dual-mode (LOCAL via memory-core, SERVER via
  TIMPS_URL), and 4 brand-new L7+ tools are exposed:

  **Re-pointed 5 LLM-stubs at local memory-core backends** (no count change, but
  no more `TIMPS_URL` requirement):

  - `timps_extract_commitments` → `MemoryEngine.meetingGhost.extract`
  - `timps_get_pending_commitments` → `MemoryEngine.meetingGhost.getPending`
  - `timps_relationship_check` → `MemoryEngine.relationship.check`
  - `timps_simulate_decision` → `MemoryEngine.deadReckoning.simulate`
  - `timps_get_manifesto` → `MemoryEngine.livingManifesto.generate`

  **Added 4 write companions** for the 5 above + 1 (commitment completion):

  - `timps_complete_commitment` (id prefix match)
  - `timps_record_mention` (relationship drift tracking)
  - `timps_log_past_decision` (dead reckoning seed)
  - `timps_ingest_manifesto_signal` (manifesto corpus)

  **Added 4 brand-new L7+ tool wrappers** (SkillShadow, CurriculumArchitect,
  CodebaseAnthropologist, InstitutionalMemory):

  - `timps_skill_shadow` — coach using your own workflow patterns
  - `timps_log_question` / `timps_curriculum_plan` — learning gap detection
  - `timps_observe_culture` / `timps_codebase_culture` — cultural norms mining
  - `timps_record_contribution` / `timps_mark_contributor_active` /
    `timps_institutional_memory` — preserve departed contributors

  All tools work in LOCAL mode (no `TIMPS_URL` required). 49 → 61 `registerTool`
  calls; typecheck clean; benchmark still 17/17.

- 7bdf855: ### memory-core: one store per Windows project, deterministic forecasts, auth warning

  - **Windows:** `projectHash()` used `fs.realpathSync`, which keeps the caller's
    casing, so `C:\Proj` and `c:\proj` (VS Code often lowercases the drive)
    hashed to different stores and a project's memory split in two depending on
    which tool launched the server. It now uses `fs.realpathSync.native`, which
    returns the on-disk case. A store that already exists under the old hash
    keeps being used, so no memories are orphaned.
  - `ChronosForge.simulateForesight()` and ResonanceForge (weave phase,
    harmonic projection) used unseeded `Math.random()`, so identical state could
    return a different risk level on every call. Noise is now seeded from the
    inputs (`fnv1a` + `mulberry32`), as the "no `Math.random()`" rule intends.
  - Intelligence tools built IDs from `Math.random()`; they now use `generateId()`
    (crypto), matching the repo convention.
  - `MemoryServer` (`start.ts`) now warns at startup when neither
    `TIMPS_JWT_SECRET` nor `TIMPS_API_KEY_AUTH` is set, since the server is then
    unauthenticated.

- 5762f45: ### Fix recall ranking: normalize BM25 scores before confidence calibration

  `recall()` passed raw MiniSearch BM25 scores (typically 3–15) to
  `ConfidenceCalibrator` as `similarity`, which is weighted as if it were 0–1.
  Every candidate clamped to confidence 1.0, so the final order was decided by
  floating-point noise in the false-memory risk score and the best match often
  ranked last. Similarity is now scaled relative to the top candidate.

  Benchmark (`benchmark/index.ts --quick`): Recall@1 0% → 70%, Recall@5 15% → 90%,
  MRR 0.08 → 0.77.

- dbde5cf: ### Wedge: single `npx timps setup` + standalone timps-mcp binary

  - **`timps setup`** — register TIMPS as an MCP server for every coding agent installed on the machine (Claude Code, Codex CLI, OpenCode, Cursor, Windsurf, Gemini CLI). Options: `--list`, `--uninstall`, `--server <url>` (point agents at a shared MemoryServer), `--binary <path>` (point at a local binary), `--dry-run`. Default mode is local (FileBackend in the agent's project dir — no server, no API keys).
  - **`timps-mcp` standalone packaging** — new `build:standalone` (esbuild bundle, 4MB CJS) and `scripts/build-binary.sh` (single-file executable via Bun compile, Node SEA fallback). Agents can now point MCP configs at a binary instead of `npx -y @timps-ai/timps-mcp` for stable, low-latency spawns. External lazy-loaded deps (pg, ioredis, better-sqlite3, @qdrant/js-client-rest) stay external.

- 9bd54c7: ### Fix EPERM crashes on Windows from leaked file descriptors

  `FileBackend.write()`/`append()` and `EngramLog`'s atomic write opened the
  temp file with `fs.openSync(path, 'r')` only to fsync it, and never closed the
  descriptor. On Windows the open handle blocks the next rename onto the same
  file, so `timps-mcp` crashed on first launch in a new project
  (`schema-version.json` is written once per migration) and every second
  `timps_store_memory` call in a session failed with
  `EPERM: operation not permitted, rename '...json.wal'`.

  The descriptor is now opened `'r+'` (Windows rejects fsync on read-only
  handles, so the old code never actually synced there) and always closed.
  `InstitutionalMemory.save()` also leaked a write descriptor; it now uses
  `fs.writeFileSync`.

- Updated dependencies [23eff61]
- Updated dependencies [7bdf855]
- Updated dependencies [5762f45]
- Updated dependencies [0bba65e]
- Updated dependencies [10aeb95]
- Updated dependencies [9bd54c7]
  - @timps-ai/memory-core@1.0.4
