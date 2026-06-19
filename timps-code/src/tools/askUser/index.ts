import type { RegisteredTool } from '../_shared/index.js';

export const askUser: RegisteredTool = {
  definition: {
    name: 'ask_user',
    description: 'Pause and ask the user a clarifying question. Use when you cannot safely proceed without input.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
      },
      required: ['question'],
    },
  },
  risk: 'low',
  async execute(args) {
    return { content: `[[ASK_USER]] ${args.question}`, isError: false };
  },
};
