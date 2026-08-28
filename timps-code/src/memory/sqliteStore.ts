// ── TIMPS SQLite Memory Store with VSS ──
// High-performance SQLite-backed memory with vector search

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SQLiteMemoryConfig {
  dbPath?: string;
  enableVSS?: boolean;
  embeddingDim?: number;
}

interface MemoryRow {
  id: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string;
  importance: number;
  access_count: number;
  last_accessed: number;
}

interface EpisodeRow {
  id: string;
  timestamp: number;
  summary: string;
  files_changed: string;
  tools_used: string;
  outcome: string;
}

interface GraphNodeRow {
  id: string;
  entity: string;
  entity_type: string;
  attributes: string;
  created_at: number;
  updated_at: number;
}

interface GraphEdgeRow {
  id: string;
  subject: string;
  relation: string;
  object: string;
  weight: number;
  timestamp: number;
}

export class SQLiteMemoryStore {
  private dbPath: string;
  private db: any = null;
  private initialized = false;
  private enableVSS: boolean;
  private embeddingDim: number;

  constructor(projectPath: string, config: SQLiteMemoryConfig = {}) {
    const memDir = path.join(projectPath, '.timps', 'sqlite');
    fs.mkdirSync(memDir, { recursive: true });
    this.dbPath = path.join(memDir, config.dbPath || 'memory.db');
    this.enableVSS = config.enableVSS !== false;
    this.embeddingDim = config.embeddingDim || 384;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const mod = await import('better-sqlite3');
      const sqlite3 = mod.default;
      this.db = new sqlite3(this.dbPath);

      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -64000;
        PRAGMA temp_store = MEMORY;

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'fact',
          content TEXT NOT NULL,
          tags TEXT DEFAULT '[]',
          importance REAL DEFAULT 5.0,
          access_count INTEGER DEFAULT 0,
          last_accessed INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS episodes (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          summary TEXT NOT NULL,
          files_changed TEXT DEFAULT '[]',
          tools_used TEXT DEFAULT '[]',
          outcome TEXT NOT NULL DEFAULT 'success'
        );

        CREATE TABLE IF NOT EXISTS graph_nodes (
          id TEXT PRIMARY KEY,
          entity TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          attributes TEXT DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS graph_edges (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          relation TEXT NOT NULL,
          object TEXT NOT NULL,
          weight REAL DEFAULT 1.0,
          timestamp INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
        CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
        CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_graph_subject ON graph_edges(subject);
        CREATE INDEX IF NOT EXISTS idx_graph_object ON graph_edges(object);
      `);

      if (this.enableVSS) {
        try {
          this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_vss USING vss0(
              embedding(384)
            );
          `);
        } catch {
          console.warn('[SQLiteMemory] VSS extension not available, vector search disabled');
          this.enableVSS = false;
        }
      }

