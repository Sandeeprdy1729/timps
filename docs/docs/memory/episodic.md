---
sidebar_position: 3
---

# Episodic Memory

Episodic memory is an **append-only log** of every TIMPS session. It answers: "What did we work on last week?"

## Episode structure

```typescript
interface Episode {
  id: string;
  summary: string;
  startedAt: string;       // ISO datetime
  endedAt: string;         // ISO datetime
  filesChanged: string[];
  decisions: string[];
  outcome: 'success' | 'partial' | 'abandoned';
  tags: string[];
}
```

## Storage

Stored at `~/.timps/memory/<project-hash>/episodes.jsonl`. One JSON object per line, never deleted.

## API

```typescript
// Start a session
await engine.startEpisode('Add webhook retry mechanism');

// End with summary
await engine.endEpisode({
  filesChanged: ['src/webhooks/retry.ts', 'src/webhooks/types.ts'],
  decisions: ['Used exponential backoff with jitter'],
  outcome: 'success',
});

// Load recent episodes
const recent = await engine.loadEpisodes(10);
```
