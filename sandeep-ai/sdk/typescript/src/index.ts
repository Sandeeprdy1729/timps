/**
 * TIMPs SDK - TypeScript
 * The heart of AI memory systems
 * 
 * @example
 * ```typescript
 * import { TIMPs } from '@timps/sdk';
 * 
 * const timps = new TIMPs({ 
 *   apiKey: process.env.TIMPS_API_KEY,
 *   userId: 'user_123'
 * });
 * 
 * // Store a memory
 * await timps.store('User prefers TypeScript over JavaScript', {
 *   type: 'preference',
 *   importance: 0.9
 * });
 * 
 * // Retrieve relevant context
 * const context = await timps.retrieve('What language does the user prefer?');
 * 
 * // Get pre-assembled context for LLM
 * const packet = await timps.assembleContext(userId, currentTask);
 * ```
 */

import { EventEmitter } from 'events';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface TIMPsConfig {
  apiUrl?: string;
  apiKey?: string;
  userId: string;
  projectId?: string;
  embeddingModel?: string;
  retrievalLimit?: number;
  decayEnabled?: boolean;
  entityResolution?: boolean;
}

export interface Memory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'goal' | 'pattern' | 'entity' | 'relationship';
  importance: number;
  salience: number;
  tags: string[];
  entityIds: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  type: 'person' | 'project' | 'concept' | 'tool' | 'file' | 'api' | 'unknown';
  facts: string[];
  confidence: number;
  linkedEntities: string[];
}

export interface ContextPacket {
  memories: Memory[];
  entities: Entity[];
  relevantFacts: string[];
  temporalContext: {
    recentEvents: string[];
    upcomingGoals: string[];
  };
  contradictionWarnings: Contradiction[];
  assembledAt: Date;
  tokens: number;
}

export interface Contradiction {
  id: string;
  type: 'direct' | 'indirect' | 'implied';
  originalClaim: string;
  newClaim: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: 'pending' | 'user_confirmed' | 'merged' | 'superseded';
  confidence: number;
}

export interface SalienceScore {
  total: number;
  components: {
    recency: number;
    importance: number;
    relevance: number;
    uniqueness: number;
    emotional: number;
  };
  decayed: boolean;
  nextDecayAt?: Date;
}

export interface GarbageCollectionResult {
  memoriesPruned: number;
  memoriesSummarized: number;
  tokensFreed: number;
  essentialFactsExtracted: number;
}

// ─── Core SDK ─────────────────────────────────────────────────────────────────
export class TIMPs {
  private config: TIMPsConfig;
  private entities: Map<string, Entity> = new Map();
  private memories: Map<string, Memory> = new Map();
  private cache: Map<string, { data: any; expires: number }> = new Map();
  
  // Events
  public on = (event: string, listener: (...args: any[]) => void) => this.emitter.on(event, listener);
  public off = (event: string, listener: (...args: any[]) => void) => this.emitter.off(event, listener);
  private emitter = new EventEmitter();

