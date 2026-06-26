# @timps/sdk

Lightweight, zero-config memory SDK for AI agents. Store and recall semantic memories with a single import.

```bash
npm install @timps/sdk
```

```typescript
import { createMemory } from '@timps/sdk'

const memory = createMemory({ projectPath: '.' })

await memory.store('This project uses tRPC for type-safe APIs')
const results = await memory.recall('API patterns')
console.log(results)
// [{ content: 'This project uses tRPC...', score: 0.92 }]
```

## Quickstart

```typescript
import { createMemory } from '@timps/sdk'

const memory = createMemory({ projectPath: './my-project' })

// Store facts
await memory.store('The auth system uses JWT with 1h expiry')
await memory.store('Prefer functional components over class components', {
  metadata: { type: 'preference', tags: ['react', 'components'] }
})

// Recall with context
const results = await memory.recall('how does authentication work', { limit: 5 })
console.log(results[0].content)
```

## Provider Configuration

### Ollama (free, local)

```typescript
const memory = createMemory({
  projectPath: '.',
  provider: 'ollama'  // uses localhost:11434, nomic-embed-text
})
```

### OpenAI (your API key)

```typescript
const memory = createMemory({
  projectPath: '.',
  provider: {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  }
})
```

### Keyword-only (no LLM dependency)

```typescript
const memory = createMemory({ projectPath: '.' })
// No provider → BM25 keyword search only, zero network dependencies
```

## API

| Method | Description |
|--------|-------------|
| `store(content, metadata?)` | Store a semantic memory |
| `recall(query, options?)` | Recall memories matching query |
| `delete(id)` | Remove a memory |
| `storeBatch(entries)` | Store multiple memories at once |
| `on(event, handler)` | Listen for 'stored' or 'error' events |
| `getStats()` | Get memory usage statistics |
| `dispose()` | Clean up resources |

<50KB published, tree-shaken to <30KB for basic usage.
