import { useState, useCallback } from 'react';
import { api, SemanticEntry } from '../api';
import './SearchView.css';

interface Props {
  projectPath: string;
  semanticEntries: SemanticEntry[];
}

export function SearchView({ projectPath, semanticEntries }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.searchMemory(projectPath, query, 20);
      setResults(res);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [projectPath, query]);

  // Local filter fallback when native search returns empty but we have entries in memory
  const displayResults =
    results.length > 0
      ? results
      : searched && semanticEntries.length > 0 && query.trim()
        ? semanticEntries.filter((e) =>
            e.content.toLowerCase().includes(query.toLowerCase()) ||
            e.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())),
          ).slice(0, 20)
        : [];

  return (
    <div className="search-view">
      <h2 className="view-title">Search Memory</h2>

      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Search semantic memory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSearch();
          }}
        />
        <button className="btn-primary" onClick={() => void runSearch()} disabled={loading || !query.trim()}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {searched && (
        <p className="search-meta">
          {displayResults.length} result{displayResults.length !== 1 ? 's' : ''} for "{query}"
        </p>
      )}

      <div className="result-list">
        {displayResults.map((e) => (
          <div className="result-card" key={e.id}>
            <div className="result-meta">
              <span className="result-type">{e.type}</span>
              <span className="result-date">{new Date(e.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="result-content">{e.content}</p>
            {e.tags.length > 0 && (
              <div className="result-tags">
                {e.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
