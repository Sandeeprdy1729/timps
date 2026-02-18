import { ShortTermMemoryStore } from './shortTerm';
import { LongTermMemoryStore, Memory, Goal, Preference, Project } from './longTerm';
import { Message } from '../models/baseModel';
export interface UserMemory {
    shortTerm: ShortTermMemoryStore;
    longTerm: LongTermMemoryStore;
    userId: number;
    projectId: string;
    username?: string;
}
export declare class MemoryIndex {
    private userMemories;
    private longTermStore;
    constructor();
    private getMemoryKey;
    getOrCreateUserMemory(userId: number, projectId: string, username?: string): UserMemory;
    retrieveContext(userId: number, projectId: string, query: string): Promise<{
        memories: Memory[];
        goals: Goal[];
        preferences: Preference[];
        projects: Project[];
    }>;
    formatContextForPrompt(context: {
        memories: Memory[];
        goals: Goal[];
        preferences: Preference[];
        projects: Project[];
    }): string;
    addToShortTerm(userId: number, projectId: string, message: Message): void;
    addToShortTermBatch(userId: number, projectId: string, messages: Message[]): void;
    getShortTermMessages(userId: number, projectId: string): Message[];
    getShortTermContext(userId: number, projectId: string): string;
    clearShortTerm(userId: number, projectId: string): void;
    storeMemory(userId: number, projectId: string, content: string, memoryType: "explicit" | "reflection" | undefined, importance: number | undefined, tags: string[] | undefined, sourceConversationId: string, sourceMessageId: string): Promise<Memory>;
    storeGoal(userId: number, title: string, description?: string, priority?: number, targetDate?: Date): Promise<Goal>;
    storePreference(userId: number, key: string, value: string, category?: string): Promise<Preference>;
    storeProject(userId: number, name: string, description?: string, techStack?: string[], repositoryUrl?: string): Promise<Project>;
    removeUser(userId: number, projectId: string): void;
}
export declare const memoryIndex: MemoryIndex;
//# sourceMappingURL=memoryIndex.d.ts.map