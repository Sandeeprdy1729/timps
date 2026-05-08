/**
 * TIMPS Desktop - Semantic Memory View
 * Display and manage semantic memory entries.
 */

import { useState, useMemo } from 'react';
import { api, SemanticEntry } from '../api';
import { formatDate, truncate } from '../utils/index';
import './SemanticView.css';

interface SemanticViewProps {
  entries: SemanticEntry[];
  loading: boolean;
}

export function SemanticView({ entries, loading }: SemanticViewProps) {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'type'>('timestamp');
  const [selectedEntry, setSelectedEntry] = useState<SemanticEntry | null>(null);

  const filtered = useMemo(() => {
    let result = [...entries];
    
    if (filter !== 'all') {
      result = result.filter(e => e.type === filter);
    }
    
    if (sortBy === 'timestamp') {
      result.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      result.sort((a, b) => a.type.localeCompare(b.type));
    }
    
    return result;
  }, [entries, filter, sortBy]);

  const types = useMemo(() => {
    const set = new Set(entries.map(e => e.type));
    return ['all', ...Array.from(set).sort()];
  }, [entries]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this memory?')) {
      await api.deleteMemory('', id);
    }
  };

  if (loading) {
    return <div className="semantic-view"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="semantic-view">
      <div className="view-header">
        <h2>Semantic Memory</h2>
        <div className="view-controls">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            {types.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'timestamp' | 'type')}>
            <option value="timestamp">Newest First</option>
            <option value="type">By Type</option>
          </select>
        </div>
      </div>

      <div className="entries-count">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </div>

      <div className="entries-list">
        {filtered.map(entry => (
          <div 
            key={entry.id} 
            className={`entry-card ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
            onClick={() => setSelectedEntry(entry)}
          >
            <div className="entry-header">
              <span className={`entry-type type-${entry.type}`}>{entry.type}</span>
              <span className="entry-date">{formatDate(entry.timestamp)}</span>
            </div>
            <div className="entry-content">
              {truncate(entry.content, 150)}
            </div>
            {entry.tags.length > 0 && (
              <div className="entry-tags">
                {entry.tags.map(tag => (
                  <span key={tag} className="entry-tag">{tag}</span>
                ))}
              </div>
            )}
            {entry.score !== undefined && (
              <div className="entry-score">
                <div 
                  className="score-bar" 
                  style={{ width: `${entry.score * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedEntry && (
        <div className="entry-detail-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="entry-detail" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <span className={`entry-type type-${selectedEntry.type}`}>{selectedEntry.type}</span>
              <button onClick={() => setSelectedEntry(null)}>✕</button>
            </div>
            <div className="detail-content">{selectedEntry.content}</div>
            <div className="detail-meta">
              <span>ID: {selectedEntry.id}</span>
              <span>Created: {formatDate(selectedEntry.timestamp)}</span>
            </div>
            {selectedEntry.tags.length > 0 && (
              <div className="detail-tags">
                {selectedEntry.tags.map(tag => (
                  <span key={tag} className="entry-tag">{tag}</span>
                ))}
              </div>
            )}
            <div className="detail-actions">
              <button 
                className="btn btn-danger"
                onClick={() => handleDelete(selectedEntry.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}