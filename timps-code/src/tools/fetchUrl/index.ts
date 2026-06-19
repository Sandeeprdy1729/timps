import type { RegisteredTool } from '../_shared/index.js';
import { isPrivateUrl } from '../_shared/index.js';

export const fetchUrl: RegisteredTool = {
  definition: {
    name: 'fetch_url',
    description: 'Fetch and return readable content from a URL. HTML tags are stripped for clean text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        maxLength: { type: 'number', description: 'Max response chars (default: 8000)' },
      },
      required: ['url'],
    },
  },
  risk: 'low',
  async execute(args) {
    const url = String(args.url);
    const maxLen = Number(args.maxLength) || 8000;
    try { new URL(url); } catch { return { content: 'Invalid URL', isError: true }; }

    if (isPrivateUrl(url)) {
      return { content: 'Error: Access denied — URL resolves to a private/internal address', isError: true };
    }

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'TIMPS-Code/2.0', 'Accept': 'text/html,text/plain,application/json' },
      });
      if (!res.ok) return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      if (contentType.includes('json')) {
        try {
          return { content: JSON.stringify(JSON.parse(text), null, 2).slice(0, maxLen), isError: false };
        } catch { return { content: text.slice(0, maxLen), isError: false }; }
      }

      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

      return { content: stripped.slice(0, maxLen), isError: false };
    } catch (e) {
      return { content: `Fetch error: ${(e as Error).message}`, isError: true };
    }
  },
};
