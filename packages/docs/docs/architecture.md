# TIMPS Agent Architecture

## Overview

TIMPS is designed as a multi-agent system with persistent memory and tool execution capabilities.

## Components

### 1. Agent Loop

The core loop manages task execution:

1. **Input** - User provides task description
2. **Plan** - Agent creates execution plan
3. **Execute** - Execute tools sequentially
4. **Verify** - Verify results
5. **Output** - Return results to user

### 2. Memory System

Three-layer architecture:

- **Working Memory**: In-session context
- **Episodic Memory**: Session history
- **Semantic Memory**: Persistent knowledge

### 3. Tool System

Tools are extensions that provide capabilities:

- File operations
- Git operations
- Shell execution
- API calls

### 4. Agent Types

- **Coder**: Code analysis and generation
- **Planner**: Task decomposition
- **Verifier**: Result validation

## Data Flow

```
User Input → Agent Loop → Tools → Memory → Output
                ↓                    ↓
            Planner ←── Verify ←─────────────────┘
```

## State Management

```typescript
interface AgentState {
  sessionId: string;
  step: number;
  plan: Plan | null;
  memory: Memory;
  tools: Tool[];
  history: History[];
}
```

## Error Handling

Errors propagate up the stack:

1. Tool error → Agent retry
2. Agent error → User notification
3. Fatal error → Session termination

## Configuration

```json
{
  "agent": {
    "maxSteps": 100,
    "timeout": 300000,
    "retryAttempts": 3
  },
  "memory": {
    "episodic": true,
    "semantic": true
  },
  "tools": {
    "shellTimeout": 60000,
    "gitTimeout": 30000
  }
}
```

## Best Practices

- Use incremental verification
- Store intermediate results
- Implement timeouts
- Log all operations