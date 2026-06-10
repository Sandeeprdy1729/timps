/**
 * TIMPS Desktop - Sidebar Component
 * Main navigation sidebar with stats and navigation.
 */

import { useState } from 'react';
import { api, MemoryStats } from '../api';
import './Sidebar.css';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  stats: MemoryStats | null;
}

const tabs = [
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'command', icon: '⌘', label: 'Command' },
  { id: 'lens', icon: '⚡', label: 'Lens' },
  { id: 'semantic', icon: '🧠', label: 'Memory' },
  { id: 'episodic', icon: '📜', label: 'Sessions' },
  { id: 'stats', icon: '📊', label: 'Stats' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export function Sidebar({ activeTab, onTabChange, stats }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button 
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            {!collapsed && <span className="nav-label">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {stats && !collapsed && (
        <div className="sidebar-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.semantic_count}</span>
            <span className="stat-label">Memories</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.episode_count}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.working_goals}</span>
            <span className="stat-label">Goals</span>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="project-hash">
            <span className="hash-label">Project</span>
            <code className="hash-value">{stats?.project_hash || '—'}</code>
          </div>
        )}
      </div>
    </aside>
  );
}
