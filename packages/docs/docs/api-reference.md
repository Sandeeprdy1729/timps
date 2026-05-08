# TIMPS API Reference

## Core API

### `Timps` Class

```typescript
import { Timps } from '@timps/core';

const timps = new Timps(options?: TimpsOptions);
```

#### Options

```typescript
interface TimpsOptions {
  model?: string;
  apiKey?: string;
  config?: string;
  memory?: boolean;
  verbose?: boolean;
}
```

### Methods

#### `run(task, options?)`

Execute a coding task.

```typescript
const result = await timps.run('Add user authentication', {
  dryRun?: boolean;
  timeout?: number;
  context?: Record<string, any>;
});
```

#### `chat(message, options?)`

Start an interactive chat.

```typescript
const response = await timps.chat('How do I implement auth?', {
  history?: boolean;
  context?: string;
});
```

#### `memory`

Access memory operations.

```typescript
// Get from memory
const value = await timps.memory.get(key);

// Set in memory
await timps.memory.set(key, value);

// Clear memory
await timps.memory.clear();

// Save snapshot
await timps.memory.save(name);

// Load snapshot
await timps.memory.load(name);
```

#### `tools`

Register and manage tools.

```typescript
// Add tool
timps.tools.register(tool);

// List tools
const tools = timps.tools.list();

// Get tool
const tool = timps.tools.get(name);

// Remove tool
timps.tools.remove(name);
```

#### `connect(integration, config?)`

Connect an integration.

```typescript
await timps.connect('github', { token: 'xxx' });
await timps.connect('slack', { token: 'xxx' });
```

## Integration API

### GitHub Integration

```typescript
const github = new GitHubIntegration(options);
await github.connect();

// Issues
const issues = await github.issues.list({ state: 'open' });
const issue = await github.issues.get('issue-number');
await github.issues.create({ title: 'New Issue', body: '...' });
await github.issues.update('issue-number', { state: 'closed' });

// Pull Requests
const prs = await github.pulls.list();
await github.pulls.create({ title: 'PR', body: '...', head: 'branch', base: 'main' });
await github.pulls.merge('pr-number');

// Repos
const repos = await github.repos.list();
const repo = await github.repos.get('owner/repo');
await github.repos.create({ name: 'new-repo', private: true });
```

### Slack Integration

```typescript
const slack = new SlackIntegration({ token: 'xxx' });
await slack.connect();

// Messages
await slack.messages.post({ channel: 'C123', text: 'Hello' });
const messages = await slack.messages.list({ channel: 'C123' });

// Channels
const channels = await slack.channels.list();

// Users
const users = await slack.users.list();
```

### Stripe Integration

```typescript
const stripe = new StripeIntegration({ apiKey: 'sk_xxx' });
await stripe.connect();

// Customers
const customers = await stripe.customers.list();
const customer = await stripe.customers.get('cus_xxx');
await stripe.customers.create({ email: 'test@example.com' });

// Charges
const charges = await stripe.charges.list();
await stripe.charges.create({ amount: 1000, currency: 'usd', customer: 'cus_xxx' });

// Subscriptions
const subs = await stripe.subscriptions.list();
await stripe.subscriptions.create({ customer: 'cus_xxx', items: [{ price: 'price_xxx' }] });
```

## Tool API

### Custom Tools

```typescript
const myTool: Tool = {
  name: 'my-tool',
  description: 'Does something useful',
  schema: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    },
    required: ['input']
  },
  execute: async (params) => {
    // Tool implementation
    return { result: params.input };
  }
};

timps.tools.register(myTool);
```

## Memory API

### Working Memory

```typescript
// Set value
timps.memory.working.set('key', value);

// Get value
const value = timps.memory.working.get('key');

// Check exists
const exists = timps.memory.working.has('key');

// Delete
timps.memory.working.delete('key');

// Clear
timps.memory.working.clear();
```

### Episodic Memory

```typescript
// Add episode
await timps.memory.episodic.add({
  type: 'task',
  content: 'Created login component',
  timestamp: Date.now(),
  context: {}
});

// Query episodes
const episodes = await timps.memory.episodic.query({
  type: 'task',
  since: Date.now() - 86400000
});

// Get recent
const recent = await timps.memory.episodic.recent(10);
```

### Semantic Memory

```typescript
// Store fact
await timps.memory.semantic.set('project', {
  name: 'MyApp',
  framework: 'React',
  language: 'TypeScript'
});

// Query
const project = await timps.memory.semantic.get('project');

// Search
const results = await timps.memory.semantic.search('framework:React');

// Update
await timps.memory.semantic.update('project', { framework: 'Next.js' });
```

## Events API

```typescript
// Subscribe to events
timps.on('task:start', (task) => { console.log('Task started:', task.name); });
timps.on('task:complete', (result) => { console.log('Task complete:', result); });
timps.on('error', (error) => { console.error('Error:', error); });

// Unsubscribe
timps.off('task:start');

// Emit events
timps.emit('custom:event', data);
```

## Error Handling

```typescript
try {
  await timps.run('task');
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Handle timeout
  } else if (error.code === 'AUTH_ERROR') {
    // Handle auth error
  } else if (error.code === 'TOOL_ERROR') {
    // Handle tool error
  } else {
    // Handle unknown
  }
}
```

## Types

```typescript
interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
  history: string[];
}

interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  tasks: Task[];
  memory: MemorySnapshot;
}

interface Integration {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: number;
}