import React, { useState, useEffect, useCallback, CSSProperties, ReactNode } from 'react';
import { PluginManifest, PluginMetadata, Plugin } from '../core/types';

export interface PluginCardProps {
  plugin: PluginMetadata;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function PluginCard({
  plugin,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  className = '',
  style,
}: PluginCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`plugin-card ${className}`} style={style}>
      <div className="plugin-card-header">
        <div className="plugin-card-icon">{plugin.icon || '📦'}</div>
        <div className="plugin-card-info">
          <div className="plugin-card-name">{plugin.name}</div>
          <div className="plugin-card-version">v{plugin.version}</div>
        </div>
        <div className={`plugin-card-badge ${plugin.enabled ? 'enabled' : 'disabled'}`}>
          {plugin.enabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>
      {plugin.description && (
        <div className="plugin-card-description">{plugin.description}</div>
      )}
      {expanded && (
        <div className="plugin-card-details">
          <div>ID: {plugin.id}</div>
          <div>Source: {plugin.source}</div>
          {plugin.author && <div>Author: {plugin.author}</div>}
          {plugin.keywords && <div>Keywords: {plugin.keywords.join(', ')}</div>}
        </div>
      )}
      <div className="plugin-card-actions">
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Less' : 'More'}
        </button>
        {plugin.enabled ? (
          <button type="button" onClick={onDisable}>Disable</button>
        ) : (
          <button type="button" onClick={onEnable}>Enable</button>
        )}
        {!plugin.source || plugin.source === 'registry' ? (
          <button type="button" onClick={onUninstall}>Uninstall</button>
        ) : (
          <button type="button" onClick={onInstall}>Install</button>
        )}
      </div>
    </div>
  );
}

export interface PluginListProps {
  plugins: PluginMetadata[];
  onInstall?: (plugin: PluginMetadata) => void;
  onUninstall?: (plugin: PluginMetadata) => void;
  onEnable?: (plugin: PluginMetadata) => void;
  onDisable?: (plugin: PluginMetadata) => void;
  filter?: string;
  className?: string;
  style?: CSSProperties;
}

export function PluginList({
  plugins,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  filter,
  className = '',
  style,
}: PluginListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const filteredPlugins = plugins.filter(p => {
    if (filter && p.source !== filter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className={`plugin-list ${className}`} style={style}>
      <div className="plugin-list-header">
        <input
          type="text"
          placeholder="Search plugins..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select onChange={e => setSourceFilter(e.target.value || null)}>
          <option value="">All Sources</option>
          <option value="core">Core</option>
          <option value="builtin">Builtin</option>
          <option value="local">Local</option>
          <option value="registry">Registry</option>
        </select>
      </div>
      <div className="plugin-list-grid">
        {filteredPlugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onInstall={() => onInstall?.(plugin)}
            onUninstall={() => onUninstall?.(plugin)}
            onEnable={() => onEnable?.(plugin)}
            onDisable={() => onDisable?.(plugin)}
          />
        ))}
      </div>
      {filteredPlugins.length === 0 && (
        <div className="plugin-list-empty">No plugins found</div>
      )}
    </div>
  );
}

export interface PluginSearchProps {
  onSearch: (query: string) => void;
  onSelect: (plugin: PluginMetadata) => void;
  className?: string;
}

export function PluginSearch({
  onSearch,
  onSelect,
  className = '',
}: PluginSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PluginMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    onSearch(query);
    setLoading(false);
  }, [query, onSearch]);

  return (
    <div className={`plugin-search ${className}`}>
      <div className="plugin-search-input">
        <input
          type="text"
          placeholder="Search plugins..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div className="plugin-search-results">
        {results.map(plugin => (
          <div
            key={plugin.id}
            className="plugin-search-result"
            onClick={() => onSelect(plugin)}
          >
            <div className="plugin-search-result-name">{plugin.name}</div>
            <div className="plugin-search-result-description">
              {plugin.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PluginDetailsProps {
  plugin: PluginMetadata;
  onClose: () => void;
  className?: string;
}

export function PluginDetails({
  plugin,
  onClose,
  className = '',
}: PluginDetailsProps) {
  return (
    <div className={`plugin-details ${className}`}>
      <div className="plugin-details-header">
        <div className="plugin-details-icon">{plugin.icon || '📦'}</div>
        <div className="plugin-details-info">
          <div className="plugin-details-name">{plugin.name}</div>
          <div className="plugin-details-version">v{plugin.version}</div>
        </div>
        <button onClick={onClose}>×</button>
      </div>
      {plugin.description && (
        <div className="plugin-details-description">{plugin.description}</div>
      )}
      <div className="plugin-details-meta">
        {plugin.author && (
          <div className="plugin-details-row">
            <span>Author:</span> {plugin.author}
          </div>
        )}
        {plugin.license && (
          <div className="plugin-details-row">
            <span>License:</span> {plugin.license}
          </div>
        )}
        {plugin.homepage && (
          <div className="plugin-details-row">
            <span>Homepage:</span> <a href={plugin.homepage}>Link</a>
          </div>
        )}
        <div className="plugin-details-row">
          <span>Source:</span> {plugin.source}
        </div>
        {plugin.installedAt && (
          <div className="plugin-details-row">
            <span>Installed:</span> {new Date(plugin.installedAt).toLocaleDateString()}
          </div>
        )}
        {plugin.updatedAt && (
          <div className="plugin-details-row">
            <span>Updated:</span> {new Date(plugin.updatedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default PluginCard;