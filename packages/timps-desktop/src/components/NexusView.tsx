import { useState, useEffect, useRef, useCallback } from 'react';
import { api, UnifiedNode, UnifiedEdge, UnifiedGraph, LayerStats } from '../api';
import './NexusView.css';

interface PosNode extends UnifiedNode {
  x: number; y: number;
  vx: number; vy: number;
  pinned: boolean;
  radius: number;
}

interface NexusViewProps {
  projectPath: string;
}

const LAYER_COLORS: Record<string, string> = {
  'L1-working': '#06b6d4',
  'L2-episodic': '#3b82f6',
  'L3-semantic': '#6366f1',
  'L5-chronos': '#10b981',
  'L6-resonance': '#14b8a6',
  'L7-echo': '#22c55e',
  'L8-synapse': '#84cc16',
  'L9-sheaf': '#eab308',
  'L10-engram': '#f59e0b',
  'kg-core': '#8b5cf6',
  'sheaf-aether': '#a855f7',
  'L3-contradiction': '#ef4444',
  'L3-regret': '#f97316',
  'L3-burnout': '#f43f5e',
  'L3-techdebt': '#78716c',
  'L3-bugprophet': '#ec4899',
  'L3-apiarch': '#0ea5e9',
  'L3-velocity': '#06b6d4',
  'L3-pattern': '#a78bfa',
  'L3-meeting': '#fb923c',
  'L3-deadreckon': '#f87171',
  'L3-manifesto': '#34d399',
  'L3-relationship': '#f472b6',
  'L3-institutional': '#2dd4bf',
  'L3-anthropologist': '#c084fc',
  'L3-curriculum': '#facc15',
  'L3-conflict': '#fb7185',
};

function layerColor(layer: string): string {
  return LAYER_COLORS[layer] || '#6b7280';
}

const LAYER_ORDER = [
  'L1-working', 'L2-episodic', 'L3-semantic', 'L5-chronos',
  'L6-resonance', 'L7-echo', 'L8-synapse', 'L9-sheaf',
  'L10-engram', 'kg-core', 'sheaf-aether',
  'L3-contradiction', 'L3-regret', 'L3-burnout', 'L3-techdebt',
  'L3-bugprophet', 'L3-apiarch', 'L3-velocity', 'L3-pattern',
  'L3-meeting', 'L3-deadreckon', 'L3-manifesto', 'L3-relationship',
  'L3-institutional', 'L3-anthropologist', 'L3-curriculum', 'L3-conflict',
];

function friendlyLayer(name: string): string {
  const map: Record<string, string> = {
    'L1-working': 'Working',
    'L2-episodic': 'Episodic',
    'L3-semantic': 'Semantic',
    'L5-chronos': 'ChronosForge',
    'L6-resonance': 'ResonanceForge',
    'L7-echo': 'EchoForge',
    'L8-synapse': 'SynapseQuench',
    'L9-sheaf': 'SheafWeaver',
    'L10-engram': 'EngramLog',
    'kg-core': 'Knowledge Graph',
    'sheaf-aether': 'AetherForge',
    'L3-contradiction': 'Contradiction',
    'L3-regret': 'Regret Oracle',
    'L3-burnout': 'Burnout',
    'L3-techdebt': 'Tech Debt',
    'L3-bugprophet': 'Bug Prophet',
    'L3-apiarch': 'API Arch',
    'L3-velocity': 'Velocity',
    'L3-pattern': 'Patterns',
    'L3-meeting': 'Meetings',
    'L3-deadreckon': 'Dead Reckoning',
    'L3-manifesto': 'Manifesto',
    'L3-relationship': 'Relationships',
    'L3-institutional': 'Institutional',
    'L3-anthropologist': 'Codebase Anthro',
    'L3-curriculum': 'Curriculum',
    'L3-conflict': 'Conflict',
  };
  return map[name] || name;
}

