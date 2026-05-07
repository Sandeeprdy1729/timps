---
sidebar_position: 4
---

# Semantic Memory

Semantic memory holds **distilled facts** about the project — patterns, architectural decisions, constraints, and preferences. It persists indefinitely and is retrieved by relevance.

## Entry structure

```typescript
interface MemoryEntry {
  id: string;
  type: 'architecture' | 'pattern' | 'preference' | 'bug-pattern' | 'constraint' | 'tech-debt';
  content: string;
  importance: number;       // 0.0 to 1.0
  accessCount: number;      // How often recalled
  lastAccessedAt: string;   // ISO datetime
  createdAt: string;
  tags: string[];
  source?: string;          // Episode ID that created this
}
```

## Storage

Stored at `~/.timps/memory/<project-hash>/semantic.json`. Entries are upserted by content hash — duplicates are merged.

## Recall

TIMPS uses MiniSearch for full-text recall across all semantic entries:

```typescript
const facts = await engine.recall('payment processing', {
  limit: 5,
  type: 'architecture', // optional type filter
});
```

Returned entries are ranked by a combination of text relevance and importance score.

## Contradiction detection

```typescript
const contradictions = await engine.detectContradictions();
// Returns pairs of entries with conflicting facts
```
