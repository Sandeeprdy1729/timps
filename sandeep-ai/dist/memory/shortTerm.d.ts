import { Message } from '../models/baseModel';
export interface ShortTermMemory {
    messages: Message[];
    tokenCount: number;
}
export declare class ShortTermMemoryStore {
    private messages;
    private tokenCount;
    private estimateTokens;
    addMessage(message: Message): void;
    addMessages(messages: Message[]): void;
    getMessages(): Message[];
    getLastMessages(count: number): Message[];
    getSystemMessages(): Message[];
    getUserMessages(): Message[];
    getAssistantMessages(): Message[];
    getConversations(): Array<{
        user: string;
        assistant: string;
    }>;
    clear(): void;
    getTokenCount(): number;
    toContextString(): string;
}
//# sourceMappingURL=shortTerm.d.ts.map