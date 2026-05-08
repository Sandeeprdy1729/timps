# ClickUp

ClickUp is an all-in-one productivity platform.

## Features

- Tasks
- Docs
- Goals
- Chat
- Whiteboards
- Time tracking

## Installation

```bash
npm install @timps/clickup
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { clickupPlugin } from '@timps/clickup';

const agent = createAgent({
  plugins: [
    clickupPlugin({
      apiKey: process.env.CLICKUP_API_KEY,
    }),
  ],
});
```

## Usage

### Create Task

```typescript
await agent.tools.createTask({
  name: 'New feature',
  listId: '123',
  description: 'Implement new feature',
});
```

### Update Task

```typescript
await agent.tools.updateTask({
  taskId: '123',
  status: 'in_progress',
});
```

### List Tasks

```typescript
const tasks = await agent.tools.listTasks({
  listId: '123',
  status: 'open',
});
```

## API Reference

`timps clickup task` - Manage tasks

`timps clickup list` - Manage lists