---
sidebar_position: 1
---

# Installation

## Prerequisites

- Node.js 18 or later
- npm 9 or later

## CLI Agent (timps-code)

```bash
npm install -g timps-code
```

Verify:

```bash
timps --version
```

## MCP Server (timps-mcp)

For Claude Code, Cursor, or Windsurf:

```bash
npm install -g timps-mcp
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": {
        "PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

## Memory Core (library)

```bash
npm install @timps/memory-core
```

## VS Code Extension

Search for **"TIMPS — AI Coding Agent"** in the VS Code Marketplace, or install via:

```bash
code --install-extension TIMPs.timps-ai-coding-agent
```
