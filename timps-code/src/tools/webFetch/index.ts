import type { RegisteredTool, ToolExecutor } from '../../tools/tools.js';
import { isPrivateUrl } from '../_shared/index.js';

export const webFetchTool: RegisteredTool = {
  definition: {
    name: 'web_fetch',
    description: 'Fetch and extract content from a URL. Applies a prompt to process the fetched content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch content from' },
        prompt: { type: 'string', description: 'The prompt to run on the fetched content' },
      },
      required: ['url', 'prompt'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const url = String(args.url);
    const prompt = String(args.prompt);
    try {
      new URL(url);
    } catch {
      return { content: `Invalid URL: ${url}`, isError: true };
    }
    try {
      const start = Date.now();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'TIMPS-Code/2.0', 'Accept': 'text/html,text/plain,application/json' },
      });
      if (!res.ok) {
        return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };
      }
      const contentType = res.headers.get('content-type') || '';
      let content = await res.text();
      let bytes = Buffer.byteLength(content, 'utf-8');
      if (contentType.includes('json')) {
        try {
          content = JSON.stringify(JSON.parse(content), null, 2);
        } catch { /* keep as text */ }
      } else {
        content = content
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ').trim();
      }
      const truncated = content.length > 8000 ? content.slice(0, 8000) + '...(truncated)' : content;
      const durationMs = Date.now() - start;
      return {
        content: `Fetched from ${url} (${bytes} bytes, ${durationMs}ms)\n\nContent:\n${truncated}`,
        isError: false,
      };
    } catch (e) {
      return { content: `Fetch error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const WebFetchTool: ToolExecutor = async (args) => {
  const { url } = args as any;

  if (isPrivateUrl(url)) {
    return { content: `Error: Access denied — ${url} resolves to a private/internal address`, isError: true, toolName: 'WebFetch' };
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    return { content: text.slice(0, 10000), toolName: 'WebFetch' };
  } catch (err: any) {
    return { content: `Fetch error: ${err.message}`, isError: true, toolName: 'WebFetch' };
  }
};