// ── TIMPS Memory Dashboard — API server ──
// Reads the 9-layer memory from disk and exposes it as REST JSON for the sigma.js graph.
// PORT: 3742 (default) or process.env.MEMORY_DASH_PORT

import express from 'express';
import cors from 'cors';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const PORT = parseInt(process.env.MEMORY_DASH_PORT ?? '3742', 10);
const PROJECT_PATH = process.env.PROJECT_PATH ?? process.cwd();

// ── Memory file paths (mirrors @timps/memory-core storage.ts) ──
function projectHash(p: string): string {
  return crypto.createHash('sha256').update(path.resolve(p)).digest('hex').slice(0, 12);
}

function memoryRoot(projectPath: string): string {
  return path.join(os.homedir(), '.timps', 'memory', projectHash(projectPath));
}

// ── Types (duplicated to avoid requiring ESM build of memory-core in CJS server) ──
interface MemoryEntry {
  id: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string[];
  score?: number;
}

interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  durationMs?: number;
  errorCount?: number;
  tags?: string[];
}

interface WorkingState {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

// ── Loaders ──
function loadSemantic(dir: string): MemoryEntry[] {
  try {
    const f = path.join(dir, 'semantic.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8')) as MemoryEntry[];
  } catch { /* ignore */ }
  return [];
}

function loadEpisodes(dir: string, count = 50): EpisodicEntry[] {
  try {
    const f = path.join(dir, 'episodes.json');
    if (!fs.existsSync(f)) return [];
    const all = JSON.parse(fs.readFileSync(f, 'utf-8')) as EpisodicEntry[];
    return all.slice(-count).reverse();
  } catch { /* ignore */ }
  return [];
}

function loadWorking(dir: string): WorkingState {
  try {
    const f = path.join(dir, 'working.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8')) as WorkingState;
  } catch { /* ignore */ }
  return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
}

// ── Graph builder ──
// Nodes: semantic entries + episode nodes + tag nodes
// Edges: entry→tag (shares tag), entry→entry (same type cluster), episode→semantic (episode references tags)

export interface GraphNode {
  id: string;
  label: string;
  type: 'semantic' | 'episode' | 'tag' | 'working';
  category: string;
  size: number;
  color: string;
  x?: number;
  y?: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    semanticCount: number;
    episodeCount: number;
    tagCount: number;
    edgeCount: number;
    projectHash: string;
    projectPath: string;
    generatedAt: number;
  };
}

const TYPE_COLORS: Record<string, string> = {
  fact: '#6366f1',
  pattern: '#10b981',
  preference: '#f59e0b',
  error: '#ef4444',
  convention: '#8b5cf6',
  bug: '#dc2626',
  incident: '#f97316',
  architecture: '#0ea5e9',
  episode: '#64748b',
  tag: '#94a3b8',
  working: '#22d3ee',
};

function buildGraph(dir: string, projectPath: string): GraphData {
  const semantic = loadSemantic(dir);
  const episodes = loadEpisodes(dir, 30);
  const working = loadWorking(dir);
  const hash = projectHash(projectPath);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let edgeSeq = 0;

  const tagMap = new Map<string, string>(); // tag text → node id

  // ── Semantic nodes ──
  for (const entry of semantic) {
    nodes.push({
      id: entry.id,
      label: entry.content.slice(0, 60) + (entry.content.length > 60 ? '…' : ''),
      type: 'semantic',
      category: entry.type,
      size: 6 + Math.min((entry.score ?? 0) * 4, 12),
      color: TYPE_COLORS[entry.type] ?? '#6366f1',
      metadata: { content: entry.content, type: entry.type, tags: entry.tags, timestamp: entry.timestamp },
    });

    // Tag nodes + entry→tag edges
    for (const tag of entry.tags) {
      const tagKey = `tag_${tag}`;
      if (!tagMap.has(tag)) {
        tagMap.set(tag, tagKey);
        nodes.push({
          id: tagKey,
          label: `#${tag}`,
          type: 'tag',
          category: 'tag',
          size: 4,
          color: TYPE_COLORS.tag,
          metadata: { tag },
        });
      }
      edges.push({ id: `e${edgeSeq++}`, source: entry.id, target: tagKey, weight: 0.5 });
    }
  }

  // ── Episode nodes ──
  for (const ep of episodes) {
    const epId = ep.id ?? `ep_${ep.timestamp}`;
    const outcomeColor: Record<string, string> = { success: '#10b981', failure: '#ef4444', partial: '#f59e0b', unknown: '#64748b' };
    nodes.push({
      id: epId,
      label: ep.summary.slice(0, 50) + (ep.summary.length > 50 ? '…' : ''),
      type: 'episode',
      category: ep.outcome,
      size: 8,
      color: outcomeColor[ep.outcome] ?? TYPE_COLORS.episode,
      metadata: { summary: ep.summary, outcome: ep.outcome, timestamp: ep.timestamp, durationMs: ep.durationMs },
    });

    // Episode→tag edges (if tags present)
    for (const tag of ep.tags ?? []) {
      if (tagMap.has(tag)) {
        edges.push({ id: `e${edgeSeq++}`, source: epId, target: tagMap.get(tag)!, weight: 0.3, label: 'via-tag' });
      }
    }
  }

  // ── Working memory node ──
  if (working.currentGoal || working.activeFiles.length > 0) {
    nodes.push({
      id: 'working_now',
      label: working.currentGoal ? `⚡ ${working.currentGoal.slice(0, 40)}` : '⚡ Working Memory',
      type: 'working',
      category: 'working',
      size: 14,
      color: TYPE_COLORS.working,
      metadata: {
        goal: working.currentGoal,
        activeFiles: working.activeFiles,
        patterns: working.discoveredPatterns,
      },
    });

    // Connect working node to matching tag nodes
    const activePatterns = working.discoveredPatterns ?? [];
    for (const p of activePatterns.slice(0, 5)) {
      const words = p.toLowerCase().split(/\s+/).filter(w => tagMap.has(w));
      for (const w of words.slice(0, 2)) {
        edges.push({ id: `e${edgeSeq++}`, source: 'working_now', target: tagMap.get(w)!, weight: 0.8, label: 'active' });
      }
    }
  }

  return {
    nodes,
    edges,
    stats: {
      semanticCount: semantic.length,
      episodeCount: episodes.length,
      tagCount: tagMap.size,
      edgeCount: edgeSeq,
      projectHash: hash,
      projectPath,
      generatedAt: Date.now(),
    },
  };
}

// ── Express app ──
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', projectPath: PROJECT_PATH });
});

app.get('/api/graph', (req, res) => {
  const projectPath = (req.query.project as string) ?? PROJECT_PATH;
  const dir = memoryRoot(projectPath);
  try {
    res.json(buildGraph(dir, projectPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/memory', (req, res) => {
  const projectPath = (req.query.project as string) ?? PROJECT_PATH;
  const dir = memoryRoot(projectPath);
  try {
    res.json({
      semantic: loadSemantic(dir),
      episodes: loadEpisodes(dir, 50),
      working: loadWorking(dir),
      projectHash: projectHash(projectPath),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`[TIMPS Memory Dashboard API] http://localhost:${PORT}`);
  console.log(`  Project: ${PROJECT_PATH}`);
  console.log(`  Graph:   http://localhost:${PORT}/api/graph`);
});

export { app };
