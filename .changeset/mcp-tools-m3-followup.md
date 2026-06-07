---
"timps-mcp": patch
"@timps/memory-core": patch
---

### 12 new MCP tool wrappers (61 total, was 49)

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
