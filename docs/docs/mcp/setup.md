---
sidebar_position: 2
---

# MCP Server Setup

## Claude Code

Add to `~/.claude/claude_desktop_config.json`:

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

## Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

## Remote server mode

If running the `timps` full server, the MCP server can connect to it instead of using a local memory engine:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "TIMPS_URL": "https://your-timps-server.com",
        "TIMPS_TOKEN": "your-token",
        "PROJECT_PATH": "/path/to/project"
      }
    }
  }
}
```

In remote mode, all 46 tools delegate to the server API and memory is shared across machines.
