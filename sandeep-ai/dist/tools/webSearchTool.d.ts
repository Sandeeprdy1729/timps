import { BaseTool, ToolParameter } from './baseTool';
export declare class WebSearchTool extends BaseTool {
    name: string;
    description: string;
    parameters: ToolParameter;
    execute(params: Record<string, any>): Promise<string>;
    private search;
}
export declare class WebFetchTool extends BaseTool {
    name: string;
    description: string;
    parameters: ToolParameter;
    execute(params: Record<string, any>): Promise<string>;
}
//# sourceMappingURL=webSearchTool.d.ts.map