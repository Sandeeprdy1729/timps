import type { RegisteredTool } from '../_shared/index.js';

export const memoryBenchmark: RegisteredTool = {
  definition: {
    name: 'memory_benchmark',
    description: 'Run the memory retrieval benchmark comparing hybrid search vs linear search. Measures Recall@K, MRR, and token efficiency.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const report = await mem.runBenchmark();
      return { content: report, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
