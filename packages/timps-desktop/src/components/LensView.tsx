/**
 * TIMPS Lens — Search all memory
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { api, SemanticEntry } from '../api';
import { formatRelativeTime } from '../utils/index';
import './LensView.css';

const TYPE_TINT: Record<string, string> = {
  fact: '#4ade80',
  pattern: '#60a5fa',
  error: '#f87171',
  architecture: '#c084fc',
  decision: '#fbbf24',
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i}>{p}</mark>
      : p
  );
}

export function LensView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.searchMemoryAll(trimmed, 50);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChange = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void doSearch(val); }, 300);
  }, [doSearch]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void doSearch(query);
  }, [query, doSearch]);

  return (
    <div className="lens-view lens-search">
      <div className="lens-header">
        <h2>Search Memory</h2>
      </div>

      <form className="lens-input-row" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="lens-url-input"
          type="text"
          placeholder="Search all local memory…"
          value={query}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
        />
        <button className="lens-btn primary" type="submit">Search</button>
      </form>

      <div className="lens-results">
        {loading && <div className="lens-empty">Searching…</div>}
        {!loading && searched && results.length === 0 && (
          <div className="lens-empty">
            <div className="lens-empty-title">No results</div>
            <div className="lens-empty-sub">Try a different query or broader terms.</div>
          </div>
        )}
        {!loading && results.map(entry => (
          <div key={`${entry.source ?? ''}:${entry.id}`} className="lens-card">
            <div className="lens-card-header">
              <span
                className="lens-card-type"
                style={{ background: TYPE_TINT[entry.type] ?? 'var(--accent, #4a8c7a)' }}
              >
                {entry.type}
              </span>
              <span className="lens-card-url">{entry.content.slice(0, 80)}{entry.content.length > 80 ? '…' : ''}</span>
              <span className="lens-card-time">{formatRelativeTime(entry.timestamp)}</span>
              {entry.source && <span className="lens-card-meta" title={`Store ${entry.source}`}>store:{entry.source.slice(0, 6)}</span>}
            </div>
            <div className="lens-analysis-text">
              {highlight(entry.content, query)}
            </div>
            {entry.tags.length > 0 && (
              <div className="lens-meta-panel">
                {entry.tags.map(t => (
                  <span key={t} className="lens-topic-tag">{t}</span>
                ))}
                {entry.score != null && (
                  <span className="lens-meta-chip"><span className="chip-value">score {entry.score}</span></span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}