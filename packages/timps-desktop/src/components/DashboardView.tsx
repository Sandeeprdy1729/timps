/**
 * TIMPS Desktop — Dashboard (Overview)
 * Visual representation of stored data: memory statistics and recent
 * knowledge at a glance.
 */
import { useMemo } from 'react';
import { AggregateStats, SemanticEntry, EpisodicEntry } from '../api';
import { formatRelativeTime } from '../utils/index';
import './DashboardView.css';

interface DashboardViewProps {
  stats: AggregateStats | null;
  semanticEntries: SemanticEntry[];
  episodicEntries: EpisodicEntry[];
  loading: boolean;
  onNavigate: (view: string) => void;
}

const TYPE_TINT: Record<string, string> = {
  fact: '#4ade80',
  pattern: '#60a5fa',
  error: '#f87171',
  architecture: '#c084fc',
  decision: '#fbbf24',
};

export function DashboardView({
  stats,
  semanticEntries,
  episodicEntries,
  loading,
  onNavigate,
}: DashboardViewProps) {
  const recent = useMemo(() => {
    return [...semanticEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [semanticEntries]);

  const episodes = useMemo(() => {
    return [...episodicEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [episodicEntries]);

  const hasData = stats !== null;

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h2>Overview</h2>
          <p className="dashboard-sub">
            {hasData
              ? stats.stores > 0
                ? `Aggregated across ${stats.stores} store${stats.stores === 1 ? '' : 's'} in ~/.timps`
                : 'No memory stores found yet — connect a data source to start building knowledge.'
              : 'Loading…'}
          </p>
        </div>
        {hasData && (
          <div className="dashboard-actions">
            <button className="dash-btn" onClick={() => onNavigate('memory')}>
              Memory
            </button>
            <button className="dash-btn" onClick={() => onNavigate('nexus')}>
              Graph
            </button>
            <button className="dash-btn primary" onClick={() => onNavigate('connectors')}>
              Connectors
            </button>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="dash-stats">
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasData ? stats.semantic_count : '—'}</span>
          <span className="dash-stat-label">Memories</span>
          <span className="dash-stat-desc">Facts, patterns, decisions</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasData ? stats.episode_count : '—'}</span>
          <span className="dash-stat-label">Episodes</span>
          <span className="dash-stat-desc">Past conversations</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasData ? stats.working_goals : '—'}</span>
          <span className="dash-stat-label">Goals</span>
          <span className="dash-stat-desc">Active objectives</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasData ? stats.stores : '—'}</span>
          <span className="dash-stat-label">Stores</span>
          <span className="dash-stat-desc">Project memory roots</span>
        </div>
      </div>

      <div className="dash-columns">
        {/* Recent knowledge */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>Recent memories</span>
            <button className="dash-link" onClick={() => onNavigate('memory')}>
              View all
            </button>
          </div>
          {loading ? (
            <div className="dash-empty">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              No memories yet — connect a data source to build knowledge.
            </div>
          ) : (
            <ul className="dash-fact-list">
              {recent.map((entry) => (
                <li key={`${entry.source ?? ''}:${entry.id}`} className="dash-fact">
                  <span
                    className="dash-fact-type"
                    style={{ background: TYPE_TINT[entry.type] ?? 'var(--accent, #4a8c7a)' }}
                  >
                    {entry.type}
                  </span>
                  <span className="dash-fact-content">{entry.content}</span>
                  <span className="dash-fact-time">{formatRelativeTime(entry.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent episodes */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>Recent episodes</span>
            <button className="dash-link" onClick={() => onNavigate('memory')}>
              View all
            </button>
          </div>
          {loading ? (
            <div className="dash-empty">Loading…</div>
          ) : episodes.length === 0 ? (
            <div className="dash-empty">No episodes recorded yet.</div>
          ) : (
            <ul className="dash-session-list">
              {episodes.map((entry) => (
                <li key={`${entry.source ?? ''}:${entry.id}`} className="dash-session">
                  <span className="dash-session-summary">{entry.summary}</span>
                  <span className="dash-session-meta">
                    {formatRelativeTime(entry.timestamp)}
                    {entry.tags.length > 0 ? ` · ${entry.tags.slice(0, 3).join(', ')}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}