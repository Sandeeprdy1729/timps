export interface Memory {
    id?: number;
    user_id: number;
    project_id: string;
    content: string;
    memory_type: "explicit" | "reflection";
    source_conversation_id: string;
    source_message_id: string;
    importance: number;
    retrieval_count: number;
    last_retrieved_at?: Date;
    tags: string[];
    created_at?: Date;
    updated_at?: Date;
}
export interface Goal {
    id?: number;
    user_id: number;
    title: string;
    description?: string;
    status: 'active' | 'completed' | 'cancelled';
    priority: number;
    target_date?: Date;
    created_at?: Date;
    updated_at?: Date;
}
export interface Preference {
    id?: number;
    user_id: number;
    preference_key: string;
    preference_value?: string;
    category?: string;
    created_at?: Date;
    updated_at?: Date;
}
export interface Project {
    id?: number;
    user_id: number;
    name: string;
    description?: string;
    status: 'active' | 'completed' | 'archived';
    tech_stack?: string[];
    repository_url?: string;
    created_at?: Date;
    updated_at?: Date;
}
export declare class LongTermMemoryStore {
    private embeddingModel;
    storeMemory(memoryInput: Omit<Memory, 'id' | 'created_at' | 'updated_at'>): Promise<Memory>;
    retrieveMemories(userId: number, projectId: string, queryText: string, limit?: number): Promise<Memory[]>;
    private getMemoriesFromDB;
    getUserMemories(userId: number): Promise<Memory[]>;
    updateMemory(id: number, updates: Partial<Memory>): Promise<void>;
    deleteMemory(id: number): Promise<void>;
    storeGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal>;
    getGoals(userId: number): Promise<Goal[]>;
    updateGoal(id: number, updates: Partial<Goal>): Promise<void>;
    storePreference(pref: Omit<Preference, 'id' | 'created_at' | 'updated_at'>): Promise<Preference>;
    getPreferences(userId: number): Promise<Preference[]>;
    getPreference(userId: number, key: string): Promise<Preference | null>;
    storeProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project>;
    getProjects(userId: number): Promise<Project[]>;
    updateProject(id: number, updates: Partial<Project>): Promise<void>;
}
//# sourceMappingURL=longTerm.d.ts.map