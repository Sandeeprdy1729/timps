import { ShortTermMemoryStore } from './shortTerm';
import { LongTermMemoryStore, Memory, Goal, Preference, Project } from './longTerm';
import { Message } from '../models/baseModel';
export interface UserMemory {
    shortTerm: ShortTermMemoryStore;
    longTerm: LongTermMemoryStore;
    userId: number;
    username?: string;
}
export declare class MemoryIndex {
    private userMemories;
    private longTermStore;
    constructor();
    getOrCreateUserMemory(userId: number, username?: string): UserMemory;
    retrieveContext(userId: number, query: string): Promise<{
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
    addToShortTerm(userId: number, message: Message): void;
    addToShortTermBatch(userId: number, messages: Message[]): void;
    getShortTermMessages(userId: number): Message[];
    getShortTermContext(userId: number): string;
    clearShortTerm(userId: number): void;
    storeMemory(userId: number, content: string, memoryType?: string, importance?: number, tags?: string[]): Promise<Memory>;
    storeGoal(userId: number, title: string, description?: string, priority?: number, targetDate?: Date): Promise<Goal>;
    storePreference(userId: number, key: string, value: string, category?: string): Promise<Preference>;
    storeProject(userId: number, name: string, description?: string, techStack?: string[], repositoryUrl?: string): Promise<Project>;
    removeUser(userId: number): void;
}
export declare const memoryIndex: MemoryIndex;
//# sourceMappingURL=memoryIndex.d.ts.map