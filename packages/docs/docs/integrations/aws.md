# AWS (Amazon Web Services)

AWS integration for cloud services.

## Features

- S3 storage
- Lambda functions
- EC2 management
- CloudWatch logs

## Installation

```bash
npm install @timps/aws
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { awsPlugin } from '@timps/aws';

const agent = createAgent({
  plugins: [
    awsPlugin({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-east-1',
    }),
  ],
});
```

## Usage

### Upload to S3

```typescript
await agent.tools.uploadS3({
  bucket: 'my-bucket',
  key: 'file.txt',
  body: 'content',
});
```

### Invoke Lambda

```typescript
const result = await agent.tools.invokeLambda({
  functionName: 'my-function',
  payload: { key: 'value' },
});
```

## API Reference

`timps aws s3` - S3 operations

`timps aws lambda` - Lambda operations