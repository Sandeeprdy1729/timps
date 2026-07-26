// TIMPS Swarm — Workflow Graph (LangGraph-style DAG)
// Wires all 10 agents into conditional execution DAG

import { createSwarm, createAgent, type SwarmAgent, type AgentRole, AGENT_PROMPTS } from './agents.js';
import { createProvider } from '../models/index.js';
import { getTool, getToolDefinitions } from '../tools/tools.js';
import type { Message, ToolCall, ToolDefinition } from '../config/types.js';

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

// Resolve agent role names to actual tool definitions the agent may call
function resolveAgentTools(agent: SwarmAgent): ToolDefinition[] {
  const agentToolNames = new Set(AGENT_PROMPTS[agent.role].tools.map(t => t.toLowerCase()));
  const allDefs = getToolDefinitions();
  return allDefs.filter(d => agentToolNames.has(d.name.toLowerCase()));
}

// Execute a single agent node — agentic loop with real tool execution
async function executeAgent(
  agent: SwarmAgent,
  task: string,
  cwd: string,
  context?: Record<string, unknown>
): Promise<string> {
  const state = context?.state as SwarmState | undefined;
  const prevMessages: string[] = state?.messages.get(agent.role) ?? [];
  const toolDefs = resolveAgentTools(agent);
  const maxTurns = 5; // safety cap per agent

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

  // Agentic loop: stream → accumulate tool calls → execute → feed results → repeat
  let fullText = '';
  for (let turn = 0; turn < maxTurns; turn++) {
    const toolCalls: ToolCall[] = [];
    const currentToolArgs = new Map<string, string>();
    const currentToolNames = new Map<string, string>();

    try {
      for await (const ev of provider.stream(messages, toolDefs, { maxTokens: 2048, temperature: 0.2 })) {
        if (ev.type === 'text') {
          fullText += ev.content;
        } else if (ev.type === 'tool_start') {
          currentToolArgs.set(ev.id, '');
          currentToolNames.set(ev.id, ev.name);
        } else if (ev.type === 'tool_delta') {
          currentToolArgs.set(ev.id, (currentToolArgs.get(ev.id) || '') + ev.argumentsChunk);
        } else if (ev.type === 'tool_end') {
          const argsStr = currentToolArgs.get(ev.id) || '{}';
          let args: Record<string, unknown>;
          try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
          const toolName = currentToolNames.get(ev.id) || 'unknown';
          toolCalls.push({ id: ev.id, name: toolName, arguments: args });
        } else if (ev.type === 'error') {
          return `[${agent.name}] ERROR: ${ev.message}`;
        }
      }
    } catch (err) {
      if (fullText) return `[${agent.name}]: ${fullText.trim()}`;
      return `[${agent.name}] FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }

    // No tool calls → agent is done
    if (toolCalls.length === 0) break;

    // Feed assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: fullText || '(tool calls only)',
      toolCalls,
      timestamp: Date.now(),
    });
    fullText = '';

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

  return fullText.trim() || `[${agent.name}] (no response)`;
}

// Run the full DAG
export async function runSwarmDAG(request: SwarmRequest): Promise<SwarmResult> {
  const startTime = Date.now();
  const agents = createSwarm();
  const cwd = process.cwd();

  const state: SwarmState = {
    currentTask: request.request,
    iteration: 0,
    completed: [],
    failed: [],
    artifacts: new Map(),
    messages: new Map(),
  };

  try {
    // Determine which agents to run based on request keywords
    const rolesToRun: AgentRole[] = ['orchestrator', 'code_generator'];
    const req = request.request.toLowerCase();

    if (req.includes('fix') || req.includes('bug')) {
      rolesToRun.push('code_reviewer', 'qa_tester');
    }
    if (req.includes('security') || req.includes('audit')) {
      rolesToRun.push('security_auditor');
    }
    if (req.includes('document') || req.includes('readme')) {
      rolesToRun.push('docs_writer');
    }
    if (req.includes('docker') || req.includes('deploy')) {
      rolesToRun.push('devops');
    }
    if (req.includes('optim') || req.includes('performance') || req.includes('slow')) {
      rolesToRun.push('performance_optimizer');
    }
    if (req.includes('test') || req.includes('spec')) {
      rolesToRun.push('qa_tester');
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

      const result = await executeAgent(agent, prompt, cwd, { state });
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
