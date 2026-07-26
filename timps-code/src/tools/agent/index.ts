import * as childProcess from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { RegisteredTool } from '../_shared/index.js';
import { getCoordinatorService } from '../../services/coordinator/index.js';

function resolveTimpsBinary(cwd: string): string[] {
  const distBin = path.join(cwd, 'dist', 'bin', 'timps.js');
  if (fs.existsSync(distBin)) {
    return [distBin];
  }
  const srcBin = path.join(cwd, 'src', 'bin', 'timps.ts');
  if (fs.existsSync(srcBin)) {
    return ['tsx', srcBin];
  }
  return ['node', '-e', ''];
}

export const agentTool: RegisteredTool = {
  definition: {
    name: 'agent',
    description: 'Spawn a subagent worker with its own context to handle a task. Returns the worker ID immediately. Use task_output to check results.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task for the subagent' },
        model: { type: 'string', description: 'Model to use (optional)' },
        description: { type: 'string', description: 'Human-readable description of the worker task' },
      },
      required: ['prompt'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    const prompt = String(args.prompt);
    const description = args.description ? String(args.description) : prompt.slice(0, 120);
    const coordinator = getCoordinatorService();

    if (!coordinator.isEnabled()) {
      coordinator.enable();
    }

    const workerId = coordinator.createWorker(description);
    const taskId = coordinator.submitTask({
      description,
      prompt,
      subagentType: 'worker',
      priority: 'normal',
      workerId,
    });

    coordinator.updateWorkerStatus(workerId, 'running');
    coordinator.addWorkerMessage(workerId, 'user', prompt);

    const binArgs = resolveTimpsBinary(cwd);
    const bin = binArgs[0];
    const binFile = binArgs.slice(1);
    const fullArgs = [...binFile, prompt];

    try {
      const child = childProcess.spawn(bin, fullArgs, {
        cwd,
        timeout: 300_000,
        env: { ...process.env } as NodeJS.ProcessEnv,
      });

      const worker = coordinator.getWorker(workerId);
      if (worker) {
        worker.abortController = new AbortController();
        worker.abortController.signal.addEventListener('abort', () => {
          child.kill('SIGTERM');
        });
      }

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        const result = stdout.trim() || stderr.trim() || '(no output)';
        if (code === 0) {
          coordinator.updateWorkerStatus(workerId, 'completed', result);
          coordinator.addWorkerMessage(workerId, 'assistant', result);
          coordinator.completeTask(taskId, result);
        } else {
          const error = `Exit code ${code}: ${stderr.trim() || stdout.trim() || 'unknown error'}`;
          coordinator.updateWorkerStatus(workerId, 'failed', undefined, error);
          coordinator.addWorkerMessage(workerId, 'assistant', `[ERROR] ${error}`);
          coordinator.failTask(taskId, error);
        }
      });

      child.on('error', (err: Error) => {
        const error = `Spawn error: ${err.message}`;
        coordinator.updateWorkerStatus(workerId, 'failed', undefined, error);
        coordinator.addWorkerMessage(workerId, 'assistant', `[ERROR] ${error}`);
        coordinator.failTask(taskId, error);
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      coordinator.updateWorkerStatus(workerId, 'failed', undefined, error);
      coordinator.failTask(taskId, error);
      return { content: `Failed to spawn worker: ${error}`, isError: true };
    }

    return {
      content: `Worker ${workerId} spawned.\nTask: ${taskId}\nDescription: ${description}\n\nUse task_output with task_id="${workerId}" to check results when ready.`,
      isError: false,
    };
  },
};

export const AgentTool = (args: Record<string, unknown>) => agentTool.execute(args, '.');
