/**
 * TIMPS Desktop - Search View
 * Search across memory entries.
 */

import { useState, useMemo } from 'react';
import { api, SemanticEntry } from '../api';
import { formatDate, truncate } from '../utils/index';
import './SearchView.css';

interface SearchViewProps {
  projectPath: string;
  semanticEntries: SemanticEntry[];
}

export function SearchView({ projectPath, semanticEntries }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticEntry[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await api.searchMemory(projectPath, query, 50);
      setResults(found);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const localResults = useMemo(() => {
    if (!query.trim()) return semanticEntries.slice(0, 20);
    const q = query.toLowerCase();
    return semanticEntries.filter(
      e => e.content.toLowerCase().includes(q) ||
           e.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [query, semanticEntries]);

  const displayResults = results.length > 0 ? results : localResults;

  return (
    <div className="search-view">
      <h2>Search Memory</h2>

      <div className="search-form">
        <div className="search-input-wrap">
          <input
            type="text"
            placeholder="Search memories..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button 
            className="search-btn"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? '...' : '🔍'}
          </button>
        </div>
        <div className="search-hint">
          Search in content and tags across all {semanticEntries.length} memories
        </div>
      </div>

      <div className="search-results">
        <div className="results-header">
          {displayResults.length} {displayResults.length === 1 ? 'result' : 'results'}
        </div>

        {displayResults.map((entry, index) => (
          <div key={entry.id || index} className="result-card">
            <div className="result-header">
              <span className={`result-type type-${entry.type}`}>{entry.type}</span>
              <span className="result-date">{formatDate(entry.timestamp)}</span>
            </div>
            <div className="result-content">
              {highlightMatch(entry.content, query)}
            </div>
            {entry.tags.length > 0 && (
              <div className="result-tags">
                {entry.tags.map(tag => (
                  <span 
                    key={tag} 
                    className={`result-tag ${query && tag.toLowerCase().includes(query.toLowerCase()) ? 'highlight' : ''}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {entry.score !== undefined && (
              <div className="result-score">
                Score: {entry.score.toFixed(2)}
              </div>
            )}
          </div>
        ))}

        {displayResults.length === 0 && query && (
          <div className="no-results">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i}>{part}</mark>
      : part
  );
}