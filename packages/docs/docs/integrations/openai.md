---
sidebar_position: 27
---

# OpenAI Integration

Connect OpenAI for AI-powered automation.

## Features

- **GPT Models**: Access GPT-4, GPT-3.5
- **Embeddings**: Semantic search capabilities
- **Fine-tuning**: Custom model training
- **Images**: DALL-E image generation
- **Audio**: Whisper transcription

## Authentication

### API Key

```env
OPENAI_API_KEY=sk-xxx
```

## Triggers

| Event | Action |
|-------|--------|
| `rate_limit.near` | Alert before limit |
| `model.response` | Log response time |

## Code Examples

```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Chat completion
const chat = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Embeddings
const embedding = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: 'Sample text',
});

// Image generation
const image = await openai.images.generate({
  prompt: 'A cute cat',
  n: 1,
  size: '1024x1024',
});
```

## Rate Limits

| Model | RPM | TPM |
|-------|-----|-----|
| GPT-4 | 500/min | 150K/min |
| GPT-3.5 | 3500/min | 90K/min |
| Embeddings | 3000/min | 150K/min |