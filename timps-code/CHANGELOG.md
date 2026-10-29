# @timps-ai/timps-code

## 2.1.0

### Minor Changes

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

- 3201eac: ### Generic connector sync services (calendar/drive/github/notion/slack/linear/ms365)

  New `src/services/connectors/` module implementing the shared sync pipeline for the 7 non-gmail connectors: `registry.ts` (provider defs matching `packages/timps-desktop/.../connectors.rs`), `tokens.ts` (token/state storage + `ensureAccessToken` refresh), `clients.ts` (read-only per-provider fetchers → normalized items), `sync.ts` (`runConnectorSync` raw-store → summarize → `itemFact` distill → memory, dedup by raw file).

  New `src/commands/connectors.ts` registers `<id>:sync|status|disconnect` for each provider — the exact commands the desktop Sync buttons shell out to. 9 tests added covering registry, storage, fact distillation, and the full (mocked-fetch) pipeline. Gmail keeps its own command module and shares no storage, staying backward compatible.

- 1223553: ### `timps recall` / `timps context` now also search the global (home) store

  When run **without** `--project`, `timps recall` and `timps context` now search the current project's memory store **plus** the global home-directory store (`~/`), and merge the results (deduped by content, favoring higher scores).

  - Shared documents and user-level facts stored in the home store (which the AUTO-CAPTURE instructions direct agents toward for shared docs) are now retrievable from **any** project directory, with no `--project` flag.
  - The header now shows `(<dir> + global)` to make it clear both stores were searched.
  - Behavior is unchanged when `--project <path>` is given explicitly — that searches only the specified store.

  ### `timps setup` AUTO-CAPTURE instructions — shared docs go to the GLOBAL store

  The instruction block now tells agents where to put what:
  - **Shared documents and user-level facts** (docs, reports, preferences, research) → the **global store**, so they're retrievable from any project (since recall always searches global).
  - **Project-specific memory** → the current project store.

- 30ee5d7: `timps setup --server <url>` now registers agents with **both** `TIMPS_URL` and `TIMPS_MEMORY_URL`, so memory tools (`timps_store_memory`, `timps_get_memories`, `timps_check_contradiction`) route to the shared MemoryServer instead of falling back to the LLM `chat` path. Override either URL via `TIMPS_SETUP_ENV`. Server-mode output now points to the new `DEPLOY.md` → Option 5 (MemoryServer full stack) guide covering the docker-compose stack, scaling, and verification.

### Patch Changes

- 1223553: ### `timps setup` instructions — auto-capture is now explicitly MANDATORY

  The instruction block `timps setup` installs into every agent's rule file no longer just suggests "store as you go". It now states that **AUTO-CAPTURE IS MANDATORY (do not ask first)** and tells agents to call `timps_store_memory` on their own whenever the user:

  - shares, pastes, attaches, or links a document / report / spec / README / research / meeting notes / any substantial text (store a digest),
  - states a preference, decision, project fact, goal, constraint, or opinion,
  - sends a long message with several ideas (batch into 2–5 concise entries, never one blob),
  - gives requirements for a feature or task.

  This makes shared docs and messages persist automatically even when the agent is also doing other work in the same turn, instead of capture being skipped. Existing installed blocks are left untouched (idempotent) — re-run `timps setup` only installs the new text into fresh or uninstalled targets.

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

- bd1b6d5: ### LSP proxy: no duplicate language servers after a restart

  `LspProxyServer`'s child `exit` handler cleared `realServerProcess`
  unconditionally, so after `stop()` + `start()` the old process's late exit
  wiped the reference to the new one. The proxy then thought no server was
  running and the next `start()` spawned a duplicate. The handler now only clears
  its own child. `stop()` also returns a Promise that resolves once the server
  has exited (escalating to SIGKILL after 2s), so callers can wait for a clean
  shutdown.

- dbde5cf: ### Wedge: single `npx timps setup` + standalone timps-mcp binary

  - **`timps setup`** — register TIMPS as an MCP server for every coding agent installed on the machine (Claude Code, Codex CLI, OpenCode, Cursor, Windsurf, Gemini CLI). Options: `--list`, `--uninstall`, `--server <url>` (point agents at a shared MemoryServer), `--binary <path>` (point at a local binary), `--dry-run`. Default mode is local (FileBackend in the agent's project dir — no server, no API keys).
  - **`timps-mcp` standalone packaging** — new `build:standalone` (esbuild bundle, 4MB CJS) and `scripts/build-binary.sh` (single-file executable via Bun compile, Node SEA fallback). Agents can now point MCP configs at a binary instead of `npx -y @timps-ai/timps-mcp` for stable, low-latency spawns. External lazy-loaded deps (pg, ioredis, better-sqlite3, @qdrant/js-client-rest) stay external.

- 21f8404: ### `timps setup`: working MCP registration on Windows; README points at current packages

  - On Windows, `timps setup` registered `command: "npx"`. MCP clients spawn
    servers without a shell and `npx` is `npx.cmd` there, so the server failed to
    start with ENOENT. Windows registrations now use `cmd /c npx -y @timps-ai/timps-mcp`.
  - `--binary` pointing at a `.js`/`.cjs`/`.mjs` bundle is now run with `node`.
  - The README quickstart (`npx timps-code`) and npm badges pointed at the stale
    unscoped `timps-code`/`timps-mcp` packages (2.0.1); they now use
    `@timps-ai/timps-code` and `@timps-ai/timps-mcp`.

- Updated dependencies [23eff61]
- Updated dependencies [7bdf855]
- Updated dependencies [5762f45]
- Updated dependencies [0bba65e]
- Updated dependencies [10aeb95]
- Updated dependencies [9bd54c7]
  - @timps-ai/memory-core@1.0.4
