import type { RegisteredTool } from '../_shared/index.js';

export const memoryKgQuery: RegisteredTool = {
  definition: {
    name: 'memory_kg_query',
    description: 'Query the knowledge graph with multi-hop traversal. Ask questions like "What technologies do we use for APIs that caused incidents?"',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question' },
        entity: { type: 'string', description: 'Starting entity for multi-hop' },
        hops: { type: 'number', description: 'Max hops (default: 3)' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      if (args.entity) {
        const results = mem.multiHopQuery(String(args.entity), []);
        if (results.length === 0) return { content: 'No paths found.', isError: false };
        const formatted = results.map(r => `${r.path.join(' → ')} (score: ${r.score.toFixed(2)})`).join('\n');
        return { content: formatted, isError: false };
      }
      if (args.question) {
        const result = mem.queryKnowledgeGraph(String(args.question));
        return { content: `Answer: ${result.answer}\nConfidence: ${Math.round(result.confidence * 100)}% | Hops: ${result.hops}`, isError: false };
      }
      return { content: 'Provide either question or entity parameter.', isError: true };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
