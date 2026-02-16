import { BaseTool, InternalToolDefinition, ToolResult } from './baseTool';
import { FileTool } from './fileTool';
import { WebSearchTool, WebFetchTool } from './webSearchTool';

export { BaseTool } from './baseTool';
export { InternalToolDefinition, ToolResult } from './baseTool';
export { FileTool } from './fileTool';
export { WebSearchTool, WebFetchTool } from './webSearchTool';

export function getAllTools(): BaseTool[] {
  return [
    new FileTool(),
    new WebSearchTool(),
    new WebFetchTool(),
  ];
}

export function getToolDefinitions(): InternalToolDefinition[] {
  return getAllTools().map(tool => tool.getDefinition());
}

export function getToolByName(name: string): BaseTool | undefined {
  return getAllTools().find(tool => tool.name === name);
}

export async function executeTool(name: string, params: Record<string, any>): Promise<ToolResult> {
  const tool = getToolByName(name);
  
  if (!tool) {
    return {
      toolCallId: params.tool_call_id || 'unknown',
      result: '',
      error: `Tool not found: ${name}`,
    };
  }
  
  try {
    const result = await tool.execute(params);
    return {
      toolCallId: params.tool_call_id || 'unknown',
      result,
    };
  } catch (error: any) {
    return {
      toolCallId: params.tool_call_id || 'unknown',
      result: '',
      error: error.message,
    };
  }
}
