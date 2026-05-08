export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  type?: 'semantic' | 'episodic' | 'all';
}

export interface SearchResult {
  id: string;
  type: 'semantic' | 'episodic';
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export class SearchError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export interface SearchIndex {
  id: string;
  type: 'semantic' | 'episodic';
  content: string;
  metadata?: Record<string, unknown>;
}

class InMemorySearchIndex {
  private semanticIndex: SearchIndex[] = [];
  private episodicIndex: SearchIndex[] = [];

  add(entry: SearchIndex): void {
    if (entry.type === 'semantic') {
      this.semanticIndex.push(entry);
    } else {
      this.episodicIndex.push(entry);
    }
  }

  remove(id: string): void {
    this.semanticIndex = this.semanticIndex.filter(e => e.id !== id);
    this.episodicIndex = this.episodicIndex.filter(e => e.id !== id);
  }

  clear(): void {
    this.semanticIndex = [];
    this.episodicIndex = [];
  }

  search(query: string, type: 'semantic' | 'episodic' | 'all'): SearchResult[] {
    const results: SearchResult[] = [];
    const searchIndex = type === 'all'
      ? [...this.semanticIndex, ...this.episodicIndex]
      : type === 'semantic'
        ? this.semanticIndex
        : this.episodicIndex;

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    for (const entry of searchIndex) {
      const contentLower = entry.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 1;
          const exactMatch = contentLower === term ? 2 : 0;
          score += exactMatch;
        }
      }

      if (score > 0) {
        results.push({
          id: entry.id,
          type: entry.type,
          title: entry.content.slice(0, 50),
          content: entry.content,
          score,
          metadata: entry.metadata,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  get count(): number {
    return this.semanticIndex.length + this.episodicIndex.length;
  }
}

export const globalSearchIndex = new InMemorySearchIndex();

export function createSearchIndex(): InMemorySearchIndex {
  return new InMemorySearchIndex();
}

export async function search({
  query,
  limit = 10,
  offset = 0,
  type = 'all',
}: SearchOptions): Promise<SearchResponse> {
  const results = globalSearchIndex.search(query, type);
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    results: paginatedResults,
    total: results.length,
    query,
  };
}

export function highlightMatch(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + '...';
}

export function getSearchSuggestions(
  index: InMemorySearchIndex,
  query: string,
  limit = 5
): string[] {
  const results = index.search(query, 'all');
  return results.slice(0, limit).map(r => r.content);
}