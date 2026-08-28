import type { RegisteredTool } from '../_shared/index.js';

export const memoryTimeline: RegisteredTool = {
  definition: {
    name: 'memory_timeline',
    description: 'Get the evolution timeline of a memory entry — how opinions/approaches changed over time. Also shows recent memory diffs.',
    inputSchema: {
      type: 'object',
      properties: {
        entryId: { type: 'string', description: 'Memory entry ID' },
        days: { type: 'number', description: 'Show changes from last N days (default: 7)' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../../memory/memory.js');
      const mem = new Memory(cwd);
      if (args.entryId) {
        const timeline = mem.getBeliefsTimeline(String(args.entryId));
        return { content: timeline || 'No history for this entry.', isError: false };
      }
      const changes = mem.getRecentChanges(Number(args.days) || 7);
      if (changes.length === 0) return { content: 'No recent changes.', isError: false };
      const formatted = changes.map(c => `${new Date(c.changedAt).toLocaleDateString()}: ${c.was} → ${c.now}`).join('\n');
      return { content: formatted, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
