import { useState, useEffect, useRef } from 'react';
import { api, SemanticEntry } from '../api';
import { forceSimulation, forceManyBody, forceCenter, forceCollide, forceLink } from 'd3-force';
import { select } from 'd3-selection';
import { zoom } from 'd3-zoom';
import './MemoryGraph.css';

interface MemoryGraphNode extends SemanticEntry {
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
  neighbors?: number;
  cluster?: number;
}

interface MemoryGraphLink {
  source: string;
  target: string;
  value: number;
  type: 'tag' | 'type' | 'proximity';
}

interface MemoryGraphProps {
  entries: SemanticEntry[];
  loading: boolean;
  projectPath: string;
}

const NODE_COLORS: Record<string, string> = {
  fact: '#4a9e8a',
  pattern: '#f59e0b',
  error: '#ef4444',
  architecture: '#3b82f6',
  default: '#6b7280',
};

function hashId(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % mod;
}

export function MemoryGraph({ entries, loading }: MemoryGraphProps) {
  const [nodes, setNodes] = useState<MemoryGraphNode[]>([]);
  const [links, setLinks] = useState<MemoryGraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<MemoryGraphNode | null>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'force' | 'cluster' | 'radial'>('force');

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setNodes([]);
      setLinks([]);
      return;
    }

    const graphNodes: MemoryGraphNode[] = entries.map(entry => ({
      ...entry,
      neighbors: entry.tags.length + (entry.score ? 1 : 0),
      cluster: hashId(entry.id, 5),
    }));

    const graphLinks: MemoryGraphLink[] = [];
    const tagMap: Record<string, string[]> = {};

    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push(entry.id);
      });
    });

    Object.entries(tagMap).forEach(([tag, entryIds]) => {
      if (entryIds.length > 1) {
        for (let i = 0; i < entryIds.length; i++) {
          for (let j = i + 1; j < entryIds.length; j++) {
            graphLinks.push({
              source: entryIds[i],
              target: entryIds[j],
              value: 1 / Math.sqrt(entryIds.length),
              type: 'tag',
            });
          }
        }
      }
    });

    const typeMap: Record<string, string[]> = {};
    entries.forEach(entry => {
      if (!typeMap[entry.type]) typeMap[entry.type] = [];
      typeMap[entry.type].push(entry.id);
    });

    Object.entries(typeMap).forEach(([type, entryIds]) => {
      if (entryIds.length > 1) {
        for (let i = 0; i < entryIds.length; i++) {
          for (let j = i + 1; j < entryIds.length; j++) {
            graphLinks.push({
              source: entryIds[i],
              target: entryIds[j],
              value: 0.5,
              type: 'type',
            });
          }
        }
      }
    });

    setNodes(graphNodes);
    setLinks(graphLinks);
  }, [entries]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    const sim = forceSimulation<MemoryGraphNode>(nodes)
      .force('link', forceLink<MemoryGraphLink, MemoryGraphNode>().id(d => d.id))
      .force('charge', forceManyBody().strength(-100))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(5))
      .stop();

    setSimulation(sim);

    return () => {
      sim.stop();
    };
  }, [nodes]);

  useEffect(() => {
    if (!simulation) return;

    if (layoutMode === 'force') {
      simulation
        .force('link', forceLink<MemoryGraphLink, MemoryGraphNode>(links)
          .id(d => d.source as string)
          .distance(d => 100 - d.value * 50)
          .strength(0.1))
        .force('charge', forceManyBody().strength(-200))
        .force('center', forceCenter(400, 300))
        .restart();
    } else if (layoutMode === 'cluster') {
      const clusters = nodes.reduce((acc, node) => {
        const clusterId = node.cluster || 0;
        if (!acc[clusterId]) acc[clusterId] = [];
        acc[clusterId].push(node);
        return acc;
      }, {} as Record<number, MemoryGraphNode[]>);

      simulation.stop();
      const newNodes = nodes.map((node, index) => {
        const clusterId = node.cluster || 0;
        const cluster = clusters[clusterId] || [];
        const idx = cluster.indexOf(node);
        const angle = (2 * Math.PI * idx) / Math.max(cluster.length, 1);
        const radius = 50 + clusterId * 60;
        return {
          ...node,
          fx: 400 + Math.cos(angle) * radius,
          fy: 300 + Math.sin(angle) * radius,
        };
      });
      setNodes(newNodes);
    }

    return () => {
      simulation.stop();
    };
  }, [layoutMode, links, nodes, simulation]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  useEffect(() => {
    if (!simulation) return;

    simulation.on('tick', () => {});
    return () => {
      simulation.on('tick', null);
    };
  }, [simulation]);

  const getNodeColor = (type: string) => NODE_COLORS[type] || NODE_COLORS.default;

  const getNodeSize = (node: MemoryGraphNode) => {
    return 10 + Math.min(node.neighbors || 0, 10) * 2;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="memory-graph">
        <div className="graph-loading">
          <span className="loading-spinner" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'var(--color-primary-500)' }} />
          Loading graph...
        </div>
      </div>
    );
  }

  return (
    <div className="memory-graph">
      <div className="view-header">
        <h2>Memory Graph</h2>
        <div className="graph-controls">
          <select
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value as typeof layoutMode)}
          >
            <option value="force">Force Layout</option>
            <option value="cluster">Cluster Layout</option>
            <option value="radial">Radial Layout</option>
          </select>
          <span className="zoom-level">{(zoomLevel * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div ref={containerRef} className="graph-container">
        <svg ref={svgRef} className="graph-svg">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g ref={gRef} className="graph-group">
            <g className="links">
              {links.map((link, index) => {
                const sourceNode = nodes.find(n => n.id === (link.source as string));
                const targetNode = nodes.find(n => n.id === (link.target as string));
                if (!sourceNode || !targetNode) return null;

                return (
                  <line
                    key={index}
                    className={`link-${link.type}`}
                    x1={sourceNode.fx || 0}
                    y1={sourceNode.fy || 0}
                    x2={targetNode.fx || 0}
                    y2={targetNode.fy || 0}
                    strokeOpacity={0.3 + link.value * 0.7}
                    strokeWidth={1 + link.value * 3}
                  />
                );
              })}
            </g>

            <g className="nodes">
              {nodes.map((node) => (
                <g
                  key={node.id}
                  className="node"
                  transform={`translate(${node.fx || 0}, ${node.fy || 0})`}
                  onClick={() => setSelectedNode(node)}
                >
                  <circle
                    r={getNodeSize(node) / 2}
                    fill={getNodeColor(node.type)}
                    stroke={selectedNode?.id === node.id ? '#fff' : 'none'}
                    strokeWidth={selectedNode?.id === node.id ? 2 : 0}
                    filter={selectedNode?.id === node.id ? 'url(#glow)' : 'none'}
                  />
                  <text
                    textAnchor="middle"
                    dy="-14"
                    className="node-label"
                    fontSize={Math.min(getNodeSize(node) / 3, 11)}
                  >
                    {node.type}
                  </text>
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>

      {selectedNode && (
        <div className={`node-details ${selectedNode ? 'open' : ''}`}>
          <div className="detail-header">
            <h4>{selectedNode.type.toUpperCase()} Entry</h4>
            <button onClick={() => setSelectedNode(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="detail-content">
            <div className="detail-field">
              <label>Content</label>
              <p>{selectedNode.content}</p>
            </div>
            <div className="detail-field">
              <label>Created</label>
              <p>{formatTimestamp(selectedNode.timestamp)}</p>
            </div>
            <div className="detail-field">
              <label>Tags</label>
              <div className="tags">
                {selectedNode.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
            {selectedNode.score !== undefined && (
              <div className="detail-field">
                <label>Importance Score</label>
                <div className="score-bar">
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{ width: `${selectedNode.score * 100}%` }}
                    />
                  </div>
                  <span className="score-bar-value">{(selectedNode.score * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            <div className="detail-field">
              <label>Connections</label>
              <p>{selectedNode.neighbors || 0} related entries</p>
            </div>
          </div>
        </div>
      )}

      <div className="graph-legend">
        {Object.entries(NODE_COLORS).filter(([key]) => key !== 'default').map(([type, color]) => (
          <div key={type} className="legend-item">
            <div className="legend-color" style={{ background: color }} />
            <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
