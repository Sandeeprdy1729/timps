/**
 * TIMPS Connectors — ConnectorsView
 * Strapped-in integrations (currently Gmail, read-only). Emails are synced into
 * TIMPS memory via the CLI pipeline; raw copies live in ~/.timps/gmail.
 * The OAuth browser flow runs in Rust (loopback listener) — the renderer stays
 * network-free so the CSP can remain strict.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { api, GmailStatus, GmailSummaryEntry } from '../api';
import './ConnectorsView.css';

function fmtTime(iso: string | null): string {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface ConnectorsViewProps {
  /** Connector requested via a `timps://connect/<name>` deep link from the website. */
  focusConnector?: string | null;
  /** Called once the deep-link focus has been consumed (handled or dismissed). */
  onFocusHandled?: () => void;
}

export function ConnectorsView({ focusConnector, onFocusHandled }: ConnectorsViewProps) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OAuth connect
  const [connecting, setConnecting] = useState(false);
  const [awaitingOAuth, setAwaitingOAuth] = useState(false);

  // Import credentials
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string | null>(null);

  // Emails
  const [recent, setRecent] = useState<GmailSummaryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.gmailStatus();
      setStatus(s);
      const emails = await api.gmailRecent(10);
      setRecent(emails);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      if (!importPath) {
        const picked = await open({
          multiple: false,
          title: 'Select Google OAuth client JSON',
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!picked) return;
        setImportPath(String(picked));
        const res = await api.gmailImportCredentials(String(picked));
        await refresh();
        return;
      }
      const res = await api.gmailImportCredentials(importPath);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const start = await api.gmailOauthStart();
      setAwaitingOAuth(true);
      const result = await api.gmailOauthFinish();
      await refresh();
      setAwaitingOAuth(false);
      setSyncOutput(`Connected as ${result.email}`);
    } catch (e) {
      setAwaitingOAuth(false);
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  const handleCancelOAuth = async () => {
    try {
      await api.gmailOauthCancel();
    } catch {
      /* ignore */
    }
    setAwaitingOAuth(false);
    setConnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncOutput(null);
    setError(null);
    try {
      const res = await api.gmailSync();
      setSyncOutput(res.ok ? res.output || 'Sync completed.' : `Sync exited with code ${res.exitCode}:\n${res.output}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoSync = async (enabled: boolean) => {
    setError(null);
    try {
      const res = await api.gmailSetAutosync(enabled);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await api.gmailDisconnect();
      setRecent([]);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const results = await api.gmailQuery(query.trim(), 10);
      setRecent(results);
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  const connected = status?.connected ?? false;

  // Deep-link handoff (website → `timps://connect/<connector>`): auto-start the
  // OAuth flow for the connector the user clicked "+" on, once we know status.
  const autoStarted = useRef<string | null>(null);
  const [focusBanner, setFocusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!focusConnector) return;
    if (focusConnector !== 'gmail') {
      onFocusHandled?.();
      return;
    }
    setFocusBanner(focusConnector);
    if (loading || connected || connecting || importing) return;
    if (autoStarted.current !== focusConnector) {
      autoStarted.current = focusConnector;
      handleConnect();
    }
  }, [focusConnector, loading, connected, connecting, importing]);

  useEffect(() => {
    if (focusBanner && connected) {
      setFocusBanner(null);
      onFocusHandled?.();
    }
  }, [focusBanner, connected]);

  return (
    <div className="connectors-view">
      <div className="connectors-header">
        <div className="connectors-header-left">
          <span className="connectors-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="4" cy="4" r="2"/><circle cx="14" cy="4" r="2"/><circle cx="14" cy="14" r="2"/><circle cx="4" cy="14" r="2"/>
              <line x1="6" y1="4" x2="12" y2="4"/><line x1="14" y1="6" x2="14" y2="12"/><line x1="12" y1="14" x2="6" y2="14"/>
            </svg>
            Connectors
            <span className="connectors-badge">Gmail</span>
          </span>
        </div>
        <div className="connectors-header-actions">
          {connected && (
            <button className="connector-btn ghost" onClick={handleDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="connector-loading">Loading…</div>
      ) : (
        <div className="connector-card">
          <div className="connector-row">
            <div className="connector-logo" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
            </div>
            <div className="connector-info">
              <div className="connector-name">
                Gmail
                <span className={`status-dot ${connected ? 'on' : 'off'}`} />
                <span className="status-label">{connected ? 'Connected' : 'Not connected'}</span>
              </div>
              {connected ? (
                <div className="connector-meta">
                  {status?.email && <span>{status.email}</span>}
                  <span>last sync {fmtTime(status?.lastRun ?? null)}</span>
                  <span>{status?.messagesSynced ?? 0} emails · {status?.summaryCount ?? 0} summaries</span>
                </div>
              ) : (
                <div className="connector-meta">
                  <span>Emails → distilled knowledge facts in TIMPS memory (read-only)</span>
                </div>
              )}
            </div>
            <div className="connector-actions">
              {connected ? (
                <>
                  <button
                    className={`connector-btn primary ${syncing ? 'disabled' : ''}`}
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button
                    className={`connector-btn ${status?.autoSync ? 'primary' : 'ghost'}`}
                    onClick={() => handleAutoSync(!(status?.autoSync ?? false))}
                  >
                    {status?.autoSync ? 'Auto-sync on' : 'Auto-sync off'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`connector-btn primary ${connecting ? 'disabled' : ''}`}
                    onClick={handleConnect}
                    disabled={connecting || importing}
                  >
                    {awaitingOAuth ? 'Waiting for browser…' : connecting ? 'Connecting…' : 'Connect'}
                  </button>
                  <button
                    className={`connector-btn ghost ${importing ? 'disabled' : ''}`}
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? 'Importing…' : 'Import credentials'}
                  </button>
                </>
              )}
            </div>
          </div>

          {focusBanner === 'gmail' && (
            <div className="connector-focus-banner">
              <span>
                Opened from the TIMPS website — authorizing Gmail…
              </span>
              <button
                className="connector-btn ghost small"
                onClick={() => {
                  setFocusBanner(null);
                  onFocusHandled?.();
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {awaitingOAuth && (
            <div className="connector-oauth-hint">
              <span>Complete the consent screen in your browser to authorize TIMPS (read-only).</span>
              <button className="connector-btn ghost small" onClick={handleCancelOAuth}>
                Cancel
              </button>
            </div>
          )}

          {!connected && importPath !== '' && (
            <div className="connector-import-row">
              <input
                className="connector-input"
                placeholder="Path to Google OAuth client JSON…"
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
              />
              <button className="connector-btn primary small" onClick={handleImport} disabled={importing}>
                Import
              </button>
            </div>
          )}

          {error && <div className="connector-error">{error}</div>}

          {syncOutput && connected && (
            <div className="connector-sync-output">
              <pre>{syncOutput}</pre>
            </div>
          )}

          {!status?.cliPath && connected && (
            <div className="connector-warn">
              Sync needs the TIMPS CLI build. Run <code>npm run build</code> in <code>timps-code/</code> or set <code>TIMPS_CLI_JS</code>.
            </div>
          )}

          {connected && (
            <>
              <div className="connector-search-row">
                <input
                  className="connector-input"
                  placeholder="Search emails (subject / sender / facts)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                />
                <button className="connector-btn primary small" onClick={handleSearch} disabled={searching}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              <div className="connector-emails">
                {recent.length === 0 ? (
                  <div className="connector-empty">No email summaries yet — run Sync now.</div>
                ) : (
                  recent.map((e) => (
                    <div key={e.emailId} className="connector-email">
                      <div className="connector-email-head">
                        <span className="connector-email-subject">{e.subject}</span>
                        <span className="connector-email-from">{e.from}</span>
                        <span className="connector-email-date">{fmtTime(e.syncedAt || e.date)}</span>
                      </div>
                      {e.facts?.length > 0 && (
                        <ul className="connector-email-facts">
                          {e.facts.slice(0, 3).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}