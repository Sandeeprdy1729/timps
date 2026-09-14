/**
 * TIMPS Desktop — Dashboard (Overview)
 * Visual representation of stored data: memory statistics, connector health
 * and recent knowledge — all in one glance.
 */
import { useEffect, useState, useMemo } from 'react';
import { api, MemoryStats, SemanticEntry, EpisodicEntry, GmailStatus } from '../api';
import { formatRelativeTime } from '../utils/index';
import './DashboardView.css';

interface DashboardViewProps {
  projectPath: string;
  stats: MemoryStats | null;
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
  projectPath,
  stats,
  semanticEntries,
  episodicEntries,
  loading,
  onNavigate,
}: DashboardViewProps) {
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setGmailLoading(true);
    api
      .gmailStatus()
      .then((s) => {
        if (active) setGmail(s);
      })
      .catch(() => {
        if (active) setGmail(null);
      })
      .finally(() => {
        if (active) setGmailLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const recent = useMemo(() => {
    return [...semanticEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [semanticEntries]);

  const sessions = useMemo(() => {
    return [...episodicEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [episodicEntries]);

  const hasProject = Boolean(projectPath) && stats !== null;

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h2>Overview</h2>
          <p className="dashboard-sub">
            {hasProject
              ? `Visualizing memory for project ${stats?.project_hash ?? ''}`
              : 'Select a project path to start visualizing memory.'}
          </p>
        </div>
        {hasProject && (
          <div className="dashboard-actions">
            <button className="dash-btn" onClick={() => onNavigate('semantic')}>
              Memory
            </button>
            <button className="dash-btn" onClick={() => onNavigate('nexus')}>
              Graph
            </button>
            <button
              className={`dash-btn primary ${gmail?.connected ? '' : 'pulse'}`}
              onClick={() => onNavigate('connectors')}
            >
              Connectors
            </button>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="dash-stats">
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasProject ? stats?.semantic_count ?? 0 : '—'}</span>
          <span className="dash-stat-label">Memories</span>
          <span className="dash-stat-desc">Facts, patterns, decisions</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasProject ? stats?.episode_count ?? 0 : '—'}</span>
          <span className="dash-stat-label">Sessions</span>
          <span className="dash-stat-desc">Past conversations</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">{hasProject ? stats?.working_goals ?? 0 : '—'}</span>
          <span className="dash-stat-label">Goals</span>
          <span className="dash-stat-desc">Active objectives</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-value">
            {gmailLoading ? '…' : (gmail?.summaryCount ?? 0)}
            <span className="dash-stat-unit">emails</span>
          </span>
          <span className="dash-stat-label">Gmail facts</span>
          <span className="dash-stat-desc">
            {gmail?.connected ? `synced from ${gmail.email ?? ''}` : 'not connected yet'}
          </span>
        </div>
      </div>

      <div className="dash-columns">
        {/* Connector panel */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>Connectors</span>
            <button className="dash-link" onClick={() => onNavigate('connectors')}>
              Manage
            </button>
          </div>
          <div
            className={`dash-conn ${gmail?.connected ? 'on' : 'off'} ${gmailLoading ? 'loading' : ''}`}
            onClick={() => onNavigate('connectors')}
          >
            <div className="dash-conn-logo" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
            </div>
            <div className="dash-conn-info">
              <div className="dash-conn-name">
                Gmail
                <span className={`dash-dot ${gmail?.connected ? 'on' : 'off'}`} />
              </div>
              <div className="dash-conn-meta">
                {gmailLoading
                  ? 'Checking…'
                  : gmail?.connected
                    ? `${gmail.messagesSynced ?? 0} messages · last sync ${gmail.lastRun ? new Date(gmail.lastRun).toLocaleDateString() : 'never'}`
                    : 'Connect Google to distill inbox → memory'}
              </div>
            </div>
            <span className="dash-chev">›</span>
          </div>
          <div className="dash-conn-muted">Slack · Notion · Drive · Outlook — coming soon</div>
        </section>

        {/* Recent knowledge */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>Recent memories</span>
            <button className="dash-link" onClick={() => onNavigate('semantic')}>
              View all
            </button>
          </div>
          {loading ? (
            <div className="dash-empty">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              {hasProject
                ? 'No memories yet — chat with TIMPS or connect a connector to build knowledge.'
                : 'Select a project to see recent memories.'}
            </div>
          ) : (
            <ul className="dash-fact-list">
              {recent.map((entry) => (
                <li key={entry.id} className="dash-fact">
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

        {/* Recent sessions */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>Recent sessions</span>
            <button className="dash-link" onClick={() => onNavigate('episodic')}>
              View all
            </button>
          </div>
          {loading ? (
            <div className="dash-empty">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="dash-empty">No sessions recorded yet.</div>
          ) : (
            <ul className="dash-session-list">
              {sessions.map((entry) => (
                <li key={entry.id} className="dash-session">
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