/**
 * TIMPS Desktop - Pagination
 * Pagination controls.
 */

import './Pagination.css';

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ current, total, pageSize, onChange }: PaginationProps) {
  const pages = Math.ceil(total / pageSize);
  const maxVisible = 7;
  const visiblePages = getVisiblePages(current, pages, maxVisible);

  function getVisiblePages(current: number, total: number, max: number): (number | string)[] {
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const half = Math.floor(max / 2);
    let start = current - half;
    let end = current + half;
    if (start <= 0) {
      start = 1;
      end = max;
    }
    if (end > total) {
      end = total;
      start = total - max + 1;
    }
    const result: (number | string)[] = [];
    if (start > 1) {
      result.push(1);
      if (start > 2) result.push('...');
    }
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    if (end < total) {
      if (end < total - 1) result.push('...');
      result.push(total);
    }
    return result;
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        ←
      </button>
      <div className="pagination-pages">
        {visiblePages.map((page, index) => (
          typeof page === 'number' ? (
            <button
              key={page}
              className={`pagination-page ${page === current ? 'active' : ''}`}
              onClick={() => onChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="pagination-ellipsis">{page}</span>
          )
        ))}
      </div>
      <button
        className="pagination-btn"
        disabled={current === pages}
        onClick={() => onChange(current + 1)}
      >
        →
      </button>
    </div>
  );
}

interface PageSizeSelectProps {
  value: number;
  options: number[];
  onChange: (size: number) => void;
}

export function PageSizeSelect({ value, options, onChange }: PageSizeSelectProps) {
  return (
    <select 
      className="page-size-select" 
      value={value} 
      onChange={e => onChange(Number(e.target.value))}
    >
      {options.map(size => (
        <option key={size} value={size}>{size} / page</option>
      ))}
    </select>
  );
}

interface InfiniteLoaderProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export function InfiniteLoader({ hasMore, loading, onLoadMore, threshold = 200 }: InfiniteLoaderProps) {
  const handleScroll = () => {
    if (loading || !hasMore) return;
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      onLoadMore();
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);

  if (loading) {
    return <div className="infinite-loading">Loading more...</div>;
  }
  return null;
}

import { useEffect } from 'react';