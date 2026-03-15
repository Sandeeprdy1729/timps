import { ToolResult } from '../tools';
export interface AgentConfig {
    userId: number;
    projectId?: string;
    username?: string;
    systemPrompt?: string;
    maxIterations?: number;
    modelProvider?: 'openai' | 'gemini' | 'ollama' | 'openrouter';
    memoryMode?: 'persistent' | 'ephemeral';
}
export interface AgentResponse {
    content: string;
    toolResults?: ToolResult[];
    iterations: number;
    memoryStored: boolean;
    toolsActivated?: string[];
    planExecuted?: boolean;
}
export declare class Agent {
    private userId;
    private projectId;
    private memoryMode;
    private username?;
    private systemPrompt;
    private model;
    private maxIterations;
    private allToolDefinitions;
    private planner;
    private executor;
    constructor(agentConfig: AgentConfig);
    run(userMessage: string): Promise<AgentResponse>;
    private runWithPlan;
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