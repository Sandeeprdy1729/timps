// agent/coder.ts - Coding Specialist Agent
// Specialized for code tasks with benchmark optimizations and TIMPs memory integration

import { BaseAgent, AgentConfig } from './base.js';
import type { AgentEvent, ToolDefinition } from '../types.js';
import { Memory } from '../memory.js';
import { SnapshotManager } from '../snapshot.js';

const CODER_SYSTEM_PROMPT = `You are TIMPS Code Coder — an elite coding specialist with deep knowledge of:
- All major languages: Python, JavaScript, TypeScript, Rust, Go, Java, C++, etc.
- Frameworks: React, Vue, Angular, Next.js, Django, FastAPI, Express, etc.
- Best practices: SOLID, DRY, KISS, patterns, clean code
- Testing: unit, integration, e2e, TDD, BDD
- DevOps: Docker, Kubernetes, CI/CD, cloud platforms

## Coding Principles
1. Read before write: Always understand existing code first
2. Type safety: Prefer TypeScript/Flow, use type hints
3. Error handling: Never swallow exceptions silently
4. Testing: Write tests that fail first, then make them pass
5. Documentation: Docstrings, comments for non-obvious code
6. Performance: Profile before optimizing, prefer clarity

## Benchmark Optimizations (SWE-Bench, HumanEval, etc.)
- Follow instructions exactly - don't add extra features
- Minimal code changes to pass tests
- Understand the test requirements before implementing
- Verify with provided tests, not assumptions

## File Operations Priority
1. read_file: Always read existing code before modifying
2. edit_file: Preferred for modifications (surgical)
3. write_file: Only for new files or complete rewrites
4. multi_edit: Efficient for multiple changes at once

## Verification Loop
1. Make change
2. Run tests: bash with pytest/npm test/etc
3. Run linting: tsc/eslint/ruff
4. Fix any issues found
5. Re-verify

## Error Recovery
When tests fail:
1. Read test output carefully
2. Understand what's expected vs actual
3. Fix root cause, not symptoms
4. Re-run tests

## Memory Integration
- Store discovered patterns and conventions
- Remember project-specific decisions
- Track error fixes for future reference
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
