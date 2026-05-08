---
sidebar_position: 4
---

# Plugin Development Guide

Create custom plugins to extend TIMPS functionality.

## Quick Start

```bash
# Generate a new plugin
timps gen plugin my-plugin

# Navigate to the plugin directory
cd plugins/my-plugin
```

## Project Structure

```
my-plugin/
├── src/
│   ├── index.ts        # Main entry point
│   ├── tools.ts       # Tool definitions
│   └── types.ts       # TypeScript types
├── package.json
├── tsconfig.json
└── manifest.json     # Plugin manifest
```

## Manifest

Every plugin requires a `manifest.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "permissions": [
    "memory:read",
    "memory:write"
  ],
  "tools": [
    {
      "name": "my-tool",
      "description": "Tool description",
      "schema": {
        "type": "object",
        "properties": {
          "input": { "type": "string" }
        },
        "required": ["input"]
      }
    }
  ],
  "settings": [
    {
      "key": "apiKey",
      "type": "string",
      "label": "API Key",
      "required": true
    }
  ]
}
```

## Tool Definition

```typescript
import { Tool, ToolExecutor } from '@timps/core';

export interface MyToolInput {
  input: string;
}

export interface MyToolOutput {
  result: string;
}

export const myTool: Tool<MyToolInput, MyToolOutput> = {
  name: 'my-tool',
  description: 'Performs a custom operation',
  schema: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  execute: async (input: MyToolInput): Promise<MyToolOutput> => {
    // Your tool logic here
    return { result: `Processed: ${input.input}` };
  },
};
```

## Executors

Process complex inputs using executors:

```typescript
const myExecutor: ToolExecutor<MyToolInput, MyToolOutput> = {
  preProcess: async (input) => {
    // Validate input
    return input;
  },
  execute: async (input) => {
    return myTool.execute(input);
  },
  postProcess: async (output) => {
    // Transform output
    return output;
  },
};
```

## Settings

Access plugin settings in your tools:

```typescript
import { PluginContext } from '@timps/core';

export const myTool: Tool = {
  name: 'my-tool',
  description: 'Tool with settings',
  execute: async (input, context: PluginContext) => {
    const apiKey = context.settings.get('apiKey');
    
    // Use API key
    return { result: 'ok' };
  },
};
```

## Memory Access

Read and write to memory:

```typescript
import { MemoryClient } from '@timps/core';

export const myTool: Tool = {
  name: 'my-tool',
  execute: async (input, context) => {
    const memory = new MemoryClient(context.sessionId);
    
    // Read working memory
    const working = await memory.get('working');
    
    // Write to episodic memory
    await memory.add('episodic', {
      event: 'tool-executed',
      tool: 'my-tool',
      timestamp: Date.now(),
    });
    
    return { success: true };
  },
};
```

## Sandbox

Plugins run in a sandboxed environment with restricted permissions:

| Permission | Default | Required |
|------------|---------|----------|
| `file:read` | ❌ | Manifest |
| `file:write` | ❌ | Manifest |
| `network` | ❌ | Manifest |
| `memory:read` | ✅ | - |
| `memory:write` | ✅ | - |
| `execute:tools` | ✅ | - |

## Publishing

```bash
# Build the plugin
npm run build

# Publish to marketplace
timps publish
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { myTool } from './index';

describe('my-tool', () => {
  it('should process input', async () => {
    const result = await myTool.execute({ input: 'test' });
    expect(result.result).toContain('test');
  });
});
```

## Best Practices

1. **Type everything** - Use TypeScript for all inputs/outputs
2. **Handle errors** - Always catch and handle errors gracefully
3. **Log appropriately** - Use structured logging for debugging
4. **Test thoroughly** - Aim for 80%+ test coverage
5. **Version carefully** - Follow semantic versioning