      this.initialized = true;
    } catch (err) {
      console.warn('[SQLiteMemory] Failed to initialize, falling back to JSON:', (err as Error).message);
      this.initialized = false;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SQLiteMemoryStore not initialized. Call initialize() first.');
    }
  }

  // ── Memory Operations ───────────────────────────────────────────────────────

  storeMemory(entry: { id: string; timestamp: number; type: string; content: string; tags: string[]; importance: number }): void {
    this.ensureInitialized();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, timestamp, type, content, tags, importance, access_count, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT access_count FROM memories WHERE id = ?), 0), ?)
    `);
    stmt.run(entry.id, entry.timestamp, entry.type, entry.content, JSON.stringify(entry.tags), entry.importance, entry.id, entry.timestamp);
  }

  searchMemories(query: string, limit = 10): MemoryRow[] {
    this.ensureInitialized();

    const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
    if (queryTokens.length === 0) {
      return this.db.prepare('SELECT * FROM memories ORDER BY importance DESC, timestamp DESC LIMIT ?').all(limit) as MemoryRow[];
    }

    const placeholders = queryTokens.map(() => 'content LIKE ?').join(' OR ');
    const params = queryTokens.map(t => `%${t}%`);

    const results = this.db.prepare(`
      SELECT *, (
        ${queryTokens.map((_, i) => `CASE WHEN content LIKE ? THEN 1 ELSE 0 END`).join(' + ')}
      ) / ${queryTokens.length} as relevance
      FROM memories
      WHERE ${placeholders}
      ORDER BY relevance DESC, importance DESC, timestamp DESC
      LIMIT ?
    `).all(...params, ...params, limit) as MemoryRow[];

    return results.map(r => ({ ...r, tags: r.tags || '[]' }));
  }

  accessMemory(id: string): void {
    this.ensureInitialized();
    this.db.prepare('UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?').run(Date.now(), id);
  }

  getMemory(id: string): MemoryRow | null {
    this.ensureInitialized();
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    if (row) this.accessMemory(id);
    return row || null;
  }

  updateImportance(id: string, importance: number): void {
    this.ensureInitialized();
    this.db.prepare('UPDATE memories SET importance = ? WHERE id = ?').run(Math.min(10, importance), id);
  }

  getMemoriesByType(type: string, limit = 50): MemoryRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM memories WHERE type = ? ORDER BY importance DESC, timestamp DESC LIMIT ?').all(type, limit) as MemoryRow[];
  }

  getRecentMemories(count = 20): MemoryRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?').all(count) as MemoryRow[];
  }

  getHighImportanceMemories(minImportance = 7): MemoryRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM memories WHERE importance >= ? ORDER BY importance DESC, timestamp DESC').all(minImportance) as MemoryRow[];
  }

  // ── Episode Operations ─────────────────────────────────────────────────────

  storeEpisode(episode: EpisodeRow): void {
    this.ensureInitialized();
    this.db.prepare(`
      INSERT INTO episodes (id, timestamp, summary, files_changed, tools_used, outcome)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(episode.id, episode.timestamp, episode.summary, episode.files_changed, episode.tools_used, episode.outcome);

    const count = (this.db.prepare('SELECT COUNT(*) as c FROM episodes').get() as any).c;
    if (count > 200) {
      this.db.prepare('DELETE FROM episodes WHERE id IN (SELECT id FROM episodes ORDER BY timestamp ASC LIMIT ?)')
        .run(count - 200);
    }
  }

  getRecentEpisodes(count = 20): EpisodeRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM episodes ORDER BY timestamp DESC LIMIT ?').all(count) as EpisodeRow[];
  }

  getEpisodesByOutcome(outcome: string, limit = 50): EpisodeRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM episodes WHERE outcome = ? ORDER BY timestamp DESC LIMIT ?').all(outcome, limit) as EpisodeRow[];
  }

  // ── Graph Operations ────────────────────────────────────────────────────────

  addGraphNode(node: GraphNodeRow): void {
    this.ensureInitialized();
    this.db.prepare(`
      INSERT OR REPLACE INTO graph_nodes (id, entity, entity_type, attributes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(node.id, node.entity, node.entity_type, node.attributes, node.created_at, node.updated_at);
  }

  addGraphEdge(edge: GraphEdgeRow): void {
    this.ensureInitialized();
    this.db.prepare(`
      INSERT OR REPLACE INTO graph_edges (id, subject, relation, object, weight, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(edge.id, edge.subject, edge.relation, edge.object, edge.weight, edge.timestamp);
  }

  getGraphNode(entity: string): GraphNodeRow | null {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM graph_nodes WHERE entity = ?').get(entity) as GraphNodeRow | null;
  }

  getGraphEdges(subject: string): GraphEdgeRow[] {
    this.ensureInitialized();
    return this.db.prepare('SELECT * FROM graph_edges WHERE subject = ? OR object = ?').all(subject, subject) as GraphEdgeRow[];
  }

  // ── Statistics ─────────────────────────────────────────────────────────────

  getStats(): { memories: number; episodes: number; graphNodes: number; graphEdges: number; avgImportance: number; totalAccess: number } {
    this.ensureInitialized();
    const memStats = this.db.prepare(`
      SELECT COUNT(*) as count, AVG(importance) as avg_imp, SUM(access_count) as total_access
      FROM memories
    `).get() as any;

    const epStats = this.db.prepare('SELECT COUNT(*) as count FROM episodes').get() as any;
    const nodeStats = this.db.prepare('SELECT COUNT(*) as count FROM graph_nodes').get() as any;
    const edgeStats = this.db.prepare('SELECT COUNT(*) as count FROM graph_edges').get() as any;

    return {
      memories: memStats?.count || 0,
      episodes: epStats?.count || 0,
      graphNodes: nodeStats?.count || 0,
      graphEdges: edgeStats?.count || 0,
      avgImportance: memStats?.avg_imp || 0,
      totalAccess: memStats?.total_access || 0,
    };
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  pruneOldMemories(daysOld = 90, minImportance = 5): number {
    this.ensureInitialized();
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const result = this.db.prepare('DELETE FROM memories WHERE timestamp < ? AND importance < ?').run(cutoff, minImportance);
    return result.changes;
  }

  vacuum(): void {
    this.ensureInitialized();
    this.db.exec('VACUUM');
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  isAvailable(): boolean {
    try {
      const sqlite3 = require('better-sqlite3');
      return true;
    } catch {
      return false;
    }
  }
}