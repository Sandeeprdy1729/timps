// ── 3-Layer Memory System ──
// Layer 1: Working memory (current session, in-process)
// Layer 2: Episodic memory (conversation summaries, what happened)
// Layer 3: Semantic memory (facts, patterns, conventions — long-term)
// All stored as plain JSON — proven most effective for AI agents

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

  // ── Layer 1: Working Memory (current session) ──

  get workingMemory(): WorkingMemory {
    return this.working;
  }

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
    this.working.recentErrors.push(error);
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

  // ── Layer 2: Episodic Memory (conversation history) ──

  storeEpisode(episode: EpisodicMemory): void {
    const line = JSON.stringify(episode) + '\n';
    fs.appendFileSync(this.episodicFile, line, 'utf-8');
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

  // ── Layer 3: Semantic Memory (long-term knowledge) ──

  storeFact(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): void {
    const facts = this.loadSemanticEntries();
    // Deduplicate
    if (facts.some(f => this.similarity(f.content, content) > 0.8)) return;

    facts.push({
      id: generateId('mem'),
      timestamp: Date.now(),
      type,
      content,
      tags,
      confidence: 1.0,
      accessCount: 0,
    });

    // Cap at 1000 entries — NEVER silently truncate
    // Remove lowest-confidence entries first, warn user
    if (facts.length > 1000) {
      facts.sort((a, b) => b.confidence - a.confidence);
      const removed = facts.length - 1000;
      facts.length = 1000;
      console.log(`  ⚠ Memory limit: pruned ${removed} low-confidence entries (1000 max, ${facts.length} kept)`);
    }
    this.saveSemanticEntries(facts);
  }

  loadSemanticEntries(): MemoryEntry[] {
    try {
      if (!fs.existsSync(this.semanticFile)) return [];
      return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { return []; }
  }

  get factCount(): number {
    return this.loadSemanticEntries().length;
  }

  // ── Query: retrieve relevant memories ──

  query(queryText: string, maxResults = 15): MemoryEntry[] {
    const all = this.loadSemanticEntries();
    if (all.length === 0) return [];

    // Score by keyword overlap + recency + confidence
    const queryWords = new Set(queryText.toLowerCase().split(/\s+/));
    const scored = all.map(entry => {
      const entryWords = entry.content.toLowerCase().split(/\s+/);
      let keywordScore = 0;
      for (const w of entryWords) {
        if (queryWords.has(w)) keywordScore++;
      }
      const recencyScore = 1 - Math.min(1, (Date.now() - entry.timestamp) / (90 * 24 * 3600 * 1000));
      const total = keywordScore * 3 + recencyScore + entry.confidence + (entry.accessCount * 0.1);
      return { entry, score: total };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, maxResults).filter(s => s.score > 0.5).map(s => s.entry);

    // Bump access count for retrieved entries
    if (results.length > 0) {
      const allEntries = this.loadSemanticEntries();
      const resultIds = new Set(results.map(r => r.id));
      for (const e of allEntries) {
        if (resultIds.has(e.id)) e.accessCount++;
      }
      this.saveSemanticEntries(allEntries);
    }

    return results;
  }

  // ── Decay: reduce confidence over time ──

  decay(): void {
    const entries = this.loadSemanticEntries();
    const now = Date.now();
    let changed = false;
    for (const e of entries) {
      const ageInDays = (now - e.timestamp) / (24 * 3600 * 1000);
      if (ageInDays > 7 && e.accessCount < 2) {
        e.confidence = Math.max(0.1, e.confidence - 0.05);
        changed = true;
      }
    }
    if (changed) this.saveSemanticEntries(entries);
  }

  // ── Build context string for system prompt injection ──

  getContextString(currentQuery?: string): string {
    const parts: string[] = [];

    // Working memory
    if (this.working.currentGoal) {
      parts.push(`CURRENT GOAL: ${this.working.currentGoal}`);
    }
    if (this.working.activeFiles.length > 0) {
      parts.push(`RECENTLY ACTIVE FILES: ${this.working.activeFiles.slice(-8).join(', ')}`);
    }
    if (this.working.recentErrors.length > 0) {
      parts.push(`RECENT ERRORS (avoid repeating):\n${this.working.recentErrors.slice(-3).map(e => `• ${e}`).join('\n')}`);
    }
    if (this.working.discoveredPatterns.length > 0) {
      parts.push(`DISCOVERED PATTERNS:\n${this.working.discoveredPatterns.slice(-5).map(p => `• ${p}`).join('\n')}`);
    }

    // Semantic memory — query-relevant facts
    const relevantFacts = currentQuery ? this.query(currentQuery, 10) : this.loadSemanticEntries().slice(-10);
    if (relevantFacts.length > 0) {
      parts.push('PROJECT KNOWLEDGE (learned from past sessions):');
      for (const f of relevantFacts) {
        const age = Math.round((Date.now() - f.timestamp) / (24 * 3600 * 1000));
        const ageStr = age === 0 ? 'today' : `${age}d ago`;
        parts.push(`• [${f.type}|${ageStr}] ${f.content}`);
      }
    }

    // Recent episodes
    const episodes = this.loadEpisodes(3);
    if (episodes.length > 0) {
      parts.push('RECENT SESSIONS:');
      for (const ep of episodes) {
        parts.push(`• [${new Date(ep.timestamp).toLocaleDateString()}] ${ep.summary} (${ep.outcome})`);
      }
    }

    return parts.join('\n\n');
  }

  // ── Extract & store from conversation ──

  extractFacts(userMessage: string, assistantResponse: string): void {
    // Architecture decisions
    const patterns = [
      /(?:using|uses|built with|stack includes?|framework is)\s+([A-Za-z][A-Za-z0-9 ./-]{3,50})/gi,
      /(?:decided to|approach is to|pattern is|convention is)\s+(.{10,100})/gi,
      /(?:the (?:project|app|codebase) (?:uses?|has|follows?))\s+(.{10,80})/gi,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(assistantResponse)) !== null) {
        this.storeFact(m[0].trim(), 'architecture');
      }
    }

    // Coding conventions — extract patterns for consistency
    const conventionPatterns = [
      /(?:always|must|should|convention|standard|rule|style)[:\s]+(.{15,120})/gi,
      /(?:naming convention|file structure|folder structure|import style|export style)\s+(?:is|:)\s+(.{10,100})/gi,
      /(?:we use|project uses|prefer|template)\s+([\w\s]+(?:for|to|as)\s+.{10,80})/gi,
    ];
    for (const re of conventionPatterns) {
      let m;
      while ((m = re.exec(assistantResponse)) !== null) {
        this.storeFact(m[0].trim(), 'convention');
      }
    }

    // Error lessons
    if (assistantResponse.match(/(?:fix|fixed|error was|bug was|issue was|problem was)/i)) {
      const errorPatterns = /(?:fix|fixed|resolved|the (?:error|bug|issue|problem) was)\s+(.{15,120})/gi;
      let m;
      while ((m = errorPatterns.exec(assistantResponse)) !== null) {
        this.storeFact(m[0].trim(), 'error_lesson');
      }
    }

    // Track files mentioned
    const fileRe = /(?:^|\s)((?:[\w.-]+\/)*[\w.-]+\.[a-z]{1,6})(?:\s|$|[,;:])/gm;
    let fm;
    while ((fm = fileRe.exec(assistantResponse)) !== null) {
      this.trackFile(fm[1]);
    }
  }

  // ── Clear all memory ──

  clearAll(): void {
    try { fs.unlinkSync(this.semanticFile); } catch { /* ok */ }
    try { fs.unlinkSync(this.episodicFile); } catch { /* ok */ }
    try { fs.unlinkSync(this.workingFile); } catch { /* ok */ }
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  // ── Stats ──

  stats(): { facts: number; episodes: number; patterns: number; errors: number } {
    const entries = this.loadSemanticEntries();
    return {
      facts: entries.length,
      episodes: this.episodeCount,
      patterns: this.working.discoveredPatterns.length,
      errors: this.working.recentErrors.length,
    };
  }

  // ── Export/Import (TIMPS memory portability) ──

  exportMemory(): { semantic: MemoryEntry[]; episodes: EpisodicMemory[]; working: WorkingMemory } {
    return {
      semantic: this.loadSemanticEntries(),
      episodes: this.loadEpisodes(100),
      working: this.working,
    };
  }

  importMemory(data: { semantic?: MemoryEntry[]; episodes?: EpisodicMemory[] }): number {
    let imported = 0;
    if (data.semantic) {
      for (const entry of data.semantic) {
        const existing = this.loadSemanticEntries();
        if (!existing.some(e => this.similarity(e.content, entry.content) > 0.8)) {
          this.storeFact(entry.content, entry.type, entry.tags);
          imported++;
        }
      }
    }
    if (data.episodes) {
      for (const ep of data.episodes) {
        this.storeEpisode(ep);
        imported++;
      }
    }
    return imported;
  }

  // ── Consolidation: merge near-duplicate facts ──

  consolidate(): number {
    const entries = this.loadSemanticEntries();
    const merged: MemoryEntry[] = [];
    const used = new Set<number>();
    let mergedCount = 0;

    for (let i = 0; i < entries.length; i++) {
      if (used.has(i)) continue;
      const entry = { ...entries[i] };

      for (let j = i + 1; j < entries.length; j++) {
        if (used.has(j)) continue;
        if (this.similarity(entry.content, entries[j].content) > 0.6) {
          // Merge: keep the more confident / more accessed one
          entry.confidence = Math.max(entry.confidence, entries[j].confidence);
          entry.accessCount += entries[j].accessCount;
          entry.tags = [...new Set([...entry.tags, ...entries[j].tags])];
          used.add(j);
          mergedCount++;
        }
      }
      merged.push(entry);
    }

    if (mergedCount > 0) this.saveSemanticEntries(merged);
    return mergedCount;
  }

  // ── Private ──

  private loadWorking(): WorkingMemory {
    try {
      if (fs.existsSync(this.workingFile)) {
        return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
  }

  private saveWorking(): void {
    fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2), 'utf-8');
  }

  private saveSemanticEntries(entries: MemoryEntry[]): void {
    fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2), 'utf-8');
  }

  private trimFile(filePath: string, maxLines: number): void {
    try {
      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      if (lines.length > maxLines) {
        fs.writeFileSync(filePath, lines.slice(-maxLines).join('\n') + '\n', 'utf-8');
      }
    } catch { /* ok */ }
  }

  private similarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    if (setA.size === 0 && setB.size === 0) return 1;
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection++;
    return (2 * intersection) / (setA.size + setB.size);
  }
}
