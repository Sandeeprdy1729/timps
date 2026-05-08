---
id: datadog
title: Datadog Integration
description: Complete guide to integrating TIMPS with Datadog for monitoring.
---

# Datadog Integration

TIMPS integrates with Datadog for metrics, logs, and monitoring.

## Configuration

```bash
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
```

## Usage

### Submitting Metrics

```typescript
import { DatadogIntegration } from '@timps/integrations';

const datadog = new DatadogIntegration({
  apiKey: process.env.DATADOG_API_KEY,
  appKey: process.env.DATADOG_APP_KEY,
});

await datadog.connect();

// Submit metric
await datadog.submitMetric({
  metric: 'custom.metric',
  points: [[Date.now() / 1000, 100]],
  type: 'gauge',
});

// Submit batch
await datadog.submitMetrics([
  { metric: 'app.requests', points: [[now, 50]] },
  { metric: 'app.latency', points: [[now, 200]] },
]);
```

### Querying Metrics

```typescript
const data = await datadog.queryMetrics({
  from: 'now-1h',
  query: 'custom.metric',
});
```

### Sending Logs

```typescript
await datadog.sendLog({
  message: 'Application event',
  service: 'timps',
  level: 'info',
});
```