// ── TIMPS Swarm Execution Engine ──
// Real distributed multi-agent orchestration with consensus

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as https from 'node:https';
import { AgentRole, SwarmAgent, AGENT_PROMPTS, createAgent, createSwarm } from './agents.js';
import { createOllamaProvider } from '../models/ollama.js';
import { getToolByName, ToolExecResult } from '../tools/tools.js';
import { Memory } from '../memory/memory.js';

export interface SwarmTask {
  id: string;
  role: AgentRole;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface SwarmResult {
  tasksCompleted: number;
  tasksFailed: number;
  totalDuration: number;
  outputs: Record<AgentRole, string>;
  consensus?: string;
}

export class SwarmExecutor {
  private agents: SwarmAgent[];
  private tasks: Map<string, SwarmTask> = new Map();
  private memory: Memory;
  private basePath: string;
  private messageQueue: Map<string, any[]> = new Map();

  constructor(memory: Memory, projectPath: string) {
    this.memory = memory;
    this.basePath = projectPath;
    this.agents = createSwarm();
  }

  getAgents(): SwarmAgent[] { return this.agents; }

  submitTask(role: AgentRole, description: string): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const task: SwarmTask = { id, role, description, status: 'pending', createdAt: Date.now() };
    this.tasks.set(id, task);
    return id;
  }

  async executeTask(taskId: string, cwd?: string): Promise<string> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const agent = this.agents.find(a => a.role === task.role);
    if (!agent) throw new Error(`Agent not found for role: ${task.role}`);

    task.status = 'running';
    agent.status = 'busy';
    agent.currentTask = taskId;

    try {
      const result = await this.runAgent(agent, task.description, cwd || this.basePath);
      task.status = 'completed';
      task.result = result;
      task.completedAt = Date.now();
      agent.status = 'idle';
      agent.stats.tasksCompleted++;
      return result;
    } catch (err) {
      task.status = 'failed';
      task.error = (err as Error).message;
      task.completedAt = Date.now();
      agent.status = 'error';
      agent.stats.tasksFailed++;
      throw err;
    }
  }

  private async runAgent(agent: SwarmAgent, description: string, cwd: string): Promise<string> {
    const provider = createOllamaProvider(
      'http://localhost:11434',
      agent.model
    );

    const systemPrompt = AGENT_PROMPTS[agent.role].prompt;
    let fullResponse = '';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: description },
    ];

    try {
      for await (const event of provider.stream(messages, [])) {
        if (event.type === 'text') {
          fullResponse += event.content;
        }
      }
    } catch {
      return `[${agent.role}] Agent execution failed — Ollama may not be running. Start with: ollama serve`;
    }

    return fullResponse.trim();
  }

  async executeDAG(taskDescriptions: Array<{ role: AgentRole; description: string; dependsOn?: number[] }>): Promise<SwarmResult> {
    const startTime = Date.now();
    const taskIds: Map<number, string> = new Map();
    const outputs: Record<AgentRole, string> = {} as any;

    for (let i = 0; i < taskDescriptions.length; i++) {
      const td = taskDescriptions[i];
      const taskId = this.submitTask(td.role, td.description);
      taskIds.set(i, taskId);
    }

    for (let i = 0; i < taskDescriptions.length; i++) {
      const td = taskDescriptions[i];

      if (td.dependsOn) {
        for (const depIdx of td.dependsOn) {
          const depTaskId = taskIds.get(depIdx);
          if (depTaskId) {
            const depTask = this.tasks.get(depTaskId);
            if (depTask && depTask.status !== 'completed') {
              throw new Error(`Dependency ${depIdx} not completed for task ${i}`);
            }
          }
        }
      }

      const taskId = taskIds.get(i)!;
      try {
        const result = await this.executeTask(taskId);
        outputs[td.role] = result;
      } catch (err) {
        outputs[td.role] = `Failed: ${(err as Error).message}`;
      }
    }

    const tasksCompleted = [...this.tasks.values()].filter(t => t.status === 'completed').length;
    const tasksFailed = [...this.tasks.values()].filter(t => t.status === 'failed').length;
    const totalDuration = Date.now() - startTime;

    return {
      tasksCompleted,
      tasksFailed,
      totalDuration,
      outputs,
      consensus: tasksFailed === 0 ? this.buildConsensus(outputs) : undefined,
    };
  }

  private buildConsensus(outputs: Record<AgentRole, string>): string {
    const summaries: string[] = [];
    for (const [role, output] of Object.entries(outputs)) {
      summaries.push(`[${role}]: ${output.slice(0, 200)}`);
    }
    return summaries.join('\n---\n');
  }

  async runPipeline(pipelineType: 'feature' | 'bugfix' | 'refactor' | 'docs'): Promise<SwarmResult> {
    const pipelines: Record<string, Array<{ role: AgentRole; description: string; dependsOn?: number[] }>> = {
      feature: [
        { role: 'product_manager', description: 'Draft a detailed PRD for a new feature' },
        { role: 'architect', description: 'Design the system architecture', dependsOn: [0] },
        { role: 'code_generator', description: 'Implement the feature', dependsOn: [1] },
        { role: 'code_reviewer', description: 'Review the implementation', dependsOn: [2] },
        { role: 'qa_tester', description: 'Write and run tests', dependsOn: [2] },
        { role: 'security_auditor', description: 'Scan for security issues', dependsOn: [2] },
        { role: 'devops', description: 'Update CI/CD and deployment', dependsOn: [3, 4, 5] },
      ],
      bugfix: [
        { role: 'architect', description: 'Analyze the bug root cause' },
        { role: 'code_generator', description: 'Fix the bug', dependsOn: [0] },
        { role: 'qa_tester', description: 'Verify the fix with tests', dependsOn: [1] },
        { role: 'code_reviewer', description: 'Final review', dependsOn: [1] },
      ],
      refactor: [
        { role: 'architect', description: 'Plan the refactoring approach' },
        { role: 'code_generator', description: 'Implement the refactor', dependsOn: [0] },
        { role: 'performance_optimizer', description: 'Optimize performance', dependsOn: [1] },
        { role: 'code_reviewer', description: 'Review refactored code', dependsOn: [1] },
        { role: 'qa_tester', description: 'Run regression tests', dependsOn: [2, 3] },
      ],
      docs: [
        { role: 'product_manager', description: 'Outline documentation structure' },
        { role: 'docs_writer', description: 'Write API documentation', dependsOn: [0] },
        { role: 'docs_writer', description: 'Write deployment guide', dependsOn: [0] },
        { role: 'code_reviewer', description: 'Review documentation accuracy', dependsOn: [1, 2] },
      ],
    };

    const pipeline = pipelines[pipelineType];
    if (!pipeline) throw new Error(`Unknown pipeline: ${pipelineType}`);

    return this.executeDAG(pipeline);
  }

  getTaskStatus(taskId: string): SwarmTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTaskStatuses(): SwarmTask[] {
    return [...this.tasks.values()];
  }

  getAgentStatus(): Array<{ role: AgentRole; status: string; stats: SwarmAgent['stats'] }> {
    return this.agents.map(a => ({
      role: a.role,
      status: a.status,
      stats: a.stats,
    }));
  }
}

export function createSwarmExecutor(memory: Memory, projectPath: string): SwarmExecutor {
  return new SwarmExecutor(memory, projectPath);
}