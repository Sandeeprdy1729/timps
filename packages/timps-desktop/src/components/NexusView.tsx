import { useState, useEffect, useRef, useCallback } from 'react';
import { api, UnifiedNode, UnifiedEdge, UnifiedGraph } from '../api';
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
  'L1-working': '#06b6d4', 'L2-episodic': '#3b82f6', 'L3-semantic': '#6366f1',
  'L5-chronos': '#10b981', 'L6-resonance': '#14b8a6', 'L7-echo': '#22c55e',
  'L8-synapse': '#84cc16', 'L9-sheaf': '#eab308', 'L10-engram': '#f59e0b',
  'kg-core': '#8b5cf6', 'sheaf-aether': '#a855f7',
};

function layerColor(layer: string): string {
  return LAYER_COLORS[layer] || '#6b7280';
}

function layerGlow(layer: string): string {
  const c = layerColor(layer);
  return `${c}44`;
}

const LAYER_ORDER = Object.keys(LAYER_COLORS);

function friendlyLayer(name: string): string {
  const map: Record<string, string> = {
    'L1-working': 'Working', 'L2-episodic': 'Episodic', 'L3-semantic': 'Semantic',
    'L5-chronos': 'ChronosForge', 'L6-resonance': 'ResonanceForge', 'L7-echo': 'EchoForge',
    'L8-synapse': 'SynapseQuench', 'L9-sheaf': 'SheafWeaver', 'L10-engram': 'EngramLog',
    'kg-core': 'Knowledge Graph', 'sheaf-aether': 'AetherForge',
  };
  return map[name] || name;
}

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 60%, 55%)`;
}

export function NexusView({ projectPath }: NexusViewProps) {
  const [graph, setGraph] = useState<UnifiedGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ node?: PosNode; edge?: UnifiedEdge } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(LAYER_ORDER));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const posNodesRef = useRef<PosNode[]>([]);
  const edgesRef = useRef<UnifiedEdge[]>([]);
  const dragRef = useRef<{ node: PosNode | null; ox: number; oy: number }>({ node: null, ox: 0, oy: 0 });
  const prevNodeIds = useRef<Set<string>>(new Set());
  const simRunning = useRef(false);

  const k = 200;
  const repulsion = 6000;
  const damping = 0.7;
  const lx: Record<string, number> = {};

  function runSimStep(nodes: PosNode[], edges: UnifiedEdge[], w: number, h: number) {
    const layers = [...new Set(nodes.map(n => n.layer))];
    layers.forEach((l, i) => { lx[l] = w * (i + 0.5) / Math.max(layers.length, 1); });

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
        const pair: [string, string][] = [[e.source, e.target], [e.target, e.source]];
        for (const [srcId, tgtId] of pair) {
          if (srcId === n.id) {
            const other = nodes.find(no => no.id === tgtId);
            if (other) {
              const dx = other.x - n.x, dy = other.y - n.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              fx += dx * (dist - k) / dist * 0.02;
              fy += dy * (dist - k) / dist * 0.02;
            }
          }
        }
      }

      const cx = lx[n.layer] || w / 2;
      fx += (cx - n.x) * 0.002;
      fy += (h / 2 - n.y) * 0.001;

      n.vx = (n.vx + fx) * damping;
      n.vy = (n.vy + fy) * damping;
      n.x += n.vx;
      n.y += n.vy;

      const margin = 20;
      n.x = Math.max(margin, Math.min(w - margin, n.x));
      n.y = Math.max(margin, Math.min(h - margin, n.y));
    }
  }

  const loadGraph = useCallback(() => {
    if (!projectPath) { setLoading(false); return; }
    setLoading(true);
    api.loadUnifiedGraph(projectPath).then(ug => {
      setGraph(ug);
      const w = containerRef.current?.clientWidth || 800;
      const h = containerRef.current?.clientHeight || 600;

      const existingIds = new Set(posNodesRef.current.map(n => n.id));
      const newIds = new Set(ug.nodes.map(n => n.id));

      const layers = [...new Set(ug.nodes.map(n => n.layer))];
      layers.forEach((l, i) => { lx[l] = w * (i + 0.5) / Math.max(layers.length, 1); });

      const oldNodes = posNodesRef.current.filter(n => newIds.has(n.id));
      const removed = posNodesRef.current.filter(n => !newIds.has(n.id));

      const addedNodes: PosNode[] = ug.nodes
        .filter(n => !existingIds.has(n.id))
        .map(n => {
          const li = layers.indexOf(n.layer);
          return {
            ...n,
            x: w * (li >= 0 ? li + 0.5 : 0.5) / Math.max(layers.length, 1) + (Math.random() - 0.5) * 40,
            y: h * 0.3 + Math.random() * h * 0.4,
            vx: 0, vy: 0,
            pinned: false,
            radius: 4 + n.size * 8,
          };
        });

      posNodesRef.current = [...oldNodes, ...addedNodes];
      edgesRef.current = ug.edges;
      prevNodeIds.current = newIds;
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

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

      const hl = hovered && (e.source === hovered || e.target === hovered);
      const sel = selectedId && (e.source === selectedId || e.target === selectedId);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = sel ? 'rgba(255,255,255,0.6)' : hl ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = sel ? 2 : hl ? 1.5 : 0.5 + e.weight * 1.2;
      ctx.stroke();
    }

    for (const n of visibleNodes) {
      const sel = selectedId === n.id;
      const hov = hovered === n.id;

      ctx.save();
      if (hov || sel) {
        ctx.shadowColor = layerColor(n.layer);
        ctx.shadowBlur = sel ? 30 : 18;
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = layerColor(n.layer);
      ctx.globalAlpha = sel ? 1 : hov ? 0.95 : 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      if (sel) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = hov || sel ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = n.label.length > 25 ? n.label.slice(0, 23) + '…' : n.label;
      ctx.fillText(label, n.x, n.y + n.radius + 5);
    }
  }, [selected, hovered, activeLayers]);

  const simLoop = useCallback(() => {
    const container = containerRef.current;
    if (!container) { simRunning.current = false; return; }
    const w = container.clientWidth;
    const h = container.clientHeight;

    runSimStep(posNodesRef.current, edgesRef.current, w, h);
    draw();

    const energy = posNodesRef.current.reduce((s, n) => s + Math.abs(n.vx) + Math.abs(n.vy), 0);
    if (energy > 0.01) {
      animRef.current = requestAnimationFrame(simLoop);
    } else {
      simRunning.current = false;
    }
  }, [draw]);

  useEffect(() => {
    if (!simRunning.current) {
      simRunning.current = true;
      animRef.current = requestAnimationFrame(simLoop);
    }
    return () => { cancelAnimationFrame(animRef.current); simRunning.current = false; };
  }, [simLoop, graph]);

  useEffect(() => {
    const onResize = () => {
      if (!simRunning.current) {
        simRunning.current = true;
        animRef.current = requestAnimationFrame(simLoop);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [simLoop]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

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
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let found: string | null = null;
    for (const n of posNodesRef.current) {
      if (!activeLayers.has(n.layer)) continue;
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) { found = n.id; break; }
    }
    setHovered(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, [activeLayers]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
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
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          Nexus
        </h2>
        <div className="nexus-controls">
          <span className="nexus-stats-badge">{totalNodes} nodes · {totalEdges} edges</span>
        </div>
      </div>

      {loading ? (
        <div className="nexus-loading">
          <span className="loading-spinner" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'var(--color-primary-500)' }} />
          Loading…
        </div>
      ) : totalNodes === 0 ? (
        <div className="nexus-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
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
              {LAYER_ORDER.filter(l => graph?.stats[l]).map(layer => (
                <div
                  key={layer}
                  className={`legend-item ${activeLayers.has(layer) ? '' : 'legend-dimmed'}`}
                  onClick={() => toggleLayer(layer)}
                >
                  <span className="legend-dot" style={{ background: layerColor(layer) }} />
                  <span className="legend-label">{friendlyLayer(layer)}</span>
                  <span className="legend-count">{graph?.stats[layer]?.nodes ?? 0}</span>
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
                {selectedNode.timestamp > 0 && (
                  <div className="detail-field">
                    <label>Time</label>
                    <span>{new Date(selectedNode.timestamp).toLocaleString()}</span>
                  </div>
                )}
                {Object.keys(selectedNode.attributes).length > 0 && (
                  <div className="detail-field">
                    <label>Attributes</label>
                    <div className="detail-attrs">
                      {Object.entries(selectedNode.attributes).map(([k, v]) => {
                        const val = typeof v === 'string' ? v
                          : v && typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v ?? '');
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
                          <span className="relation-label">—{e.relation}→</span>
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
