import { BaseTool, ToolParameter } from './baseTool';

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
    
    try {
      const results = await this.search(query, parseInt(num_results, 10));
      return JSON.stringify(results, null, 2);
    } catch (error: any) {
      return `Search error: ${error.message}`;
    }
  }
  
  private async search(query: string, numResults: number): Promise<any[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://ddg-api.vercel.app/search?q=${encodedQuery}&num=${numResults}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }
    
    const data:any = await response.json();
    
    return data.map((item: any) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
    }));
  }
}

const BLOCKED_HOSTS = ['169.254.169.254', '127.0.0.1', '0.0.0.0', 'localhost', 'metadata.google.internal', '100.100.100.200'];
const BLOCKED_RANGES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];

function isInternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) return true;
    if (BLOCKED_RANGES.some(range => hostname.startsWith(range))) return true;
    return false;
  } catch {
    return true;
  }
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

    if (isInternalUrl(url)) {
      return 'Error: Access denied — URL resolves to a private/internal address';
    }
    
    try {
      const response = await fetch(url, {
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
