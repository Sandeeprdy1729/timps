export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface GenerateOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    tools?: ToolDefinition[];
    tool_choice?: string | {
        type: 'function';
        function: {
            name: string;
        };
    };
    stop?: string[];
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
}
export interface GenerateResponse {
    content: string;
    toolCalls?: ToolCall[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface EmbeddingResponse {
    embedding: number[];
    usage: {
        promptTokens: number;
        totalTokens: number;
    };
}
export declare abstract class BaseModel {
    protected modelName: string;
    protected temperature: number;
    constructor(modelName: string, temperature?: number);
    abstract generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
    abstract getEmbedding(text: string): Promise<EmbeddingResponse>;
    getModelName(): string;
    setTemperature(temperature: number): void;
    protected parseToolCalls(responseContent: string): ToolCall[] | undefined;
}
//# sourceMappingURL=baseModel.d.ts.map