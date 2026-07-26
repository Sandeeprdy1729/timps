// ── TIMPS Swarm Execution Engine ──
// Real distributed multi-agent orchestration with consensus

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentRole, SwarmAgent, AGENT_PROMPTS, createSwarm } from './agents.js';
import { createProvider } from '../models/index.js';
import { getTool, getToolDefinitions } from '../tools/tools.js';
import { Memory } from '../memory/memory.js';
import type { Message, ToolCall, ToolDefinition } from '../config/types.js';

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

// Resolve agent role names to actual tool definitions the agent may call
function resolveAgentTools(agent: SwarmAgent): ToolDefinition[] {
  const agentToolNames = new Set(AGENT_PROMPTS[agent.role].tools.map(t => t.toLowerCase()));
  const allDefs = getToolDefinitions();
  return allDefs.filter(d => agentToolNames.has(d.name.toLowerCase()));
}

export class SwarmExecutor {
  private agents: SwarmAgent[];
  private tasks: Map<string, SwarmTask> = new Map();
  private memory: Memory;
  private basePath: string;

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

  // Agentic loop: stream → accumulate tool calls → execute → feed results → repeat
  private async runAgent(agent: SwarmAgent, description: string, cwd: string): Promise<string> {
    const toolDefs = resolveAgentTools(agent);
    const maxTurns = 5;

    let provider;
    try {
      provider = createProvider(agent.provider, agent.model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `[${agent.role}] SKIPPED (provider unavailable: ${msg}). Set the API key or run 'ollama serve'.`;
    }

    const messages: Message[] = [
      { role: 'system', content: AGENT_PROMPTS[agent.role].prompt },
      { role: 'user', content: description },
    ];

    let fullResponse = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      const toolCalls: ToolCall[] = [];
      const currentToolArgs = new Map<string, string>();
      const currentToolNames = new Map<string, string>();

      try {
        for await (const event of provider.stream(messages, toolDefs, { maxTokens: 2048, temperature: 0.2 })) {
          if (event.type === 'text') {
            fullResponse += event.content;
          } else if (event.type === 'tool_start') {
            currentToolArgs.set(event.id, '');
            currentToolNames.set(event.id, event.name);
          } else if (event.type === 'tool_delta') {
            currentToolArgs.set(event.id, (currentToolArgs.get(event.id) || '') + event.argumentsChunk);
          } else if (event.type === 'tool_end') {
            const argsStr = currentToolArgs.get(event.id) || '{}';
            let args: Record<string, unknown>;
            try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
            const toolName = currentToolNames.get(event.id) || 'unknown';
            toolCalls.push({ id: event.id, name: toolName, arguments: args });
          } else if (event.type === 'error') {
            return `[${agent.role}] ERROR: ${event.message}`;
          }
        }
      } catch (err) {
        if (fullResponse) return `[${agent.role}]: ${fullResponse.trim()}`;
        return `[${agent.role}] Agent execution failed: ${(err as Error).message}`;
      }

      // No tool calls → agent is done
      if (toolCalls.length === 0) break;

      // Feed assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: fullResponse || '(tool calls only)',
        toolCalls,
      });
      fullResponse = '';

      // Execute each tool call
      for (const tc of toolCalls) {
        const tool = getTool(tc.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            content: `Unknown tool: ${tc.name}. Available: ${toolDefs.map(d => d.name).join(', ')}`,
            toolCallId: tc.id,
            name: tc.name,
          });
          continue;
        }

        let result: string;
        try {
          const execResult = await tool.execute(tc.arguments, cwd);
          result = execResult.content;
        } catch (err) {
          result = `Tool error: ${(err as Error).message}`;
        }

        messages.push({
          role: 'tool',
          content: result.slice(0, 4000), // cap per-call output
          toolCallId: tc.id,
          name: tc.name,
        });
      }
    }

    return fullResponse.trim() || `[${agent.role}] (no response)`;
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
    const lines: string[] = ['=== Swarm Consensus ===\n'];
    for (const [role, output] of Object.entries(outputs)) {
      // Extract first meaningful paragraph or summary line
      const paragraphs = output.split('\n\n').filter(p => p.trim().length > 20);
      const summary = paragraphs.length > 0
        ? paragraphs[0].slice(0, 500)
        : output.slice(0, 500);
      lines.push(`[${role}]: ${summary}`);
    }
    return lines.join('\n\n');
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
