import type { RegisteredTool } from '../_shared/index.js';

export const memoryDecay: RegisteredTool = {
  definition: {
    name: 'memory_decay',
    description: 'Trigger Ebbinghaus decay cycle. Archives low-recall memories to crypt layer. Run periodically to keep memory lean.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      mem.applyDecay();
      const stats = mem.getStats();
      return { content: `Decay cycle complete. ${stats.semanticCount} active entries remain.`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
