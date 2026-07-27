import { PluginCard } from './PluginCard';
import { plugins as localPlugins } from '@/data/plugins';
import type { Plugin } from '@/data/plugins';

const MARKETPLACE_API = process.env.NEXT_PUBLIC_MARKETPLACE_API || 'http://localhost:4100/marketplace';

interface RemotePlugin {
  name: string;
  description: string;
  author: string;
  latestVersion: string;
  permissions?: string[];
  avgRating?: number;
  reviewCount?: number;
  totalDownloads?: number;
}

async function fetchRemotePlugins(): Promise<Plugin[]> {
  try {
    const res = await fetch(`${MARKETPLACE_API}/plugins`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const remote: RemotePlugin[] = await res.json();
    return remote.map(p => ({
      id: p.name.replace(/[^a-z0-9-]/g, '-'),
      name: p.name,
      description: p.description,
      fullDescription: p.description,
      icon: '🧩',
      category: 'Marketplace',
      author: p.author,
      version: p.latestVersion,
      features: p.permissions?.map((perm: string) => `Permission: ${perm}`) ?? [],
      installation: `timps install ${p.name}`,
      configuration: '',
      repo: '',
    }));
  } catch {
    return [];
  }
}

export async function PluginGrid({ category = 'all', searchQuery = '' }: { category?: string; searchQuery?: string }) {
  const remotePlugins = await fetchRemotePlugins();
  const allPlugins = [...localPlugins, ...remotePlugins];

  const filtered = allPlugins.filter((p) => {
    const matchesCategory = category === 'all' || p.category === category || (category === 'Marketplace' && p.category === 'Marketplace');
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    return (
      <div className="container">
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? `No results for "${searchQuery}"` : 'No plugins available.'}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="grid">
        {filtered.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
    </div>
  );
}
