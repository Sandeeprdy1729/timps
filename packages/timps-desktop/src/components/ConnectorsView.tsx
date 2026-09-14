/**
 * TIMPS Connectors — multi-provider connector hub.
 * Links external services (Gmail, Calendar, Drive, GitHub, Notion, Slack,
 * Linear, Microsoft 365) via OAuth so the assistant can read/act on the user's
 * data — the Grok connector model, self-hosted.
 *
 * The OAuth browser flow runs in Rust (loopback listener + PKCE / client
 * secret); the renderer stays network-free so the CSP remains strict.
 * Tokens/creds live per provider in ~/.timps/<id>/, shared with the `timps`
 * CLI (`timps gmail:sync` etc.). Synced data is distilled into TIMPS memory.
 *
 * Guided setup: for each provider, open its developer console, create an
 * OAuth app, and either paste the client_id (and client_secret when required)
 * inline or import the client JSON. The loopback callback is always
 * http://localhost:12849/oauth2callback.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { api, ConnectorEntry } from '../api';
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

// ── Provider metadata (mirrors Rust connectors.rs registry) ─────────────────

interface ProviderMeta {
  id: string;
  display: string;
  blurb: string;
  /** Providers that need a client_secret (no PKCE). */
  secretRequired: boolean;
  /** Developer-console URL where the user creates the OAuth app. */
  console: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gmail', display: 'Gmail', secretRequired: true,
    console: 'https://console.cloud.google.com/apis/credentials',
    blurb: 'Inbox → memory. Search, draft and triage email with context.',
  },
  {
    id: 'calendar', display: 'Google Calendar', secretRequired: true,
    console: 'https://console.cloud.google.com/apis/credentials',
    blurb: 'Events, meetings and schedules become recallable context.',
  },
  {
    id: 'drive', display: 'Google Drive', secretRequired: true,
    console: 'https://console.cloud.google.com/apis/credentials',
    blurb: 'Docs and spreadsheets indexed as searchable long-term memory.',
  },
  {
    id: 'github', display: 'GitHub', secretRequired: true,
    console: 'https://github.com/settings/developers',
    blurb: 'Issues, PRs and commits feed decisions into memory.',
  },
  {
    id: 'notion', display: 'Notion', secretRequired: false,
    console: 'https://www.notion.so/my-integrations',
    blurb: 'Docs, wikis and project pages — structure becomes fact.',
  },
  {
    id: 'slack', display: 'Slack', secretRequired: false,
    console: 'https://api.slack.com/apps',
    blurb: 'Channels and threads — decisions survive past the scroll.',
  },
  {
    id: 'linear', display: 'Linear', secretRequired: false,
    console: 'https://linear.app/settings/api',
    blurb: 'Issues, cycles and project state become recallable facts.',
  },
  {
    id: 'ms365', display: 'Microsoft 365', secretRequired: false,
    console: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    blurb: 'Mail and calendar from your Microsoft tenant.',
  },
];

const REDIRECT_URI = 'http://localhost:12849/oauth2callback';

function ProviderLogo({ id }: { id: string }) {
  const style = { width: 20, height: 20, display: 'block' } as const;
  switch (id) {
    case 'gmail':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
        </svg>
      );
    case 'calendar':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 3.5A3.5 3.5 0 0 1 3.5 0h17A3.5 3.5 0 0 1 24 3.5v10.51a9.6 9.6 0 0 0-2.4-1.4V5.5H0v11A3.5 3.5 0 0 0 3.5 20h6.2a9.7 9.7 0 0 0 .46 2.4H3.5A3.5 3.5 0 0 1 0 18.5z" fill="#4285F4"/>
          <rect x="2.6" y="9" width="18.8" height="2.4" rx="1.2" fill="#fff"/>
          <circle cx="17" cy="17" r="7" fill="#4285F4"/>
          <path d="M17 13.5v3.6h3.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        </svg>
      );
    case 'drive':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.8 2.9 6.6 15.6h13.4L26.6 3H18.6c-.4 0-.8 0-1.1 0z" transform="scale(.9) translate(1.3 1.5)" fill="#FFC107"/>
          <path d="M13.8 2.9 6.6 15.6h13.4L26.6 3H18.6c-.4 0-.8 0-1.1 0z" transform="scale(.9) translate(1.3 1.5)" fill="#F4B400"/>
          <path d="M2.2 15.6 5.4 21l8.4-14.5L10.6 1z" transform="scale(.9) translate(1.3 1.5)" fill="#4285F4"/>
          <path d="M16.6 21h13.3l-3.3-5-6.7-1.8L16.6 21z" transform="scale(.9) translate(1.3 1.5)" fill="#34A853"/>
        </svg>
      );
    case 'github':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#E6E6E6" d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.4 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.4 10.4 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.8 1.1 3 0 4.2-2.6 5.1-5.1 5.4.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.6 18.4.5 12 .5z"/>
        </svg>
      );
    case 'notion':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#fff" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933z"/>
        </svg>
      );
    case 'slack':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#36C5F0" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
          <path fill="#2EB67D" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
          <path fill="#ECB22E" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
          <path fill="#E01E5A" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
      );
    case 'linear':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#5E6AD2"/>
          <path d="M8 13.5a4.5 4.5 0 0 1 4.5-4.5V12a4.5 4.5 0 0 1 4.5 4.5H8z" fill="#fff" opacity="0.9"/>
          <circle cx="8" cy="13.5" r="2.2" fill="#fff"/>
        </svg>
      );
    case 'ms365':
      return (
        <svg style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
          <rect x="13" y="0" width="11" height="11" fill="#7FBA00"/>
          <rect x="0" y="13" width="11" height="11" fill="#00A4EF"/>
          <rect x="13" y="13" width="11" height="11" fill="#FFB900"/>
        </svg>
      );
    default:
      return null;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

