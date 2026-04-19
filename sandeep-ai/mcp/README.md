# TIMPs MCP Server

Model Context Protocol server for TIMPs memory integration with Claude Desktop and Cursor.

## Features

- **8 Memory Tools**: store, retrieve, assemble, detect contradictions, entities, decay, gc, stats
- **Entity Resolution**: Automatic entity extraction and linking
- **Salience Scoring**: Importance-weighted memory retrieval
- **Temporal Decay**: Configurable decay for older memories
- **Contradiction Detection**: Truth Engine for catching conflicting information

## Installation

```bash
cd sandeep-ai/mcp
npm install
npm run build
```

## Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "node",
      "args": ["/Users/sandeepreddy/Desktop/testbot/sandeep-ai/mcp/dist/index.js"]
    }
  }
}
```

## Cursor Setup

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "node",
      "args": ["/Users/sandeepreddy/Desktop/testbot/sandeep-ai/mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `memory_store` | Store memories with entity extraction and salience |
| `memory_retrieve` | Semantic search with entity linking |
| `memory_assemble` | Pre-Inference Routing context packets |
| `memory_detect_contradictions` | Truth Engine contradiction detection |
| `memory_entities` | Entity graph exploration |
| `memory_apply_decay` | Temporal decay for memory aging |
| `memory_gc` | Garbage collection and compression |
| `memory_stats` | Memory statistics and health |

## Usage Example

```
User: "Remember that I prefer dark mode"
→ memory_store({ content: "User prefers dark mode", type: "preference", user_id: "user123" })

User: "What are my display preferences?"
→ memory_retrieve({ query: "display theme dark mode", user_id: "user123" })
```

## Development

```bash
npm run dev    # Build and run
npm test       # Run tests
```
