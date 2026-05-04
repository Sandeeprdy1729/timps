# TIMPS MCP — Persistent Intelligence for Claude, Cursor, and Windsurf

[![npm](https://img.shields.io/npm/v/timps-mcp?color=blue)](https://www.npmjs.com/package/timps-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

Give your AI coding assistant a memory that persists across sessions, catches contradictions, remembers your bug patterns, tracks API quirks, and monitors your burnout — all as native MCP tools.

**The problem:** Claude Code, Cursor, and Windsurf forget everything between sessions. Every conversation starts from zero.

**What TIMPS MCP solves:** 20 MCP tools that give your AI assistant long-term intelligence — stored on your own infrastructure, private by default.

## Quick Start

**Step 1:** Start the TIMPS server (one command with Docker):

```bash
# From the timps repo root
docker compose up -d
```

Or manually: `cd sandeep-ai && npm install && npm run server`

**Step 2:** Install the MCP package:

```bash
npm install -g timps-mcp
```

**Step 3:** Add to your AI tool's config and restart:

### Claude Code (`~/.claude.json`)

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

### Remote TIMPS server (Railway, Render, etc.)

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

### Remote TIMPS server (Railway, Render, etc.)

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

---

## All 20 MCP Tools

### Core Memory

| Tool | What it does |
|---|---|
| `timps_chat` | Full conversation with all intelligence tools active |
| `timps_get_memories` | Recall stored facts, goals, and preferences |
| `timps_store_memory` | Permanently store a fact (importance 1-5) |

### Contradiction Detection

| Tool | What it does |
|---|---|
| `timps_check_contradiction` | Detects if a statement contradicts a past position |
| `timps_get_positions` | Lists all tracked positions with conflict counts |

### Decision Memory

| Tool | What it does |
|---|---|
| `timps_check_regret` | Warns before you repeat a decision you previously regretted |
| `timps_log_decision` | Records a decision and its outcome for future warnings |
| `timps_simulate_decision` | Simulates future outcomes before you commit |

### Burnout Monitoring

| Tool | What it does |
|---|---|
| `timps_burnout_analyze` | Current burnout risk score based on behavioral baseline |
| `timps_record_signal` | Log a behavioral signal (overwork, skip meetings, late commits) |

### Bug & Code Pattern Intelligence

| Tool | What it does |
|---|---|
| `timps_warn_bug_pattern` | Warns if current coding context matches your personal bug triggers |
| `timps_record_bug` | Record a bug to build your personal bug profile |
| `timps_check_tech_debt` | Warns if a code pattern matches a past production incident |
| `timps_record_incident` | Record a production incident for future pattern matching |

### API Knowledge Base

| Tool | What it does |
|---|---|
| `timps_lookup_api` | Retrieve known quirks for an API (auth, rate limits, gotchas) |
| `timps_record_api_quirk` | Save a discovered API gotcha to never rediscover it |

### Commitments & Meetings

| Tool | What it does |
|---|---|
| `timps_extract_commitments` | Extract action items from meeting notes or Slack messages |
| `timps_get_pending_commitments` | List all open commitments with due dates |

### Relationships & Values

| Tool | What it does |
|---|---|
| `timps_relationship_check` | Check relationship health and drift alerts |
| `timps_get_manifesto` | Your living manifesto — actual values derived from behavior |

---

## Real examples

```
You: "I'm going to use setTimeout for synchronization here"
Claude: [calls timps_warn_bug_pattern]
⚠️  Bug pattern match: "setTimeout for async sync → race condition"
    You hit this before in src/queue.ts — took 12h to debug (March 2025)
```

```
You: "Remote teams don't work. Everyone should be in the office."
Claude: [calls timps_check_contradiction]
⚠️  CONTRADICTION (82%) — 47 days ago you stated:
    "Remote work increases productivity and should be the default"
    Have you changed your mind?
```

```
You: "Let me use the same auth pattern we used for the payments API"
Claude: [calls timps_lookup_api]
📋  Known quirk for payments-api:
    - Rate limit is 60 req/min per IP, not per API key (undocumented)
    - Token refresh must happen before expiry, not on 401 (causes cascade)
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TIMPS_URL` | `http://localhost:3000` | URL of your TIMPS server |
| `TIMPS_USER_ID` | `1` | Your TIMPS user ID |

---

## License

MIT — [github.com/Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps)
