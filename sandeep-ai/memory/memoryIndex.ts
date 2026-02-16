import { ShortTermMemoryStore, ShortTermMemory } from './shortTerm';
import { LongTermMemoryStore, Memory, Goal, Preference, Project } from './longTerm';
import { Message } from '../models/baseModel';
import { config } from '../config/env';

export interface UserMemory {
  shortTerm: ShortTermMemoryStore;
  longTerm: LongTermMemoryStore;
  userId: number;
  username?: string;
}

export class MemoryIndex {
  private userMemories: Map<number, UserMemory> = new Map();
  private longTermStore: LongTermMemoryStore;
  
  constructor() {
    this.longTermStore = new LongTermMemoryStore();
  }
  
  getOrCreateUserMemory(userId: number, username?: string): UserMemory {
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, {
        shortTerm: new ShortTermMemoryStore(),
        longTerm: this.longTermStore,
        userId,
        username,
      });
    }
    const userMemory = this.userMemories.get(userId)!;
    if (username) {
      userMemory.username = username;
    }
    return userMemory;
  }
  
  async retrieveContext(userId: number, query: string): Promise<{
    memories: Memory[];
    goals: Goal[];
    preferences: Preference[];
    projects: Project[];
  }> {
    const userMemory = this.getOrCreateUserMemory(userId);
    
    const [memories, goals, preferences, projects] = await Promise.all([
      userMemory.longTerm.retrieveMemories(userId, query, config.memory.longTermTopResults),
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
  
  addToShortTerm(userId: number, message: Message): void {
    const userMemory = this.getOrCreateUserMemory(userId);
    userMemory.shortTerm.addMessage(message);
  }
  
  addToShortTermBatch(userId: number, messages: Message[]): void {
    const userMemory = this.getOrCreateUserMemory(userId);
    userMemory.shortTerm.addMessages(messages);
  }
  
  getShortTermMessages(userId: number): Message[] {
    const userMemory = this.getOrCreateUserMemory(userId);
    return userMemory.shortTerm.getMessages();
  }
  
  getShortTermContext(userId: number): string {
    const userMemory = this.getOrCreateUserMemory(userId);
    return userMemory.shortTerm.toContextString();
  }
  
  clearShortTerm(userId: number): void {
    const userMemory = this.getOrCreateUserMemory(userId);
    userMemory.shortTerm.clear();
  }
  
  async storeMemory(
    userId: number,
    content: string,
    memoryType: string = 'general',
    importance: number = 1,
    tags: string[] = []
  ): Promise<Memory> {
    const userMemory = this.getOrCreateUserMemory(userId);
    return userMemory.longTerm.storeMemory({
      user_id: userId,
      content,
      memory_type: memoryType,
      importance,
      tags,
    });
  }
  
  async storeGoal(
    userId: number,
    title: string,
    description?: string,
    priority: number = 1,
    targetDate?: Date
  ): Promise<Goal> {
    const userMemory = this.getOrCreateUserMemory(userId);
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
    const userMemory = this.getOrCreateUserMemory(userId);
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
    const userMemory = this.getOrCreateUserMemory(userId);
    return userMemory.longTerm.storeProject({
      user_id: userId,
      name,
      description,
      status: 'active',
      tech_stack: techStack,
      repository_url: repositoryUrl,
    });
  }
  
  removeUser(userId: number): void {
    this.userMemories.delete(userId);
  }
}

export const memoryIndex = new MemoryIndex();
