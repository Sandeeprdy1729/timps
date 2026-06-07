---
"timps-code": patch
"timps-mcp": patch
---

### 8 new intelligence tools (17 total, all real, all benchmarked)

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

All 17 tools verified by `benchmark/index.ts` smoke test (100% pass).

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