  constructor(config: TIMPsConfig) {
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:3000',
      embeddingModel: 'nomic-embed-text',
      retrievalLimit: 10,
      decayEnabled: true,
      entityResolution: true,
      ...config
    };
  }

  // ─── Core Memory Operations ────────────────────────────────────────────────
  
  /**
   * Store a memory with automatic entity resolution and salience calculation
   */
  async store(
    content: string,
    options: {
      type?: Memory['type'];
      importance?: number;
      tags?: string[];
      metadata?: Record<string, any>;
      linkToEntities?: string[];
      decay?: boolean;
    } = {}
  ): Promise<Memory> {
    const memory: Memory = {
      id: this.generateId(),
      content,
      type: options.type || 'fact',
      importance: options.importance ?? 0.5,
      salience: this.calculateSalience(options.importance ?? 0.5),
      tags: options.tags || [],
      entityIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata || {},
    };

    // Entity Resolution
    if (this.config.entityResolution) {
      const resolvedEntities = await this.resolveEntities(content);
      memory.entityIds = resolvedEntities.map(e => e.id);
      
      // Link memory to entities
      for (const entity of resolvedEntities) {
        this.entities.set(entity.id, entity);
      }
    }

    // Link explicitly provided entities
    if (options.linkToEntities) {
      memory.entityIds = [...new Set([...memory.entityIds, ...options.linkToEntities])];
    }

    // Calculate decay
    if (options.decay !== false && this.config.decayEnabled) {
      memory.expiresAt = this.calculateDecayExpiry(memory);
    }

    this.memories.set(memory.id, memory);
    
    // Emit event
    this.emitter.emit('memory:stored', memory);
    
    // Check for contradictions
    const contradictions = await this.detectContradictions(memory);
    if (contradictions.length > 0) {
      this.emitter.emit('contradiction:detected', { memory, contradictions });
    }

    return memory;
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieve(
    query: string,
    options: {
      limit?: number;
      types?: Memory['type'][];
      entityIds?: string[];
      minSalience?: number;
      includeDecayed?: boolean;
    } = {}
  ): Promise<Memory[]> {
    const limit = options.limit || this.config.retrievalLimit || 10;
    
    // Simple vector similarity (in production, use actual embeddings)
    const scores = Array.from(this.memories.values())
      .filter(m => {
        if (options.types && !options.types.includes(m.type)) return false;
        if (options.entityIds && !options.entityIds.some(id => m.entityIds.includes(id))) return false;
        if (options.minSalience && m.salience < options.minSalience) return false;
        if (!options.includeDecayed && m.expiresAt && m.expiresAt < new Date()) return false;
        return true;
      })
      .map(m => ({
        memory: m,
        score: this.cosineSimilarity(this.embed(query), this.embed(m.content))
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scores.map(s => s.memory);
  }

  /**
   * Assemble complete context packet for LLM consumption
   * This is the "Pre-Inference Routing" - TIMPs prepares context before LLM sees it
   */
  async assembleContext(
    task?: string,
    options: {
      maxTokens?: number;
      includeEntityGraph?: boolean;
      includeTemporalContext?: boolean;
      includeContradictions?: boolean;
    } = {}
  ): Promise<ContextPacket> {
    const startTime = Date.now();
    const memories = task 
      ? await this.retrieve(task, { limit: 20 })
      : Array.from(this.memories.values())
          .filter(m => m.salience > 0.3)
          .sort((a, b) => b.salience - a.salience)
          .slice(0, 20);

    // Entity resolution
    const entityIds = new Set<string>();
    for (const m of memories) {
      for (const id of m.entityIds) entityIds.add(id);
    }
    const entities = Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter(Boolean) as Entity[];

    // Extract relevant facts
    const relevantFacts = memories.map(m => m.content);

    // Temporal context
    const now = new Date();
    const temporalContext = {
      recentEvents: memories
        .filter(m => now.getTime() - m.createdAt.getTime() < 24 * 60 * 60 * 1000)
        .map(m => m.content),
      upcomingGoals: memories
        .filter(m => m.type === 'goal')
        .map(m => m.content),
    };

    // Contradiction check
    const contradictionWarnings = options.includeContradictions !== false
      ? await this.checkAllContradictions(memories)
      : [];

    // Estimate tokens (rough: 4 chars = 1 token)
    const tokens = relevantFacts.join(' ').length / 4 + entities.length * 50;

    // Respect token limit
    let finalMemories = memories;
    if (options.maxTokens) {
      let currentTokens = tokens;
      finalMemories = [];
      for (const m of memories) {
        const memTokens = m.content.length / 4;
        if (currentTokens + memTokens <= options.maxTokens) {
          finalMemories.push(m);
          currentTokens += memTokens;
        }
      }
    }

    const latency = Date.now() - startTime;
    if (latency > 100) {
      console.warn(`TIMPs: assembleContext took ${latency}ms (target <100ms)`);
    }

    return {
      memories: finalMemories,
      entities,
      relevantFacts,
      temporalContext,
      contradictionWarnings,
      assembledAt: new Date(),
      tokens: Math.round(tokens),
    };
  }

  // ─── Entity Resolution ──────────────────────────────────────────────────────
  
  /**
   * Resolve entities from text - linking "the project" to actual project entity
   */
  async resolveEntities(text: string): Promise<Entity[]> {
    const resolved: Entity[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Find matching entities by name or alias
    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase().includes(words.join(' ')) ||
          entity.aliases.some(a => text.toLowerCase().includes(a.toLowerCase()))) {
        resolved.push(entity);
      }
    }

    // Extract new potential entities (capitalized words, URLs, etc.)
    const potentialEntities = this.extractPotentialEntities(text);
    for (const name of potentialEntities) {
      if (!resolved.find(e => e.name === name)) {
        const newEntity: Entity = {
          id: this.generateId(),
          name,
          aliases: [name.toLowerCase(), name.toUpperCase()],
          type: this.guessEntityType(name),
          facts: [],
          confidence: 0.5,
          linkedEntities: [],
        };
        this.entities.set(newEntity.id, newEntity);
        resolved.push(newEntity);
      }
    }

    return resolved;
  }

  private extractPotentialEntities(text: string): string[] {
    const entities: string[] = [];
    
    // CamelCase words (likely proper nouns/code elements)
    const camelCase = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g);
    if (camelCase) entities.push(...camelCase);
    
    // URLs
    const urls = text.match(/https?:\/\/[^\s]+/g);
    if (urls) entities.push(...urls.map(u => new URL(u).hostname));
    
    // File paths
    const paths = text.match(/\/[\w\/.-]+\.\w+/g);
    if (paths) entities.push(...paths);
    
    // Capitalized acronyms (APIs, DBs)
    const acronyms = text.match(/\b[A-Z]{2,}\b/g);
    if (acronyms) entities.push(...acronyms);

    return entities;
  }

  private guessEntityType(name: string): Entity['type'] {
    if (name.includes('.') || name.includes('/')) return 'file';
    if (name.includes('http')) return 'api';
    if (['API', 'REST', 'GraphQL', 'SQL'].includes(name)) return 'api';
    if (['React', 'Node', 'Python', 'TypeScript'].some(p => name.includes(p))) return 'tool';
    return 'unknown';
  }

  // ─── Temporal Decay & Salience ──────────────────────────────────────────────
  
  /**
   * Calculate salience score (how important this memory is)
   */
  calculateSalience(importance: number): number {
    return Math.min(1, Math.max(0, importance));
  }

  /**
   * Calculate when a memory should expire based on type
   */
  private calculateDecayExpiry(memory: Memory): Date {
    const decayRates: Record<string, number> = {
      // Technical facts decay fast (port numbers, configs)
      fact: 7 * 24 * 60 * 60 * 1000, // 7 days
      // Preferences decay slowly
      preference: 365 * 24 * 60 * 60 * 1000, // 1 year
      // Goals are medium
      goal: 30 * 24 * 60 * 60 * 1000, // 30 days
      // Patterns last longest
      pattern: 180 * 24 * 60 * 60 * 1000, // 6 months
      // Entities and relationships are persistent
      entity: 365 * 24 * 60 * 60 * 1000,
      relationship: 365 * 24 * 60 * 60 * 1000,
    };

    const baseMs = decayRates[memory.type] || 7 * 24 * 60 * 60 * 1000;
    const importanceMultiplier = 0.5 + (memory.importance * 0.5); // 0.5x to 1x
    
    return new Date(Date.now() + baseMs * importanceMultiplier);
  }

  /**
   * Apply decay to all memories (run periodically)
   */
  async applyDecay(): Promise<{ pruned: number; updated: number }> {
    let pruned = 0;
    let updated = 0;
    const now = new Date();

    for (const [id, memory] of this.memories.entries()) {
      if (memory.expiresAt && memory.expiresAt < now) {
        this.memories.delete(id);
        pruned++;
      } else {
        // Decay salience over time
        const ageHours = (now.getTime() - memory.createdAt.getTime()) / (1000 * 60 * 60);
        const decayFactor = Math.pow(0.99, ageHours / 24); // 1% decay per day
        
        const newSalience = memory.salience * decayFactor;
        if (Math.abs(newSalience - memory.salience) > 0.01) {
          memory.salience = newSalience;
          memory.updatedAt = now;
          updated++;
        }
      }
    }

    return { pruned, updated };
  }

  // ─── Truth Engine / Contradiction Detection ─────────────────────────────────
  
  /**
   * Detect if new memory contradicts existing ones
   */
  async detectContradictions(newMemory: Memory): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    
    // Get similar memories
    const similar = await this.retrieve(newMemory.content, { limit: 5 });
    
    for (const existing of similar) {
      if (existing.id === newMemory.id) continue;
      
      // Check for negation patterns
      const hasNegation = (text: string) => 
        /\b(not|never|no|don't|doesn't|didn't|won't|wouldn't|isn't|aren't|can't|couldn't)\b/i.test(text);
      
      const existingNegated = hasNegation(existing.content);
      const newNegated = hasNegation(newMemory.content);
      
      // If one is negated and they're similar but not same polarity
      if (existingNegated !== newNegated) {
        const similarity = this.cosineSimilarity(
          this.embed(existing.content),
          this.embed(newMemory.content)
        );
        
        if (similarity > 0.7) {
          contradictions.push({
            id: this.generateId(),
            type: 'direct',
            originalClaim: existing.content,
            newClaim: newMemory.content,
            severity: similarity > 0.9 ? 'high' : 'medium',
            confidence: similarity,
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * Check all memories for contradictions
   */
  async checkAllContradictions(memories: Memory[]): Promise<Contradiction[]> {
    const all: Contradiction[] = [];
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sim = this.cosineSimilarity(
          this.embed(memories[i].content),
          this.embed(memories[j].content)
        );
        
        if (sim > 0.7 && this.isContradiction(memories[i], memories[j])) {
          all.push({
            id: this.generateId(),
            type: sim > 0.9 ? 'direct' : 'indirect',
            originalClaim: memories[i].content,
            newClaim: memories[j].content,
            severity: sim > 0.9 ? 'high' : 'medium',
            confidence: sim,
          });
        }
      }
    }

    return all;
  }

  private isContradiction(a: Memory, b: Memory): boolean {
    const negationWords = /\b(not|never|no|false|wrong|bad|don't|doesn't|won't|canceled|rejected)\b/gi;
    const aNegated = (a.content.match(negationWords) || []).length;
    const bNegated = (b.content.match(negationWords) || []).length;
    return (aNegated > 0) !== (bNegated > 0);
  }

  /**
   * Resolve a contradiction by user input or auto-merge
   */
  async resolveContradiction(
    contradictionId: string,
    resolution: 'user_confirmed' | 'merged' | 'superseded',
    userDecision?: string
  ): Promise<void> {
    // In production, this would update the DB
    this.emitter.emit('contradiction:resolved', { contradictionId, resolution, userDecision });
  }

  // ─── Memory Garbage Collection ───────────────────────────────────────────────
  
  /**
   * Summarize old memories into essential facts
   */
  async garbageCollect(options: {
    olderThanDays?: number;
    minSalience?: number;
    summarize?: boolean;
  } = {}): Promise<GarbageCollectionResult> {
    const olderThan = options.olderThanDays 
      ? Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000 
      : 0;
    
    const minSalience = options.minSalience ?? 0.2;
    
    const toProcess: Memory[] = [];
    const toKeep: Memory[] = [];
    let memoriesPruned = 0;
    let memoriesSummarized = 0;
    let essentialFactsExtracted = 0;
    let tokensFreed = 0;

    for (const memory of this.memories.values()) {
      const ageMs = Date.now() - memory.createdAt.getTime();
      
      if (ageMs > olderThan && memory.salience < minSalience) {
        toProcess.push(memory);
      } else {
        toKeep.push(memory);
      }
    }

    // Summarize low-importance memories into essential facts
    if (options.summarize) {
      const summary = await this.summarizeMemories(toProcess);
      
      if (summary) {
        // Store summary as new memory
        await this.store(summary, { type: 'fact', importance: 0.3 });
        memoriesSummarized = toProcess.length;
        essentialFactsExtracted = 1;
      }
    }

    // Prune old memories
    for (const memory of toProcess) {
      this.memories.delete(memory.id);
      memoriesPruned++;
      tokensFreed += memory.content.length / 4;
    }

    // Update internal state
    this.memories = new Map(this.memories.entries());

    return {
      memoriesPruned,
      memoriesSummarized,
      tokensFreed: Math.round(tokensFreed),
      essentialFactsExtracted,
    };
  }

  private async summarizeMemories(memories: Memory[]): Promise<string | null> {
    if (memories.length === 0) return null;
    
    // Simple extractive summarization - take first sentence of each
    const sentences = memories
      .map(m => m.content)
      .join(' ')
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 20)
      .slice(0, 5);
    
    return sentences.length > 0 
      ? `Key points from recent interactions: ${sentences.join('. ')}.`
      : null;
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private embed(text: string): number[] {
    // Simple hash-based embedding for demo
    // In production, use actual embedding model
    const hash = text.split('').reduce((acc, char, i) => {
      return acc + char.charCodeAt(0) * (i + 1);
    }, 0);
    
    const dimension = 384;
    const vector = new Array(dimension).fill(0);
    for (let i = 0; i < dimension; i++) {
      vector[i] = Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 2));
    }
    
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / norm);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dot = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ─── Persistence (for SDK use) ─────────────────────────────────────────────
  
  async sync(): Promise<void> {
    // In production, sync with TIMPs backend
    console.log('TIMPs: Syncing state...');
  }
}

// ─── LangChain Integration ──────────────────────────────────────────────────────
export { TIMPs as TIMPsMemory };

// ─── Factory Function ───────────────────────────────────────────────────────────
export function createTIMPs(config: TIMPsConfig): TIMPs {
  return new TIMPs(config);
}
