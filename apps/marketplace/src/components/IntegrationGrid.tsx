import { IntegrationCard } from './IntegrationCard';

const integrations = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Automate PR reviews, issue management, and repository workflows',
    icon: '🐙',
    category: 'Developer Tools',
    downloads: 45000,
    rating: 4.9,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications, create channels, and manage messages',
    icon: '💬',
    category: 'Communication',
    downloads: 38000,
    rating: 4.8,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Access GPT models for code generation and analysis',
    icon: '🤖',
    category: 'AI & LLMs',
    downloads: 52000,
    rating: 4.9,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Sync issues, track projects, and manage sprints',
    icon: '📋',
    category: 'Productivity',
    downloads: 28000,
    rating: 4.7,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Create pages, databases, and knowledge bases',
    icon: '📝',
    category: 'Productivity',
    downloads: 32000,
    rating: 4.8,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy apps and manage edge functions',
    icon: '▲',
    category: 'Developer Tools',
    downloads: 25000,
    rating: 4.9,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage subscriptions',
    icon: '💳',
    category: 'Database',
    downloads: 18000,
    rating: 4.8,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Manage issues, sprints, and project roadmaps',
    icon: '📊',
    category: 'Productivity',
    downloads: 22000,
    rating: 4.6,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM integration for leads and opportunities',
    icon: '☁️',
    category: 'Database',
    downloads: 15000,
    rating: 4.5,
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Monitor applications and infrastructure',
    icon: '🐕',
    category: 'Analytics',
    downloads: 12000,
    rating: 4.7,
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Track errors and monitor application health',
    icon: '🔍',
    category: 'Analytics',
    downloads: 20000,
    rating: 4.8,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Marketing automation and CRM',
    icon: '🎯',
    category: 'Database',
    downloads: 16000,
    rating: 4.6,
  },
];

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