interface ConnectorsViewProps {
  /** Connector requested via a `timps://connect/<name>` deep link from the website. */
  focusConnector?: string | null;
  /** Called once the deep-link focus has been consumed (handled or dismissed). */
  onFocusHandled?: () => void;
}

interface SetupStep {
  title: string;
  body: string;
}

function setupSteps(meta: ProviderMeta): SetupStep[] {
  const base = [
    {
      title: `Create an OAuth app for ${meta.display}`,
      body: `Open the developer console and create a new OAuth app / client for ${meta.display}.`,
    },
    {
      title: 'Register the callback URL',
      body: `Set the redirect URI to ${REDIRECT_URI}. GitHub, Slack, Linear and Notion require this exact URL; Google and Microsoft accept any loopback port.`,
    },
    {
      title: 'Enter your credentials',
      body: meta.secretRequired
        ? 'Paste the client_id and client_secret into the form below (or import the client JSON file).'
        : 'Paste the client_id below (or import the client JSON file). No secret needed — this provider uses PKCE.',
    },
  ];
  return base;
}

export function ConnectorsView({ focusConnector, onFocusHandled }: ConnectorsViewProps) {
  const [entries, setEntries] = useState<ConnectorEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'connecting' | 'importing' | 'saving' | 'syncing'>>({});
  const [awaiting, setAwaiting] = useState<Record<string, boolean>>({});
  const [syncOutput, setSyncOutput] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [importPath, setImportPath] = useState('');
  const [focusBanner, setFocusBanner] = useState<string | null>(null);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');

  const setBusyFor = (id: string, v: 'connecting' | 'importing' | 'saving' | 'syncing' | null) =>
    setBusy((b) => {
      const next = { ...b };
      if (v === null) delete next[id];
      else next[id] = v;
      return next;
    });

  const refresh = useCallback(async () => {
    try {
      const list = await api.connectorList();
      setEntries(list);
      setErrors({});
    } catch (e) {
      setErrors((er) => ({ ...er, _list: String(e) }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset the inline-paste form when switching providers.
  useEffect(() => {
    setClientIdInput('');
    setClientSecretInput('');
  }, [selected]);

  const entryFor = (id: string): ConnectorEntry | undefined =>
    entries?.find((e) => e.id === id);

  const handleSaveInline = async (id: string) => {
    setBusyFor(id, 'saving');
    try {
      await api.connectorSaveCredentials(
        id,
        clientIdInput.trim(),
        clientSecretInput.trim() || undefined
      );
      setClientIdInput('');
      setClientSecretInput('');
      await refresh();
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: String(e) }));
    } finally {
      setBusyFor(id, null);
    }
  };

  const handleImport = async (id: string, explicitPath?: string) => {
    setBusyFor(id, 'importing');
    try {
      const path = explicitPath || importPath;
      if (!path) {
        const picked = await open({
          multiple: false,
          title: `Select ${id} OAuth client JSON`,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!picked) return;
        setImportPath(String(picked));
        await api.connectorImportCredentials(id, String(picked));
      } else {
        await api.connectorImportCredentials(id, path);
        setImportPath('');
      }
      await refresh();
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: String(e) }));
    } finally {
      setBusyFor(id, null);
    }
  };

  const handleConnect = async (id: string) => {
    setBusyFor(id, 'connecting');
    try {
      const start = await api.connectorConnect(id);
      setAwaiting((a) => ({ ...a, [id]: true }));
      const result = await api.connectorOauthFinish(id);
      setAwaiting((a) => ({ ...a, [id]: false }));
      setErrors((er) => ({ ...er, [id]: '' }));
      await refresh();
      setSyncOutput((so) => ({ ...so, [id]: `Connected as ${result.account}` }));
    } catch (e) {
      setAwaiting((a) => ({ ...a, [id]: false }));
      setErrors((er) => ({ ...er, [id]: String(e) }));
    } finally {
      setBusyFor(id, null);
    }
  };

  const handleCancelOAuth = async (id: string) => {
    try {
      await api.connectorOauthCancel(id);
    } catch {
      /* ignore */
    }
    setAwaiting((a) => ({ ...a, [id]: false }));
    setBusyFor(id, null);
  };

  const handleSync = async (id: string) => {
    setBusyFor(id, 'syncing');
    setSyncOutput((so) => ({ ...so, [id]: '' }));
    try {
      const res = await api.connectorSync(id);
      setSyncOutput((so) => ({
        ...so,
        [id]: res.ok ? res.output || 'Sync completed.' : `Sync exited with code ${res.exitCode}:\n${res.output}`,
      }));
      await refresh();
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: String(e) }));
    } finally {
      setBusyFor(id, null);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.connectorDisconnect(id);
      setSyncOutput((so) => ({ ...so, [id]: '' }));
      await refresh();
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: String(e) }));
    }
  };

  // Deep-link handoff (website → `timps://connect/<connector>`): select the
  // connector and auto-start the OAuth flow if credentials are available.
  const autoStarted = useRef<string | null>(null);

  useEffect(() => {
    if (!focusConnector) return;
    if (!PROVIDERS.some((p) => p.id === focusConnector)) {
      onFocusHandled?.();
      return;
    }
    setSelected(focusConnector);
    setFocusBanner(focusConnector);
    if (loading || busy[focusConnector] || awaiting[focusConnector]) return;
    const entry = entryFor(focusConnector);
    if (!entry) return;
    if (entry.connected) {
      setFocusBanner(null);
      onFocusHandled?.();
      return;
    }
    if (entry.hasCredentials && autoStarted.current !== focusConnector) {
      autoStarted.current = focusConnector;
      handleConnect(focusConnector);
    }
    // No credentials → banner stays; the user imports creds in the detail panel.
  }, [focusConnector, loading, entries, busy, awaiting]);

  useEffect(() => {
    if (!focusBanner) return;
    const entry = entryFor(focusBanner);
    if (entry?.connected) {
      setFocusBanner(null);
      onFocusHandled?.();
    }
  }, [focusBanner, entries]);

  const connectedCount = entries?.filter((e) => e.connected).length ?? 0;
  const selectedEntry = selected ? entryFor(selected) : undefined;
  const selectedMeta = PROVIDERS.find((p) => p.id === selected);

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
            {!loading && <span className="connectors-badge">{connectedCount} / {PROVIDERS.length} connected</span>}
          </span>
          <p className="connectors-subtitle">
            Link external services via OAuth — scoped, revocable, stored on this machine.{' '}
            <code>timps &lt;name&gt;:sync</code> distills synced data into memory your agents can recall.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="connector-loading">Loading…</div>
      ) : (
        <div className="connector-grid">
          {PROVIDERS.map((p) => {
            const entry = entryFor(p.id);
            const connected = entry?.connected ?? false;
            const isBusy = busy[p.id];
            const isAwaiting = awaiting[p.id];
            const isSelected = selected === p.id;
            return (
              <div
                key={p.id}
                className={`connector-tile${connected ? ' connected' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => setSelected(isSelected ? null : p.id)}
              >
                <div className="connector-tile-top">
                  <span className="connector-tile-logo"><ProviderLogo id={p.id} /></span>
                  <div className="connector-tile-head">
                    <span className="connector-tile-name">{p.display}</span>
                    <span className={`connector-tile-status${connected ? ' on' : ' off'}`}>
                      {connected ? (entry?.account && entry.account !== 'unknown' ? entry.account : 'Connected') : 'Not connected'}
                    </span>
                  </div>
                  {entry?.hasCredentials && !connected && (
                    <span className="connector-tile-creds" title="Credentials imported">creds ✓</span>
                  )}
                </div>
                <p className="connector-tile-blurb">{p.blurb}</p>
                <div className="connector-tile-actions" onClick={(e) => e.stopPropagation()}>
                  {connected ? (
                    <>
                      <button
                        className={`connector-btn primary ${isBusy === 'syncing' ? 'disabled' : ''}`}
                        onClick={() => handleSync(p.id)}
                        disabled={!!isBusy}
                      >
                        {isBusy === 'syncing' ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button
                        className="connector-btn ghost"
                        onClick={() => handleDisconnect(p.id)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`connector-btn primary ${isBusy ? 'disabled' : ''}`}
                        onClick={() => handleConnect(p.id)}
                        disabled={!!isBusy || !entry?.hasCredentials}
                        title={entry?.hasCredentials ? undefined : 'Add credentials first'}
                      >
                        {isAwaiting ? 'Waiting for browser…' : isBusy === 'connecting' ? 'Connecting…' : 'Connect'}
                      </button>
                      <button
                        className={`connector-btn ghost ${isBusy === 'importing' ? 'disabled' : ''}`}
                        onClick={() => handleImport(p.id)}
                        disabled={!!isBusy}
                      >
                        {isBusy === 'importing' ? 'Importing…' : 'Credentials'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {errors._list && <div className="connector-error">{errors._list}</div>}

      {selectedEntry && selectedMeta && selected && (() => {
        const sid: string = selected;
        const meta = selectedMeta;
        const secretRequired = meta.secretRequired;
        const steps = setupSteps(meta);
        return (
          <div className="connector-detail">
            <div className="connector-detail-head">
              <span className="connector-detail-logo"><ProviderLogo id={sid} /></span>
              <h3>{meta.display}</h3>
              <span className={`connector-detail-status${selectedEntry.connected ? ' on' : ' off'}`}>
                {selectedEntry.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>

            {focusBanner === sid && (
              <div className="connector-focus-banner">
                <span>
                  Opened from the TIMPS website — {selectedEntry.connected ? `${meta.display} is connected.` : `authorizing ${meta.display}…`}
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

            <div className="connector-detail-meta">
              <span>Account: <b>{selectedEntry.account || '—'}</b></span>
              <span>Scopes requested: <b>{selectedEntry.scopes}</b></span>
              <span>Last sync: <b>{fmtTime(selectedEntry.lastRun ?? null)}</b></span>
              <span>Synced items: <b>{selectedEntry.syncedCount}</b></span>
            </div>

            {awaiting[sid] && (
              <div className="connector-oauth-hint">
                <span>Complete the consent screen in your browser to authorize TIMPS. Tokens stay on this machine and are revocable anytime.</span>
                <button className="connector-btn ghost small" onClick={() => handleCancelOAuth(sid)}>
                  Cancel
                </button>
              </div>
            )}

            {!selectedEntry.hasCredentials && (
              <div className="connector-setup">
                <div className="connector-setup-title">
                  <span>Set up {meta.display}</span>
                  <span className="connector-setup-redirect">Callback: <code>{REDIRECT_URI}</code></span>
                </div>
                <div className="connector-setup-steps">
                  {steps.map((s, i) => (
                    <div key={i} className="connector-setup-step">
                      <span className="connector-setup-step-num">{i + 1}</span>
                      <div>
                        <b>{s.title}</b>
                        <p>{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="connector-setup-actions">
                  <button
                    className="connector-btn ghost small"
                    onClick={() => {
                      api.connectorOpenConsole(sid).catch(() => window.open(meta.console, '_blank'));
                    }}
                  >
                    Open developer console
                  </button>
                </div>

                <div className="connector-import-form">
                  <div className="connector-import-row">
                    <input
                      className="connector-input"
                      placeholder="client_id (paste)"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                    />
                    {secretRequired && (
                      <input
                        className="connector-input"
                        type="password"
                        placeholder="client_secret (paste)"
                        value={clientSecretInput}
                        onChange={(e) => setClientSecretInput(e.target.value)}
                      />
                    )}
                    <button
                      className="connector-btn primary small"
                      onClick={() => handleSaveInline(sid)}
                      disabled={busy[sid] === 'saving' || !clientIdInput.trim() || (secretRequired && !clientSecretInput.trim())}
                    >
                      {busy[sid] === 'saving' ? 'Saving…' : 'Save credentials'}
                    </button>
                  </div>
                  <div className="connector-import-divider">or import the OAuth client JSON file</div>
                  <div className="connector-import-row">
                    <input
                      className="connector-input"
                      placeholder={`~/.timps/${sid}/client.json`}
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                    />
                    <button
                      className="connector-btn primary small"
                      onClick={() => handleImport(sid, importPath || undefined)}
                      disabled={busy[sid] === 'importing'}
                    >
                      {busy[sid] === 'importing' ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {errors[sid] && <div className="connector-error">{errors[sid]}</div>}
            {syncOutput[sid] && (
              <div className="connector-sync-output">
                <pre>{syncOutput[sid]}</pre>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}