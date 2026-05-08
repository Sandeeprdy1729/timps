# Azure

Microsoft Azure cloud integration.

## Features

- Blob Storage
- Azure Functions
- VM management
- App Service

## Installation

```bash
npm install @timps/azure
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { azurePlugin } from '@timps/azure';

const agent = createAgent({
  plugins: [
    azurePlugin({
      connectionString: process.env.AZURE_CONNECTION_STRING,
    }),
  ],
});
```

## Usage

### Upload Blob

```typescript
await agent.tools.uploadBlob({
  container: 'my-container',
  blob: 'file.txt',
  data: 'content',
});
```

### Deploy Function

```typescript
await agent.tools.deployFunction({
  name: 'my-function',
  code: './function.zip',
});
```

## API Reference

`timps azure blob` - Blob storage

`timps azure function` - Azure Functions