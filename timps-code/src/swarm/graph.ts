// TIMPS Swarm — Workflow Graph (LangGraph-style DAG)
// Wires all 10 agents into conditional execution DAG

import { createSwarm, createAgent, type SwarmAgent, type AgentRole } from './agents.js';
import { createProvider } from '../models/index.js';
import type { Message } from '../config/types.js';

export interface SwarmRequest {
  request: string;
  language?: string;
  maxIterations?: number;
  maxParallelAgents?: number;
  useRemote?: boolean;
}

export interface SwarmResult {
  success: boolean;
  summary?: string;
  artifacts?: string[];
  error?: string;
  duration?: number;
}

export interface SwarmState {
  currentTask?: string;
  iteration: number;
  completed: string[];
  failed: string[];
  artifacts: Map<string, string>;
  messages: Map<string, string[]>;
}

// Routing logic
export function routeAfterOrchestrator(state: SwarmState): AgentRole {
  if (state.completed.includes('product_manager') && !state.completed.includes('architect')) {
    return 'architect';
  }
  if (!state.completed.includes('code_generator')) {
    return 'code_generator';
  }
  if (!state.completed.includes('code_reviewer')) {
    return 'code_reviewer';
  }
  if (!state.completed.includes('qa_tester')) {
    return 'qa_tester';
  }
  if (!state.completed.includes('security_auditor')) {
    return 'security_auditor';
  }
  return 'docs_writer';
}

// Execute a single agent node — calls the agent's configured LLM with its system prompt
async function executeAgent(
  agent: SwarmAgent,
  task: string,
  context?: Record<string, unknown>
): Promise<string> {
  const state = context?.state as SwarmState | undefined;
  const prevMessages: string[] = state?.messages.get(agent.role) ?? [];

  const messages: Message[] = [
    { role: 'system', content: agent.prompt, timestamp: Date.now() },
    ...prevMessages.map((m): Message => ({ role: 'user', content: m, timestamp: Date.now() })),
    { role: 'user', content: task, timestamp: Date.now() },
  ];

  let provider;
  try {
    provider = createProvider(agent.provider, agent.model);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `[${agent.name}] SKIPPED (provider unavailable: ${msg}). Set the API key or run 'ollama serve'.`;
  }

  let text = '';
  try {
    for await (const ev of provider.stream(messages, [], { maxTokens: 1024, temperature: 0.2 })) {
      if (ev.type === 'text') text += ev.content;
      else if (ev.type === 'error') return `[${agent.name}] ERROR: ${ev.message}`;
    }
  } catch (err) {
    return `[${agent.name}] FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  return text.trim() || `[${agent.name}] (no response)`;
}

// Run the full DAG
export async function runSwarmDAG(request: SwarmRequest): Promise<SwarmResult> {
  const startTime = Date.now();
  const agents = createSwarm();

  const state: SwarmState = {
    currentTask: request.request,
    iteration: 0,
    completed: [],
    failed: [],
    artifacts: new Map(),
    messages: new Map(),
  };

  try {
    const orchestrator = agents.find(a => a.role === 'orchestrator')!;
    state.currentTask = `Analyze and plan: ${request.request}`;

    const rolesToRun: AgentRole[] = ['orchestrator', 'code_generator'];

    if (request.request.toLowerCase().includes('fix') || request.request.toLowerCase().includes('bug')) {
      rolesToRun.push('code_reviewer', 'qa_tester');
    }
    if (request.request.toLowerCase().includes('security') || request.request.toLowerCase().includes('audit')) {
      rolesToRun.push('security_auditor');
    }
    if (request.request.toLowerCase().includes('document') || request.request.toLowerCase().includes('readme')) {
      rolesToRun.push('docs_writer');
    }
    if (request.request.toLowerCase().includes('docker') || request.request.toLowerCase().includes('deploy')) {
      rolesToRun.push('devops');
    }

    for (const role of rolesToRun) {
      const agent = agents.find(a => a.role === role)!;
      if (!agent) continue;

      const inputFromPrev = Array.from(state.artifacts.entries())
        .map(([r, out]) => `[${r} output]\n${out}`)
        .join('\n\n');
      const prompt = state.artifacts.size > 0
        ? `Original task: ${request.request}\n\n${inputFromPrev}\n\nNow produce your ${agent.name} output.`
        : `Plan the work needed for: ${request.request}\n\nList which of the 10 agents should run and in what order. Be concise.`;

      const result = await executeAgent(agent, prompt, { state });
      state.completed.push(role);
      state.artifacts.set(role, result);
      state.messages.set(role, [result]);
    }

    return {
      success: true,
      summary: `Completed ${state.completed.length} agents:\n${state.completed.join(', ')}`,
      artifacts: Array.from(state.artifacts.values()),
      duration: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

// Create the DAG workflow
export function createSwarmDAG() {
  const agents = createSwarm();
  return {
    agents,
    run: runSwarmDAG,
  };
}