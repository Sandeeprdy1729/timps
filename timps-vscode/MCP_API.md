# TIMPS MCP API v1 — Stable Tool Names

**Freeze date:** June 2026
**API version:** `1`
**Breaking changes:** None after this freeze. New tools only, never rename/remove.

## Core Memory

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_chat` | Full-context chat with memory activation | `message` (string, required), `username` (string, optional) |
| `timps_get_memories` | Retrieve all stored memories/goals/preferences | none |
| `timps_store_memory` | Store a new memory with tags | `content` (string, required), `type` (string, optional), `tags` (string[], optional) |
| `timps_get_context` | Get current memory context for active file | `filePath` (string, optional), `cursorLine` (number, optional), `projectPath` (string, optional) |

## Intelligence Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_check_contradiction` | Check a statement against stored memories for contradictions | `statement` (string, required), `autoStore` (boolean, optional) |
| `timps_get_positions` | Get all tracked positions on topics | none |
| `timps_check_regret` | Check if a decision matches past regrets | `decision` (string, required), `context` (string, optional) |
| `timps_log_decision` | Log a decision for future regret checks | `decision` (string, required), `rationale` (string, required), `context` (string, optional) |
| `timps_burnout_analyze` | Analyze current burnout trajectory | none |
| `timps_record_signal` | Record a wellness/energy signal | `category` (string, required), `value` (number, required), `note` (string, optional) |
| `timps_warn_bug_pattern` | Check code against known bug patterns | `code` (string, required), `language` (string, optional) |
| `timps_record_bug` | Record a bug/fix for pattern learning | `symptom` (string, required), `cause` (string, required), `fix` (string, required), `files` (string[], optional) |
| `timps_check_tech_debt` | Check for tech debt signals in a code area | `filePath` (string, required), `content` (string, optional) |
| `timps_record_incident` | Record a production incident | `title` (string, required), `severity` (string, required), `impact` (string, required), `files` (string[], optional) |
| `timps_lookup_api` | Look up API quirks/surprises | `endpoint` (string, required), `method` (string, optional) |
| `timps_record_api_quirk` | Record an API quirk/surprise | `endpoint` (string, required), `method` (string, optional), `issue` (string, required), `workaround` (string, optional) |

## Commitment Tracking

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_extract_commitments` | Extract commitments from a message | `text` (string, required) |
| `timps_get_pending_commitments` | Get all pending commitments | none |
| `timps_complete_commitment` | Mark a commitment as completed | `commitmentId` (string, required) |
| `timps_record_mention` | Record that a contributor was mentioned | `mentionedUser` (string, required), `context` (string, optional) |
| `timps_relationship_check` | Check relationship history with a contributor | `username` (string, required) |
| `timps_log_past_decision` | Log a decision from past context | `decision` (string, required), `rationale` (string, required), `outcome` (string, optional) |
| `timps_simulate_decision` | Simulate a decision across past contexts | `decision` (string, required), `options` (string[], required) |

## Manifesto / Values

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_ingest_manifesto_signal` | Ingest a value signal for the manifesto | `category` (string, required), `content` (string, required) |
| `timps_get_manifesto` | Get the current living manifesto | none |

## Chronos (Episodic Memory)

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_chronos_ingest` | Store an episodic memory with temporal context | `content` (string, required), `tags` (string[], optional), `importance` (number, optional) |
| `timps_chronos_query` | Query episodic memory by time/semantic | `query` (string, required), `limit` (number, optional), `startTime` (string, optional), `endTime` (string, optional) |
| `timps_chronos_stats` | Get Chronos forge statistics | none |
| `timps_chrono_foresight` | Predict future patterns from temporal data | `query` (string, required), `horizon` (string, optional) |
| `timps_chrono_consolidate` | Consolidate similar episodic memories | `dryRun` (boolean, optional) |
| `timps_temporal_query` | Execute an advanced temporal query across layers | `query` (string, required), `timeRange` (string, optional), `limit` (number, optional) |

## Nexus (Semantic Memory Graph)

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_nexus_ingest` | Store a memory in the semantic graph | `content` (string, required), `tags` (string[], optional), `entities` (string[], optional) |
| `timps_nexus_query` | Query the semantic graph | `query` (string, required), `limit` (number, optional) |
| `timps_nexus_stats` | Get Nexus forge node/edge statistics | none |
| `timps_nexus_graph` | Get the full semantic graph as nodes/edges | none |

