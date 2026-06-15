'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

const categories = [
  'All',
  'AI & LLMs',
  'Communication',
  'Developer Tools',
  'Productivity',
  'Database',
  'Security',
  'Analytics',
];

export function Hero() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') || 'integrations';
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState<'integrations' | 'plugins'>(initialType as 'integrations' | 'plugins');

  const updateParams = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== 'All') sp.set(k, v);
      else sp.delete(k);
    });
    const qs = sp.toString();
    router.push(qs ? `/?${qs}` : '/');
  }, [router, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: query });
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    updateParams({ category: cat === 'All' ? '' : cat });
  };

  const handleTypeToggle = (type: 'integrations' | 'plugins') => {
    setActiveType(type);
    updateParams({ type, category: '' });
    setActiveCategory('All');
  };

  return (
    <section className="hero">
      <h1 className="hero-title">
        Discover <span>Plugins</span> & <span>Integrations</span>
      </h1>
      <p className="hero-subtitle">
        Extend TIMPS with powerful integrations and custom plugins. Build, share, and discover tools that make TIMPS even stronger.
      </p>
      <div className="hero-actions" style={{ marginBottom: '32px', gap: '12px' }}>
        <button
          onClick={() => handleTypeToggle('integrations')}
          className={`btn ${activeType === 'integrations' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Integrations
        </button>
        <button
          onClick={() => handleTypeToggle('plugins')}
          className={`btn ${activeType === 'plugins' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Plugins
        </button>
      </div>
      <form onSubmit={handleSearch} className="search-container">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search plugins and integrations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </section>
  );
}