function runSimulation(nodes: PosNode[], edges: UnifiedEdge[], width: number, height: number, iterations = 150): PosNode[] {
  const k = 200;
  const repulsion = 8000;
  const damping = 0.85;
  const layerCenterX: Record<string, number> = {};
  const layers = [...new Set(nodes.map(n => n.layer))];
  layers.forEach((l, i) => {
    layerCenterX[l] = width * (i + 0.5) / layers.length;
  });

  for (let iter = 0; iter < iterations; iter++) {
    for (const n of nodes) {
      if (n.pinned) continue;
      let fx = 0, fy = 0;

      for (const other of nodes) {
        if (n.id === other.id) continue;
        const dx = n.x - other.x;
        const dy = n.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const repel = repulsion / (dist * dist);
        fx += (dx / dist) * repel;
        fy += (dy / dist) * repel;
      }

      for (const e of edges) {
        let linked = false;
        if (e.source === n.id) {
          const target = nodes.find(no => no.id === e.target);
          if (target) {
            const dx = target.x - n.x;
            const dy = target.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            fx += dx * (dist - k) / dist * 0.03;
            fy += dy * (dist - k) / dist * 0.03;
            linked = true;
          }
        }
        if (e.target === n.id) {
          const source = nodes.find(no => no.id === e.source);
          if (source) {
            const dx = source.x - n.x;
            const dy = source.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            fx += dx * (dist - k) / dist * 0.03;
            fy += dy * (dist - k) / dist * 0.03;
            linked = true;
          }
        }
        if (linked) break;
      }

      const cx = layerCenterX[n.layer] || width / 2;
      fx += (cx - n.x) * 0.002;
      fy += (height / 2 - n.y) * 0.001;

      n.vx = (n.vx + fx) * damping;
      n.vy = (n.vy + fy) * damping;
      n.x += n.vx;
      n.y += n.vy;

      const margin = 20;
      n.x = Math.max(margin, Math.min(width - margin, n.x));
      n.y = Math.max(margin, Math.min(height - margin, n.y));
    }
  }
  return nodes;
}

