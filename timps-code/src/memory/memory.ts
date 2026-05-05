// ── TIMPS Code — 3-Layer Memory System ──
// Layer 1: Working memory (current session, in-process)
// Layer 2: Episodic memory (conversation summaries)
// Layer 3: Semantic memory (facts, patterns, conventions — persistent)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { MemoryEntry, EpisodicMemory, WorkingMemory } from '../config/types.js';
import { generateId } from '../utils/utils.js';

export class Memory {
  private dir: string;
  private semanticFile: string;
  private episodicFile: string;
  private workingFile: string;
  private working: WorkingMemory;

  constructor(projectPath: string) {
    this.dir = getMemoryDir(projectPath);
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.episodicFile = path.join(this.dir, 'episodes.jsonl');
    this.workingFile = path.join(this.dir, 'working.json');
    this.working = this.loadWorking();
  }

  // ── Layer 1: Working Memory ──

  get workingMemory(): WorkingMemory { return this.working; }

  setGoal(goal: string): void {
    this.working.currentGoal = goal;
    this.saveWorking();
  }

  trackFile(filePath: string): void {
    if (!this.working.activeFiles.includes(filePath)) {
      this.working.activeFiles.push(filePath);
      if (this.working.activeFiles.length > 20) this.working.activeFiles.shift();
      this.saveWorking();
    }
  }

  trackError(error: string): void {
    this.working.recentErrors.push(error.slice(0, 200));
    if (this.working.recentErrors.length > 10) this.working.recentErrors.shift();
    this.saveWorking();
  }

  trackPattern(pattern: string): void {
    if (!this.working.discoveredPatterns.includes(pattern)) {
      this.working.discoveredPatterns.push(pattern);
      if (this.working.discoveredPatterns.length > 20) this.working.discoveredPatterns.shift();
      this.saveWorking();
    }
  }

  clearWorking(): void {
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    this.saveWorking();
  }

  // ── Layer 2: Episodic Memory ──

  storeEpisode(episode: EpisodicMemory): void {
    fs.appendFileSync(this.episodicFile, JSON.stringify(episode) + '\n', 'utf-8');
    this.trimFile(this.episodicFile, 100);
  }

  loadEpisodes(count = 10): EpisodicMemory[] {
    try {
      if (!fs.existsSync(this.episodicFile)) return [];
      const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
      return lines.slice(-count).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  get episodeCount(): number {
    try {
      if (!fs.existsSync(this.episodicFile)) return 0;
      return fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n').filter(l => l.trim()).length;
    } catch { return 0; }
  }

  // ── Layer 3: Semantic Memory ──

  storeFact(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): void {
    const facts = this.loadSemanticEntries();
    if (facts.some(f => this.similarity(f.content, content) > 0.8)) return; // dedup

    facts.push({
      id: generateId('mem'),
      timestamp: Date.now(),
      type,
      content,
      tags,
    });

    if (facts.length > 500) facts.splice(0, facts.length - 500);
    fs.writeFileSync(this.semanticFile, JSON.stringify(facts, null, 2), 'utf-8');
  }

  searchFacts(query: string, limit = 5): MemoryEntry[] {
    const facts = this.loadSemanticEntries();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    return facts
      .map(f => {
        const contentLower = f.content.toLowerCase();
        const score = queryWords.reduce((acc, w) => acc + (contentLower.includes(w) ? 1 : 0), 0) / queryWords.length;
        return { ...f, score };
      })
      .filter(f => f.score > 0)
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, limit);
  }

  getContextString(task = ''): string {
    const episodes = this.loadEpisodes(5);
    const facts = this.searchFacts(task, 5);
    const parts: string[] = [];

    if (facts.length > 0) {
      parts.push('Relevant memory:\n' + facts.map(f => `• [${f.type}] ${f.content}`).join('\n'));
    }

    if (episodes.length > 0) {
      const recent = episodes.slice(-3);
      parts.push('Recent sessions:\n' + recent.map(e =>
        `• ${new Date(e.timestamp).toLocaleDateString()} — ${e.summary} (${e.outcome})`
      ).join('\n'));
    }

    if (this.working.activeFiles.length > 0) {
      parts.push('Previously active files:\n' + this.working.activeFiles.slice(-10).join('\n'));
    }

    return parts.join('\n\n');
  }

  getStats(): { semanticCount: number; episodeCount: number; workingFiles: number } {
    return {
      semanticCount: this.loadSemanticEntries().length,
      episodeCount: this.episodeCount,
      workingFiles: this.working.activeFiles.length,
    };
  }

  /** Alias for getStats() */
  get stats(): { semanticCount: number; episodeCount: number; workingFiles: number } {
    return this.getStats();
  }

  /** Extract facts from a conversation turn */
  extractFacts(userMessage: string, assistantResponse: string): void {
    // Heuristic: store the pair as a 'pattern' if the response is non-trivial
    const combined = assistantResponse.trim();
    if (combined.length > 50) {
      this.storeFact(combined.slice(0, 300), 'pattern', []);
    }
  }

  /** Simple query against semantic entries */
  query(q: string, limit = 10): MemoryEntry[] {
    return q.trim() ? this.searchFacts(q, limit) : this.loadSemanticEntries().slice(-limit);
  }

  /** Delete all semantic memory entries */
  clearAll(): void {
    try { fs.writeFileSync(this.semanticFile, '[]', 'utf-8'); } catch { /* ignore */ }
    this.clearWorking();
  }

  /** Export all memory data as a JSON string */
  exportMemory(): string {
    return JSON.stringify({
      semantic: this.loadSemanticEntries(),
      episodes: this.loadEpisodes(9999),
      working: this.working,
    }, null, 2);
  }

  /** Import memory data; returns count of imported entries */
  importMemory(data: string): number {
    try {
      const parsed = JSON.parse(data);
      const entries: MemoryEntry[] = parsed.semantic || [];
      fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2), 'utf-8');
      return entries.length;
    } catch { return 0; }
  }

  /** Merge near-duplicate semantic entries; returns number consolidated */
  consolidate(): number {
    const entries = this.loadSemanticEntries();
    const before = entries.length;
    const deduped: MemoryEntry[] = [];
    for (const e of entries) {
      if (!deduped.some(d => this.similarity(d.content, e.content) > 0.85)) {
        deduped.push(e);
      }
    }
    fs.writeFileSync(this.semanticFile, JSON.stringify(deduped, null, 2), 'utf-8');
    return before - deduped.length;
  }

  loadSemanticEntries(): MemoryEntry[] {
    try {
      if (!fs.existsSync(this.semanticFile)) return [];
      return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { return []; }
  }

  private loadWorking(): WorkingMemory {
    try {
      if (!fs.existsSync(this.workingFile)) return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
      return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
    } catch { return { activeFiles: [], recentErrors: [], discoveredPatterns: [] }; }
  }

  private saveWorking(): void {
    fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2), 'utf-8');
  }

  private trimFile(file: string, maxLines: number): void {
    try {
      const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
      if (lines.length > maxLines) {
        fs.writeFileSync(file, lines.slice(-maxLines).join('\n') + '\n', 'utf-8');
      }
    } catch { /* ignore */ }
  }

  private similarity(a: string, b: string): number {
    const al = a.toLowerCase(), bl = b.toLowerCase();
    if (al === bl) return 1;
    const words = new Set(al.split(/\s+/));
    const bWords = bl.split(/\s+/);
    const overlap = bWords.filter(w => words.has(w)).length;
    return overlap / Math.max(words.size, bWords.length);
  }
}
