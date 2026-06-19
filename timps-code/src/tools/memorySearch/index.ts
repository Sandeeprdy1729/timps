import type { RegisteredTool } from '../_shared/index.js';

export const memorySearch: RegisteredTool = {
  definition: {
    name: 'memory_search',
    description: 'Search semantic memory for facts, patterns, and conventions from past sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 5)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const results = mem.searchFacts(String(args.query), Number(args.limit) || 5);
      if (results.length === 0) return { content: 'No relevant memories found.', isError: false };
      return {
        content: results.map(r => `[${r.type}] ${r.content}`).join('\n\n'),
        isError: false,
      };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