export function NexusView({ projectPath }: NexusViewProps) {
  const [graph, setGraph] = useState<UnifiedGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ node?: PosNode; edge?: UnifiedEdge } | null>(null);
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(LAYER_ORDER));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const posNodesRef = useRef<PosNode[]>([]);
  const edgesRef = useRef<UnifiedEdge[]>([]);
  const dragRef = useRef<{ node: PosNode | null; ox: number; oy: number }>({ node: null, ox: 0, oy: 0 });

  const loadGraph = useCallback(() => {
    if (!projectPath) { setLoading(false); return; }
    setLoading(true);
    api.loadUnifiedGraph(projectPath).then(ug => {
      setGraph(ug);
      const w = containerRef.current?.clientWidth || 800;
      const h = containerRef.current?.clientHeight || 600;
      const layers = [...new Set(ug.nodes.map(n => n.layer))];
      const layerIndex: Record<string, number> = {};
      layers.forEach((l, i) => { layerIndex[l] = i; });
      const totalLayers = layers.length || 1;

      posNodesRef.current = ug.nodes.map(n => {
        const li = layerIndex[n.layer] || 0;
        return {
          ...n,
          x: w * (li + 0.5) / totalLayers + (Math.random() - 0.5) * 60,
          y: h * 0.3 + Math.random() * h * 0.4,
          vx: 0, vy: 0,
          pinned: false,
          radius: 6 + n.size * 10,
        };
      });
      edgesRef.current = ug.edges;
      posNodesRef.current = runSimulation(posNodesRef.current, ug.edges, w, h);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Auto-refresh every 5 seconds so new memory data appears
  useEffect(() => {
    if (!projectPath) return;
    const id = setInterval(loadGraph, 5000);
    return () => clearInterval(id);
  }, [projectPath, loadGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const nodes = posNodesRef.current;
    const edges = edgesRef.current;
    const selectedId = selected?.node?.id;
    const activeLayerSet = activeLayers;

    const visibleNodes = nodes.filter(n => activeLayerSet.has(n.layer));
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

    for (const e of visibleEdges) {
      const src = nodes.find(n => n.id === e.source);
      const dst = nodes.find(n => n.id === e.target);
      if (!src || !dst) continue;

      const isHighlighted = hovered && (e.source === hovered || e.target === hovered);
      const isSelected = selectedId && (e.source === selectedId || e.target === selectedId);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = isSelected ? '#fff' : isHighlighted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = isSelected ? 2 : isHighlighted ? 1.5 : 0.5 + e.weight * 1.5;
      ctx.stroke();

      if (isSelected && ctx.measureText) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.relation, (src.x + dst.x) / 2, (src.y + dst.y) / 2 - 6);
      }
    }

    for (const n of visibleNodes) {
      const isSelected = selectedId === n.id;
      const isHovered = hovered === n.id;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = layerColor(n.layer);
      ctx.globalAlpha = isSelected ? 1 : isHovered ? 0.9 : 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(10 + n.radius * 0.12, 12)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = n.label.length > 20 ? n.label.slice(0, 18) + '…' : n.label;
      ctx.fillText(label, n.x, n.y + n.radius + 4);
    }
  }, [selected, hovered, activeLayers]);

  useEffect(() => {
    draw();
  }, [draw, graph]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const n of posNodesRef.current) {
      if (!activeLayers.has(n.layer)) continue;
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        setSelected({ node: n });
        return;
      }
    }
    setSelected(null);
  }, [activeLayers]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const n of posNodesRef.current) {
      if (!activeLayers.has(n.layer)) continue;
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        found = n.id;
        break;
      }
    }
    setHovered(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, [activeLayers]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const n of posNodesRef.current) {
      if (!activeLayers.has(n.layer)) continue;
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        n.pinned = true;
        dragRef.current = { node: n, ox: mx - n.x, oy: my - n.y };
        return;
      }
    }
  }, [activeLayers]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.node) {
      dragRef.current.node.pinned = false;
      dragRef.current.node = null;
    }
  }, []);

  const toggleLayer = (layer: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const totalNodes = graph?.nodes.length ?? 0;
  const totalEdges = graph?.edges.length ?? 0;

  const selectedNode = selected?.node;
  const selectedEdges = selectedNode
    ? edgesRef.current.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : [];

  return (
    <div className="nexus-view">
      <div className="view-header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Nexus
        </h2>
        <div className="nexus-controls">
          <div className="nexus-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="nexus-stats-badge">{totalNodes} nodes · {totalEdges} edges</span>
        </div>
      </div>

      {loading ? (
        <div className="nexus-loading">
          <span className="loading-spinner" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'var(--color-primary-500)' }} />
          Loading unified knowledge graph...
        </div>
      ) : totalNodes === 0 ? (
        <div className="nexus-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <h3>No knowledge graph yet</h3>
          <p>The knowledge graph is built automatically as you use TIMPS. Start chatting to grow it.</p>
        </div>
      ) : (
        <div className="nexus-body">
          <div ref={containerRef} className="nexus-canvas-container">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div className="nexus-legend">
              <div className="legend-title">Layers</div>
              {LAYER_ORDER.filter(l => !l.startsWith('L3-')).concat(
                LAYER_ORDER.filter(l => l.startsWith('L3-'))
              ).filter(l => graph?.stats[l]).map(layer => (
                <div
                  key={layer}
                  className={`legend-item ${activeLayers.has(layer) ? '' : 'legend-dimmed'}`}
                  onClick={() => toggleLayer(layer)}
                >
                  <span className="legend-dot" style={{ background: layerColor(layer) }} />
                  <span>
                    {friendlyLayer(layer)}
                    <span className="legend-count">
                      {graph?.stats[layer] && ` (${graph.stats[layer].nodes})`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {selectedNode && (
            <div className="nexus-details">
              <div className="detail-header">
                <div>
                  <h4>{selectedNode.label}</h4>
                  <div className="detail-layer-badge" style={{ background: layerColor(selectedNode.layer) }}>
                    {friendlyLayer(selectedNode.layer)}
                  </div>
                </div>
                <button onClick={() => setSelected(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-field">
                  <label>ID</label>
                  <span className="detail-mono">{selectedNode.id}</span>
                </div>
                <div className="detail-field">
                  <label>Kind</label>
                  <span>{selectedNode.kind}</span>
                </div>
                <div className="detail-field">
                  <label>Size (importance)</label>
                  <span>{(selectedNode.size * 100).toFixed(0)}%</span>
                </div>
                {selectedNode.timestamp > 0 && (
                  <div className="detail-field">
                    <label>Timestamp</label>
                    <span>{new Date(selectedNode.timestamp).toLocaleString()}</span>
                  </div>
                )}
                {Object.keys(selectedNode.attributes).length > 0 && (
                  <div className="detail-field">
                    <label>Attributes</label>
                    <div className="detail-attrs">
                      {Object.entries(selectedNode.attributes).map(([k, v]) => {
                        const val = typeof v === 'string' ? v :
                          v && typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v ?? '');
                        return (
                          <div key={k} className="attr-row">
                            <span className="attr-key">{k}</span>
                            <span className="attr-val">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedEdges.length > 0 && (
                  <div className="detail-field">
                    <label>Relations ({selectedEdges.length})</label>
                    <div className="detail-relations">
                      {selectedEdges.slice(0, 20).map((e, i) => (
                        <div key={i} className="relation-row">
                          <span className="relation-sub">{e.source === selectedNode.id ? '' : e.source.slice(0, 20)}</span>
                          <span className="relation-label">—[{e.relation}]→</span>
                          <span className="relation-obj">{e.target === selectedNode.id ? '' : e.target.slice(0, 20)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
