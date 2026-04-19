# TIMPS MCP — Model Context Protocol Server

MCP server for TIMPS — connects Claude Code, Cursor, Windsurf, and any MCP-compatible agent to your TIMPS memory layer.

> **Note:** This connects to the full **sand-eep-ai** server which has the full 17-tool intelligence layer. For simpler CLI use, just install `timps-code` directly.

## What this unlocks

Once connected, your AI coding assistant gains:

- **Contradiction detection** — catches you contradicting past decisions mid-conversation
- **Bug pattern warnings** — knows your personal bug triggers before you write the bug
- **API knowledge** — never re-discover undocumented quirks
- **Decision memory** — warns before you repeat regretted decisions
- **Meeting commitments** — extracts and tracks promises automatically
- **Burnout monitoring** — alerts based on your personal behavioral baseline
- **And 11 more tools** from TIMPs' 17-tool intelligence layer

## Prerequisites

1. TIMPs server running: `cd sandeep-ai && npm run server`
2. Node.js 18+

## Installation

```bash
npm install -g timps-mcp
```

## Configuration

### Claude Code (`~/.claude.json` or `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "TIMPS_URL": "http://localhost:3000",
        "TIMPS_USER_ID": "1"
      }
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
      "env": {
        "TIMPS_URL": "http://localhost:3000",
        "TIMPS_USER_ID": "1"
      }
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
      "env": {
        "TIMPS_URL": "http://localhost:3000",
        "TIMPS_USER_ID": "1"
      }
    }
  }
}
```

### Remote TIMPs (deployed)

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "TIMPS_URL": "https://your-timps-instance.railway.app",
        "TIMPS_USER_ID": "1"
      }
    }
  }
}
```

## Available MCP Tools

| Tool | What it does |
|------|-------------|
| `timps_chat` | Full TIMPs conversation with all 17 tools active |
| `timps_get_memories` | Get all stored memories and goals |
| `timps_store_memory` | Store an important fact permanently |
| `timps_check_contradiction` | Check if statement contradicts past positions |
| `timps_get_positions` | List all tracked positions with conflict counts |
| `timps_check_regret` | Warn before repeating a regretted decision |
| `timps_log_decision` | Record a decision outcome for future warnings |
| `timps_burnout_analyze` | Get current burnout risk assessment |
| `timps_record_signal` | Log a behavioral signal for burnout tracking |
| `timps_warn_bug_pattern` | Check if coding context matches your bug triggers |
| `timps_record_bug` | Record a bug to build your personal pattern profile |
| `timps_check_tech_debt` | Warn if code pattern matches past codebase incidents |
| `timps_record_incident` | Record a production incident for future pattern matching |
| `timps_lookup_api` | Look up known quirks for an API |
| `timps_record_api_quirk` | Save a discovered API gotcha |
| `timps_extract_commitments` | Extract action items from meeting notes |
| `timps_get_pending_commitments` | List all open commitments |
| `timps_relationship_check` | Check relationship health and drift alerts |
| `timps_simulate_decision` | Simulate future outcomes for a decision |
| `timps_get_manifesto` | Get your Living Manifesto (actual values from behavior) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMPS_URL` | `http://localhost:3000` | URL of your TIMPs server |
| `TIMPS_USER_ID` | `1` | Your TIMPs user ID |

## Usage examples in Claude Code

Once connected, Claude automatically calls TIMPs tools when relevant:

```
You: "I'm going to use setTimeout for synchronization here"
Claude: [calls timps_check_tech_debt] 
⚠️ WARNING: This pattern matches a past incident in your codebase — 
"setTimeout used for async synchronization" caused a race condition 
that took 12 hours to debug (March 2025).
```

```
You: "Remote teams don't work, everyone should be in the office"
Claude: [calls timps_check_contradiction]
⚠️ CONTRADICTION DETECTED (82% confidence)
You argued the opposite 47 days ago: "Remote work significantly 
increases developer productivity and should be the default"
```

## License

MIT — github.com/Sandeeprdy1729/timps