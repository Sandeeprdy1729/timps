import Link from 'next/link';

interface PluginCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  author?: string;
  version: string;
}

export function PluginCard({ plugin }: { plugin: PluginCardData }) {
  const isNew = plugin.version.startsWith('1.');
  
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">{plugin.icon}</div>
        {isNew && <span className="card-badge new">New</span>}
      </div>
      <h3 className="card-title">{plugin.name}</h3>
      <p className="card-description">{plugin.description}</p>
      <div className="card-footer">
        <div className="card-stats">
          <span className="card-badge">{plugin.category}</span>
          <span className="card-stat">v{plugin.version}</span>
        </div>
        <Link href={`/plugins/${plugin.id}`} className="install-btn">
          View
        </Link>
      </div>
    </div>
  );
}
