import type { RegisteredTool } from '../_shared/index.js';

export const memoryStats: RegisteredTool = {
  definition: {
    name: 'memory_stats',
    description: 'Get comprehensive memory statistics: semantic count, episodes, procedural traces, knowledge graph nodes, decay stats, benchmark results.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      const stats = mem.getStats();
      const decay = mem.decay.getStats();
      const procedural = mem.procedural.getStats();
      const graph = mem.graph.getStats();
      const affective = mem.affective.getStats();
      const report = mem.benchmark.loadLatestReport();
      const lines = [
        'Memory Statistics:',
        `  Semantic entries: ${stats.semanticCount}`,
        `  Episodes: ${stats.episodeCount}`,
        `  Procedural traces: ${procedural.totalTraces}`,
        `  Knowledge graph nodes: ${graph.nodeCount}, edges: ${graph.edgeCount}`,
        `  Active memories: ${decay.activeCount} | Archived: ${decay.archivedCount}`,
        `  Avg importance: ${decay.avgImportance}/10`,
        `  Session samples: ${affective.sampleCount}`,
      ];
      if (report) {
        lines.push(`  Benchmark R@5: ${(report.recallAt5 * 100).toFixed(1)}%`);
        lines.push(`  Token efficiency: ${report.tokenEfficiency.toFixed(0)} tok/query`);
      }
      return { content: lines.join('\n'), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
