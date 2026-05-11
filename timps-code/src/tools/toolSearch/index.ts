import type { RegisteredTool } from '../../tools/tools.js';

interface DeferredTool {
  name: string;
  description: string;
  searchHint?: string;
}

const availableTools = new Map<string, DeferredTool>();

export function registerDeferredTool(tool: DeferredTool): void {
  availableTools.set(tool.name.toLowerCase(), tool);
}

export const toolSearchTool: RegisteredTool = {
  definition: {
    name: 'tool_search',
    description: 'Search for deferred/lazy-loaded tools by keyword or exact name. Use to discover available tools that are not loaded by default.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query to find deferred tools. Use "select:<tool_name>" for direct selection.' },
        max_results: { type: 'number', description: 'Maximum results (default: 5)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args) {
    const query = String(args.query);
    const maxResults = Number(args.max_results) || 5;
    const tools = Array.from(availableTools.values());
    if (tools.length === 0) {
      return { content: 'No deferred tools available', isError: false };
    }
    const selectMatch = query.match(/^select:(.+)$/i);
    if (selectMatch) {
      const requested = selectMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      const found: string[] = [];
      for (const name of requested) {
        const tool = availableTools.get(name.toLowerCase());
        if (tool) found.push(tool.name);
      }
      if (found.length === 0) {
        return { content: `No matching tools found for: ${requested.join(', ')}`, isError: false };
      }
      return {
        content: `Found: ${found.join(', ')}`,
        isError: false,
      };
    }
    const queryLower = query.toLowerCase();
    const matches = tools
      .filter(t => t.name.toLowerCase().includes(queryLower) || (t.searchHint?.toLowerCase().includes(queryLower)))
      .slice(0, maxResults)
      .map(t => t.name);
    if (matches.length === 0) {
      return { content: `No matching deferred tools found for: ${query}`, isError: false };
    }
    return {
      content: `Matches: ${matches.join(', ')}`,
      isError: false,
    };
  },
};