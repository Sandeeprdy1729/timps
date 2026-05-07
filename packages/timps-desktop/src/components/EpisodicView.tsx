import { EpisodicEntry } from '../api';
import './EpisodicView.css';

interface Props {
  entries: EpisodicEntry[];
  loading: boolean;
}

const OUTCOME_COLOR: Record<string, string> = {
  success: 'var(--success)',
  failure: 'var(--danger)',
  partial: 'var(--warning)',
};

export function EpisodicView({ entries, loading }: Props) {
  if (loading && entries.length === 0) {
    return <div className="loading-state">Loading…</div>;
  }

  const sorted = [...entries].reverse(); // newest first in display

  return (
    <div className="episodic-view">
      <div className="view-header">
        <h2 className="view-title">Episodic Memory</h2>
        <span className="count-badge">{entries.length} sessions</span>
      </div>

      {sorted.length === 0 ? (
        <div className="loading-state">No episodes yet.</div>
      ) : (
        <div className="timeline">
          {sorted.map((e, i) => (
            <div className="timeline-item" key={e.id}>
              <div className="timeline-dot" style={{ background: OUTCOME_COLOR[e.outcome] ?? 'var(--text-muted)' }} />
              {i < sorted.length - 1 && <div className="timeline-line" />}
              <div className="timeline-content">
                <div className="ep-meta">
                  <span
                    className="ep-outcome"
                    style={{ color: OUTCOME_COLOR[e.outcome] ?? 'var(--text-muted)' }}
                  >
                    {e.outcome}
                  </span>
                  <span className="ep-date">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="ep-summary">{e.summary}</p>
                {e.tags.length > 0 && (
                  <div className="entry-tags">
                    {e.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
