import { BaseTool, ToolParameter } from './baseTool';
import { fetchWithRetry, fetchWithTimeout } from '../lib/http';
import { lookup } from 'node:dns/promises';
import * as net from 'node:net';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// web_search no longer depends on a single hardcoded third-party proxy.
// Providers are tried in order (WEB_SEARCH_PROVIDERS, comma-separated):
//   ddg-api    — community DDG JSON proxy (default, keeps prior behavior)
//   duckduckgo — official DuckDuckGo instant-answer API (api.duckduckgo.com,
//                no key, structured JSON — official fallback)
//   custom     — operator-owned endpoint via WEB_SEARCH_URL (their own
//                gateway/SearXNG); optional WEB_SEARCH_API_KEY → Bearer token
async function searchDdgApi(query: string, numResults: number): Promise<SearchResult[]> {
  const url = `https://ddg-api.vercel.app/search?q=${encodeURIComponent(query)}&num=${numResults}`;
  const response = await fetchWithRetry(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`proxy returned ${response.status}`);
  }
  const data: any = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('proxy returned an unexpected response shape');
  }
  return data.slice(0, numResults).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.snippet || '',
  }));
}

// Official DuckDuckGo instant-answer API. No key, no HTML scraping — related
// topics arrive as structured JSON (nesting flattened).
async function searchDuckDuckGo(query: string, numResults: number): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
  const response = await fetchWithRetry(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
  const data: any = await response.json();
  const topics: any[] = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
  const results: SearchResult[] = [];
  for (const topic of topics) {
    if (topic.Topics) {
      // Nested category topic (Abstract / "Related" heading) — flatten.
      for (const sub of topic.Topics) {
        if (sub?.Text && sub?.FirstURL) {
          results.push({ title: sub.Text.split(' - ')[0], url: sub.FirstURL, snippet: sub.Text });
        }
      }
    } else if (topic?.Text && topic?.FirstURL) {
      results.push({ title: topic.Text.split(' - ')[0], url: topic.FirstURL, snippet: topic.Text });
    }
    if (results.length >= numResults) break;
  }
  return results.slice(0, numResults);
}

async function searchCustom(query: string, numResults: number): Promise<SearchResult[]> {
  const baseUrl = process.env.WEB_SEARCH_URL;
  if (!baseUrl) {
    throw new Error('WEB_SEARCH_URL is not set for the custom provider');
  }
  const url = new URL(baseUrl);
  url.searchParams.set('q', query);
  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: 'application/json',
      ...(process.env.WEB_SEARCH_API_KEY
        ? { Authorization: `Bearer ${process.env.WEB_SEARCH_API_KEY}` }
        : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`endpoint returned ${response.status}`);
  }
  const data: any = await response.json();
  const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : null;
  if (!list) {
    throw new Error('endpoint returned an unexpected response shape');
  }
  return list.slice(0, numResults).map((item: any) => ({
    title: item.title || item.name || '',
    url: item.url || item.link || '',
    snippet: item.snippet || item.description || '',
  }));
}

const SEARCH_PROVIDERS: Record<string, (query: string, numResults: number) => Promise<SearchResult[]>> = {
  'ddg-api': searchDdgApi,
  'duckduckgo': searchDuckDuckGo,
  'custom': searchCustom,
};

function configuredProviders(): string[] {
  const raw = process.env.WEB_SEARCH_PROVIDERS || 'ddg-api,duckduckgo';
  return raw
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(name => name.length > 0);
}

export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = 'Search the web for information. Use this tool when you need to find current information, facts, or answers to questions that require up-to-date knowledge.';
  
  parameters: ToolParameter = {
    type: 'object',
    description: 'Web search parameters',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'string',
        description: 'Number of results to return (default: 5)',
      },
    },
    required: ['query'],
  };
  
  async execute(params: Record<string, any>): Promise<string> {
    const { query, num_results = '5' } = params;
    const numResults = parseInt(num_results, 10) || 5;

    const providers = configuredProviders().filter(name => SEARCH_PROVIDERS[name]);
    if (providers.length === 0) {
      const valid = Object.keys(SEARCH_PROVIDERS).join(', ');
      return `Search error: no valid providers in WEB_SEARCH_PROVIDERS (got "${process.env.WEB_SEARCH_PROVIDERS}"). Valid options: ${valid}`;
    }

    // Fall back through the provider chain so one down/rate-limited proxy does
    // not silently fail every search for every user.
    const failures: string[] = [];
    for (const name of providers) {
      try {
        const results = await SEARCH_PROVIDERS[name](query, numResults);
        if (results.length > 0) {
          return JSON.stringify(results, null, 2);
        }
        failures.push(`${name}: returned no results`);
      } catch (error: any) {
        failures.push(`${name}: ${error.message}`);
      }
    }

    return `Search error: all search providers failed — ${failures.join('; ')}`;
  }
}

