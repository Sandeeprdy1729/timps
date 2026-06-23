import type { RegisteredTool } from '../_shared/index.js';

export const memoryPredict: RegisteredTool = {
  definition: {
    name: 'memory_predict',
    description: 'Pre-fetch memories based on current task context similarity to past sessions. Uses session profiles and file similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Current task goal' },
      },
      required: ['goal'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const prediction = mem.predictNext(String(args.goal));
      if (!prediction || prediction.confidence === 0) return { content: 'No similar past sessions found.', isError: false };
      const parts: string[] = [`Confidence: ${Math.round(prediction.confidence * 100)}%`];
      if (prediction.episodicSummaries.length > 0) parts.push('Similar sessions:\n' + prediction.episodicSummaries.map(s => `• ${s}`).join('\n'));
      if (prediction.semanticFacts.length > 0) parts.push('Relevant facts:\n' + prediction.semanticFacts.map(f => `• ${f.slice(0, 100)}`).join('\n'));
      return { content: parts.join('\n'), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
