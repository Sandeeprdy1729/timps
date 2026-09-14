/**
 * TIMPS Desktop - Stats View
 * Aggregate memory statistics across every store in ~/.timps.
 */

import { useMemo } from 'react';
import { AggregateStats } from '../api';
import './StatsView.css';

interface StatsViewProps {
  stats: AggregateStats | null;
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

  if (loading) {
    return <div className="stats-view"><div className="loading">Loading...</div></div>;
  }

  if (!stats) {
    return (
      <div className="stats-view">
        <h2>Memory Statistics</h2>
        <div className="stats-section">
          <div className="stats-empty">
            No memory data found in ~/.timps. Connect a data source to start
            building knowledge.
          </div>
        </div>
      </div>
    );
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
            <span className="stat-label">Episodes</span>
            <span className="stat-desc">Past conversations</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.stores}</span>
            <span className="stat-label">Memory Stores</span>
            <span className="stat-desc">Project roots in ~/.timps/memory</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.working_goals}</span>
            <span className="stat-label">Active Goals</span>
            <span className="stat-desc">Current objectives</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Storage</h3>
        <div className="stats-empty">Everything lives under <code>~/.timps/</code>.</div>
        <div className="storage-files">
          <div className="file-item">
            <span className="file-name">memory/&lt;hash&gt;/semantic.json</span>
            <span className="file-desc">Permanent facts (per store)</span>
          </div>
          <div className="file-item">
            <span className="file-name">memory/&lt;hash&gt;/episodes.jsonl</span>
            <span className="file-desc">Session history (per store)</span>
          </div>
          <div className="file-item">
            <span className="file-name">&lt;connector&gt;/</span>
            <span className="file-desc">OAuth tokens + synced data per connector</span>
          </div>
        </div>
      </div>

      {stats.breakdown.length > 0 && (
        <div className="stats-section">
          <h3>Per-Store Breakdown</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Memories</th>
                <th>Episodes</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {stats.breakdown.map((s) => (
                <tr key={s.project_hash}>
                  <td><code>{s.project_hash}</code></td>
                  <td>{s.semantic_count}</td>
                  <td>{s.episode_count}</td>
                  <td>{s.working_goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stats-section">
        <h3>Recommendations</h3>
        <div className="recommendations">
          {stats.semantic_count < 10 && (
            <div className="rec-item warning">
              <span className="rec-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
                </svg>
              </span>
              <span>Connect a data source to start building semantic knowledge</span>
            </div>
          )}
          {stats.episode_count < 5 && (
            <div className="rec-item info">
              <span className="rec-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </span>
              <span>Use TIMPS more to build session history</span>
            </div>
          )}
          {health >= 80 && (
            <div className="rec-item success">
              <span className="rec-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </span>
              <span>Great memory health! Keep it up.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}