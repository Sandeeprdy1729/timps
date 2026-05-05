// autoDream.ts - Background Memory Consolidation
// Automatic memory optimization during idle periods

import type { Memory } from '../memory/memory.js';
import type { ModelProvider } from '../config/types.js';

export interface DreamConfig {
  enabled: boolean;
  intervalMs: number;
  minIdleMs: number;
  consolidationThreshold: number;
}

const DEFAULT_CONFIG: DreamConfig = {
  enabled: true,
  intervalMs: 5 * 60 * 1000,
  minIdleMs: 30 * 1000,
  consolidationThreshold: 50,
};

export interface DreamResult {
  consolidated: number;
  pruned: number;
  improved: number;
  duration: number;
}

export class AutoDream {
  private config: DreamConfig;
  private memory: Memory | null = null;
  private provider: ModelProvider | null = null;
  private lastActivity: number = Date.now();
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private pendingOperations: Array<() => Promise<void>> = [];

  constructor(config: Partial<DreamConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setMemory(memory: Memory): void {
    this.memory = memory;
  }

  setProvider(provider: ModelProvider): void {
    this.provider = provider;
  }

  start(): void {
    if (this.isRunning || !this.config.enabled) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), this.config.intervalMs);
    console.log('[AutoDream] Started memory consolidation service');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AutoDream] Stopped memory consolidation service');
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  private async tick(): Promise<void> {
    const idleTime = Date.now() - this.lastActivity;
    
    if (idleTime < this.config.minIdleMs) {
      return;
    }

    console.log('[AutoDream] Starting consolidation cycle...');
    const result = await this.consolidate();
    console.log(`[AutoDream] Cycle complete: ${result.consolidated} consolidated, ${result.pruned} pruned, ${result.improved} improved`);
  }

  async consolidate(): Promise<DreamResult> {
    const startTime = Date.now();
    let consolidated = 0;
    let pruned = 0;
    let improved = 0;

    if (!this.memory) {
      return { consolidated, pruned, improved, duration: Date.now() - startTime };
    }

    try {
      const entries = this.memory.loadSemanticEntries();
      
      if (entries.length >= this.config.consolidationThreshold) {
        const mergeCount = this.memory.consolidate();
        consolidated = mergeCount;
      }

      const decayCount = this.applyDecay();
      pruned = decayCount;

      if (this.provider) {
        const improveCount = await this.enhanceWithLLM();
        improved = improveCount;
      }
    } catch (err) {
      console.warn('[AutoDream] Consolidation error:', err);
    }

    return { consolidated, pruned, improved, duration: Date.now() - startTime };
  }

  private applyDecay(): number {
    if (!this.memory) return 0;

    const entries = this.memory.loadSemanticEntries();
    let decayed = 0;

    for (const entry of entries) {
      const ageInDays = (Date.now() - entry.timestamp) / (24 * 3600 * 1000);
      
      if (ageInDays > 14 && (entry.accessCount ?? 0) < 2) {
        entry.confidence = Math.max(0.1, (entry.confidence ?? 1) - 0.1);
        decayed++;
      }
    }

    return decayed;
  }

  private async enhanceWithLLM(): Promise<number> {
    if (!this.memory || !this.provider) return 0;

    const entries = this.memory.loadSemanticEntries();
    let enhanced = 0;

    const staleEntries = entries.filter(e => {
      const ageInDays = (Date.now() - e.timestamp) / (24 * 3600 * 1000);
      return ageInDays > 7 && (e.confidence ?? 1) < 0.7;
    });

    for (const entry of staleEntries.slice(0, 5)) {
      try {
        const prompt = `Analyze this memory entry and determine if it's still relevant or should be updated/pruned:

Entry: ${entry.content}
Type: ${entry.type}
Confidence: ${entry.confidence}
Age: ${Math.round((Date.now() - entry.timestamp) / (24 * 3600 * 1000))} days
Access count: ${entry.accessCount}

Return JSON with:
{
  "action": "keep|update|prune",
  "updated_content": "optional updated version",
  "reason": "explanation"
}`;

        const response = await this.callLLM(prompt);
        
        if (response.action === 'update' && response.updated_content) {
          const idx = entries.findIndex(e => e.id === entry.id);
          if (idx !== -1) {
            entries[idx].content = response.updated_content;
            entries[idx].confidence = Math.min(1, (entry.confidence ?? 1) + 0.1);
            enhanced++;
          }
        } else if (response.action === 'prune') {
          const idx = entries.findIndex(e => e.id === entry.id);
          if (idx !== -1) {
            entries.splice(idx, 1);
          }
        }
      } catch {
        // Best effort enhancement
      }
    }

    return enhanced;
  }

  private async callLLM(prompt: string): Promise<{ action: string; updated_content?: string; reason: string }> {
    if (!this.provider) {
      return { action: 'keep', reason: 'no provider' };
    }

    try {
      let response = '';
      for await (const event of this.provider.stream(
        [{ role: 'user', content: prompt }],
        []
      )) {
        if (event.type === 'text') {
          response += event.content;
        }
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { action: 'keep', reason: 'parse error' };
  }

  getStats(): { isRunning: boolean; lastActivity: number; config: DreamConfig } {
    return {
      isRunning: this.isRunning,
      lastActivity: this.lastActivity,
      config: this.config,
    };
  }

  scheduleOperation(op: () => Promise<void>): void {
    this.pendingOperations.push(op);
  }

  async flushOperations(): Promise<void> {
    for (const op of this.pendingOperations) {
      try {
        await op();
      } catch (err) {
        console.warn('[AutoDream] Pending operation error:', err);
      }
    }
    this.pendingOperations = [];
  }
}

export const autoDream = new AutoDream();
