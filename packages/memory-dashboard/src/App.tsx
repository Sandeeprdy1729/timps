import React, { useEffect, useRef, useState, useCallback } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import circular from 'graphology-layout/circular';

// ── Types ──
interface GraphNode {
  id: string;
  label: string;
  type: 'semantic' | 'episode' | 'tag' | 'working';
  category: string;
  size: number;
  color: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label?: string;
}

interface GraphData {
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

interface WorkingMemory {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  durationMs?: number;
  tags?: string[];
}

interface MemoryDump {
  semantic: Array<{ id: string; type: string; content: string; tags: string[]; score?: number; timestamp: number }>;
  episodes: EpisodicEntry[];
  working: WorkingMemory;
  projectHash: string;
}

const TYPE_LABELS: Record<string, string> = {
  fact: 'Fact',
  pattern: 'Pattern',
  preference: 'Preference',
  error: 'Error',
  convention: 'Convention',
  bug: 'Bug',
  incident: 'Incident',
  architecture: 'Architecture',
  episode: 'Episode',
  tag: 'Tag',
  working: 'Active',
};

const LEGEND_ITEMS = [
  { color: '#6366f1', label: 'fact' },
  { color: '#10b981', label: 'pattern' },
  { color: '#f59e0b', label: 'preference' },
  { color: '#ef4444', label: 'error/bug' },
  { color: '#8b5cf6', label: 'convention' },
  { color: '#0ea5e9', label: 'architecture' },
  { color: '#f97316', label: 'incident' },
  { color: '#64748b', label: 'episode' },
  { color: '#94a3b8', label: 'tag' },
  { color: '#22d3ee', label: 'working memory' },
];

const ALL_TYPES = ['semantic', 'episode', 'tag', 'working'];

function formatTs(ts: number) {
  return new Date(ts).toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── SigmaGraph component ──
interface SigmaGraphProps {
  data: GraphData;
  typeFilters: Set<string>;
  searchTerm: string;
  onNodeClick: (node: GraphNode | null) => void;
}

function SigmaGraph({ data, typeFilters, searchTerm, onNodeClick }: SigmaGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance
    layoutRef.current?.stop();
    sigmaRef.current?.kill();

    const graph = new Graph();
    graphRef.current = graph;

    const visibleTypes = typeFilters.size === 0 ? new Set(ALL_TYPES) : typeFilters;
    const term = searchTerm.toLowerCase();

    // Add nodes
    const addedNodes = new Set<string>();
    for (const node of data.nodes) {
      if (!visibleTypes.has(node.type)) continue;
      const content = (node.metadata.content as string | undefined) ?? node.label;
      const tags = (node.metadata.tags as string[] | undefined) ?? [];
      const matchesSearch =
        !term ||
        node.label.toLowerCase().includes(term) ||
        content.toLowerCase().includes(term) ||
        tags.some(t => t.toLowerCase().includes(term));

      if (!matchesSearch) continue;

      try {
        graph.addNode(node.id, {
          label: node.label,
          size: node.size,
          color: node.type === 'tag' ? (term && node.label.toLowerCase().includes(term) ? '#22d3ee' : node.color) : node.color,
          x: Math.random() * 200 - 100,
          y: Math.random() * 200 - 100,
          // Custom attrs for click handling
          nodeType: node.type,
          nodeCategory: node.category,
          nodeMetadata: node.metadata,
        });
        addedNodes.add(node.id);
      } catch { /* duplicate */ }
    }

    // Add edges (only if both endpoints exist)
    for (const edge of data.edges) {
      if (!addedNodes.has(edge.source) || !addedNodes.has(edge.target)) continue;
      try {
        graph.addEdge(edge.source, edge.target, {
          size: Math.max(0.5, edge.weight * 2),
          color: 'rgba(100,100,140,0.25)',
        });
      } catch { /* duplicate edge */ }
    }

    // Initial circular layout to avoid overlaps
    circular.assign(graph, { scale: 120 });

    const sigma = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelSize: 10,
      labelColor: { color: '#c0c0d8' },
      defaultEdgeColor: 'rgba(100,100,140,0.2)',
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
    });
    sigmaRef.current = sigma;

