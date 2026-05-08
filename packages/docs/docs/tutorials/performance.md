# Tutorial: Performance Optimization

This guide covers how to optimize TIMPS performance.

## Quick Wins

### 1. Use Local Provider

```bash
# Default to Ollama (free, fast)
timps --provider ollama "task"
```

### 2. Enable Caching

```typescript
const agent = createAgent({
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
  },
});
```

### 3. Limit Context

```typescript
const agent = createAgent({
  maxTokens: 4096, // Reduce from default
});
```

## Memory Optimization

### Working Memory

```typescript
const agent = createAgent({
  memory: {
    workingSize: 100, // Reduce for speed
  },
});
```

### Semantic Search

```typescript
const agent = createAgent({
  memory: {
    semanticThreshold: 0.9, // Higher = faster
  },
});
```

## Tool Optimization

### Disable Unused Tools

```typescript
const agent = createAgent({
  tools: ['file', 'git', 'shell'], // Only what you need
});
```

### Parallel Execution

TIMPS automatically runs independent tools in parallel. Ensure your custom tools don't have unnecessary dependencies.

## Provider Comparison

| Provider | Speed | Notes |
|----------|-------|-------|
| Ollama | Fastest | Local |
| OpenAI | Fast | Good |
| Claude | Fast | Premium |
| Gemini | Fast | Good value |

## Benchmarking

```bash
timps benchmark --tasks 10 --iterations 3
```

Shows:
- Average response time
- Token count
- Memory usage
- Success rate

## Pro Tips

1. **Use specific prompts** - Less context to process
2. **Reuse sessions** - Don't reset memory
3. **Batch operations** - Multiple changes in one prompt