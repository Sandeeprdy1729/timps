import type { RegisteredTool } from '../../tools/tools.js';

export const syntheticOutputTool: RegisteredTool = {
  definition: {
    name: 'structured_output',
    description: 'Return the final response as structured JSON. Use to provide output in a specific schema format.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  risk: 'low',
  async execute(args) {
    return {
      content: JSON.stringify(args, null, 2),
      isError: false,
    };
  },
};

export function createSyntheticOutputTool(jsonSchema: Record<string, unknown>): RegisteredTool {
  return {
    definition: {
      name: 'structured_output',
      description: `Return structured output matching schema: ${JSON.stringify(jsonSchema)}`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    risk: 'low',
    async execute(args) {
      return {
        content: JSON.stringify(args, null, 2),
        isError: false,
      };
    },
  };
}