import type { RegisteredTool } from '../_shared/index.js';

export const memoryCompress: RegisteredTool = {
  definition: {
    name: 'memory_compress',
    description: 'Get a token-budgeted memory context. Set budget in tokens (default: 2000). Uses relevance × recency × importance to rank and compress memories.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for relevance scoring' },
        budget: { type: 'number', description: 'Token budget (default: 2000)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const compressed = await mem.getContextCompressed(String(args.query), Number(args.budget) || 2000);
      return { content: compressed, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
