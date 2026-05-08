# Cloudflare

Cloudflare provides CDN, security, and serverless edge computing.

## Features

- Global CDN
- DDoS protection
- Workers (serverless)
- R2 (storage)
- D1 (database)
- Access (Zero Trust)

## Installation

```bash
npm install @timps/cloudflare
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { cloudflarePlugin } from '@timps/cloudflare';

const agent = createAgent({
  plugins: [
    cloudflarePlugin({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
    }),
  ],
});
```

## Usage

### Deploy Worker

```typescript
await agent.tools.deployWorker({
  name: 'my-worker',
  script: 'export default { fetch(req) { return new Response("Hello") } }',
});
```

### Upload Asset

```typescript
await agent.tools.uploadAsset({
  bucket: 'my-bucket',
  file: './dist/index.js',
});
```

### Deploy to R2

```typescript
await agent.tools.deployR2({
  bucket: 'my-bucket',
  key: 'file.txt',
  body: 'content',
});
```

## API Reference

`timps cf deploy` - Deploy worker or site

`timps cf r2` - Manage R2 storage

`timps cf kv` - Manage KV storage

`timps cf d1` - Manage D1 database