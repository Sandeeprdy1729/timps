import { BaseTool, InternalToolDefinition, ToolResult } from './baseTool';
export { BaseTool } from './baseTool';
export { InternalToolDefinition, ToolResult } from './baseTool';
export { FileTool } from './fileTool';
export { WebSearchTool, WebFetchTool } from './webSearchTool';
export declare function getAllTools(): BaseTool[];
export declare function getToolDefinitions(): InternalToolDefinition[];
export declare function getToolByName(name: string): BaseTool | undefined;
export declare function executeTool(name: string, params: Record<string, any>): Promise<ToolResult>;
//# sourceMappingURL=index.d.ts.map