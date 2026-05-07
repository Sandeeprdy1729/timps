---
sidebar_position: 1
---

# MCP Tools Reference

The `timps-mcp` server exposes **46 tools** to any MCP-compatible client (Claude Code, Cursor, Windsurf, Continue).

## Setup

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "PROJECT_PATH": "/absolute/path/to/your/project"
      }
    }
  }
}
```

## Tool categories

### Core memory (5 tools)

| Tool | Description |
|---|---|
| `timps_remember` | Store a fact in semantic memory |
| `timps_recall` | Retrieve relevant facts by query |
| `timps_start_episode` | Begin a new session episode |
| `timps_end_episode` | End the current episode with summary |
| `timps_get_stats` | Get memory statistics |

### Semantic analysis (8 tools)

| Tool | Description |
|---|---|
| `timps_detect_contradiction` | Find conflicting facts in memory |
| `timps_get_architecture_insights` | Codebase architecture analysis |
| `timps_record_decision` | Record an architectural decision |
| `timps_get_decisions` | Retrieve past decisions |
| `timps_add_tech_debt` | Log a tech debt item |
| `timps_get_tech_debt` | List tech debt by severity |
| `timps_record_bug_pattern` | Record a recurring bug pattern |
| `timps_get_bug_patterns` | List known bug patterns |

### Velocity tracking (5 tools)

| Tool | Description |
|---|---|
| `timps_record_velocity` | Log task completion with time |
| `timps_get_velocity_trend` | Get AI coaching on your velocity |
| `timps_get_velocity_patterns` | Surface productivity patterns |
| `timps_predict_completion` | Estimate task completion time |
| `timps_record_blocker` | Log a blocking issue |

### Team memory (6 tools)

| Tool | Description |
|---|---|
| `timps_add_team_member` | Add team member profile |
| `timps_get_team_context` | Get team knowledge context |
| `timps_record_standup` | Log standup notes |
| `timps_get_standups` | Retrieve recent standups |
| `timps_add_ownership` | Map code area to owner |
| `timps_get_ownership` | Look up who owns code area |

### Institutional memory (7 tools)

| Tool | Description |
|---|---|
| `timps_record_incident` | Log a production incident |
| `timps_get_incidents` | Retrieve incident history |
| `timps_add_runbook` | Store a runbook |
| `timps_get_runbook` | Retrieve a runbook |
| `timps_record_meeting` | Extract commitments from meeting notes |
| `timps_get_meetings` | Retrieve meeting records |
| `timps_get_commitments` | List open commitments |

### Intelligence tools (15 tools)

Aether Weft, Apex Synapse, Atom Chain, Bind Weave, Chronos Veil, Curate Tier, Echo Forge, Forge Link, Govern Tier, Layer Forge, Nexus Forge, Policy Metabol, Skill Weave, Synapse Metabolon, Tempora Tree — advanced reasoning tools for complex multi-step analysis.

See the [timps-mcp README](https://github.com/Sandeeprdy1729/timps/tree/main/timps-mcp) for full parameter documentation.
