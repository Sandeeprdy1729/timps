export interface ExtractedKnowledge {
    memories: Array<{
        content: string;
        type: 'fact' | 'preference' | 'goal' | 'project' | 'general';
        importance: number;
        tags: string[];
    }>;
    goals: Array<{
        title: string;
        description?: string;
        priority: number;
        status: 'active' | 'completed' | 'cancelled';
    }>;
    preferences: Array<{
        key: string;
        value: string;
        category?: string;
    }>;
    projects: Array<{
        name: string;
        description?: string;
        status: 'active' | 'completed' | 'archived';
        techStack?: string[];
    }>;
}
export declare class Reflection {
    private model;
    constructor();
    analyzeConversation(userId: number, userMessage: string, assistantMessage: string): Promise<ExtractedKnowledge>;
    storeExtractedKnowledge(userId: number, knowledge: ExtractedKnowledge): Promise<void>;
    reflectOnSession(userId: number, messages: Array<{
        role: string;
        content: string;
    }>): Promise<void>;
}
//# sourceMappingURL=reflection.d.ts.map