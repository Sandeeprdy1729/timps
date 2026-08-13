# @timps-ai/timps-mcp

## 2.0.3

### Patch Changes

- b05bb4f: ### 8 new intelligence tools (17 total, all real, all benchmarked)

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

- 40a9eb9: ### 12 new MCP tool wrappers (61 total, was 49)

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
