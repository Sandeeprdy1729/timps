import { useState, useEffect, useCallback } from 'react';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { api, IntelligenceAlert } from '../api';
import { formatRelativeTime } from '../utils/index';
import './IntelligenceAlerts.css';

const SEVERITY_ICONS: Record<string, string> = {
  warning: '!',
  info: 'i',
  ok: '\u2713',
};

const ALERT_ENGINES = [
  { id: 'contradiction', label: 'Contradiction Detector', icon: '' },
  { id: 'pattern', label: 'Pattern Weaver', icon: '' },
  { id: 'bug_pattern', label: 'Bug Pattern Prophet', icon: '' },
  { id: 'insight', label: 'Insight Miner', icon: '' },
  { id: 'suggestion', label: 'Suggestion Engine', icon: '' },
];

interface Props {
  projectPath: string;
}

export function IntelligenceAlerts({ projectPath }: Props) {
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [notifPerm, setNotifPerm] = useState(false);

  useEffect(() => {
    (async () => {
      let permitted = await isPermissionGranted();
      if (!permitted) {
        const perm = await requestPermission();
        permitted = perm === 'granted';
      }
      setNotifPerm(permitted);
    })();
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!projectPath.trim()) return;
    setLoading(true);
    try {
      const data = await api.getAlerts(projectPath);
      setAlerts(data);
    } catch {
      // stub data for dev mode
      setAlerts([
        {
          id: 'stub-1',
          kind: 'contradiction',
          title: 'Contradiction Detected',
          body: 'Memory says "uses React 18" but also "uses React 17" in project context.',
          severity: 'warning',
          timestamp: Date.now() - 3600000,
          dismissed: false,
          source: 'Contradiction Detector',
        },
        {
          id: 'stub-2',
          kind: 'pattern',
          title: 'New Pattern Identified',
          body: 'Error handling pattern detected: try/catch with consistent logging across 5 modules.',
          severity: 'info',
          timestamp: Date.now() - 7200000,
          dismissed: false,
          source: 'Pattern Weaver',
        },
        {
          id: 'stub-3',
          kind: 'bug_pattern',
          title: 'Potential Bug Pattern',
          body: 'Missing null check on API responses in 3 files.',
          severity: 'warning',
          timestamp: Date.now() - 14400000,
          dismissed: false,
          source: 'Bug Pattern Prophet',
        },
        {
          id: 'stub-4',
          kind: 'insight',
          title: 'Insight: Module Coupling',
          body: 'High coupling detected between auth and user modules. Consider dependency inversion.',
          severity: 'info',
          timestamp: Date.now() - 28800000,
          dismissed: false,
          source: 'Insight Miner',
        },
        {
          id: 'stub-5',
          kind: 'suggestion',
          title: 'Suggestion: Test Coverage',
          body: 'The memory system has 17 intelligence tools but only 60% test coverage. Add tests for the 7 untested tools.',
          severity: 'ok',
          timestamp: Date.now() - 57600000,
          dismissed: false,
          source: 'Suggestion Engine',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleDismiss = async (alertId: string) => {
    try {
      await api.dismissAlert(projectPath, alertId);
    } catch {
      // stub
    }
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, dismissed: true } : a));
  };

  const handleSnooze = async (alertId: string) => {
    const until = Date.now() + 3600000;
    try {
      await api.snoozeAlert(projectPath, alertId, until);
    } catch {
      // stub
    }
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, snoozed_until: until } : a));
  };

  const handleNotify = async (alert: IntelligenceAlert) => {
    if (!notifPerm) return;
    sendNotification({ title: alert.title, body: alert.body });
  };

  const activeAlerts = alerts.filter(a => !a.dismissed && (!a.snoozed_until || a.snoozed_until < Date.now()));
  const filtered = filter === 'all' ? activeAlerts : activeAlerts.filter(a => a.kind === filter);

  const engineMap = Object.fromEntries(ALERT_ENGINES.map(e => [e.id, e]));

  if (loading) {
    return <div className="alerts-view"><div className="loading">Loading alerts...</div></div>;
  }

  return (
    <div className="alerts-view">
      <div className="alerts-header">
        <h2>Intelligence Alerts</h2>
        <button className="refresh-btn" onClick={loadAlerts} title="Refresh">
          ↻
        </button>
      </div>

      <div className="alerts-subtitle">
        <span className="alert-count">{activeAlerts.length} active</span>
        <span className="alert-engines-note">from {ALERT_ENGINES.length} intelligence engines</span>
      </div>

      <div className="alerts-filters">
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {ALERT_ENGINES.map(engine => (
          <button
            key={engine.id}
            className={`filter-chip ${filter === engine.id ? 'active' : ''}`}
            onClick={() => setFilter(engine.id)}
          >
            {engine.label.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      <div className="alerts-list">
        {filtered.length === 0 ? (
          <div className="alerts-empty">
            <p>All clear — no alerts from the intelligence engines.</p>
          </div>
        ) : (
          filtered.map(alert => {
            const engine = engineMap[alert.kind];
            return (
              <div key={alert.id} className={`alert-card severity-${alert.severity}`}>
                <div className="alert-indicator" />
                <div className="alert-body">
                  <div className="alert-top-row">
                    <span className={`severity-badge ${alert.severity}`}>
                      {SEVERITY_ICONS[alert.severity]} {alert.severity}
                    </span>
                    <span className="alert-engine">{engine?.icon || ''} {engine?.label || alert.source}</span>
                    <span className="alert-time">{formatRelativeTime(alert.timestamp)}</span>
                  </div>
                  <h3 className="alert-title">{alert.title}</h3>
                  <p className="alert-body-text">{alert.body}</p>
                  <div className="alert-actions">
                    <button
                      className="alert-action dismiss"
                      onClick={() => handleDismiss(alert.id)}
                    >
                      Dismiss
                    </button>
                    <button
                      className="alert-action snooze"
                      onClick={() => handleSnooze(alert.id)}
                    >
                      Snooze 1h
                    </button>
                    <button
                      className="alert-action notify"
                      onClick={() => handleNotify(alert)}
                    >
                      Notify
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default IntelligenceAlerts;
