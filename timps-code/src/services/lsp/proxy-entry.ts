// TIMPS LSP — Proxy Server Entry Point
// Standalone process that runs as an LSP proxy for a single language server
// Usage: node proxy.js [--language typescript] [--stdio]

import { LspProxyServer, LspProxyConfig, MemoryClient } from './proxy.js';

function getConfig(): { language: string; command: string; args: string[] } {
  const lang = process.argv.find(a => a.startsWith('--language='))?.split('=')[1] || 'typescript';
  const configs: Record<string, { command: string; args: string[] }> = {
    typescript: { command: 'typescript-language-server', args: ['--stdio'] },
    javascript: { command: 'typescript-language-server', args: ['--stdio'] },
    python: { command: 'python', args: ['-m', 'pyright-langserver', '--stdio'] },
    rust: { command: 'rust-analyzer', args: [] },
    go: { command: 'gopls', args: [] },
  };
  return { language: lang, ...(configs[lang] || configs.typescript) };
}

// Create a memory client that connects to the local TIMPS MemoryServer
const memoryClient: MemoryClient = {
  async recall(query: string, options?: { limit?: number }) {
    const url = process.env.TIMPS_MEMORY_URL || 'http://localhost:4100';
    try {
      const res = await fetch(`${url}/api/memory/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: options?.limit || 5 }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.memories || data || [];
    } catch {
      return [];
    }
  },

  async checkContradiction(statement: string) {
    const url = process.env.TIMPS_MEMORY_URL || 'http://localhost:4100';
    try {
      const res = await fetch(`${url}/api/memory/contradiction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement }),
      });
      if (!res.ok) return { contradicts: false, confidence: 0 };
      return await res.json();
    } catch {
      return { contradicts: false, confidence: 0 };
    }
  },

  async checkBugPattern(content: string, file: string) {
    const url = process.env.TIMPS_MEMORY_URL || 'http://localhost:4100';
    try {
      const res = await fetch(`${url}/api/memory/check-bug-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, file }),
      });
      if (!res.ok) return { matches: false, patterns: [] };
      return await res.json();
    } catch {
      return { matches: false, patterns: [] };
    }
  },
};

const config = getConfig();
const proxyConfig: LspProxyConfig = {
  serverCommand: config.command,
  serverArgs: config.args,
  languageId: config.language,
  memoryClient,
  debounceMs: parseInt(process.env.TIMPS_LSP_DEBOUNCE_MS || '2000', 10),
  enabled: process.env.TIMPS_LSP_ENABLED !== 'false',
};

const server = new LspProxyServer(proxyConfig);

// Connect stdin/stdout for LSP communication
process.stdin.on('data', (data: Buffer) => {
  server.handleEditorMessage(data.toString());
});

server.onSend = (msg: string) => {
  process.stdout.write(msg);
};

// Start the real language server
const rootPath = process.env.TIMPS_LSP_ROOT || process.cwd();
server.start(rootPath);

// Handle process signals
process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  server.stop();
  process.exit(0);
});

console.error(`[TIMPS LSP] Proxy started for ${config.language} at ${rootPath}`);
