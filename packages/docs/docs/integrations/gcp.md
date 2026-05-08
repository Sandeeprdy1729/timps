# GCP (Google Cloud Platform)

GCP integration for Google Cloud services.

## Features

- Cloud Storage
- Cloud Functions
- Compute Engine
- Cloud Logging

## Installation

```bash
npm install @timps/gcp
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { gcpPlugin } from '@timps/gcp';

const agent = createAgent({
  plugins: [
    gcpPlugin({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: JSON.parse(process.env.GCP_CREDENTIALS),
    }),
  ],
});
```

## Usage

### Upload to GCS

```typescript
await agent.tools.uploadGCS({
  bucket: 'my-bucket',
  destination: 'file.txt',
  source: './file.txt',
});
```

### Deploy Cloud Function

```typescript
await agent.tools.deployFunction({
  name: 'my-function',
  source: './function.zip',
});
```

## API Reference

`timps gcp storage` - Cloud Storage

`timps gcp function` - Cloud Functions