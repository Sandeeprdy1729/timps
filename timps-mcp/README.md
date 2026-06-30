# @timps-ai/timps-mcp — Persistent Memory for Claude, Cursor, and Windsurf

[![npm](https://img.shields.io/npm/v/@timps-ai/timps-mcp?color=blue)](https://www.npmjs.com/package/@timps-ai/timps-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

45 MCP tools that give your AI coding assistant persistent memory across sessions — contradiction detection, bug patterns, burnout monitoring, architecture drift, and 22-layer memory forge.

```bash
npm install -g @timps-ai/timps-mcp
```

## Add to your AI tool

### Claude Code (`~/.claude.json`)

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000", "TIMPS_USER_ID": "1" }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000", "TIMPS_USER_ID": "1" }
    }
  }
}
```

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000", "TIMPS_USER_ID": "1" }
    }
  }
}
```

## Two modes

| Mode | Config | Backend |
|------|--------|---------|
| **SERVER** (default) | `TIMPS_URL` set | Proxies to TIMPS HTTP server |
| **LOCAL** | No `TIMPS_URL` | Uses `@timps-ai/memory-core` MemoryEngine directly |

## 45 MCP Tools

### Core Memory
`timps_chat`, `timps_get_memories`, `timps_store_memory`

### Contradiction Detection
`timps_check_contradiction`, `timps_get_positions`

### Decision Intelligence
`timps_check_regret`, `timps_log_decision`, `timps_simulate_decision`, `timps_log_past_decision`

### Burnout Monitoring
`timps_burnout_analyze`, `timps_record_signal`

### Bug & Code Patterns
`timps_warn_bug_pattern`, `timps_record_bug`, `timps_check_tech_debt`, `timps_record_incident`

### API Knowledge
`timps_lookup_api`, `timps_record_api_quirk`

### Meetings & Commitments
`timps_extract_commitments`, `timps_get_pending_commitments`, `timps_complete_commitment`

### Relationships
`timps_record_mention`, `timps_relationship_check`

### Living Manifesto
`timps_ingest_manifesto_signal`, `timps_get_manifesto`

### Chronos Veil (Causal Graph)
`timps_chronos_ingest`, `timps_chronos_query`, `timps_chronos_stats`

### NexusForge (Knowledge Graph)
`timps_nexus_ingest`, `timps_nexus_query`, `timps_nexus_stats`, `timps_nexus_graph`

### SynapseMetabolon
`timps_synapse_ingest`, `timps_synapse_query`, `timps_synapse_stats`, `timps_synapse_graph`, `timps_synapse_consolidate`

### Architecture & Risk
`timps_detect_architecture_drift`, `timps_predict_bug_risk`, `timps_get_incident_timeline`, `timps_check_deployment_risk`

### Developer Intelligence
`timps_get_velocity_trend`, `timps_get_context_switches`, `timps_record_learning`, `timps_get_shared_decisions`, `timps_record_review_pattern`

### ChronosForge
`timps_temporal_query`, `timps_chrono_foresight`, `timps_chrono_consolidate`

### L7+ Intelligence
`timps_skill_shadow`, `timps_log_question`, `timps_curriculum_plan`, `timps_observe_culture`, `timps_codebase_culture`, `timps_record_contribution`, `timps_mark_contributor_active`, `timps_institutional_memory`

### 22-Layer Tools
`timps_verify_engram_chain`, `timps_false_memory_check`, `timps_explain_provenance`, `timps_resolve_conflict`, `timps_audit_memory`, `timps_register_trigger`, `timps_reveal_bias`, `timps_infer_schemas`

## Env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMPS_URL` | — | TIMPS server URL (SERVER mode) |
| `TIMPS_USER_ID` | `1` | User ID |

## Examples

```
You: "I'm going to use setTimeout for sync here"
→ timps_warn_bug_pattern → ⚠️ Bug pattern match (race condition, hit before in src/queue.ts)

You: "Remote teams don't work"
→ timps_check_contradiction → ⚠️ CONTRADICTION 82% — 47 days ago you said "Remote works best"
```
