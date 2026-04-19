// ============================================================
// TIMPS 3-Layer Memory System (ported from timps-code)
// Layer 1: Working  (active session state)
// Layer 2: Episodic (conversation history)  
// Layer 3: Semantic (long-term facts/patterns)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'explicit' | 'reflection' | 'pattern';
  importance: number; // 1-5
  tags: string[];
  accessCount: number;
  confidence: number; // 0-1
  createdAt: string;
  updatedAt: string;
}

export interface EpisodicMemory {
  id: string;
  summary: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: string;
  language?: string;
  fileName?: string;
}

export interface WorkingMemory {
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
  currentGoal?: string;
}

export class TIMPsMemory {
  private dir: string;
  private semanticFile: string;
  private episodicFile: string;
  private workingFile: string;
  private working: WorkingMemory;

  constructor(storagePath: string) {
    this.dir = path.join(storagePath, 'timps-memory');
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.episodicFile = path.join(this.dir, 'episodes.jsonl');
    this.workingFile  = path.join(this.dir, 'working.json');
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  async init(): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    this.working = this.loadWorking();
  }

  // ── Layer 1: Working Memory ──────────────────────────────

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

  // ── Layer 2: Episodic Memory ─────────────────────────────

  storeEpisode(ep: Omit<EpisodicMemory, 'id' | 'timestamp'>): void {
    const entry: EpisodicMemory = {
      id: genId(),
      timestamp: new Date().toISOString(),
      ...ep
    };
    try {
      fs.appendFileSync(this.episodicFile, JSON.stringify(entry) + '\n', 'utf-8');
      this.trimEpisodic(100);
    } catch { }
  }

  loadEpisodes(count = 10): EpisodicMemory[] {
    try {
      if (!fs.existsSync(this.episodicFile)) return [];
      const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
      return lines.slice(-count).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  // ── Layer 3: Semantic Memory ─────────────────────────────

  async store(entry: { content: string; type?: 'explicit' | 'reflection' | 'pattern'; importance?: number; tags?: string[] }): Promise<MemoryEntry> {
    const entries = this.loadSemanticEntries();
    const now = new Date().toISOString();
    const mem: MemoryEntry = {
      id: genId(),
      content: entry.content.slice(0, 500),
      type: entry.type || 'explicit',
      importance: entry.importance || 2,
      tags: entry.tags || [],
      accessCount: 0,
      confidence: 0.8,
      createdAt: now,
      updatedAt: now
    };
    entries.push(mem);
    // Trim to 300 entries, lowest importance first
    if (entries.length > 300) {
      entries.sort((a, b) => b.importance - a.importance);
      entries.splice(300);
    }
    this.saveSemanticEntries(entries);
    return mem;
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    if (!query.trim()) return [];
    const entries = this.loadSemanticEntries();
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = entries.map(e => {
      const text = e.content.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (text.includes(w)) score += w.length * (e.importance || 1);
      }
      return { entry: e, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Update access counts
    if (scored.length > 0) {
      for (const { entry } of scored) {
        entry.accessCount++;
        entry.updatedAt = new Date().toISOString();
      }
      this.saveSemanticEntries(entries);
    }
    return scored.map(x => x.entry);
  }

  async audit(limit = 20): Promise<MemoryEntry[]> {
    const entries = this.loadSemanticEntries();
    return [...entries]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  async forget(keyword: string): Promise<number> {
    const entries = this.loadSemanticEntries();
    const kw = keyword.toLowerCase();
    const before = entries.length;
    const filtered = entries.filter(e => !e.content.toLowerCase().includes(kw) && !e.tags.some(t => t.toLowerCase().includes(kw)));
    if (filtered.length < before) this.saveSemanticEntries(filtered);
    return before - filtered.length;
  }

  async reflect(userMsg: string, response: string): Promise<void> {
    const patterns = [
      /(?:I (?:use|prefer|like|work with|am building|always))\s+(.{5,60})/i,
      /(?:my (?:project|stack|tech|framework|language|preference) is)\s+(.{5,60})/i,
      /(?:remember|important|note):\s+(.{5,100})/i,
    ];
    const combined = `${userMsg} ${response}`;
    for (const p of patterns) {
      const m = combined.match(p);
      if (m?.[0]) {
        await this.store({ content: m[0].slice(0, 300), type: 'reflection', importance: 3, tags: ['auto'] });
        break;
      }
    }
  }

  buildContext(memories: MemoryEntry[], episodes: EpisodicMemory[]): string {
    const parts: string[] = [];
    if (memories.length > 0) {
      parts.push('## TIMPS Memory (long-term)');
      for (const m of memories) {
        parts.push(`- [${m.type}⭐${m.importance}] ${m.content}`);
      }
    }
    if (episodes.length > 0) {
      parts.push('\n## Recent Sessions');
      for (const ep of episodes.slice(-3)) {
        parts.push(`- ${new Date(ep.timestamp).toLocaleDateString()}: ${ep.summary}`);
      }
    }
    if (this.working.activeFiles.length > 0) {
      parts.push(`\n## Active Files\n${this.working.activeFiles.slice(-5).join(', ')}`);
    }
    if (this.working.discoveredPatterns.length > 0) {
      parts.push(`\n## Discovered Patterns\n${this.working.discoveredPatterns.slice(-5).join(', ')}`);
    }
    return parts.join('\n');
  }

  close(): void {
    this.saveWorking();
  }

  // ── Private ───────────────────────────────────────────────

  private loadWorking(): WorkingMemory {
    try {
      if (fs.existsSync(this.workingFile)) return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
    } catch { }
    return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  private saveWorking(): void {
    try { fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2)); } catch { }
  }

  private loadSemanticEntries(): MemoryEntry[] {
    try {
      if (fs.existsSync(this.semanticFile)) return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { }
    return [];
  }

  private saveSemanticEntries(entries: MemoryEntry[]): void {
    try { fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2)); } catch { }
  }

  private trimEpisodic(max: number): void {
    try {
      const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
      if (lines.length > max) fs.writeFileSync(this.episodicFile, lines.slice(-max).join('\n') + '\n');
    } catch { }
  }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
