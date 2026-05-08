# TIMPS Under the Hood: Memory System

TIMPS uses a three-layer memory architecture that enables persistent context across sessions.

## Layers

### 1. Working Memory

**Purpose**: Current session state

**Storage**: In-memory

**Contents**:
- Active files
- Current goal
- Recent errors
- Conversation history

**Lifecycle**: Cleared on session end

### 2. Episodic Memory

**Purpose**: Session summaries

**Storage**: `~/.timps/memory/<hash>/episodes.jsonl`

**Contents**:
- What was done
- Outcome
- Key decisions

**Recall**: On session start

### 3. Semantic Memory

**Purpose**: Permanent facts

**Storage**: `~/.timps/memory/<hash>/semantic.json`

**Contents**:
- Code patterns
- Conventions
- User preferences

**Recall**: On context match

## Data Flow

```
User Input
  → Working Memory (current)
  → Episodic (session start)
  → Semantic (pattern match)
  → Combined Context → Agent
```

## Source Files

- `timps-code/src/memory/working.ts`
- `timps-code/src/memory/episodic.ts`
- `timps-code/src/memory/semantic.ts`

## Configuration

```typescript
const agent = createAgent({
  memory: {
    workingSize: 1000,
    episodicRecall: 5,
    semanticThreshold: 0.8,
  },
});
```

## Manual Memory Operations

```bash
timps memory read "project conventions"
timps memory write "use snake_case for files"
timps memory forget old-pattern
timps memory search "API"
```