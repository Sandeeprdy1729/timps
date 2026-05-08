import { useState, useEffect, useCallback } from 'react';
import { connectionManager } from '../../connection-manager/src/index.js';
import { eventBus } from '../../event-bus/src/index.js';
import './IntegrationSettings.css';

interface IntegrationInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  authType: string;
}

interface IntegrationState {
  id: string;
  integrationId: string;
  integrationName: string;
  status: string;
  connectedAt?: string;
  lastError?: string;
}

const AVAILABLE_INTEGRATIONS: IntegrationInfo[] = [
  { id: 'google-calendar', name: 'Google Calendar', icon: '📅', description: 'Calendar and scheduling', authType: 'oauth2' },
  { id: 'google-gmail', name: 'Google Gmail', icon: '📧', description: 'Email management', authType: 'oauth2' },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Team messaging', authType: 'oauth2' },
  { id: 'github', name: 'GitHub', icon: '🐙', description: 'Code and version control', authType: 'api_key' },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'All-in-one workspace', authType: 'api_key' },
  { id: 'jira', name: 'Jira', icon: '📋', description: 'Project tracking', authType: 'api_key' },
  { id: 'linear', name: 'Linear', icon: '📊', description: 'Issue tracking', authType: 'api_key' },
  { id: 'todoist', name: 'Todoist', icon: '✅', description: 'Task management', authType: 'api_key' },
  { id: 'spotify', name: 'Spotify', icon: '🎵', description: 'Music streaming', authType: 'oauth2' },
  { id: 'stripe', name: 'Stripe', icon: '💳', description: 'Payment processing', authType: 'api_key' },
  { id: 'hubspot', name: 'HubSpot', icon: '🧡', description: 'CRM', authType: 'api_key' },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', description: 'Enterprise CRM', authType: 'oauth2' },
  { id: 'zendesk', name: 'Zendesk', icon: '🎧', description: 'Customer support', authType: 'api_key' },
  { id: 'intercom', name: 'Intercom', icon: '💬', description: 'Customer messaging', authType: 'api_key' },
  { id: 'discord', name: 'Discord', icon: '🎮', description: 'Community chat', authType: 'oauth2' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', description: 'Messaging', authType: 'api_key' },
];

export function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>(AVAILABLE_INTEGRATIONS);
  const [connectedIntegrations, setConnectedIntegrations] = useState<IntegrationState[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'connected' | 'available'>('all');

  useEffect(() => {
    loadConnections();
    setupEventListeners();
  }, []);

  const loadConnections = useCallback(() => {
    const connections = connectionManager.getAllConnections();
    setConnectedIntegrations(connections);
  }, []);

  const setupEventListeners = useCallback(() => {
    eventBus.subscribe(
      { type: 'connection:*' },
      (event) => {
        setActivityFeed(prev => [event, ...prev].slice(0, 50));
      }
    );
  }, []);

  const filteredIntegrations = integrations.filter(int => {
    const matchesSearch = !searchQuery || 
      int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isConnected = connectedIntegrations.some(c => c.integrationId === int.id);
    
    if (filter === 'connected') return matchesSearch && isConnected;
    if (filter === 'available') return matchesSearch && !isConnected;
    return matchesSearch;
  });

  const handleConnect = async () => {
    if (!selectedIntegration || !apiKey) return;
    
    setIsConnecting(true);
    
    try {
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) return;
      
      await connectionManager.connect({
        integrationId: integration.id,
        integrationName: integration.name,
        authType: integration.authType as 'api_key' | 'oauth2' | 'basic',
        credentials: { apiKey },
      });
      
      loadConnections();
      setSelectedIntegration(null);
      setApiKey('');
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await connectionManager.disconnect(connectionId);
      loadConnections();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    const result = await connectionManager.testConnection(connectionId);
    const statusEl = document.querySelector(`[data-connection-id="${connectionId}"] .status-value`);
    if (statusEl) {
      statusEl.textContent = result ? 'Connected' : 'Error';
      statusEl.className = result ? 'status-value connected' : 'status-value error';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#22c55e';
      case 'disconnected': return '#6b7280';
      case 'error': return '#ef4444';
      case 'expired': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getConnection = (integrationId: string) => {
    return connectedIntegrations.find(c => c.integrationId === integrationId);
  };

  return (
    <div className="integration-settings-page">
      <header className="integration-header">
        <h1>Integrations</h1>
        <p className="integration-subtitle">
          Connect your favorite services to automate workflows
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
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({integrations.length})
          </button>
          <button
            className={`filter-btn ${filter === 'connected' ? 'active' : ''}`}
            onClick={() => setFilter('connected')}
          >
            Connected ({connectedIntegrations.length})
          </button>
          <button
            className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
            onClick={() => setFilter('available')}
          >
            Available ({integrations.length - connectedIntegrations.length})
          </button>
        </div>
      </div>

      <div className="integration-grid">
        {filteredIntegrations.map(integration => {
          const connection = getConnection(integration.id);
          const isConnected = !!connection;
          
          return (
            <div
              key={integration.id}
              className={`integration-card ${isConnected ? 'connected' : ''}`}
              onClick={() => !isConnected && setSelectedIntegration(integration.id)}
            >
              <div className="integration-icon">{integration.icon}</div>
              <div className="integration-info">
                <h3>{integration.name}</h3>
                <p>{integration.description}</p>
              </div>
              <div className="integration-status">
                {isConnected ? (
                  <>
                    <span
                      className="status-dot"
                      style={{ background: getStatusColor(connection.status) }}
                    />
                    <span className="status-label">Connected</span>
                    <div className="integration-actions">
                      <button
                        className="action-btn test"
                        onClick={(e) => {
                          e.stopPropagation();
                          connection && handleTestConnection(connection.id);
                        }}
                      >
                        Test
                      </button>
                      <button
                        className="action-btn disconnect"
                        onClick={(e) => {
                          e.stopPropagation();
                          connection && handleDisconnect(connection.id);
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="status-label not-connected">Not connected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedIntegration && (
        <div className="modal-overlay" onClick={() => setSelectedIntegration(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Connect {integrations.find(i => i.id === selectedIntegration)?.name}</h2>
            <div className="form-group">
              <label>
                {integrations.find(i => i.id === selectedIntegration)?.authType === 'oauth2'
                  ? 'OAuth flow will open in a new window'
                  : 'API Key'}
              </label>
              {integrations.find(i => i.id === selectedIntegration)?.authType !== 'oauth2' && (
                <input
                  type="password"
                  placeholder="Enter API key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedIntegration(null)}>
                Cancel
              </button>
              <button
                className="btn-connect"
                onClick={handleConnect}
                disabled={isConnecting || (!apiKey && integrations.find(i => i.id === selectedIntegration)?.authType !== 'oauth2')}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {connectedIntegrations.length > 0 && (
        <section className="activity-feed-section">
          <h2>Recent Activity</h2>
          <div className="activity-feed">
            {activityFeed.length === 0 ? (
              <p className="empty-activity">No recent activity</p>
            ) : (
              activityFeed.map((event, index) => (
                <div key={index} className="activity-item">
                  <span className="activity-type">{event.type}</span>
                  <span className="activity-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default IntegrationSettings;