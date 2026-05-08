# Tutorial: MCP Integration with Claude/Cursor/Windsurf

This tutorial shows how to connect TIMPS to Claude Code, Cursor, or Windsurf via MCP.

## What is MCP?

MCP (Model Context Protocol) gives AI assistants persistent memory and tools.

## Why Use It?

- Claude Code forgets everything on close
- TIMPS remembers forever
- Get 20+ memory tools in your editor

## Quick Setup

### 1. Install TIMPS MCP

```bash
npm install -g timps-mcp
```

### 2. Configure Claude Code

Add to `claude/settings.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "npx",
      "args": ["timps-mcp"]
    }
  }
}
```

### 3. Configure Cursor

Settings → Extensions → MCP → Add:

```
Name: timps
Command: npx timps-mcp
```

### 4. Configure Windsurf

Similar to Cursor - add MCP server in settings.

## Available Tools

Once connected, you get:

| Tool | Description |
|------|------------|
| `memory_read` | Read from semantic memory |
| `memory_write` | Write to semantic memory |
| `memory_search` | Search memories |
| `episodic_list` | List past sessions |
| `semantic_recall` | Recall learned patterns |

## Usage in Claude/Cursor

```
Ask: "Use the pattern from last week"
Claude: [uses semantic memory]

Ask: "Remember that we use error boundaries"
TIMPS: [saves to memory]
```

## Verify Connection

```bash
timps-mcp --test
```

Should list available tools.

## Troubleshooting

**Not connecting?**

1. Check install: `npm list -g timps-mcp`
2. Check config: `timps status`
3. Restart editor

**Tools not showing?**

- Verify MCP config in editor settings
- Check editor logs