import { PluginCard } from './PluginCard';
import { plugins } from '@/data/plugins';

export function PluginGrid({ category = 'all', searchQuery = '' }: { category?: string; searchQuery?: string }) {
  const filtered = plugins.filter((p) => {
    const matchesCategory = category === 'all' || p.category === category;
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