    // Click handling
    sigma.on('clickNode', ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      const found = data.nodes.find(n => n.id === node);
      if (found) {
        onNodeClick(found);
      } else {
        onNodeClick({
          id: node,
          label: attrs.label as string,
          type: attrs.nodeType as GraphNode['type'],
          category: attrs.nodeCategory as string,
          size: attrs.size as number,
          color: attrs.color as string,
          metadata: attrs.nodeMetadata as Record<string, unknown>,
        });
      }
    });

    sigma.on('clickStage', () => onNodeClick(null));

    // Force-directed layout
    if (graph.order > 1) {
      const layout = new FA2Layout(graph, {
        settings: { gravity: 1, scalingRatio: 5, strongGravityMode: false },
      });
      layoutRef.current = layout;
      layout.start();
      // Stop after a few seconds — let the graph settle
      setTimeout(() => layout.stop(), 4000);
    }

    return () => {
      layoutRef.current?.stop();
      sigma.kill();
    };
  }, [data, typeFilters, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      style={{ width: '100%', height: '100%', cursor: 'default' }}
    />
  );
}

// ── Main App ──
export default function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [memoryDump, setMemoryDump] = useState<MemoryDump | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, mRes] = await Promise.all([
        fetch('/api/graph'),
        fetch('/api/memory'),
      ]);
      if (!gRes.ok) throw new Error(`Graph API error: ${gRes.status}`);
      if (!mRes.ok) throw new Error(`Memory API error: ${mRes.status}`);
      setGraphData(await gRes.json());
      setMemoryDump(await mRes.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { void fetchData(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  function toggleTypeFilter(t: string) {
    setTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const stats = graphData?.stats;
  const working = memoryDump?.working;
  const episodes = memoryDump?.episodes ?? [];

  return (
    <div className="dashboard">
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar-logo">
          {/* Pixel robot icon */}
          <svg viewBox="0 0 16 20" width="22" height="27" xmlns="http://www.w3.org/2000/svg" style={{imageRendering:'pixelated', marginRight:6, verticalAlign:'middle'}}>
            <rect x="3" y="0" width="10" height="9" rx="1" fill="#2D5A4F"/>
            <rect x="4" y="1" width="8" height="7" rx="1" fill="#3D7A6A"/>
            <rect x="5" y="3" width="2" height="2" fill="#E8E0B0"/>
            <rect x="9" y="3" width="2" height="2" fill="#E8E0B0"/>
            <rect x="6" y="6" width="4" height="1" fill="#E8E0B0"/>
            <rect x="5" y="9" width="1" height="2" fill="#C8BF8C"/>
            <rect x="10" y="9" width="1" height="2" fill="#C8BF8C"/>
            <rect x="2" y="11" width="12" height="6" rx="1" fill="#C8BF8C"/>
            <rect x="0" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <rect x="14" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <rect x="4" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
            <rect x="9" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
          </svg>
          TIMPS
        </span>
        <span className="topbar-subtitle">Memory Dashboard</span>
        {stats && (
          <div className="topbar-stats">
            <span className="stat-badge">
              <strong>{stats.semanticCount}</strong> facts
            </span>
            <span className="stat-badge">
              <strong>{stats.episodeCount}</strong> episodes
            </span>
            <span className="stat-badge">
              <strong>{stats.tagCount}</strong> tags
            </span>
            <span className="stat-badge">
              <strong>{stats.edgeCount}</strong> edges
            </span>
            {stats.projectPath && (
              <span className="stat-badge" title={stats.projectPath}>
                <strong>#{stats.projectHash}</strong>
              </span>
            )}
          </div>
        )}
        <button className="btn-refresh" onClick={fetchData} disabled={loading}>
          {loading ? '…' : '↺ Refresh'}
        </button>
      </header>

      {/* Left panel */}
      <aside className="panel-left">
        {/* Filter / search */}
        <div className="panel-section">
          <h3>Filter</h3>
          <div className="filter-bar">
            <input
              className="filter-search"
              type="text"
              placeholder="Search nodes…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="filter-row">
              {ALL_TYPES.map(t => (
                <button
                  key={t}
                  className={`filter-chip ${typeFilters.has(t) ? 'active' : ''}`}
                  onClick={() => toggleTypeFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Working memory */}
        <div className="panel-section">
          <h3>Working Memory</h3>
          {working?.currentGoal && (
            <div className="wm-goal">{working.currentGoal}</div>
          )}
          {(working?.activeFiles ?? []).length > 0 ? (
            <div className="wm-list">
              {working!.activeFiles.slice(0, 8).map(f => (
                <div key={f} className="wm-file" title={f}>{f}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No active files</div>
          )}
          {(working?.discoveredPatterns ?? []).length > 0 && (
            <>
              <h3 style={{ marginTop: 10 }}>Discovered Patterns</h3>
              <div className="wm-list">
                {working!.discoveredPatterns.slice(0, 5).map((p, i) => (
                  <div key={i} className="wm-file" title={p}>🔍 {p}</div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="panel-section">
          <h3>Legend</h3>
          <div className="legend">
            {LEGEND_ITEMS.map(item => (
              <div key={item.label} className="legend-item">
                <div className="legend-dot" style={{ background: item.color }} />
                <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Graph */}
      <main className="graph-container">
        {loading && !graphData && (
          <div className="loading-overlay">Loading memory graph…</div>
        )}
        {error && (
          <div className="graph-empty">
            <span className="icon">⚠️</span>
            <span style={{ color: 'var(--danger)' }}>{error}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300, textAlign: 'center' }}>
              Make sure the API server is running: <code>npm run dev:api</code>
            </span>
          </div>
        )}
        {!error && graphData && graphData.nodes.length === 0 && (
          <div className="graph-empty">
            <span className="icon">🧠</span>
            <span>No memory entries yet</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Use TIMPS in your project to start building memory
            </span>
          </div>
        )}
        {!error && graphData && graphData.nodes.length > 0 && (
          <SigmaGraph
            data={graphData}
            typeFilters={typeFilters}
            searchTerm={searchTerm}
            onNodeClick={setSelectedNode}
          />
        )}
        {loading && graphData && (
          <div className="loading-overlay" style={{ background: 'rgba(15,15,23,0.4)' }}>
            Refreshing…
          </div>
        )}
      </main>

      {/* Right panel */}
      <aside className="panel-right">
        {/* Selected node detail */}
        <div className="panel-section">
          <h3>Node Detail</h3>
          {selectedNode ? (
            <div className="node-detail">
              <div
                className="node-type-badge"
                style={{ background: selectedNode.color + '22', color: selectedNode.color }}
              >
                {TYPE_LABELS[selectedNode.category] ?? selectedNode.category}
              </div>
              <div className="node-content">{selectedNode.label}</div>
              {Boolean(selectedNode.metadata.content) && selectedNode.metadata.content !== selectedNode.label && (
                <div className="node-content" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                  {String(selectedNode.metadata.content)}
                </div>
              )}
              {Array.isArray(selectedNode.metadata.tags) && selectedNode.metadata.tags.length > 0 && (
                <div className="node-tags">
                  {(selectedNode.metadata.tags as string[]).map(t => (
                    <span key={t} className="tag-chip">#{t}</span>
                  ))}
                </div>
              )}
              {Boolean(selectedNode.metadata.timestamp) && (
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                  {formatTs(selectedNode.metadata.timestamp as number)}
                </div>
              )}
              {Boolean(selectedNode.metadata.outcome) && (
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  Outcome:{' '}
                  <span className={`outcome-${String(selectedNode.metadata.outcome)}`}>
                    {String(selectedNode.metadata.outcome)}
                  </span>
                  {Boolean(selectedNode.metadata.durationMs) && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      {formatDuration(selectedNode.metadata.durationMs as number)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Click a node to inspect</div>
          )}
        </div>

        {/* Recent episodes */}
        <div className="panel-section">
          <h3>Recent Sessions</h3>
          {episodes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No sessions recorded yet</div>
          ) : (
            <div className="episode-list">
              {episodes.slice(0, 15).map(ep => (
                <div key={ep.id} className="episode-item">
                  <div className="episode-summary">{ep.summary}</div>
                  <div className="episode-meta">
                    <span className={`outcome-${ep.outcome}`}>{ep.outcome}</span>
                    {ep.durationMs && <span> · {formatDuration(ep.durationMs)}</span>}
                    <span> · {formatTs(ep.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
