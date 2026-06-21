import { useState, useEffect, useRef, useCallback } from 'react';
import { api, KnowledgeNode, KnowledgeEdge, KnowledgeGraph } from '../api';
import './NexusView.css';

interface PosNode extends KnowledgeNode {
  x: number; y: number;
  vx: number; vy: number;
  pinned: boolean;
  radius: number;
}

interface NexusViewProps {
  projectPath: string;
}

const COLORS: Record<string, string> = {
  technology: '#3b82f6',
  concept: '#f59e0b',
  pattern: '#8b5cf6',
  person: '#ef4444',
  file: '#4a9e8a',
  default: '#6b7280',
};

function color(type: string): string {
  return COLORS[type] || COLORS.default;
}

function runSimulation(nodes: PosNode[], edges: KnowledgeEdge[], width: number, height: number, iterations = 120): PosNode[] {
  const k = 200;
  const repulsion = 5000;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    for (const n of nodes) {
      if (n.pinned) continue;
      let fx = 0, fy = 0;

      for (const other of nodes) {
        if (n.id === other.id) continue;
        const dx = n.x - other.x;
        const dy = n.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        fx += (dx / dist) * repulsion / (dist * dist);
        fy += (dy / dist) * repulsion / (dist * dist);
      }

      for (const e of edges) {
        if (e.subject === n.entity) {
          const target = nodes.find(no => no.entity === e.object);
          if (target) {
            const dx = target.x - n.x;
            const dy = target.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            fx += dx * (dist - k) / dist * 0.05;
            fy += dy * (dist - k) / dist * 0.05;
          }
        }
        if (e.object === n.entity) {
          const source = nodes.find(no => no.entity === e.subject);
          if (source) {
            const dx = source.x - n.x;
            const dy = source.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            fx += dx * (dist - k) / dist * 0.05;
            fy += dy * (dist - k) / dist * 0.05;
          }
        }
      }

      fx += (width / 2 - n.x) * 0.001;
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
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ node?: PosNode; edge?: KnowledgeEdge } | null>(null);
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const posNodesRef = useRef<PosNode[]>([]);
  const edgesRef = useRef<KnowledgeEdge[]>([]);
  const dragRef = useRef<{ node: PosNode | null; ox: number; oy: number }>({ node: null, ox: 0, oy: 0 });

  useEffect(() => {
    if (!projectPath) { setLoading(false); return; }
    setLoading(true);
    api.loadKnowledgeGraph(projectPath).then(kg => {
      setGraph(kg);
      const w = containerRef.current?.clientWidth || 800;
      const h = containerRef.current?.clientHeight || 600;
      posNodesRef.current = kg.nodes.map(n => ({
        ...n,
        x: Math.random() * w * 0.6 + w * 0.2,
        y: Math.random() * h * 0.6 + h * 0.2,
        vx: 0, vy: 0,
        pinned: false,
        radius: 12 + (kg.edges.filter(e => e.subject === n.entity || e.object === n.entity).length * 3),
      }));
      edgesRef.current = kg.edges;
      posNodesRef.current = runSimulation(posNodesRef.current, kg.edges, w, h);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

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
    const selectedEntity = selected?.node?.entity;

    for (const e of edges) {
      const src = nodes.find(n => n.entity === e.subject);
      const dst = nodes.find(n => n.entity === e.object);
      if (!src || !dst) continue;

      const isHighlighted = hovered && (e.subject === hovered || e.object === hovered);
      const isSelected = selectedEntity && (e.subject === selectedEntity || e.object === selectedEntity);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = isSelected ? '#fff' : isHighlighted ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isSelected ? 2 : isHighlighted ? 1.5 : 0.5 + e.weight * 1.5;
      ctx.stroke();

      const mx = (src.x + dst.x) / 2;
      const my = (src.y + dst.y) / 2;
      if (isSelected && ctx.measureText) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.relation, mx, my - 6);
      }
    }

    for (const n of nodes) {
      const isSelected = selectedEntity === n.entity;
      const isHovered = hovered === n.entity;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = color(n.entityType);
      ctx.globalAlpha = isSelected ? 1 : isHovered ? 0.9 : 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(10 + n.radius * 0.15, 13)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = n.entity.length > 18 ? n.entity.slice(0, 16) + '…' : n.entity;
      ctx.fillText(label, n.x, n.y + n.radius + 4);
    }
  }, [selected, hovered]);

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
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        setSelected({ node: n });
        return;
      }
    }
    setSelected(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const n of posNodesRef.current) {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        found = n.entity;
        break;
      }
    }
    setHovered(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const n of posNodesRef.current) {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        n.pinned = true;
        dragRef.current = { node: n, ox: mx - n.x, oy: my - n.y };
        return;
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.node) {
      dragRef.current.node.pinned = false;
      dragRef.current.node = null;
    }
  }, []);

  const filteredNodes = graph?.nodes.filter(n =>
    !search || n.entity.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;

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
          <span className="nexus-stats-badge">{nodeCount} nodes · {edgeCount} edges</span>
        </div>
      </div>

      {loading ? (
        <div className="nexus-loading">
          <span className="loading-spinner" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'var(--color-primary-500)' }} />
          Loading knowledge graph...
        </div>
      ) : nodeCount === 0 ? (
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
              {Object.entries(COLORS).map(([type, c]) => (
                <div key={type} className="legend-item">
                  <span className="legend-dot" style={{ background: c }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {selected?.node && (
            <div className="nexus-details">
              <div className="detail-header">
                <h4>{selected.node.entity}</h4>
                <button onClick={() => setSelected(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-field">
                  <label>Type</label>
                  <span className="detail-type-badge" style={{ background: color(selected.node.entityType) }}>
                    {selected.node.entityType}
                  </span>
                </div>
                <div className="detail-field">
                  <label>Relations</label>
                  <div className="detail-relations">
                    {edgesRef.current
                      .filter(e => e.subject === selected.node!.entity || e.object === selected.node!.entity)
                      .map((e, i) => (
                        <div key={i} className="relation-row">
                          <span className="relation-sub">{e.subject}</span>
                          <span className="relation-label">—[{e.relation}]→</span>
                          <span className="relation-obj">{e.object}</span>
                        </div>
                      ))}
                    {edgesRef.current.filter(e => e.subject === selected.node!.entity || e.object === selected.node!.entity).length === 0 && (
                      <span className="relation-none">No relations</span>
                    )}
                  </div>
                </div>
                {selected.node.attributes && Object.keys(selected.node.attributes).length > 0 && (
                  <div className="detail-field">
                    <label>Attributes</label>
                    <div className="detail-attrs">
                      {Object.entries(selected.node.attributes).map(([k, v]) => (
                        <div key={k} className="attr-row">
                          <span className="attr-key">{k}</span>
                          <span className="attr-val">{String(v).slice(0, 60)}</span>
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
