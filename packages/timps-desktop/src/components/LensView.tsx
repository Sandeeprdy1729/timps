/**
 * TIMPS Lens — LensView
 * Daily digest of GitHub & HuggingFace links with one-click LLM analysis.
 * Like Clicky AI for your clipboard: zero friction from copy to insight.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { api, LensLink, GitHubMeta, HuggingFaceMeta } from '../api';
import './LensView.css';

type LensTab = 'today' | 'history';

interface AnalysisState {
  [linkId: string]: {
    loading: boolean;
    result: string | null;
    error: string | null;
    meta: GitHubMeta | HuggingFaceMeta | null;
    expanded: boolean;
    extraPrompt: string;
  };
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function linkIcon(type: string) {
  if (type === 'github') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    );
  }
  if (type === 'huggingface') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function linkTypeLabel(type: string) {
  if (type === 'github') return 'GitHub';
  if (type === 'huggingface') return 'HuggingFace';
  return 'Link';
}

function shortUrl(url: string, maxLen = 52) {
  const s = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

function isGitHubMeta(m: GitHubMeta | HuggingFaceMeta | null): m is GitHubMeta {
  return !!m && 'stars' in m;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function LensView() {
  const [tab, setTab] = useState<LensTab>('today');
  const [queue, setQueue] = useState<LensLink[]>([]);
  const [history, setHistory] = useState<LensLink[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisState>({});
  const [manualUrl, setManualUrl] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadQueue = useCallback(async () => {
    try {
      const links = await api.getLensQueue();
      setQueue(links.sort((a, b) => b.timestamp - a.timestamp));
      // Pre-populate analysis state for links already analyzed
      setAnalysis(prev => {
        const next = { ...prev };
        for (const link of links) {
          if (link.analyzed && link.analysis && !next[link.id]) {
            next[link.id] = {
              loading: false,
              result: link.analysis,
              error: null,
              meta: null,
              expanded: false,
              extraPrompt: '',
            };
          }
        }
        return next;
      });
    } catch { /* ignore */ }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const links = await api.getLensHistory(7);
      setHistory(links.sort((a, b) => b.timestamp - a.timestamp));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  const analyzeLink = useCallback(async (link: LensLink) => {
    setAnalysis(prev => ({
      ...prev,
      [link.id]: {
        ...(prev[link.id] ?? { result: null, error: null, meta: null, expanded: true, extraPrompt: '' }),
        loading: true,
        error: null,
        expanded: true,
      },
    }));

    try {
      let meta: GitHubMeta | HuggingFaceMeta | null = null;

      if (link.link_type === 'github') {
        meta = await api.fetchGithubMeta(link.url);
      } else if (link.link_type === 'huggingface') {
        meta = await api.fetchHfMeta(link.url);
      }

      setAnalysis(prev => ({
        ...prev,
        [link.id]: { ...prev[link.id], meta },
      }));

      const metaJson = meta ? JSON.stringify(meta, null, 2) : '{}';
      const extraPrompt = analysis[link.id]?.extraPrompt ?? '';
      const result = await api.analyzeLensLink(
        link.url,
        link.link_type,
        metaJson,
        extraPrompt || undefined,
      );

      await api.markLensAnalyzed(link.id, result);

      setAnalysis(prev => ({
        ...prev,
        [link.id]: { ...prev[link.id], loading: false, result, error: null },
      }));

      // Refresh queue to reflect analyzed state
      void loadQueue();
    } catch (err) {
      setAnalysis(prev => ({
        ...prev,
        [link.id]: {
          ...prev[link.id],
          loading: false,
          result: null,
          error: String(err),
        },
      }));
    }
  }, [analysis, loadQueue]);

  const analyzeAll = useCallback(async () => {
    const unanalyzed = queue.filter(l => !l.analyzed && !analysis[l.id]?.loading);
    if (unanalyzed.length === 0) return;
    setBatchLoading(true);
    for (const link of unanalyzed) {
      await analyzeLink(link);
    }
    setBatchLoading(false);
  }, [queue, analysis, analyzeLink]);

  const addManualUrl = useCallback(async () => {
    const url = manualUrl.trim();
    if (!url) return;
    const linkType = await api.detectLinkType(url);
    const id = await api.saveToLensQueue(url, linkType);
    setManualUrl('');
    await loadQueue();
    // Auto-start analysis for the new link
    const newLink: LensLink = {
      id,
      url,
      link_type: linkType,
      title: null,
      timestamp: Math.floor(Date.now() / 1000),
      analyzed: false,
      analysis: null,
    };
    void analyzeLink(newLink);
  }, [manualUrl, loadQueue, analyzeLink]);

  const removeLink = useCallback(async (id: string) => {
    await api.removeFromLensQueue(id);
    setQueue(prev => prev.filter(l => l.id !== id));
    setAnalysis(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const copyAnalysis = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ignore */ }
  }, []);

  const openUrl = useCallback(async (url: string) => {
    try {
      await open(url);
    } catch { /* ignore */ }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setAnalysis(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { loading: false, result: null, error: null, meta: null, extraPrompt: '' }),
        expanded: !prev[id]?.expanded,
      },
    }));
  }, []);

  const unanalyzedCount = queue.filter(l => !l.analyzed && !analysis[l.id]?.loading).length;
  const displayLinks = tab === 'today' ? queue : history;

  return (
    <div className="lens-view">
      {/* Header */}
      <div className="lens-header">
        <div className="lens-header-left">
          <div className="lens-title">
            Lens
            {queue.length > 0 && (
              <span className="lens-badge">{queue.length}</span>
            )}
          </div>
        </div>
        <div className="lens-header-actions">
          {unanalyzedCount > 0 && tab === 'today' && (
            <button
              className="lens-btn primary"
              onClick={analyzeAll}
              disabled={batchLoading}
            >
              {batchLoading
                ? <><span className="lens-spinner" /> Analyzing…</>
                : <>Analyze all ({unanalyzedCount})</>}
            </button>
          )}
          <button className="lens-btn ghost" onClick={loadQueue} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Manual URL input */}
      <div className="lens-input-row">
        <input
          ref={inputRef}
          className="lens-url-input"
          placeholder="Paste a GitHub or HuggingFace URL to analyze…"
          value={manualUrl}
          onChange={e => setManualUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void addManualUrl();
            if (e.key === 'Escape') setManualUrl('');
          }}
        />
        <button
          className="lens-btn primary"
          onClick={addManualUrl}
          disabled={!manualUrl.trim()}
        >
          Analyze
        </button>
      </div>

      {/* Tab bar */}
      <div className="lens-tabs">
        <button
          className={`lens-tab ${tab === 'today' ? 'active' : ''}`}
          onClick={() => setTab('today')}
        >
          Today
        </button>
        <button
          className={`lens-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => { setTab('history'); }}
        >
          History (7 days)
        </button>
      </div>

      {/* Link list */}
      {displayLinks.length === 0 ? (
        <div className="lens-empty">
          <div className="lens-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div className="lens-empty-title">
            {tab === 'today' ? 'No links collected yet today' : 'No history found'}
          </div>
          <div className="lens-empty-sub">
            {tab === 'today'
              ? 'Copy any GitHub or HuggingFace URL and TIMPS will instantly detect it. Or paste one above.'
              : 'Links you analyze will appear here for the last 7 days.'}
          </div>
        </div>
      ) : (
        <div className="lens-list">
          {displayLinks.map(link => {
            const a = analysis[link.id];
            const isLoading = a?.loading;
            const isAnalyzed = link.analyzed || !!a?.result;
            const isExpanded = a?.expanded ?? false;
            const meta = a?.meta ?? null;

            return (
              <div
                key={link.id}
                className={`lens-card ${isAnalyzed ? 'analyzed' : ''}`}
              >
                {/* Card header */}
                <div className="lens-card-header">
                  <span className="lens-card-icon">{linkIcon(link.link_type)}</span>

                  <div className="lens-card-info">
                    <div className="lens-card-meta">
                      <span className="lens-card-type">{linkTypeLabel(link.link_type)}</span>
                      <span className="lens-card-time">{relativeTime(link.timestamp)}</span>
                    </div>
                    <a
                      className="lens-card-url"
                      href="#"
                      onClick={e => { e.preventDefault(); void openUrl(link.url); }}
                      title={link.url}
                    >
                      {shortUrl(link.url)}
                    </a>
                  </div>
                  <div className="lens-card-actions">
                    {!isLoading && !isAnalyzed && (
                      <button
                        className="lens-card-btn accent"
                        onClick={() => void analyzeLink(link)}
                      >
                        Analyze
                      </button>
                    )}
                    {isLoading && (
                      <span className="lens-spinner" />
                    )}
                    {isAnalyzed && !isLoading && (
                      <button
                        className="lens-card-btn"
                        onClick={() => toggleExpand(link.id)}
                      >
                        {isExpanded ? 'Hide' : 'Show'}
                      </button>
                    )}
                    {tab === 'today' && (
                      <button
                        className="lens-card-btn"
                        onClick={() => void removeLink(link.id)}
                        title="Remove from today's queue"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata chips */}
                {meta && isExpanded && (
                  <div className="lens-meta-panel">
                    {isGitHubMeta(meta) ? (
                      <>
                        <span className="lens-meta-chip">
                          <span className="chip-label">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </span>
                          <span className="chip-value">{formatNumber(meta.stars)}</span>
                        </span>
                        <span className="lens-meta-chip">
                          <span className="chip-label">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 3 6 15 14 15"/><polyline points="18 21 18 9 10 9"/></svg>
                          </span>
                          <span className="chip-value">{formatNumber(meta.forks)}</span>
                        </span>
                        {meta.language && (
                          <span className="lens-meta-chip">
                            <span className="chip-value">{meta.language}</span>
                          </span>
                        )}
                        {meta.open_issues > 0 && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">issues</span>
                            <span className="chip-value">{meta.open_issues}</span>
                          </span>
                        )}
                        {meta.topics.slice(0, 4).map(t => (
                          <span key={t} className="lens-topic-tag">{t}</span>
                        ))}
                        {meta.license && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">license</span>
                            <span className="chip-value">{meta.license}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {(meta as HuggingFaceMeta).pipeline_tag && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">task</span>
                            <span className="chip-value">{(meta as HuggingFaceMeta).pipeline_tag}</span>
                          </span>
                        )}
                        {(meta as HuggingFaceMeta).library_name && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">lib</span>
                            <span className="chip-value">{(meta as HuggingFaceMeta).library_name}</span>
                          </span>
                        )}
                        {(meta as HuggingFaceMeta).downloads != null && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </span>
                            <span className="chip-value">{formatNumber((meta as HuggingFaceMeta).downloads)}</span>
                          </span>
                        )}
                        {(meta as HuggingFaceMeta).likes != null && (
                          <span className="lens-meta-chip">
                            <span className="chip-label">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          </span>
                            <span className="chip-value">{formatNumber((meta as HuggingFaceMeta).likes)}</span>
                          </span>
                        )}
                        {(meta as HuggingFaceMeta).tags.slice(0, 4).map(t => (
                          <span key={t} className="lens-topic-tag">{t}</span>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Extra prompt input (before analysis) */}
                {!isLoading && !isAnalyzed && isExpanded === false && (
                  <div className="lens-extra-prompt">
                    <textarea
                      rows={2}
                      placeholder="Optional: add a specific question or context for the analysis…"
                      value={a?.extraPrompt ?? ''}
                      onChange={e =>
                        setAnalysis(prev => ({
                          ...prev,
                          [link.id]: {
                            ...(prev[link.id] ?? { loading: false, result: null, error: null, meta: null, expanded: false }),
                            extraPrompt: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {/* Loading state */}
                {isLoading && (
                  <div className="lens-analysis">
                    <div className="lens-analysis-header">
                      <span className="lens-analysis-label">Fetching metadata + analyzing…</span>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {a?.error && !isLoading && (
                  <div className="lens-analysis">
                    <div className="lens-analysis-header">
                      <span className="lens-analysis-label" style={{ color: '#e06c75' }}>Error</span>
                    </div>
                    <div className="lens-analysis-text" style={{ color: '#e06c75' }}>{a.error}</div>
                  </div>
                )}

                {/* Analysis result */}
                {isExpanded && (a?.result ?? link.analysis) && (
                  <div className="lens-analysis">
                    <div className="lens-analysis-header">
                      <span className="lens-analysis-label">Analysis</span>
                      <button
                        className="lens-analysis-copy"
                        onClick={() => void copyAnalysis(link.id, a?.result ?? link.analysis ?? '')}
                      >
                        {copiedId === link.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="lens-analysis-text">
                      {a?.result ?? link.analysis}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
