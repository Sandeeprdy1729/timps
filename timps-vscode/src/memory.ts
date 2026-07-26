// ============================================================
// TIMPS Memory Adapter — bridges VS Code to shared memory-core
// Stores in ~/.timps/memory/<projectHash>/ (same as CLI/MCP)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ── Shared types (mirrors @timps/memory-core/src/types.ts) ──

type SharedEntryType = 'fact' | 'pattern' | 'preference' | 'error' | 'convention' | 'bug' | 'incident' | 'architecture' | 'decision';

interface SharedSemanticEntry {
  id: string;
  timestamp: number;
  type: SharedEntryType;
  content: string;
  tags: string[];
}

interface SharedEpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  durationMs?: number;
  errorCount?: number;
  tags?: string[];
}

interface SharedWorkingState {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

// ── VS Code adapter types (backward-compatible API) ──

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'explicit' | 'reflection' | 'pattern';
  importance: number;
  tags: string[];
  accessCount: number;
  confidence: number;
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

// ── Helpers ──

function projectHash(projectPath: string): string {
  return crypto.createHash('sha256').update(path.resolve(projectPath)).digest('hex').slice(0, 12);
}

function genId(): string {
  return `mem_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function genEpisodeId(): string {
  return `ep_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

/** Map adapter type → shared type */
function toSharedType(t: MemoryEntry['type']): SharedEntryType {
  switch (t) {
    case 'explicit': return 'fact';
    case 'reflection': return 'pattern';
    case 'pattern': return 'pattern';
    default: return 'fact';
  }
}

/** Map shared type → adapter type */
function fromSharedType(t: SharedEntryType): MemoryEntry['type'] {
  switch (t) {
    case 'fact': return 'explicit';
    case 'pattern': return 'pattern';
    case 'preference': return 'explicit';
    case 'error': return 'explicit';
    case 'convention': return 'pattern';
    case 'bug': return 'explicit';
    case 'incident': return 'explicit';
    case 'architecture': return 'pattern';
    case 'decision': return 'explicit';
    default: return 'explicit';
  }
}

// ── Main Adapter ──

export class TIMPsMemory {
  private dir: string;
  private semanticFile: string;
  private episodicFile: string;
  private workingFile: string;
  private working: WorkingMemory;

  constructor(storagePath: string) {
    // Compute project hash from workspace root → same dir as CLI/MCP
    const hash = projectHash(storagePath);
    this.dir = path.join(os.homedir(), '.timps', 'memory', hash);
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.episodicFile = path.join(this.dir, 'episodes.json');
    this.workingFile = path.join(this.dir, 'working.json');
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  getStorageDir(): string { return this.dir; }

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
    const entry: SharedEpisodicEntry = {
      id: genEpisodeId(),
      timestamp: Date.now(),
      summary: ep.summary,
      outcome: 'success',
      tags: ['vscode'],
    };
    try {
      const episodes = this.loadSharedEpisodes();
      episodes.push(entry);
      if (episodes.length > 200) episodes.splice(0, episodes.length - 200);
      fs.writeFileSync(this.episodicFile, JSON.stringify(episodes, null, 2));
    } catch { }
  }

  loadEpisodes(count = 10): EpisodicMemory[] {
    try {
      const episodes = this.loadSharedEpisodes();
      return episodes.slice(-count).map(ep => ({
        id: ep.id,
        summary: ep.summary,
        userMessage: '',
        assistantResponse: '',
        timestamp: new Date(ep.timestamp).toISOString(),
      }));
    } catch { return []; }
  }

  // ── Layer 3: Semantic Memory ─────────────────────────────

  async store(entry: { content: string; type?: 'explicit' | 'reflection' | 'pattern'; importance?: number; tags?: string[] }): Promise<MemoryEntry> {
    const entries = this.loadSemanticEntries();
    const now = Date.now();
    const shared: SharedSemanticEntry = {
      id: genId(),
      timestamp: now,
      type: toSharedType(entry.type || 'explicit'),
      content: entry.content.slice(0, 500),
      tags: entry.tags || [],
    };
    entries.push(shared);
    if (entries.length > 1000) {
      entries.sort((a, b) => a.timestamp - b.timestamp);
      entries.splice(0, entries.length - 1000);
    }
    this.saveSemanticEntries(entries);
    return this.toAdapterEntry(shared, entry.importance || 2);
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    if (!query.trim()) return [];
    const entries = this.loadSemanticEntries();
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = entries.map(e => {
      const text = e.content.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (text.includes(w)) score += w.length;
      }
      return { entry: e, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(x => this.toAdapterEntry(x.entry));
  }

  async audit(limit = 20): Promise<MemoryEntry[]> {
    const entries = this.loadSemanticEntries();
    return [...entries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(e => this.toAdapterEntry(e));
  }

  async forget(keyword: string): Promise<number> {
    const entries = this.loadSemanticEntries();
    const kw = keyword.toLowerCase();
    const before = entries.length;
    const filtered = entries.filter(e =>
      !e.content.toLowerCase().includes(kw) && !e.tags.some(t => t.toLowerCase().includes(kw))
    );
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

  getStats(): { semanticCount: number; episodeCount: number; workingFiles: number } {
    const semantic = this.loadSemanticEntries();
    const episodes = this.loadSharedEpisodes();
    return {
      semanticCount: semantic.length,
      episodeCount: episodes.length,
      workingFiles: this.working.activeFiles.length,
    };
  }

  getSemanticEntries(): MemoryEntry[] {
    return this.loadSemanticEntries().map(e => this.toAdapterEntry(e));
  }

  // ── Private: Shared format I/O ───────────────────────────

  private toAdapterEntry(shared: SharedSemanticEntry, importance = 2): MemoryEntry {
    return {
      id: shared.id,
      content: shared.content,
      type: fromSharedType(shared.type),
      importance,
      tags: shared.tags,
      accessCount: 0,
      confidence: 0.8,
      createdAt: new Date(shared.timestamp).toISOString(),
      updatedAt: new Date(shared.timestamp).toISOString(),
    };
  }

  private loadWorking(): WorkingMemory {
    try {
      if (fs.existsSync(this.workingFile)) return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
    } catch { }
    return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  private saveWorking(): void {
    try { fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2)); } catch { }
  }

  private loadSemanticEntries(): SharedSemanticEntry[] {
    try {
      if (fs.existsSync(this.semanticFile)) return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { }
    return [];
  }

  private saveSemanticEntries(entries: SharedSemanticEntry[]): void {
    try { fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2)); } catch { }
  }

  private loadSharedEpisodes(): SharedEpisodicEntry[] {
    try {
      if (fs.existsSync(this.episodicFile)) return JSON.parse(fs.readFileSync(this.episodicFile, 'utf-8'));
    } catch { }
    return [];
  }
}
