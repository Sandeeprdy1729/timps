# OpenRouter

OpenRouter provides unified access to LLMs from multiple providers.

## Features

- 100+ LLM models
- Unified API
- Token usage tracking
- Cost management
- Routing optimization

## Installation

```bash
npm install @timps/openrouter
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { openRouterPlugin } from '@timps/openrouter';

const agent = createAgent({
  plugins: [
    openRouterPlugin({
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: 'anthropic/claude-3-opus',
    }),
  ],
});
```

## Usage

### Generate

```typescript
const result = await agent.tools.generate({
  prompt: 'Write a haiku about code',
  model: 'anthropic/claude-3-sonnet',
});
```

### Chat

```typescript
const result = await agent.tools.chat({
  messages: [
    { role: 'user', content: 'Hello!' },
  ],
  model: 'openai/gpt-4-turbo',
});
```

### Embed

```typescript
const embedding = await agent.tools.embed({
  text: 'Hello world',
  model: 'amazon/ embeddings',
});
```

## API Reference

`timps llm generate` - Generate text with LLM

`timps llm chat` - Chat with LLM

`timps llm embed` - Create embeddings

`timps llm models` - List available models