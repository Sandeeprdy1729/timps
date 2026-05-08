import { PluginCard } from './PluginCard';

const plugins = [
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    description: 'Advanced static analysis and code quality checks',
    icon: '📊',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '2.0.0',
  },
  {
    id: 'auto-refactor',
    name: 'Auto Refactor',
    description: 'Automatically refactor code for best practices',
    icon: '🔧',
    category: 'Developer Tools',
    author: 'Community',
    version: '1.5.0',
  },
  {
    id: 'test-generator',
    name: 'Test Generator',
    description: 'Generate unit tests from code automatically',
    icon: '🧪',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '3.0.0',
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scan for vulnerabilities and security issues',
    icon: '🔒',
    category: 'Security',
    author: 'TIMPS Team',
    version: '1.8.0',
  },
  {
    id: 'doc-generator',
    name: 'Doc Generator',
    description: 'Generate documentation from code comments',
    icon: '📄',
    category: 'Developer Tools',
    author: 'Community',
    version: '2.2.0',
  },
  {
    id: 'git-helper',
    name: 'Git Helper',
    description: 'Enhanced git workflows and automation',
    icon: '🌿',
    category: 'Developer Tools',
    author: 'TIMPS Team',
    version: '1.0.0',
  },
  {
    id: 'docker-build',
    name: 'Docker Build',
    description: 'Build and manage Docker containers',
    icon: '🐳',
    category: 'Developer Tools',
    author: 'Community',
    version: '1.3.0',
  },
  {
    id: 'ai-summarizer',
    name: 'AI Summarizer',
    description: 'Summarize code changes with AI',
    icon: '🧠',
    category: 'AI & LLMs',
    author: 'TIMPS Team',
    version: '1.0.0',
  },
  {
    id: 'slack-notifier',
    name: 'Slack Notifier',
    description: 'Send notifications to Slack channels',
    icon: '💬',
    category: 'Communication',
    author: 'Community',
    version: '2.0.0',
  },
  {
    id: 'metric-dashboard',
    name: 'Metric Dashboard',
    description: 'Display code metrics in real-time',
    icon: '📈',
    category: 'Analytics',
    author: 'TIMPS Team',
    version: '1.2.0',
  },
  {
    id: 'db-migrator',
    name: 'Database Migrator',
    description: 'Manage database migrations',
    icon: '🗄️',
    category: 'Database',
    author: 'Community',
    version: '1.0.0',
  },
  {
    id: 'env-manager',
    name: 'Environment Manager',
    description: 'Manage environment variables across projects',
    icon: '⚙️',
    category: 'Developer Tools',
    author: 'Community',
    version: '1.1.0',
  },
];

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