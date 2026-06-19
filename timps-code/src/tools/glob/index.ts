import type { ToolDefinition } from '../../config/types.js';
import type { ToolExecutor } from '../_shared/index.js';

export const GlobTool: ToolExecutor = async (args) => {
  const { pattern, cwd } = args as any;
  const { glob } = await import('glob');

  try {
    const files = await glob(pattern, { cwd: cwd || process.cwd(), absolute: true });

    return {
      content: files.slice(0, 100).join('\n'),
      toolName: 'Glob',
    };
  } catch (err: any) {
    return {
      content: `Glob error: ${err.message}`,
      isError: true,
      toolName: 'Glob',
    };
  }
};

export const globToolDefinition: ToolDefinition = {
  name: 'Glob',
  description: 'Find files by glob pattern',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
      cwd: { type: 'string', description: 'Working directory' },
    },
    required: ['pattern'],
  },
};
