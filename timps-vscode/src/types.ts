// TIMPS — Type Definitions
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatOptions { temperature?: number; maxTokens?: number; }
export interface GenerateOptions { temperature?: number; maxTokens?: number; }
export interface OllamaModel { name: string; size?: number; modified_at?: string; }
export interface SetupStatus {
    ollamaInstalled: boolean;
    ollamaRunning: boolean;
    modelAvailable: boolean;
    modelName: string;
}
export interface OllamaChatResponse {
    model: string; created_at: string;
    message: { role: string; content: string; };
    done: boolean;
}
export interface OllamaPullStatus {
    status: string; digest?: string; total?: number; completed?: number;
}
