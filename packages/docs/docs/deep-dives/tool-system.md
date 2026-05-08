# TIMPS Under the Hood: Tool System

TIMPS provides 25+ tools for file, git, shell, web, and memory operations.

## Tool Architecture

```
Tool Interface
├── schema (JSON Schema)
├── execute (function)
└── description (for routing)
```

## Tool Types

### File Tools

| Tool | Description |
|------|------------|
| `file_read` | Read file contents |
| `file_write` | Write/create files |
| `file_edit` | Edit file portions |
| `file_grep` | Search in files |
| `file_tree` | List directory tree |

### Git Tools

| Tool | Description |
|------|------------|
| `git_status` | Show working tree |
| `git_commit` | Commit changes |
| `git_push` | Push to remote |
| `git_pull` | Pull from remote |
| `git_log` | View history |

### Shell Tools

| Tool | Description |
|------|------------|
| `shell_exec` | Run command |
| `shell_kill` | Stop process |
| `shell_ps` | List processes |

### Web Tools

| Tool | Description |
|------|------------|
| `web_search` | Search web |
| `web_fetch` | Get URL content |
| `web_scrape` | Extract data |

## Creating Custom Tools

```typescript
import { Tool } from 'timps-code';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'What the tool does',
  schema: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  execute: async ({ input }) => {
    return { result: input.toUpperCase() };
  },
};
```

## Tool Selection

The agent selects tools by matching task intent to tool descriptions. Keep descriptions accurate!

## Source Files

- `timps-code/src/tools/` - Tool implementations
- `timps-code/src/tools/tools.ts` - Tool router