## Synapse (Procedural Memory)

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_synapse_ingest` | Store a procedural memory | `content` (string, required), `tags` (string[], optional) |
| `timps_synapse_query` | Query procedural memory | `query` (string, required), `limit` (number, optional) |
| `timps_synapse_stats` | Get Synapse forge statistics | none |
| `timps_synapse_graph` | Get the full procedural graph as nodes/edges | none |
| `timps_synapse_consolidate` | Consolidate redundant procedural steps | `dryRun` (boolean, optional) |

## Session & Patterns

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_get_session_history` | Get history of all sessions | `limit` (number, optional) |
| `timps_get_architecture_decisions` | Get past architecture decisions | `limit` (number, optional) |
| `timps_get_code_patterns` | Get detected code patterns | `language` (string, optional), `limit` (number, optional) |
| `timps_record_pattern` | Record a code pattern | `pattern` (string, required), `language` (string, required), `description` (string, required) |
| `timps_get_patterns_for_context` | Get patterns relevant to current code context | `code` (string, required), `language` (string, required) |
| `timps_record_review_pattern` | Record a pattern found during code review | `pattern` (string, required), `severity` (string, required), `recommendation` (string, required) |
| `timps_record_learning` | Record a learning/insight | `topic` (string, required), `insight` (string, required) |

## Architecture & Risk

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_detect_architecture_drift` | Check for architecture drift in current code | `filePath` (string, optional) |
| `timps_predict_bug_risk` | Predict bug risk for a code change | `filePath` (string, required), `changeDescription` (string, optional) |
| `timps_get_incident_timeline` | Get the incident timeline | `limit` (number, optional) |
| `timps_check_deployment_risk` | Check deployment risk for current changes | `files` (string[], optional) |
| `timps_get_velocity_trend` | Get team velocity trend data | `days` (number, optional) |
| `timps_get_context_switches` | Get context switch analysis | none |
| `timps_get_shared_decisions` | Get decisions shared across sessions | `limit` (number, optional) |

## Codebase Anthropology

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_skill_shadow` | Analyze skill distribution in the codebase | `area` (string, optional) |
| `timps_log_question` | Log a question for curriculum planning | `question` (string, required), `context` (string, optional) |
| `timps_curriculum_plan` | Generate a curriculum plan | `area` (string, optional) |
| `timps_observe_culture` | Observe cultural signals from recent activity | none |
| `timps_codebase_culture` | Analyze codebase culture from history | `depth` (string, optional) |
| `timps_record_contribution` | Record a contribution for institutional memory | `type` (string, required), `description` (string, required), `impact` (string, optional) |
| `timps_mark_contributor_active` | Mark a contributor as active | `username` (string, required) |
| `timps_institutional_memory` | Get institutional memory for a topic | `topic` (string, required) |

## Integrity & Safety

| Tool | Description | Parameters |
|------|-------------|------------|
| `timps_verify_engram_chain` | Verify the integrity of the engram hash chain | none |
| `timps_false_memory_check` | Check for false memories/reconcilation issues | `entryId` (string, optional) |
| `timps_explain_provenance` | Explain the provenance of a memory | `entryId` (string, required) |
| `timps_resolve_conflict` | Resolve a contradiction between two memories | `entryIdA` (string, required), `entryIdB` (string, required), `resolution` (string, required) |
| `timps_audit_memory` | Run a full audit on all memory layers | none |
| `timps_register_trigger` | Register a prospective memory trigger | `trigger` (string, required), `action` (string, required) |
| `timps_reveal_bias` | Reveal potential biases in memory | `layer` (string, optional) |
| `timps_infer_schemas` | Infer schemas from stored memories | `limit` (number, optional) |

## Versioning

- Current API version: `1`
- Every tool response includes `tool_api_version: 1`
- Adding new tools: ✅ Allowed
- Adding optional parameters: ✅ Allowed (backwards compatible)
- Removing tools: ❌ Forbidden (deprecate with `@deprecated` instead)
- Renaming tools: ❌ Forbidden
- Changing required parameter types: ❌ Forbidden
- Changing response format: ❌ Forbidden without version bump and migration guide
