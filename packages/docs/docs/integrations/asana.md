# Asana

Asana is a work management platform.

## Features

- Tasks
- Projects
- Timeline
- Forms
- Portfolios
- Goals

## Installation

```bash
npm install @timps/asana
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { asanaPlugin } from '@timps/asana';

const agent = createAgent({
  plugins: [
    asanaPlugin({
      accessToken: process.env.ASANA_ACCESS_TOKEN,
    }),
  ],
});
```

## Usage

### Create Task

```typescript
await agent.tools.createTask({
  name: 'New task',
  projects: ['project_123'],
});
```

### Create Project

```typescript
await agent.tools.createProject({
  name: 'New Project',
  workspace: 'workspace_123',
});
```

## API Reference

`timps asana task` - Manage tasks

`timps asana project` - Manage projects