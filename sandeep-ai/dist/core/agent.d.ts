import { ToolResult } from '../tools';
export interface AgentConfig {
    userId: number;
    projectId?: string;
    username?: string;
    systemPrompt?: string;
    maxIterations?: number;
    modelProvider?: 'openai' | 'gemini' | 'ollama';
    memoryMode?: 'persistent' | 'ephemeral';
}
export interface AgentResponse {
    content: string;
    toolResults?: ToolResult[];
    iterations: number;
    memoryStored: boolean;
}
export declare class Agent {
    private userId;
    private projectId;
    private memoryMode;
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
    getProjectId(): string;
    getUserId(): number;
    getMemoryMode(): string;
    clearConversation(): void;
}
//# sourceMappingURL=agent.d.ts.map