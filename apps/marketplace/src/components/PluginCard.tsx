import Link from 'next/link';

interface PluginCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  author?: string;
  version: string;
  avgRating?: number;
  reviewCount?: number;
  totalDownloads?: number;
}

export function PluginCard({ plugin }: { plugin: PluginCardData }) {
  const isNew = plugin.version.startsWith('1.');
  const rating = plugin.avgRating ? `★ ${plugin.avgRating.toFixed(1)}` : null;
  const downloads = plugin.totalDownloads ? `${plugin.totalDownloads.toLocaleString()} downloads` : null;
  
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">{plugin.icon}</div>
        {isNew && <span className="card-badge new">New</span>}
      </div>
      <h3 className="card-title">{plugin.name}</h3>
      <p className="card-description">{plugin.description}</p>
      {(rating || downloads) && (
        <div className="card-meta text-sm text-gray-500 mt-1">
          {rating && <span className="mr-2">{rating}</span>}
          {downloads && <span>{downloads}</span>}
        </div>
      )}
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
