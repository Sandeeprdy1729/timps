"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFetchTool = exports.WebSearchTool = void 0;
const baseTool_1 = require("./baseTool");
class WebSearchTool extends baseTool_1.BaseTool {
    name = 'web_search';
    description = 'Search the web for information. Use this tool when you need to find current information, facts, or answers to questions that require up-to-date knowledge.';
    parameters = {
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
    async execute(params) {
        const { query, num_results = '5' } = params;
        try {
            const results = await this.search(query, parseInt(num_results, 10));
            return JSON.stringify(results, null, 2);
        }
        catch (error) {
            return `Search error: ${error.message}`;
        }
    }
    async search(query, numResults) {
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
        const data = await response.json();
        return data.map((item) => ({
            title: item.title,
            url: item.url,
            snippet: item.snippet,
        }));
    }
}
exports.WebSearchTool = WebSearchTool;
class WebFetchTool extends baseTool_1.BaseTool {
    name = 'web_fetch';
    description = 'Fetch content from a specific URL. Use this tool when you need to get the content of a webpage, API endpoint, or any publicly accessible URL.';
    parameters = {
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
    async execute(params) {
        const { url, max_length = '5000' } = params;
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
            }
            else {
                content = await response.text();
            }
            const maxLen = parseInt(max_length, 10);
            if (content.length > maxLen) {
                content = content.substring(0, maxLen) + '\n\n[Content truncated...]';
            }
            return content;
        }
        catch (error) {
            return `Fetch error: ${error.message}`;
        }
    }
}
exports.WebFetchTool = WebFetchTool;
//# sourceMappingURL=webSearchTool.js.map