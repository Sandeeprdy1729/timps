import type { RegisteredTool } from '../_shared/index.js';

export const think: RegisteredTool = {
  definition: {
    name: 'think',
    description: 'Structured reasoning scratchpad. Use to plan complex changes, analyze errors, or reason through a problem before taking action. No side effects.',
    inputSchema: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your reasoning, analysis, or plan' },
      },
      required: ['thought'],
    },
  },
  risk: 'low',
  async execute(args) {
    return { content: `Thought noted. Proceeding.`, isError: false };
  },
};
