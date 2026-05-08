# Todoist

Todoist is a task management application.

## Features

- Tasks
- Projects
- Labels
- Filters
- Comments
- Reminders

## Installation

```bash
npm install @timps/todoist
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { todoistPlugin } from '@timps/todoist';

const agent = createAgent({
  plugins: [
    todoistPlugin({
      apiKey: process.env.TODOIST_API_KEY,
    }),
  ],
});
```

## Usage

### Add Task

```typescript
await agent.tools.addTask({
  content: 'Buy groceries',
  projectId: '123',
  dueString: 'tomorrow',
});
```

### Complete Task

```typescript
await agent.tools.completeTask({
  taskId: '123',
});
```

## API Reference

`timps todoist task` - Manage tasks

`timps todoist project` - Manage projects