import { useState } from 'react';
import { SemanticEntry } from '../api';
import './SemanticView.css';

interface Props {
  entries: SemanticEntry[];
  loading: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  fact: '#3fb950',
  pattern: '#58a6ff',
  error: '#f85149',
  architecture: '#d29922',
};

export function SemanticView({ entries, loading }: Props) {
  const [filter, setFilter] = useState('');

  const visible = filter
    ? entries.filter(
        (e) =>
          e.content.toLowerCase().includes(filter.toLowerCase()) ||
          e.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())),
      )
    : entries;

  return (
    <div className="semantic-view">
      <div className="view-header">
        <h2 className="view-title">Semantic Memory</h2>
        <span className="count-badge">{visible.length} / {entries.length}</span>
      </div>

      <input
        className="filter-input"
        type="text"
        placeholder="Filter entries…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {loading && entries.length === 0 ? (
        <div className="loading-state">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="loading-state">No entries found.</div>
      ) : (
        <div className="entry-list">
          {visible.map((e) => (
            <div className="entry-card" key={e.id}>
              <div className="entry-meta">
                <span
                  className="entry-type"
                  style={{ color: TYPE_COLORS[e.type] ?? 'var(--text-muted)' }}
                >
                  {e.type}
                </span>
                <span className="entry-date">
                  {new Date(e.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="entry-content">{e.content}</p>
              {e.tags.length > 0 && (
                <div className="entry-tags">
                  {e.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
