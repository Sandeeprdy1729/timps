---
sidebar_position: 2
---

# Working Memory

Working memory is the **current session state** — what the agent is doing right now. It's reset at the start of each new session.

## Contents

```typescript
interface WorkingMemory {
  goal: string;                   // What the agent is trying to accomplish
  activeFiles: string[];          // Files currently being worked on
  discoveredPatterns: string[];   // Patterns found in this session
  pendingQuestions: string[];     // Unresolved questions
  context: Record<string, unknown>; // Arbitrary session context
}
```

## Storage

Stored at `~/.timps/memory/<project-hash>/working.json`. Overwritten at session start.

## API

```typescript
await engine.setWorkingMemory({
  goal: 'Implement webhook retry',
  activeFiles: ['src/webhooks/retry.ts'],
});

const wm = await engine.getWorkingMemory();
console.log(wm.goal); // "Implement webhook retry"
```
