---
id: sentry
title: Sentry Integration
description: Complete guide to integrating TIMPS with Sentry for error tracking.
---

# Sentry Integration

TIMPS integrates with Sentry for error tracking and performance monitoring.

## Configuration

```bash
SENTRY_DSN=https://key@sentry.io/project
SENTRY_ORG=your-org
SENTRY_TOKEN=your-token
```

## Usage

### Capturing Errors

```typescript
import { SentryIntegration } from '@timps/integrations';

const sentry = new SentryIntegration({
  dsn: process.env.SENTRY_DSN,
  org: process.env.SENTRY_ORG,
  token: process.env.SENTRY_TOKEN,
});

await sentry.connect();

// Capture exception
try {
  // code
} catch (error) {
  await sentry.captureException(error);
}

// Capture message
await sentry.captureMessage('Something happened', 'info');
```

### Release Tracking

```typescript
await sentry.createRelease({
  version: '1.0.0',
  projects: ['timps'],
});

// Deploy
await sentry.createDeploy({
  release: '1.0.0',
  environment: 'production',
});
```