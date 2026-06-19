import type { RegisteredTool } from '../_shared/index.js';

export const memoryStore: RegisteredTool = {
  definition: {
    name: 'memory_store',
    description: 'Store an important fact, pattern, or decision to semantic memory for future sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact, pattern, or decision to remember' },
        type: { type: 'string', description: 'Type: fact, pattern, convention, error, decision', enum: ['fact', 'pattern', 'convention', 'error', 'decision'] },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['content'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const tags = String(args.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      mem.storeFact(String(args.content), (args.type as any) || 'fact', tags);
      return { content: `Stored to memory: ${String(args.content).slice(0, 80)}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
