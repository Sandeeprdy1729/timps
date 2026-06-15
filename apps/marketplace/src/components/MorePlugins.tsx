import { PluginCard } from './PluginCard';

const morePlugins = [
  {
    id: 'api-client',
    name: 'API Client',
    description: 'Test and manage REST APIs directly from TIMPS',
    icon: '🔌',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '1.0.0',
  },
  {
    id: 'openapi-generator',
    name: 'OpenAPI Generator',
    description: 'Generate code from OpenAPI specifications',
    icon: '📜',
    category: 'Developer Tools',
    author: 'Community',
    version: '2.0.0',
  },
  {
    id: 'graphql-client',
    name: 'GraphQL Client',
    description: 'Query and mutate GraphQL endpoints',
    icon: '◼️',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '1.5.0',
  },
  {
    id: 'schema-migrator',
    name: 'Schema Migrator',
    description: 'Migrate database schemas between environments',
    icon: '🗂️',
    category: 'Database',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'seed-generator',
    name: 'Seed Generator',
    description: 'Generate seed data for development databases',
    icon: '🌱',
    category: 'Database',
    author: 'Community',
    version: '1.2.0',
  },
  {
    id: 'query-builder',
    name: 'Query Builder',
    description: 'Build SQL queries visually',
    icon: '💾',
    category: 'Database',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'format-converter',
    name: 'Format Converter',
    description: 'Convert between JSON, YAML, XML, TOML',
    icon: '🔄',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '2.0.0',
  },
  {
    id: 'secret-scanner',
    name: 'Secret Scanner',
    description: 'Scan code for exposed secrets and API keys',
    icon: '🔐',
    category: 'Security',
    author: 'TIMPS Team',
    version: '1.0.0',
  },
  {
    id: 'license-checker',
    name: 'License Checker',
    description: 'Check license compliance for dependencies',
    icon: '📜',
    category: 'Security',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'perf-profiler',
    name: 'Performance Profiler',
    description: 'Profile code execution time and memory',
    icon: '⚡',
    category: 'Analytics',
    author: 'TIMPS Team',
    version: '1.0.0',
  },
  {
    id: 'bundle-analyzer',
    name: 'Bundle Analyzer',
    description: 'Analyze and visualize bundle sizes',
    icon: '📦',
    category: 'Analytics',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'i18n-helper',
    name: 'i18n Helper',
    description: 'Manage internationalization strings',
    icon: '🌍',
    category: 'Developer Tools',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'deploy-helper',
    name: 'Deploy Helper',
    description: 'One-click deploy to various platforms',
    icon: '🚀',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '2.0.0',
  },
  {
    id: 'log-viewer',
    name: 'Log Viewer',
    description: 'Parse and view log files in real-time',
    icon: '📋',
    category: 'Analytics',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'env-validator',
    name: 'Env Validator',
    description: 'Validate environment variables schemas',
    icon: '✅',
    category: 'Developer Tools',
    author: 'Community',
    version: '1.0.0',
  },
];

export function MorePluginGrid({ category = 'all', searchQuery = '' }: { category?: string; searchQuery?: string }) {
  const filtered = morePlugins.filter((p) => {
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
