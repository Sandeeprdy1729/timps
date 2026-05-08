---
id: linear
title: Linear Integration
description: Complete guide to integrating TIMPS with Linear for issue tracking and project management.
---

# Linear Integration

TIMPS integrates with Linear for streamlined issue tracking and project management.

## Features

- Issue creation and updates
- Project and team management
- Cycle and milestone tracking
- Label management
- Comment integration

## Configuration

```bash
LINEAR_API_KEY=lin_api_xxxx
LINEAR_TEAM_ID=team_xxxx
```

## Usage

### Creating Issues

```typescript
import { LinearIntegration } from '@timps/integrations';

const linear = new LinearIntegration({
  apiKey: process.env.LINEAR_API_KEY,
  teamId: process.env.LINEAR_TEAM_ID,
});

await linear.connect();

const issue = await linear.createIssue({
  title: 'New feature request',
  description: 'Detailed description',
  priority: 1,
});
```

### Query Issues

```typescript
const issues = await linear.query(`
  issues(filter: { state: { neq: "triage" } }) {
    nodes { id title priority }
  }
`);
```

## Cycles

```typescript
const currentCycle = await linear.getCurrentCycle();
const issues = await linear.getCycleIssues(currentCycle.id);
```