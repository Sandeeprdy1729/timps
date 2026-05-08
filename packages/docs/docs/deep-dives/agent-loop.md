# TIMPS Under the Hood: The Agent Loop

This deep-dive explores how TIMPS processes requests and uses memory to deliver intelligent responses.

## Overview

The agent loop is the heart of TIMPS - it orchestrates thinking, action, and reflection for every user request.

## Flow Diagram

```
User Input → Parser → Planner → Memory (Working/Episodic/Semantic) → Executor → Tools → Review → Response
                  ↑                                                        ↓
                  └──────────────── Feedback ───────────────────────────────┘
```

## Key Components

### 1. Input Parser

Parses natural language into structured intent:
- Extracts entities (files, functions, commands)
- Determines desired outcome
- Identifies constraints

### 2. Memory Retrieval

Three-layer recall system:
- **Working**: Current context
- **Episodic**: Past sessions
- **Semantic**: Learned patterns

### 3. Planner

Generates execution plan:
- Tool selection
- Sequence determination
- Error anticipation

### 4. Executor

Runs planned actions:
- Shell commands
- File operations
- API calls

### 5. Self-Correction

On failure:
1. Analyzes error
2. Revises approach
3. Retries (up to 3x)

## Source Code

See `timps-code/src/core/agent.ts`

## Configuration

```typescript
const agent = createAgent({
  maxRetries: 3,
  timeout: 60000,
});
```

## Customization

You can customize each component by extending the base classes in `timps-code/src/core/`.