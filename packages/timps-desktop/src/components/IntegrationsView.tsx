import { useState } from 'react';
import { INTEGRATION_CATEGORIES } from '../constants/index';
import './IntegrationSettings.css';

interface IntegrationCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: keyof typeof INTEGRATION_CATEGORIES;
  authType: string;
  configured: boolean;
}

const ALL_INTEGRATIONS: IntegrationCard[] = [
  { id: 'github', name: 'GitHub', icon: '', description: 'Code repositories, PRs, issues, and actions', category: 'dev-tools', authType: 'api_key', configured: false },
  { id: 'claude-mcp', name: 'Claude Code MCP', icon: '◈', description: '61 MCP tools — file ops, search, memory, terminal, and agent orchestration', category: 'ai-agents', authType: 'built-in', configured: false },
  { id: 'openai-agents', name: 'OpenAI Agents SDK', icon: '◆', description: 'OpenAI Agent integration with code interpreter and file search', category: 'ai-agents', authType: 'api_key', configured: false },
  { id: 'telegram', name: 'Telegram Bot', icon: '', description: 'Bot messages, commands, and inline queries', category: 'messaging', authType: 'api_key', configured: false },
  { id: 'slack', name: 'Slack', icon: '', description: 'Team messaging, channels, and slash commands', category: 'messaging', authType: 'oauth2', configured: false },
  { id: 'line', name: 'Line', icon: '', description: 'Line messaging platform integration', category: 'messaging', authType: 'oauth2', configured: false },
  { id: 'wechat', name: 'WeChat', icon: '', description: 'WeChat official account integration', category: 'messaging', authType: 'oauth2', configured: false },
  { id: 'google-calendar', name: 'Google Calendar', icon: '', description: 'Calendar and scheduling', category: 'productivity', authType: 'oauth2', configured: false },
  { id: 'google-gmail', name: 'Google Gmail', icon: '', description: 'Email management', category: 'productivity', authType: 'oauth2', configured: false },
  { id: 'notion', name: 'Notion', icon: '', description: 'All-in-one workspace', category: 'productivity', authType: 'api_key', configured: false },
  { id: 'jira', name: 'Jira', icon: '', description: 'Project tracking', category: 'dev-tools', authType: 'api_key', configured: false },
  { id: 'linear', name: 'Linear', icon: '', description: 'Issue tracking', category: 'dev-tools', authType: 'api_key', configured: false },
  { id: 'discord', name: 'Discord', icon: '', description: 'Community chat', category: 'messaging', authType: 'oauth2', configured: false },
  { id: 'vscode', name: 'VS Code Extension', icon: '', description: 'TIMPS AI Coding Agent — inline coding assistant', category: 'dev-tools', authType: 'built-in', configured: false },
];

export function IntegrationsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = ALL_INTEGRATIONS.filter(int => {
    const matchesSearch = !searchQuery ||
      int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || int.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = filtered.reduce<Record<string, IntegrationCard[]>>((acc, int) => {
    if (!acc[int.category]) acc[int.category] = [];
    acc[int.category].push(int);
    return acc;
  }, {});

  return (
    <div className="integration-settings-page">
      <header className="integration-header">
        <h1>Integrations</h1>
        <p className="integration-subtitle">
          Connect TIMPS to your tools and services. Categorized by function.
        </p>
      </header>

      <div className="integration-toolbar">
        <input
          type="text"
          className="integration-search"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="integration-filters">
          <button
            className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {Object.entries(INTEGRATION_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`filter-btn ${activeCategory === key ? 'active' : ''}`}
              onClick={() => setActiveCategory(key)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => {
        const catInfo = INTEGRATION_CATEGORIES[category as keyof typeof INTEGRATION_CATEGORIES];
        return (
          <div key={category} className="integration-category-section">
            <h2 className="category-title">
              {catInfo?.icon || ''} {catInfo?.label || category}
            </h2>
            <div className="integration-grid">
              {items.map(int => (
                <div
                  key={int.id}
                  className={`integration-card ${int.configured ? 'connected' : ''}`}
                >
                  <div className="integration-icon">{int.icon}</div>
                  <div className="integration-info">
                    <h3>{int.name}</h3>
                    <p>{int.description}</p>
                    <span className="integration-auth-type">{int.authType}</span>
                  </div>
                  <div className="integration-status">
                    {int.configured ? (
                      <span className="status-label" style={{ color: '#22c55e' }}>Connected</span>
                    ) : (
                      <span className="status-label not-connected">Not connected</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IntegrationsView;
