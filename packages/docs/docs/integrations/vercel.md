---
id: vercel
title: Vercel Integration
description: Complete guide to integrating TIMPS with Vercel for deployment.
---

# Vercel Integration

TIMPS integrates with Vercel for deployment and serverless functions.

## Configuration

```bash
VERCEL_TOKEN=your-token
VERCEL_PROJECT=your-project
```

## Usage

### Deployments

```typescript
import { VercelIntegration } from '@timps/integrations';

const vercel = new VercelIntegration({
  token: process.env.VERCEL_TOKEN,
  project: process.env.VERCEL_PROJECT,
});

await vercel.connect();

// List deployments
const deployments = await vercel.listDeployments();

// Create deployment
const deployment = await vercel.createDeployment({
  name: 'my-project',
  files: [],
});
```

### Projects

```typescript
const projects = await vercel.listProjects();

const project = await vercel.createProject({
  name: 'New Project',
});
```