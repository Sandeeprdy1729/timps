import { MemoryStats } from '../api';
import './StatsView.css';

interface Props {
  stats: MemoryStats | null;
  loading: boolean;
}

export function StatsView({ stats, loading }: Props) {
  if (loading && !stats) {
    return <div className="loading-state">Loading memory stats…</div>;
  }
  if (!stats) {
    return <div className="loading-state">No data yet.</div>;
  }

  const cards = [
    { label: 'Project hash', value: stats.project_hash, mono: true },
    { label: 'Semantic entries', value: String(stats.semantic_count), mono: false },
    { label: 'Episodes', value: String(stats.episode_count), mono: false },
    { label: 'Active goals', value: String(stats.working_goals), mono: false },
  ];

  return (
    <div className="stats-view">
      <h2 className="view-title">Overview</h2>
      <div className="stats-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <span className="stat-label">{c.label}</span>
            <span className={`stat-value ${c.mono ? 'mono' : ''}`}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
