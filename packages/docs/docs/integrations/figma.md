# Figma

Figma is a collaborative interface design tool.

## Features

- Design editing
- Prototyping
- Design systems
- Teams
- Version history
- Plugins

## Installation

```bash
npm install @timps/figma
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { figmaPlugin } from '@timps/figma';

const agent = createAgent({
  plugins: [
    figmaPlugin({
      accessToken: process.env.FIGMA_ACCESS_TOKEN,
    }),
  ],
});
```

## Usage

### Get File

```typescript
const file = await agent.tools.getFigmaFile({
  fileKey: 'abc123',
});
```

### Get Components

```typescript
const components = await agent.tools.getFigmaComponents({
  fileKey: 'abc123',
});
```

### Export Image

```typescript
await agent.tools.exportFigmaImage({
  fileKey: 'abc123',
  nodeId: '1:2',
  format: 'png',
});
```

## API Reference

`timps figma file` - Get Figma file

`timps figma components` - List components

`timps figma export` - Export design