import { ShortTermMemoryStore, ShortTermMemory } from './shortTerm';
import { LongTermMemoryStore, Memory, Goal, Preference, Project } from './longTerm';
import { Message } from '../models/baseModel';
import { config } from '../config/env';

export interface UserMemory {
  shortTerm: ShortTermMemoryStore;
  longTerm: LongTermMemoryStore;
  userId: number;
  projectId: string;
  username?: string;
}

export class MemoryIndex {
  private userMemories: Map<string, UserMemory> = new Map();
  private longTermStore: LongTermMemoryStore;
  
  constructor() {
    this.longTermStore = new LongTermMemoryStore();
  }
  
  private getMemoryKey(userId: number, projectId: string): string {
    return `${userId}:${projectId}`;
  }
  
  getOrCreateUserMemory(userId: number, projectId: string, username?: string): UserMemory {
    const key = this.getMemoryKey(userId, projectId);
    if (!this.userMemories.has(key)) {
      this.userMemories.set(key, {
        shortTerm: new ShortTermMemoryStore(),
        longTerm: this.longTermStore,
        userId,
        projectId,
        username,
      });
    }
    const userMemory = this.userMemories.get(key)!;
    if (username) {
      userMemory.username = username;
    }
    return userMemory;
  }
  
  async retrieveContext(userId: number, projectId: string, query: string): Promise<{
    memories: Memory[];
    goals: Goal[];
    preferences: Preference[];
    projects: Project[];
  }> {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    
    const [memories, goals, preferences, projects] = await Promise.all([
      userMemory.longTerm.retrieveMemories(userId, projectId, query, config.memory.longTermTopResults),
      userMemory.longTerm.getGoals(userId),
      userMemory.longTerm.getPreferences(userId),
      userMemory.longTerm.getProjects(userId),
    ]);
    
    return { memories, goals, preferences, projects };
  }
  
  formatContextForPrompt(context: {
    memories: Memory[];
    goals: Goal[];
    preferences: Preference[];
    projects: Project[];
  }): string {
    const parts: string[] = [];
    
    if (context.memories.length > 0) {
      parts.push('## Relevant Memories');
      for (const mem of context.memories) {
        parts.push(`- ${mem.content} (${mem.memory_type})`);
      }
    }
    
    if (context.goals.length > 0) {
      parts.push('\n## Active Goals');
      for (const goal of context.goals.filter(g => g.status === 'active')) {
        parts.push(`- ${goal.title}${goal.description ? `: ${goal.description}` : ''}`);
      }
    }
    
    if (context.preferences.length > 0) {
      parts.push('\n## Preferences');
      for (const pref of context.preferences) {
        parts.push(`- ${pref.preference_key}: ${pref.preference_value}`);
      }
    }
    
    if (context.projects.length > 0) {
      parts.push('\n## Projects');
      for (const proj of context.projects.filter(p => p.status === 'active')) {
        const techStack = proj.tech_stack?.join(', ') || 'N/A';
        parts.push(`- ${proj.name}: ${proj.description || 'No description'} (Tech: ${techStack})`);
      }
    }
    
    return parts.join('\n');
  }
  
  addToShortTerm(userId: number, projectId: string, message: Message): void {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    userMemory.shortTerm.addMessage(message);
  }
  
  addToShortTermBatch(userId: number, projectId: string, messages: Message[]): void {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    userMemory.shortTerm.addMessages(messages);
  }
  
  getShortTermMessages(userId: number, projectId: string): Message[] {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    return userMemory.shortTerm.getMessages();
  }
  
  getShortTermContext(userId: number, projectId: string): string {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    return userMemory.shortTerm.toContextString();
  }
  
  clearShortTerm(userId: number, projectId: string): void {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    userMemory.shortTerm.clear();
  }
  
  async storeMemory(
    userId: number,
    content: string,
    memoryType: "explicit" | "reflection",
    importance: number,
    tags: string[],
    projectId: string,
    conversationId: string,
    messageId: string
  ): Promise<Memory> {
    const userMemory = this.getOrCreateUserMemory(userId, projectId);
    return userMemory.longTerm.storeMemory(
      userId,
      content,
      memoryType,
      importance,
      tags,
      projectId,
      conversationId,
      messageId
    );
  }
  
  async storeGoal(
    userId: number,
    title: string,
    description?: string,
    priority: number = 1,
    targetDate?: Date
  ): Promise<Goal> {
    const userMemory = this.getOrCreateUserMemory(userId, 'default');
    return userMemory.longTerm.storeGoal({
      user_id: userId,
      title,
      description,
      status: 'active',
      priority,
      target_date: targetDate,
    });
  }
  
  async storePreference(
    userId: number,
    key: string,
    value: string,
    category?: string
  ): Promise<Preference> {
    const userMemory = this.getOrCreateUserMemory(userId, 'default');
    return userMemory.longTerm.storePreference({
      user_id: userId,
      preference_key: key,
      preference_value: value,
      category,
    });
  }
  
  async storeProject(
    userId: number,
    name: string,
    description?: string,
    techStack?: string[],
    repositoryUrl?: string
  ): Promise<Project> {
    const userMemory = this.getOrCreateUserMemory(userId, 'default');
    return userMemory.longTerm.storeProject({
      user_id: userId,
      name,
      description,
      status: 'active',
      tech_stack: techStack,
      repository_url: repositoryUrl,
    });
  }
  
  removeUser(userId: number, projectId: string): void {
    this.userMemories.delete(this.getMemoryKey(userId, projectId));
  }
}

export const memoryIndex = new MemoryIndex();
