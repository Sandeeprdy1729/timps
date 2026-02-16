export interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    items?: any;
    properties?: Record<string, ToolParameter>;
    required?: string[];
}
export interface InternalToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter;
}
export interface ToolResult {
    toolCallId: string;
    result: string;
    error?: string;
}
export declare abstract class BaseTool {
    abstract name: string;
    abstract description: string;
    abstract parameters: ToolParameter;
    abstract execute(params: Record<string, any>): Promise<string>;
    getDefinition(): InternalToolDefinition;
    protected validateParams(params: Record<string, any>): void;
}
//# sourceMappingURL=baseTool.d.ts.map