'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <section className="hero">
      <h1 className="hero-title">
        Discover <span>Plugins</span> & <span>Integrations</span>
      </h1>
      <p className="hero-subtitle">
        Extend TIMPS with powerful integrations and custom plugins. Build, share, and discover tools that make TIMPS even stronger.
      </p>
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
        <button className="category-btn active">All</button>
        <button className="category-btn">AI & LLMs</button>
        <button className="category-btn">Communication</button>
        <button className="category-btn">Developer Tools</button>
        <button className="category-btn">Productivity</button>
        <button className="category-btn">Database</button>
        <button className="category-btn">Security</button>
        <button className="category-btn">Analytics</button>
      </div>
    </section>
  );
}