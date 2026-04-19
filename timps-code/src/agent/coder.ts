// agent/coder.ts - Coding Specialist Agent
// Specialized for code tasks with benchmark optimizations and TIMPs memory integration

import { BaseAgent, AgentConfig } from './base.js';
import type { AgentEvent, ToolDefinition } from '../config/types.js';
import { Memory } from '../memory/memory.js';
import { SnapshotManager } from '../memory/snapshot.js';

const CODER_SYSTEM_PROMPT = `TIMPS Coder. Benchmark-optimized.

## Principles
1. Read before write
2. Follow instructions exactly — no extra features
3. Minimal changes to pass tests
4. Verify with tests, not assumptions

## Verification Loop
1. Make change → 2. Run tests → 3. Run linting → 4. Fix → 5. Re-verify

## Error Recovery
Tests fail → Read output → Understand expected vs actual → Fix root cause → Re-run
`;

export class CoderAgent extends BaseAgent {
  private memory: Memory | null = null;
  private snapshots: SnapshotManager | null = null;
  private currentGoal: string = '';
  private taskHistory: Array<{ task: string; result: string; timestamp: number }> = [];

  constructor(config: AgentConfig & { memory?: Memory; snapshots?: SnapshotManager }) {
    super(config);
    this.memory = config.memory || null;
    this.snapshots = config.snapshots || null;
    
    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: CODER_SYSTEM_PROMPT });
    }
  }

  protected buildSystemPrompt(): string {
    return CODER_SYSTEM_PROMPT;
  }

  async *run(task: string): AsyncGenerator<AgentEvent> {
    this.currentGoal = task;
    this.taskHistory.push({ task, result: 'started', timestamp: Date.now() });

    if (this.memory) {
      const memCtx = this.memory.getContextString(task);
      if (memCtx) {
        this.addSystemMessage(`\n## Memory Context\n${memCtx}\n`);
      }
    }

    yield { type: 'status', message: `Starting task: ${task.slice(0, 100)}...` };

    const events: AgentEvent[] = [];
    for await (const event of super.run(task)) {
      events.push(event);
      yield event;
    }

    if (events.length > 0 && this.memory) {
      const lastEvent = events[events.length - 1];
      const result = lastEvent.type === 'done' ? 'success' : 'partial';
      this.memory.storeEpisode({
        timestamp: Date.now(),
        summary: task.slice(0, 100),
        filesChanged: [],
        toolsUsed: [],
        outcome: result as 'success' | 'partial' | 'failed',
      });
    }

    if (this.taskHistory.length > 0) {
      this.taskHistory[this.taskHistory.length - 1].result = 
        events.some(e => e.type === 'error') ? 'failed' : 'success';
    }
  }

  protected async *executeTurn(tools: ToolDefinition[]): AsyncGenerator<AgentEvent, { done: boolean; error?: string }> {
    const result = this.executeTurnWithTools(tools);
    return yield* result;
  }

  protected async *attemptSelfCorrection(failedCall: any, errorMsg: string): AsyncGenerator<AgentEvent> {
    const recoverable = [
      'oldString not found', 'No such file', 'ENOENT',
      'Exit 1', 'Exit 2', 'Exit code 1', 'AssertionError',
      'Test failed', 'pytest: error', 'npm ERR!',
    ];

    if (!recoverable.some(r => errorMsg.includes(r))) return;

    for (let attempt = 1; attempt <= this.maxCorrections; attempt++) {
      yield { type: 'selfcorrect', attempt, error: errorMsg };

      this.messages.push({
        role: 'user',
        content: `ANALYSIS REQUIRED for: ${errorMsg.slice(0, 500)}

${attempt}/${this.maxCorrections} attempt. Think through:
1. Read the actual error output carefully
2. What is the test/spec expecting?
3. What is the actual behavior?
4. Root cause?
5. Specific fix?`,
      });

      return;
    }
  }

  async *runTests(testCommand?: string): AsyncGenerator<AgentEvent> {
    const defaultCommands: Record<string, string> = {
      python: 'pytest -v',
      javascript: 'npm test 2>&1 || jest 2>&1',
      typescript: 'npm test 2>&1 || npx jest',
      rust: 'cargo test',
      go: 'go test ./...',
    };

    const ext = this.detectProjectLanguage();
    const cmd = testCommand || defaultCommands[ext] || 'echo "No test command configured"';

    yield { type: 'status', message: `Running: ${cmd}` };

    const { execSync } = await import('child_process');
    try {
      const result = execSync(cmd, { cwd: this.cwd, encoding: 'utf-8', timeout: 120000 });
      yield { type: 'text', content: result || 'Tests passed' };
    } catch (e: any) {
      yield { type: 'error', message: e.stdout?.toString() || e.message };
    }
  }

  async *runLinting(): AsyncGenerator<AgentEvent> {
    const linters: Record<string, string[]> = {
      typescript: ['npx tsc --noEmit 2>&1', 'npx eslint . 2>&1 || echo "No ESLint"'],
      javascript: ['npx eslint . 2>&1 || echo "No ESLint"'],
      python: ['ruff check . 2>&1 || echo "No Ruff"', 'mypy . 2>&1 || echo "No MyPy"'],
      rust: ['cargo clippy 2>&1 || echo "No Clippy"'],
    };

    const ext = this.detectProjectLanguage();
    const cmds = linters[ext] || ['echo "No linters configured"'];

    for (const cmd of cmds) {
      yield { type: 'status', message: `Running: ${cmd.split(' ')[0]}` };
      
      const { execSync } = await import('child_process');
      try {
        const result = execSync(cmd, { cwd: this.cwd, encoding: 'utf-8', timeout: 60000 });
        if (result.trim()) yield { type: 'text', content: result };
      } catch (e: any) {
        if (e.stdout) yield { type: 'text', content: e.stdout.toString() };
        if (e.stderr && !e.stdout) yield { type: 'error', message: e.stderr.toString() };
      }
    }
  }

  private detectProjectLanguage(): string {
    const files = ['package.json', 'Cargo.toml', 'requirements.txt', 'go.mod', 'pom.xml'];
    for (const f of files) {
      try {
        const { existsSync } = require('fs');
        if (existsSync(f)) {
          if (f.includes('package')) return 'javascript';
          if (f.includes('Cargo')) return 'rust';
          if (f.includes('requirements') || f.includes('pyproject')) return 'python';
          if (f.includes('go.')) return 'go';
        }
      } catch {}
    }
    return 'unknown';
  }

  getTaskHistory() {
    return [...this.taskHistory];
  }

  setMemory(memory: Memory): void {
    this.memory = memory;
  }

  setSnapshots(snapshots: SnapshotManager): void {
    this.snapshots = snapshots;
  }
}
