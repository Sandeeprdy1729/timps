'use client';

import { useState, useEffect, useCallback } from 'react';

interface ConnectButtonProps {
  integrationId: string;
  integrationName: string;
  credentialFields?: Array<{ key: string; label: string; type: string; placeholder: string }>;
}

export function ConnectButton({ integrationId, integrationName, credentialFields }: ConnectButtonProps) {
  const [connected, setConnected] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Checking...');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/${integrationId}/status`);
      const data = await res.json();
      setConnected(data.connected);
      setStatusLabel(data.label || 'Not connected');
    } catch {
      setConnected(false);
      setStatusLabel('Error checking status');
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const res = await fetch(`/api/integrations/${integrationId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connection failed');
      } else {
        setConnected(true);
        setStatusLabel(data.label);
        setShowForm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    try {
      await fetch(`/api/integrations/${integrationId}/disconnect`, { method: 'POST' });
      setConnected(false);
      setStatusLabel('Disconnected');
      setFormValues({});
      setShowForm(false);
    } catch {
      setError('Disconnect failed');
    } finally {
      setConnecting(false);
    }
  };

  const defaultFields = credentialFields || [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Enter your API key or access token' },
  ];

  if (loading) {
    return <button className="btn btn-secondary" disabled>Checking...</button>;
  }

  if (connected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--success)', fontSize: '14px' }}>✓ {statusLabel}</span>
        <button onClick={handleDisconnect} disabled={connecting} className="btn btn-secondary" style={{ border: '1px solid var(--error)', color: 'var(--error)' }}>
          {connecting ? '...' : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
        Connect {integrationName}
      </button>
      {showForm && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
          {defaultFields.map((field) => (
            <input
              key={field.key}
              type={field.type}
              placeholder={field.placeholder}
              value={formValues[field.key] || ''}
              onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
              className="search-input"
              style={{ padding: '12px 16px' }}
            />
          ))}
          {integrationId === 'jira' && (
            <input
              type="text"
              placeholder="Instance URL (e.g. https://your-domain.atlassian.net)"
              value={formValues.instanceUrl || ''}
              onChange={(e) => setFormValues({ ...formValues, instanceUrl: e.target.value })}
              className="search-input"
              style={{ padding: '12px 16px' }}
            />
          )}
          {integrationId === 'salesforce' && (
            <input
              type="text"
              placeholder="Instance URL"
              value={formValues.instanceUrl || ''}
              onChange={(e) => setFormValues({ ...formValues, instanceUrl: e.target.value })}
              className="search-input"
              style={{ padding: '12px 16px' }}
            />
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleConnect} disabled={connecting} className="btn btn-primary">
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
