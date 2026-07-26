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

export const sendMessageTool: RegisteredTool = {
  definition: {
    name: 'send_message',
    description: 'Send a follow-up message to an existing worker to continue its task or provide a correction.',
    inputSchema: {
      type: 'object',
      properties: {
        worker_id: { type: 'string', description: 'The worker ID to send a message to' },
        message: { type: 'string', description: 'The message to send to the worker' },
      },
      required: ['worker_id', 'message'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    const workerId = String(args.worker_id);
    const message = String(args.message);
    const coordinator = getCoordinatorService();

    const worker = coordinator.getWorker(workerId);
    if (!worker) {
      return { content: `Worker not found: ${workerId}`, isError: true };
    }

    if (worker.status === 'completed' || worker.status === 'failed' || worker.status === 'stopped') {
      return { content: `Worker ${workerId} is already ${worker.status}. Cannot send message.`, isError: true };
    }

    coordinator.addWorkerMessage(workerId, 'user', message);

    const history = coordinator.getWorkerHistory(workerId);
    const contextMessages = history
      ? history.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
      : message;

    const fullPrompt = `Previous context:\n${contextMessages}\n\nFollow-up instruction: ${message}`;

    const taskId = coordinator.submitTask({
      description: `Follow-up for ${workerId}: ${message.slice(0, 100)}`,
      prompt: fullPrompt,
      subagentType: 'worker',
      priority: 'normal',
      workerId,
    });

    coordinator.updateWorkerStatus(workerId, 'running');

    const binArgs = resolveTimpsBinary(cwd);
    const bin = binArgs[0];
    const binFile = binArgs.slice(1);
    const fullArgs = [...binFile, fullPrompt];

    try {
      const child = childProcess.spawn(bin, fullArgs, {
        cwd,
        timeout: 300_000,
        env: { ...process.env } as NodeJS.ProcessEnv,
      });

      const ctrl = coordinator.getWorker(workerId);
      if (ctrl) {
        ctrl.abortController = new AbortController();
        ctrl.abortController.signal.addEventListener('abort', () => {
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
      return { content: `Failed to send message to worker: ${error}`, isError: true };
    }

    return {
      content: `Message sent to worker ${workerId}.\nTask: ${taskId}\n\nUse task_output with task_id="${workerId}" to check results.`,
      isError: false,
    };
  },
};