// ── web_fetch SSRF guard ──────────────────────────────────────────────
// The previous guard only string-matched the hostname against static
// blocklists — decimal/hex/IPv6 literals (http://2130706433, http://0x7f.1,
// http://[::1]) and attacker-controlled DNS resolving to a private IP bypassed
// it entirely. The guard now resolves the hostname via DNS and requires EVERY
// resolved address (IPv4 and IPv6) to be a public address. Unresolvable
// hostnames are denied (fail-closed). Redirects are followed manually so an
// external → internal redirect cannot smuggle a request to a metadata/loopback
// endpoint either.

const BLOCKED_HOSTS = ['169.254.169.254', '127.0.0.1', '0.0.0.0', 'localhost', 'metadata.google.internal', '100.100.100.200'];

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return false;                             // 0.0.0.0/8 "this network"
  if (a === 10) return false;                            // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return false;    // CGNAT 100.64.0.0/10
  if (a === 127) return false;                           // loopback
  if (a === 169 && b === 254) return false;              // link-local incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false;     // RFC 1918
  if (a === 192 && b === 168) return false;              // RFC 1918
  if (a === 192 && b === 0) return false;                // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking 198.18.0.0/15
  if (a >= 224) return false;                            // multicast + reserved
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return false;                  // unspecified / loopback
  if (lower.startsWith('::ffff:')) return isPublicIpv4(lower.slice(7)); // IPv4-mapped
  if (lower.startsWith('fe8') || lower.startsWith('fec')) return false; // link-local / site-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false;   // unique-local fc00::/7
  if (lower.startsWith('ff')) return false;                             // multicast
  return true;
}

async function isSafeToFetch(urlStr: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  let hostname = parsed.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.some(h => lower === h || lower.endsWith('.' + h))) return false;

  let addresses: string[];
  try {
    const records = await lookup(lower, { all: true, verbatim: true });
    addresses = records.map(r => r.address);
  } catch {
    return false; // unresolvable → deny (fail-closed)
  }
  if (addresses.length === 0) return false;

  // Every resolved address must be public. A hostname that resolves to even
  // one private IP (DNS rebinding / attacker-controlled DNS) is denied.
  for (let raw of addresses) {
    raw = raw.toLowerCase();
    if (raw.includes('%')) raw = raw.split('%')[0]; // strip IPv6 zone id
    if (net.isIP(raw) === 4) {
      if (!isPublicIpv4(raw)) return false;
    } else if (net.isIP(raw) === 6) {
      if (!isPublicIpv6(raw)) return false;
    } else {
      return false;
    }
  }
  return true;
}

const MAX_REDIRECTS = 5;

// Follow redirects manually, re-running the SSRF guard on every hop, so a
// public site cannot 302 us into an internal/metadata address.
async function fetchSafely(urlStr: string, init: RequestInit = {}): Promise<Response> {
  let current = urlStr;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isSafeToFetch(current))) {
      throw new Error('Access denied — URL resolves to a private/internal address');
    }

    const response = await fetchWithTimeout(current, { ...init, redirect: 'manual' });
    const status = response.status;
    const location = response.headers.get('location');

    if (status >= 300 && status < 400 && location) {
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        await response.body?.cancel().catch(() => {});
        throw new Error('Invalid redirect location');
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        await response.body?.cancel().catch(() => {});
        throw new Error('Access denied — redirect to unsupported protocol');
      }
      await response.body?.cancel().catch(() => {});
      current = next.toString();
      continue;
    }

    return response;
  }
  throw new Error('Too many redirects');
}

export class WebFetchTool extends BaseTool {
  name = 'web_fetch';
  description = 'Fetch content from a specific URL. Use this tool when you need to get the content of a webpage, API endpoint, or any publicly accessible URL.';
  
  parameters: ToolParameter = {
    type: 'object',
    description: 'Web fetch parameters',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      max_length: {
        type: 'string',
        description: 'Maximum length of content to return (default: 5000)',
      },
    },
    required: ['url'],
  };
  
  async execute(params: Record<string, any>): Promise<string> {
    const { url, max_length = '5000' } = params;

    try {
      const response = await fetchSafely(url, {
        headers: {
          'Accept': 'text/html, application/json, text/plain',
        },
      });
      
      if (!response.ok) {
        return `Error: Fetch failed with status ${response.status}`;
      }
      
      const contentType = response.headers.get('content-type') || '';
      let content = '';
      
      if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else {
        content = await response.text();
      }
      
      const maxLen = parseInt(max_length, 10);
      if (content.length > maxLen) {
        content = content.substring(0, maxLen) + '\n\n[Content truncated...]';
      }
      
      return content;
    } catch (error: any) {
      return `Fetch error: ${error.message}`;
    }
  }
}
