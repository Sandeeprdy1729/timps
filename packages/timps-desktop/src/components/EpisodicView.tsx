/**
 * TIMPS Desktop - Episodic Memory View
 * Display session history/episodes.
 */

import { useState, useMemo } from 'react';
import { api, EpisodicEntry } from '../api';
import { formatDate } from '../utils/index';
import './EpisodicView.css';

interface EpisodicViewProps {
  entries: EpisodicEntry[];
  loading: boolean;
}

export function EpisodicView({ entries, loading }: EpisodicViewProps) {
  const [filter, setFilter] = useState<string>('all');
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodicEntry | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.outcome === filter);
  }, [entries, filter]);

  const stats = useMemo(() => {
    const total = entries.length;
    const success = entries.filter(e => e.outcome === 'success').length;
    const failure = entries.filter(e => e.outcome === 'failure').length;
    const partial = entries.filter(e => e.outcome === 'partial').length;
    return { total, success, failure, partial, successRate: total ? Math.round((success / total) * 100) : 0 };
  }, [entries]);

  if (loading) {
    return <div className="episodic-view"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="episodic-view">
      <div className="view-header">
        <h2>Session History</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Sessions</option>
          <option value="success">Successful</option>
          <option value="failure">Failed</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      <div className="session-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card success">
          <span className="stat-value">{stats.success}</span>
          <span className="stat-label">Successful</span>
        </div>
        <div className="stat-card failure">
          <span className="stat-value">{stats.failure}</span>
          <span className="stat-label">Failed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.successRate}%</span>
          <span className="stat-label">Success Rate</span>
        </div>
      </div>

      <div className="sessions-list">
        {filtered.map(entry => (
          <div 
            key={entry.id}
            className={`session-card outcome-${entry.outcome}`}
            onClick={() => setSelectedEpisode(entry)}
          >
            <div className="session-header">
              <span className={`outcome-badge ${entry.outcome}`}>{entry.outcome}</span>
              <span className="session-date">{formatDate(entry.timestamp)}</span>
            </div>
            <div className="session-summary">{entry.summary}</div>
            {entry.tags.length > 0 && (
              <div className="session-tags">
                {entry.tags.map(tag => (
                  <span key={tag} className="session-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedEpisode && (
        <div className="episode-detail-overlay" onClick={() => setSelectedEpisode(null)}>
          <div className="episode-detail" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <span className={`outcome-badge ${selectedEpisode.outcome}`}>
                {selectedEpisode.outcome}
              </span>
              <button onClick={() => setSelectedEpisode(null)}>✕</button>
            </div>
            <div className="detail-summary">{selectedEpisode.summary}</div>
            <div className="detail-meta">
              <span>ID: {selectedEpisode.id}</span>
              <span>Date: {formatDate(selectedEpisode.timestamp)}</span>
            </div>
            {selectedEpisode.tags.length > 0 && (
              <div className="detail-tags">
                {selectedEpisode.tags.map(tag => (
                  <span key={tag} className="session-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}