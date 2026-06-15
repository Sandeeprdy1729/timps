import { IntegrationCard } from './IntegrationCard';
import { integrations } from '@/data/integrations';

export function IntegrationGrid({ category = 'all', searchQuery = '' }: { category?: string; searchQuery?: string }) {
  const filtered = integrations.filter((i) => {
    const matchesCategory = category === 'all' || i.category === category;
    const matchesSearch = !searchQuery || 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container">
      <div className="grid">
        {filtered.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
    </div>
  );
}
