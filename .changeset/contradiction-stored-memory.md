---
"@timps-ai/timps-mcp": patch
---

### `timps_check_contradiction` — checks stored memories + no more self-match false positives

- The tool now also compares the claim against **stored semantic memories** via `MemoryEngine.checkBeforeStore()`, not just past positions. A claim that opposes an existing memory returns `⚠️ CONTRADICTION with stored memory (N%)` with the stored text.
- A `negates()` gate (no/not/never/don't/doesn't/cannot/won't/isn't/without…) distinguishes real opposition from duplicates and near-duplicates. Self-matches and same-sentiment paraphrases are demoted to `✓ Consistent…` / `✓ Already stored` instead of being flagged as contradictions (previously identical claims auto-stored as positions then re-flagged at 60–100%).
- Applied consistently to both local (binary/embedded engine) and server (`memoryClient`) paths.
