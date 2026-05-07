---
sidebar_position: 1
---

# Memory Architecture

The TIMPS 3-layer memory system is the core differentiator. All three layers persist to disk and survive process restarts.

```
┌─────────────────────────────────────────────────────┐
│                  Agent Session                       │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Working   │  │   Episodic   │  │  Semantic  │  │
│  │   Memory    │  │   Memory     │  │   Memory   │  │
│  │             │  │              │  │            │  │
│  │ · Goal      │  │ · Sessions   │  │ · Facts    │  │
│  │ · Files     │  │ · Decisions  │  │ · Patterns │  │
│  │ · Patterns  │  │ · Outcomes   │  │ · Tech debt│  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                │          │
└─────────┼────────────────┼────────────────┼──────────┘
          │                │                │
          ▼                ▼                ▼
    working.json     episodes.jsonl    semantic.json
    (overwritten)    (append-only)     (upserted)
          │
          └──── ~/.timps/memory/<project-hash>/
```

## Layer 1: Working Memory

**File:** `working.json`  
**Reset:** Each session (overwritten)  
**Purpose:** Current session state — what the agent is doing right now

Contains:
- `goal` — the current task
- `activeFiles` — files being edited
- `discoveredPatterns` — patterns found in this session
- `pendingQuestions` — unresolved questions

## Layer 2: Episodic Memory

**File:** `episodes.jsonl`  
**Reset:** Never (append-only)  
**Purpose:** What happened in each past session

Each episode contains:
- `summary` — what was accomplished
- `decisions` — key decisions made
- `filesChanged` — files that were modified
- `timestamp` — when the session occurred

## Layer 3: Semantic Memory

**File:** `semantic.json`  
**Reset:** Never (upserted by key)  
**Purpose:** Distilled facts about the project

Entry types:
- `architecture` — how the system is designed
- `pattern` — recurring code patterns
- `preference` — user/team preferences
- `bug-pattern` — known failure modes
- `constraint` — hard requirements
- `tech-debt` — known technical debt

## Memory scoping

Each project gets its own memory directory, identified by a SHA-256 hash of the absolute project path:

```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(projectPath).digest('hex').slice(0, 12);
// → ~/.timps/memory/a3f9b2c1d4e5/
```

This means working on `/home/user/project-a` and `/home/user/project-b` gives completely separate memories.

## Using the memory API

```typescript
import { MemoryEngine } from '@timps/memory-core';

const engine = new MemoryEngine('/path/to/project');

// Store a fact
await engine.remember({
  type: 'architecture',
  content: 'Uses event sourcing for order state',
  importance: 0.9,
  tags: ['orders', 'events'],
});

// Recall relevant facts
const facts = await engine.recall('order processing', { limit: 5 });

// Start a new session episode
await engine.startEpisode('Implement payment retry logic');

// End session
await engine.endEpisode({ filesChanged: ['src/payments/retry.ts'] });
```
