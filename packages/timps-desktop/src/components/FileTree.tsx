/**
 * TIMPS Desktop - FileTree
 * File tree navigation component.
 */

import { useState } from 'react';
import './FileTree.css';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedId?: string;
  onSelect: (node: FileNode) => void;
}

export function FileTree({ nodes, selectedId, onSelect }: FileTreeProps) {
  return (
    <div className="file-tree">
      {nodes.map(node => (
        <FileTreeNode 
          key={node.id} 
          node={node} 
          selectedId={selectedId}
          onSelect={onSelect}
          level={0}
        />
      ))}
    </div>
  );
}

function FileTreeNode({ 
  node, 
  selectedId, 
  onSelect, 
  level 
}: { 
  node: FileNode; 
  selectedId?: string; 
  onSelect: (node: FileNode) => void;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelected = node.id === selectedId;

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <div className="tree-node">
      <div 
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'folder' && (
          <span className={`tree-arrow ${isExpanded ? 'expanded' : ''}`}>▶</span>
        )}
        <span className="tree-icon">{node.type === 'folder' ? '📁' : '📄'}</span>
        <span className="tree-name">{node.name}</span>
      </div>
      {node.type === 'folder' && isExpanded && node.children && (
        <div className="tree-children">
          {node.children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileBrowserProps {
  rootPath: string;
  onNavigate: (path: string) => void;
}

export function FileBrowser({ rootPath, onNavigate }: FileBrowserProps) {
  return (
    <div className="file-browser">
      <div className="browser-toolbar">
        <button onClick={() => onNavigate(rootPath)}>Home</button>
        <button onClick={() => onNavigate(rootPath)}>Up</button>
      </div>
      <FileTree 
        nodes={[]}
        onSelect={(node) => onNavigate(node.id)}
      />
    </div>
  );
}