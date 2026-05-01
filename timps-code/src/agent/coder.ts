import { BaseAgent, AgentConfig } from './base.js';
import type { AgentEvent, ToolDefinition } from '../config/types.js';
import { Memory } from '../memory/memory.js';

const CODER_SYSTEM = `You are TIMPS Code, a benchmark-optimized AI coding agent.

## Principles
1. Read before write — always verify file content before editing
2. Follow instructions exactly — no unrequested features
3. Minimal diff — smallest change that solves the problem
4. Verify loop: change → test → lint → fix → repeat

## Self-Correction on Test Failure
Read test output → understand expected vs actual → find root cause → fix → re-run tests

## Memory
- Use memory_store to save important project conventions and patterns
- Use memory_search to retrieve relevant context from past sessions
- Use todo_write/todo_read to manage multi-step tasks

## Performance
- Batch reads before writes
- Use search_code to locate code before editing
- Use run_diagnostics after refactors
`;

export class CoderAgent extends BaseAgent {
  private memory: Memory | null = null;

  constructor(config: AgentConfig & { memory?: Memory }) {
    super(config);
    this.memory = config.memory || null;
    // Replace system message with coder-specific one
    this.messages[0] = { role: 'system', content: this.buildSystemPrompt() };
  }

  protected buildSystemPrompt(): string {
    return CODER_SYSTEM;
  }

  async *run(task: string): AsyncGenerator<AgentEvent> {
    // Inject memory context if available
    if (this.memory) {
      const ctx = this.memory.getContextString(task);
      if (ctx) {
        this.messages[0] = {
          role: 'system',
          content: CODER_SYSTEM + `\n\n## Memory Context\n${ctx}`,
        };
      }
      this.memory.setGoal(task);
    }

    const events: AgentEvent[] = [];
    for await (const event of super.run(task)) {
      events.push(event);
      yield event;
    }

    // Save episode to memory
    if (this.memory) {
      const filesChanged = new Set<string>();
      const toolsUsed = new Set<string>();
      for (const m of this.messages) {
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            toolsUsed.add(tc.name);
            if (tc.arguments.path) filesChanged.add(String(tc.arguments.path));
          }
        }
      }
      const outcome = events.some(e => e.type === 'error') ? 'partial' : 'success';
      this.memory.storeEpisode({
        timestamp: Date.now(),
        summary: task.slice(0, 120),
        filesChanged: [...filesChanged],
        toolsUsed: [...toolsUsed],
        outcome,
      });
    }
  }
}
