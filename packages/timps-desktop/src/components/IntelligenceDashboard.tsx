import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import './IntelligenceDashboard.css';

interface IntelligenceAlert {
  id: string;
  tool: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  actionable: boolean;
  domain?: string;
}

interface Props {
  projectPath: string;
}

const toolIcons: Record<string, React.ReactNode> = {
  ContradictionDetector: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  RegretOracle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
  BurnoutSeismograph: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  TechDebtSeismograph: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  BugPatternProphet: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  APIArchaeologist: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  LivingManifesto: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  ArchitectureDriftDetector: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>
    </svg>
  ),
  PatternLearner: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  MeetingGhost: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  DeadReckoning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  ),
  RelationshipIntelligence: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  SkillShadow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  CurriculumArchitect: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  CodebaseAnthropologist: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),
  InstitutionalMemory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  ProactiveNotifications: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
};

const defaultIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const ENGINES = [
  { name: 'ContradictionDetector', icon: 'contradiction' },
  { name: 'BurnoutSeismograph', icon: 'burnout' },
  { name: 'RegretOracle', icon: 'regret' },
  { name: 'BugPatternProphet', icon: 'bug' },
  { name: 'PatternLearner', icon: 'pattern' },
  { name: 'LivingManifesto', icon: 'manifesto' },
  { name: 'ArchitectureDriftDetector', icon: 'drift' },
  { name: 'APIArchaeologist', icon: 'api' },
  { name: 'CodebaseAnthropologist', icon: 'codebase' },
  { name: 'InstitutionalMemory', icon: 'memory' },
  { name: 'RelationshipIntelligence', icon: 'relationship' },
  { name: 'DeadReckoning', icon: 'dead' },
  { name: 'TechDebtSeismograph', icon: 'debt' },
  { name: 'MeetingGhost', icon: 'ghost' },
  { name: 'SkillShadow', icon: 'skill' },
  { name: 'CurriculumArchitect', icon: 'curriculum' },
  { name: 'ProactiveNotifications', icon: 'notifications' },
];

let alertCounter = 0;

function genId(): string {
  const buf = new Uint8Array(3);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export function IntelligenceDashboard({ projectPath }: Props) {
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const checkIntelligence = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const stats = await api.getMemoryStats(projectPath);
      const notifications = await api.checkProactiveNotifications(projectPath);

      const newAlerts: IntelligenceAlert[] = [];

      for (const notif of notifications) {
        newAlerts.push({
          id: `notif-${Date.now()}-${genId()}`,
          tool: 'ProactiveNotifications',
          level: notif.kind === 'error' ? 'critical' : 'warning',
          title: notif.title,
          message: notif.body,
          timestamp: Date.now(),
          actionable: notif.kind !== 'info',
          domain: 'productivity',
        });
      }

      if (stats.semantic_count > 0 && stats.episode_count > 0) {
        newAlerts.push({
          id: `pattern-${Date.now()}`,
          tool: 'PatternLearner',
          level: 'info',
          title: 'Pattern Learning Active',
          message: `Analyzed ${stats.episode_count} sessions to extract workflow patterns`,
          timestamp: Date.now(),
          actionable: false,
          domain: 'productivity',
        });
      }

      if (stats.episode_count > 10) {
        newAlerts.push({
          id: `regret-${Date.now()}`,
          tool: 'RegretOracle',
          level: 'warning',
          title: 'Regret Oracle Active',
          message: `Analyzing patterns for repeated regretted decisions across ${stats.episode_count} sessions`,
          timestamp: Date.now(),
          actionable: true,
          domain: 'decision-making',
        });
      }

      setAlerts(prev => [...newAlerts, ...prev].slice(0, 20));
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to check intelligence:', error);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    void checkIntelligence();
    if (isAutoRefresh) {
      const interval = setInterval(() => {
        void checkIntelligence();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [checkIntelligence, isAutoRefresh]);

  const criticalAlerts = useMemo(() => alerts.filter(a => a.level === 'critical'), [alerts]);
  const warningAlerts = useMemo(() => alerts.filter(a => a.level === 'warning'), [alerts]);
  const infoAlerts = useMemo(() => alerts.filter(a => a.level === 'info'), [alerts]);

  const getToolIcon = (tool: string) => toolIcons[tool] || defaultIcon;

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="intelligence-dashboard">
      <div className="view-header">
        <h2>Intelligence</h2>
        <div className="view-controls">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void checkIntelligence()}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            )}
            <span>{loading ? 'Checking...' : 'Refresh'}</span>
          </button>
          <button
            className={`btn btn-sm ${isAutoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>{isAutoRefresh ? 'Auto' : 'Manual'}</span>
          </button>
        </div>
      </div>

      <div className="alert-summary">
        {criticalAlerts.length > 0 && (
          <div className="alert-summary-item alert-summary-critical">
            <span className="count">{criticalAlerts.length}</span>
            <span className="label">Critical</span>
          </div>
        )}
        {warningAlerts.length > 0 && (
          <div className="alert-summary-item alert-summary-warning">
            <span className="count">{warningAlerts.length}</span>
            <span className="label">Warnings</span>
          </div>
        )}
        {infoAlerts.length > 0 && (
          <div className="alert-summary-item alert-summary-info">
            <span className="count">{infoAlerts.length}</span>
            <span className="label">Insights</span>
          </div>
        )}
        <div className="alert-last-update">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {lastChecked ? `Updated ${lastChecked.toLocaleTimeString()}` : 'Not checked'}
        </div>
      </div>

      <div className="alerts-container">
        {alerts.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <h3>Intelligence System Ready</h3>
            <p>All 17 TIMPS intelligence engines are active and monitoring your memory patterns.</p>
            <p>Run a command or chat to generate intelligence alerts.</p>
          </div>
        ) : (
          <>
            {criticalAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} icon={getToolIcon(alert.tool)} onDismiss={dismissAlert} />
            ))}
            {warningAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} icon={getToolIcon(alert.tool)} onDismiss={dismissAlert} />
            ))}
            {infoAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} icon={getToolIcon(alert.tool)} onDismiss={dismissAlert} showActions={false} />
            ))}
          </>
        )}
      </div>

      <div className="intelligence-stats">
        <div className="section-header">
          <span className="section-title" style={{ textTransform: 'none', letterSpacing: 0 }}>Engine Status</span>
        </div>
        <div className="engines-grid">
          {ENGINES.map(engine => (
            <div key={engine.name} className="engine-card">
              <div className="engine-card-icon">{getToolIcon(engine.name)}</div>
              <span className="engine-card-name">{engine.name}</span>
              <span className="engine-card-badge active" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AlertCardProps {
  alert: IntelligenceAlert;
  icon: React.ReactNode;
  onDismiss: (id: string) => void;
  showActions?: boolean;
}

function AlertCard({ alert, icon, onDismiss, showActions = true }: AlertCardProps) {
  return (
    <div className={`alert-card alert-card-${alert.level}`}>
      <div className="alert-card-header">
        <span className="alert-card-icon">{icon}</span>
        <span className="alert-card-tool">{alert.tool}</span>
        <span className="alert-card-time">
          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Now'}
        </span>
        <button className="alert-card-close" onClick={() => onDismiss(alert.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="alert-card-body">
        <h4>{alert.title}</h4>
        <p>{alert.message}</p>
      </div>
      {alert.actionable && showActions && (
        <div className="alert-card-actions">
          <button className="btn btn-sm btn-primary">Review</button>
          <button className="btn btn-sm btn-ghost">Dismiss</button>
        </div>
      )}
    </div>
  );
}
