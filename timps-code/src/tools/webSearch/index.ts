import type { RegisteredTool, ToolExecResult } from '../_shared/index.js';

export const webSearch: RegisteredTool = {
  definition: {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo (or SearXNG if SEARXNG_URL env is set). Returns titles, URLs, and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default: 5)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args) {
    const query = String(args.query);
    const max = Number(args.maxResults) || 5;

    if (process.env.SEARXNG_URL) {
      return await searchSearXNG(process.env.SEARXNG_URL, query, max);
    }
    return await searchDuckDuckGo(query, max);
  },
};

async function searchSearXNG(baseUrl: string, query: string, max: number): Promise<ToolExecResult> {
  try {
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { content: `SearXNG error: ${res.status}`, isError: true };
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] };
    const results = (data.results || []).slice(0, max);
    if (results.length === 0) return { content: 'No results found.', isError: false };
    const output = results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content?.slice(0, 200) || ''}`
    ).join('\n\n');
    return { content: output, isError: false };
  } catch (e) {
    return { content: `SearXNG error: ${(e as Error).message}`, isError: true };
  }
}

async function searchDuckDuckGo(query: string, max: number): Promise<ToolExecResult> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { content: `Search error: ${res.status}`, isError: true };
    const data = await res.json() as {
      Abstract?: string; AbstractURL?: string; AbstractSource?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
      Results?: { Text?: string; FirstURL?: string }[];
    };

    const parts: string[] = [];
    if (data.Abstract) parts.push(`${data.AbstractSource}: ${data.Abstract}\n${data.AbstractURL || ''}`);
    for (const r of (data.Results || []).slice(0, max)) if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);
    for (const r of (data.RelatedTopics || []).slice(0, max)) if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);

    if (parts.length === 0) return await searchDDGLite(query, max);
    return { content: parts.slice(0, max).join('\n\n'), isError: false };
  } catch (e) {
    return { content: `Search error: ${(e as Error).message}`, isError: true };
  }
}

async function searchDDGLite(query: string, max: number): Promise<ToolExecResult> {
  try {
    const url = `https://lite.duckduckgo.com/lite?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'TIMPS-Code/2.0' },
    });
    if (!res.ok) return { content: `Search error: ${res.status}`, isError: true };
    const html = await res.text();

    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([^<]+)/gi;
    const links: { url: string; title: string }[] = [];
    const snippets: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && links.length < max) {
      links.push({ url: m[1], title: m[2].trim() });
    }
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < max) {
      snippets.push(m[1].trim());
    }

    const results = links.slice(0, max).map((link, i) =>
      `${i + 1}. ${link.title}\n   ${link.url}\n   ${snippets[i] || ''}`
    );
    return { content: results.length > 0 ? results.join('\n\n') : `No results for: ${query}`, isError: false };
  } catch (e) {
    return { content: `Search error: ${(e as Error).message}`, isError: true };
  }
}

export const WebSearchTool = async (args: Record<string, unknown>) => {
  const { query } = args as any;

  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await response.json() as { AbstractText?: string };

    return {
      content: data.AbstractText || `No results for: ${query}`,
      toolName: 'WebSearch',
    };
  } catch (err: any) {
    return {
      content: `Search error: ${err.message}`,
      isError: true,
      toolName: 'WebSearch',
    };
  }
};
