import Link from 'next/link';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
}

export function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">{integration.icon}</div>
        {integration.downloads > 40000 && (
          <span className="card-badge popular">Popular</span>
        )}
      </div>
      <h3 className="card-title">{integration.name}</h3>
      <p className="card-description">{integration.description}</p>
      <div className="card-footer">
        <div className="card-stats">
          <span className="card-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {(integration.downloads / 1000).toFixed(0)}k
          </span>
          <span className="card-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {integration.rating}
          </span>
        </div>
        <Link href={`/integrations/${integration.id}`} className="install-btn">
          View
        </Link>
      </div>
    </div>
  );
}