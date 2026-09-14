/**
 * TIMPS Memory — File browser for ~/.timps
 */
import { useState, useCallback, useEffect } from 'react';
import { api, MemoryTreeEntry } from '../api';
import './MemoryView.css';

function formatBytes(n: number): string {
  if (n === 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTreeNodeProps {
  node: MemoryTreeEntry;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
}

function FileTreeNode({ node, depth, selected, onSelect, expandedDirs, toggleDir }: FileTreeNodeProps) {
  const isExpanded = expandedDirs.has(node.path);

  if (node.is_dir) {
    return (
      <div className="mem-tree-node">
        <button
          className={`mem-tree-row dir ${isExpanded ? 'expanded' : ''}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => toggleDir(node.path)}
        >
          <span className="mem-tree-chevron">{isExpanded ? '▾' : '▸'}</span>
          <span className="mem-tree-icon">📁</span>
          <span className="mem-tree-name">{node.name}</span>
          {node.children.length > 0 && (
            <span className="mem-tree-count">{node.children.length}</span>
          )}
        </button>
        {isExpanded && (
          <div className="mem-tree-children">
            {node.children.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const ext = node.name.split('.').pop()?.toLowerCase();
  const icon = ext === 'json' ? '{}' : ext === 'jsonl' ? '≡' : ext === 'gz' ? '📦' : '📄';
  const isSelected = selected === node.path;

  return (
    <button
      className={`mem-tree-row file ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 16 + 8 }}
      onClick={() => onSelect(node.path)}
    >
      <span className="mem-tree-icon">{icon}</span>
      <span className="mem-tree-name">{node.name}</span>
      <span className="mem-tree-size">{formatBytes(node.size)}</span>
    </button>
  );
}

export function MemoryView() {
  const [tree, setTree] = useState<MemoryTreeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(['', '.timps', '.timps/memory']));

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await api.listMemoryTree();
      setTree(t);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTree(); }, [loadTree]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const selectFile = useCallback(async (relPath: string) => {
    setSelected(relPath);
    setFileLoading(true);
    try {
      const [content, size] = await api.readMemoryFile(relPath);
      setFileContent(content);
      setFileSize(size);
    } catch (e) {
      setFileContent(`Error: ${e}`);
      setFileSize(null);
    } finally {
      setFileLoading(false);
    }
  }, []);

  return (
    <div className="memory-view">
      <div className="mem-header">
        <h2>Memory Store</h2>
        <div className="mem-header-sub">
          {tree ? `${countFiles(tree)} files in ~/.timps` : 'Loading…'}
        </div>
      </div>

      <div className="mem-layout">
        <div className="mem-tree-panel">
          {loading && <div className="mem-empty">Loading…</div>}
          {error && <div className="mem-empty error">{error}</div>}
          {tree && (
            <FileTreeNode
              node={tree}
              depth={0}
              selected={selected}
              onSelect={selectFile}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          )}
        </div>

        <div className="mem-content-panel">
          {selected === null && (
            <div className="mem-empty">
              Select a file to view its contents.
            </div>
          )}
          {selected !== null && fileLoading && (
            <div className="mem-empty">Loading…</div>
          )}
          {selected !== null && !fileLoading && fileContent !== null && (
            <>
              <div className="mem-content-header">
                <span className="mem-content-path">{selected}</span>
                {fileSize !== null && <span className="mem-content-size">{formatBytes(fileSize)}</span>}
              </div>
              <pre className="mem-content-pre">{fileContent}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function countFiles(node: MemoryTreeEntry): number {
  if (!node.is_dir) return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}