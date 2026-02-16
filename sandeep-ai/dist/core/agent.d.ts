import { ToolResult } from '../tools';
export interface AgentConfig {
    userId: number;
    username?: string;
    systemPrompt?: string;
    maxIterations?: number;
    modelProvider?: 'openai' | 'gemini' | 'ollama';
}
export interface AgentResponse {
    content: string;
    toolResults?: ToolResult[];
    iterations: number;
    memoryStored: boolean;
}
export declare class Agent {
    private userId;
    private username?;
    private systemPrompt;
    private model;
    private maxIterations;
    private toolDefinitions;
    constructor(config: AgentConfig);
    run(userMessage: string): Promise<AgentResponse>;
    private buildMessages;
    private executeToolCall;
    private reflectAndStore;
    private extractMemories;
    setSystemPrompt(prompt: string): void;
    clearConversation(): void;
}
//# sourceMappingURL=agent.d.ts.map