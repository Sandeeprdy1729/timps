# Raycast

Raycast is a command launcher for macOS with extensibility.

## Features

- Command launching
- AI integration
- Clipboard history
- Window management
- Custom extensions
- Snippet management

## Installation

```bash
npm install @timps/raycast
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { raycastPlugin } from '@timps/raycast';

const agent = createAgent({
  plugins: [
    raycastPlugin({
      apiKey: process.env.RAYCAST_API_KEY,
    }),
  ],
});
```

## Usage

### Launch Command

```typescript
await agent.tools.raycastCommand({
  command: 'Spotify',
  action: 'Play',
});
```

### Search

```typescript
const results = await agent.tools.raycastSearch({
  query: 'search term',
  limit: 10,
});
```

### Clipboard

```typescript
const clipboard = await agent.tools.raycastClipboard();
await agent.tools.raycastCopy({ text: 'new content' });
```

## API Reference

`timps raycast launch` - Launch Raycast command

`timps raycast search` - Search commands

`timps raycast clipboard` - Manage clipboard