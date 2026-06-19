import type { ToolDefinition } from '../../config/types.js';
import type { ToolExecutor } from '../_shared/index.js';

export const AgentTool: ToolExecutor = async (args) => {
  const { prompt } = args as any;

  return {
    content: `[Agent Tool] Spawning subagent for: ${prompt.slice(0, 50)}...`,
    toolName: 'Agent',
  };
};

export const agentToolDefinition: ToolDefinition = {
  name: 'Agent',
  description: 'Spawn a subagent with its own context to handle a task',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Task for the subagent' },
      model: { type: 'string', description: 'Model to use (optional)' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    required: ['prompt'],
  },
};
