import { Tab } from '../App';
import { MemoryStats } from '../api';
import './Sidebar.css';

interface Props {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  stats: MemoryStats | null;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '◉' },
  { id: 'stats', label: 'Overview', icon: '◈' },
  { id: 'semantic', label: 'Semantic', icon: '⬡' },
  { id: 'episodic', label: 'Episodic', icon: '⌚' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ activeTab, onTabChange, stats }: Props) {
  return (
    <nav className="sidebar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onTabChange(t.id)}
          title={t.label}
        >
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
          {t.id === 'semantic' && stats && (
            <span className="badge">{stats.semantic_count}</span>
          )}
          {t.id === 'episodic' && stats && (
            <span className="badge">{stats.episode_count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
