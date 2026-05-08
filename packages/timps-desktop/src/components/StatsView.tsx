/**
 * TIMPS Desktop - Stats View
 * Display memory statistics and insights.
 */

import { useMemo } from 'react';
import { api, MemoryStats } from '../api';
import { formatDate } from '../utils/index';
import './StatsView.css';

interface StatsViewProps {
  stats: MemoryStats | null;
  loading: boolean;
}

export function StatsView({ stats, loading }: StatsViewProps) {
  const total = useMemo(() => {
    if (!stats) return 0;
    return stats.semantic_count + stats.episode_count;
  }, [stats]);

  const health = useMemo(() => {
    if (!stats) return 0;
    if (total === 0) return 0;
    const memoryHealth = Math.min(stats.semantic_count / 100, 1);
    const sessionHealth = Math.min(stats.episode_count / 50, 1);
    return Math.round(((memoryHealth + sessionHealth) / 2) * 100);
  }, [stats, total]);

  if (loading || !stats) {
    return <div className="stats-view"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="stats-view">
      <h2>Memory Statistics</h2>

      <div className="stats-overview">
        <div className="overview-card health-card">
          <div className="health-circle">
            <svg viewBox="0 0 100 100">
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="var(--bg-tertiary)" 
                strokeWidth="8"
              />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="var(--accent)" 
                strokeWidth="8"
                strokeDasharray={`${health * 2.83} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="health-value">{health}%</div>
          </div>
          <span className="health-label">Memory Health</span>
        </div>

        <div className="overview-stats">
          <div className="stat-card primary">
            <span className="stat-value">{stats.semantic_count}</span>
            <span className="stat-label">Semantic Memories</span>
            <span className="stat-desc">Facts, patterns, decisions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.episode_count}</span>
            <span className="stat-label">Sessions</span>
            <span className="stat-desc">Past conversations</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.working_goals}</span>
            <span className="stat-label">Active Goals</span>
            <span className="stat-desc">Current objectives</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Project Info</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Project Hash</span>
            <code className="info-value">{stats.project_hash}</code>
          </div>
          <div className="info-item">
            <span className="info-label">Total Entries</span>
            <span className="info-value">{total}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Storage Location</h3>
        <div className="storage-path">
          <code>~/.timps/memory/{stats.project_hash}/</code>
        </div>
        <div className="storage-files">
          <div className="file-item">
            <span className="file-name">semantic.json</span>
            <span className="file-desc">Permanent facts</span>
          </div>
          <div className="file-item">
            <span className="file-name">episodes.jsonl</span>
            <span className="file-desc">Session history</span>
          </div>
          <div className="file-item">
            <span className="file-name">working.json</span>
            <span className="file-desc">Active state</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Recommendations</h3>
        <div className="recommendations">
          {stats.semantic_count < 10 && (
            <div className="rec-item warning">
              <span className="rec-icon">💡</span>
              <span>Start adding semantic memories to build knowledge</span>
            </div>
          )}
          {stats.episode_count < 5 && (
            <div className="rec-item info">
              <span className="rec-icon">📜</span>
              <span>Use TIMPS more to build session history</span>
            </div>
          )}
          {health >= 80 && (
            <div className="rec-item success">
              <span className="rec-icon">✨</span>
              <span>Great memory health! Keep it up.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}