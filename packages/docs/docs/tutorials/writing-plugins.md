# Tutorial: Writing Your First Plugin

This tutorial shows how to create a custom TIMPS plugin.

## What is a Plugin?

A plugin extends TIMPS with:
- Custom tools
- New providers
- Additional memory handlers

## Quick Start

### 1. Create Plugin Structure

```bash
mkdir my-timps-plugin
cd my-timps-plugin
npm init -y
```

### 2. Create Plugin File

```typescript
// src/index.ts
import { Plugin } from 'timps-code';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  // Add custom tools
  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      schema: { /* JSON Schema */ },
      execute: async (params) => {
        return { result: 'Done!' };
      },
    },
  ],
  
  // Hook into lifecycle
  setup: async () => {
    console.log('Plugin loaded!');
  },
};
```

### 3. Configure

```json
{
  "plugins": ["my-timps-plugin"]
}
```

### 4. Use

```bash
timps my-tool --param value
```

## Publishing

```bash
# Update package.json
npm publish
```

Others can install:
```bash
npm install @yourname/timps-plugin
```

## Example: Custom API Client

```typescript
import { Plugin, Tool } from 'timps-code';

export const apiClient: Plugin = {
  name: 'api-client',
  version: '1.0.0',
  
  tools: [
    {
      name: 'api_request',
      description: 'Make HTTP request to API',
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST'] },
        },
        required: ['url'],
      },
      execute: async ({ url, method = 'GET' }) => {
        const res = await fetch(url, { method });
        return { data: await res.json() };
      },
    },
  ],
};
```

## Best Practices

1. **Clear tool descriptions** - Used for routing
2. **Strong typing** - Use TypeScript interfaces
3. **Error handling** - Return meaningful errors
4. **Testing** - Add tests for all tools

## Resources

- See `packages/docs/examples/` for more examples
- Join Discord for help