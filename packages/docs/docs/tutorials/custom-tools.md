# Tutorial: Adding Custom Tools to Your Agent

This tutorial shows how to extend TIMPS with custom tools.

## Why Custom Tools?

- Automate workflow-specific tasks
- Integrate internal APIs
- Wrap CLI commands

## Creating a Custom Tool

### 1. Define Tool Schema

```typescript
const myToolSchema = {
  type: 'object',
  properties: {
    input: { type: 'string' },
    format: { 
      type: 'string', 
      enum: ['json', 'yaml'],
      default: 'json'
    },
  },
  required: ['input'],
};
```

### 2. Implement Execute

```typescript
async function executeTool(params: any) {
  const { input, format } = params;
  
  // Your logic here
  if (format === 'json') {
    return JSON.parse(input);
  }
  return input;
}
```

### 3. Register Tool

```typescript
// In your plugin or config
registerTool({
  name: 'parse_data',
  description: 'Parse data into specified format',
  schema: myToolSchema,
  execute: executeTool,
});
```

### 4. Use

```bash
timps parse-data --input '{"key": "value"}' --format json
```

## Example: Deploy Tool

```typescript
registerTool({
  name: 'deploy',
  description: 'Deploy application to platform',
  schema: {
    type: 'object',
    properties: {
      platform: { 
        type: 'string', 
        enum: ['vercel', 'netlify', 'cloudflare'] 
      },
      branch: { type: 'string', default: 'main' },
    },
    required: ['platform'],
  },
  execute: async ({ platform, branch }) => {
    switch (platform) {
      case 'vercel':
        return await deployVercel(branch);
      case 'netlify':
        return await deployNetlify(branch);
      case 'cloudflare':
        return await deployCloudflare(branch);
    }
  },
});
```

## Example: Database Tool

```typescript
registerTool({
  name: 'db_query',
  description: 'Execute database query',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      params: { type: 'array' },
    },
    required: ['query'],
  },
  execute: async ({ query, params = [] }) => {
    const client = new DBClient();
    return await client.query(query, params);
  },
});
```

## Best Practices

1. **Clear descriptions** - Help the agent route correctly
2. **Strong schemas** - Validate input
3. **Error handling** - Return meaningful errors
4. **Documentation** - Add to docs