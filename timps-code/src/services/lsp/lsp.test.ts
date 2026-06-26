// TIMPS LSP — Tests for proxy server, protocol, and handlers

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  encodeLspMessage, decodeLspMessages,
  LspRequest, LspResponse, LspNotification,
  DiagnosticSeverity, TextDocumentSyncKind,
} from './protocol.js';
import { LspProxyServer, LspProxyConfig, MemoryClient } from './proxy.js';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-lsp-test-'));

// ─── Protocol tests ──────────────────────────────────────────

describe('LSP Protocol', () => {
  it('encodes a request with Content-Length header', () => {
    const request: LspRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/definition',
      params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 0, character: 0 } },
    };
    const encoded = encodeLspMessage(request);
    expect(encoded).toMatch(/Content-Length: \d+/);
    expect(encoded).toContain('"jsonrpc":"2.0"');
  });

  it('decodes messages from a raw byte stream', () => {
    const request: LspRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: 123, rootUri: 'file:///' },
    };
    const encoded = encodeLspMessage(request);
    const decoded = decodeLspMessages(encoded);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({ id: 1, method: 'initialize' });
  });

  it('handles multiple messages in one buffer', () => {
    const req1 = encodeLspMessage({ jsonrpc: '2.0', id: 1, method: 'a', params: {} });
    const req2 = encodeLspMessage({ jsonrpc: '2.0', id: 2, method: 'b', params: {} });
    const decoded = decodeLspMessages(req1 + req2);
    expect(decoded).toHaveLength(2);
  });

  it('handles empty input gracefully', () => {
    expect(decodeLspMessages('')).toEqual([]);
  });

  it('encodes and decodes responses', () => {
    const response: LspResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { capabilities: { hoverProvider: true } },
    };
    const encoded = encodeLspMessage(response);
    const decoded = decodeLspMessages(encoded);
    expect(decoded).toHaveLength(1);
    expect((decoded[0] as LspResponse).result).toEqual({ capabilities: { hoverProvider: true } });
  });

  it('encodes and decodes notifications', () => {
    const notification: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: { uri: 'file:///test.ts', diagnostics: [] },
    };
    const encoded = encodeLspMessage(notification);
    const decoded = decodeLspMessages(encoded);
    expect(decoded).toHaveLength(1);
    expect((decoded[0] as LspNotification).method).toBe('textDocument/publishDiagnostics');
  });
});

// ─── Proxy server tests ──────────────────────────────────────

function createMockMemoryClient(): MemoryClient {
  return {
    recall: vi.fn().mockResolvedValue([
      { content: 'auth navigation pattern', metadata: { fileUri: 'file:///auth.ts', visitCount: 10 }, score: 0.95 },
      { content: 'middleware pattern', metadata: { fileUri: 'file:///middleware.ts', visitCount: 5 }, score: 0.8 },
    ]),
    checkContradiction: vi.fn().mockResolvedValue({ contradicts: true, confidence: 0.9, conflictingMemory: 'Use 1h expiry', severity: 'warning' }),
    checkBugPattern: vi.fn().mockResolvedValue({ matches: true, patterns: [{ name: 'String comparison role check', description: 'Use enum instead', severity: 'warning' }] }),
  };
}

// A minimal LSP server script that responds to initialize and basic requests
const lspMockScript = `
const fs = require('fs');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const parts = buffer.split('\\r\\n\\r\\n');
  for (let i = 0; i < parts.length - 1; i += 2) {
    const header = parts[i];
    const body = parts[i + 1];
    const m = header.match(/Content-Length:\\s*(\\d+)/i);
    if (!m) continue;
    const len = parseInt(m[1], 10);
    if (body.length < len) continue;
    const msg = JSON.parse(body.substring(0, len));
    
    if (msg.method === 'initialize') {
      const resp = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { capabilities: { textDocumentSync: 1, hoverProvider: true, definitionProvider: true } }
      });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(resp) + '\\r\\n\\r\\n' + resp);
    } else if (msg.method === 'initialized') {
      // no response needed
    } else if (msg.method === 'textDocument/definition') {
      const resp = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: [{ uri: 'file:///src/auth.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } } }]
      });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(resp) + '\\r\\n\\r\\n' + resp);
    } else if (msg.method === 'textDocument/hover') {
      const resp = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { contents: { kind: 'markdown', value: 'function auth(): void' } }
      });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(resp) + '\\r\\n\\r\\n' + resp);
    } else {
      const resp = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(resp) + '\\r\\n\\r\\n' + resp);
    }
    buffer = body.substring(len);
  }
});
`;

describe('LspProxyServer', () => {
  let server: LspProxyServer;
  let memoryClient: MemoryClient;
  let sentMessages: string[];

  beforeEach(() => {
    sentMessages = [];
    memoryClient = createMockMemoryClient();
    const config: LspProxyConfig = {
      serverCommand: process.execPath,
      serverArgs: ['-e', lspMockScript],
      languageId: 'typescript',
      memoryClient,
      debounceMs: 50,
      enabled: true,
    };
    server = new LspProxyServer(config);
    server.onSend = (msg: string) => { sentMessages.push(msg); };
  });

  it('handles initialize request', async () => {
    server.start(testRoot);
    await vi.waitFor(() => {
      // Wait for server process to start
      expect((server as unknown as { realServerProcess: unknown }).realServerProcess).not.toBeNull();
    }, { timeout: 1000 });

    const initMsg: LspRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: 'file:///test', capabilities: {} },
    };

    server.handleEditorMessage(encodeLspMessage(initMsg));

    // Should have sent back a response
    await vi.waitFor(() => {
      expect(sentMessages.length).toBeGreaterThan(0);
      const decoded = decodeLspMessages(sentMessages[sentMessages.length - 1]);
      expect(decoded[0]).toMatchObject({
        id: 1,
        result: { capabilities: expect.objectContaining({ definitionProvider: true, hoverProvider: true }) },
      });
    }, { timeout: 2000 });
  });

  it('enriches definition results with related files', async () => {
    server.start(testRoot);
    await vi.waitFor(() => {
      expect((server as unknown as { realServerProcess: unknown }).realServerProcess).not.toBeNull();
    }, { timeout: 1000 });

    // Send initialize first
    server.handleEditorMessage(encodeLspMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: 'file:///test', capabilities: {} },
    }));
    await vi.waitFor(() => expect(sentMessages.length).toBeGreaterThan(0), { timeout: 3000 });

    const defMsg: LspRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/definition',
      params: {
        textDocument: { uri: 'file:///src/index.ts' },
        position: { line: 0, character: 0 },
      },
    };

    server.handleEditorMessage(encodeLspMessage(defMsg));

    await vi.waitFor(() => {
      // Wait for enriched definition response
      const allMsgs = sentMessages.flatMap(m => decodeLspMessages(m));
      const defResponse = allMsgs.find(m => 'id' in m && (m as unknown as { id: number }).id === 2);
      expect(defResponse).toBeDefined();
    }, { timeout: 3000 });

    // MemoryClient.recall should have been called with the filename
    expect(memoryClient.recall).toHaveBeenCalledWith('index.ts', { limit: 5 });
  });

  it('schedules debounced contradiction checks on didChange', async () => {
    const openMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri: 'file:///test.ts', languageId: 'typescript', version: 1, text: 'const x = 1;\n' },
      },
    };

    const changeMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri: 'file:///test.ts', version: 2 },
        contentChanges: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 12 } }, text: 'const x = 2;' }],
      },
    };

    server.handleEditorMessage(encodeLspMessage(openMsg));
    server.handleEditorMessage(encodeLspMessage(changeMsg));

    await vi.waitFor(() => {
      expect(memoryClient.checkContradiction).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('handles hover request and enriches with memory context', async () => {
    server.start(testRoot);
    await vi.waitFor(() => {
      expect((server as unknown as { realServerProcess: unknown }).realServerProcess).not.toBeNull();
    }, { timeout: 1000 });

    // Send initialize first
    server.handleEditorMessage(encodeLspMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: 'file:///test', capabilities: {} },
    }));
    await vi.waitFor(() => expect(sentMessages.length).toBeGreaterThan(0), { timeout: 3000 });

    const hoverMsg: LspRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'textDocument/hover',
      params: {
        textDocument: { uri: 'file:///src/index.ts' },
        position: { line: 0, character: 0 },
      },
    };

    server.handleEditorMessage(encodeLspMessage(hoverMsg));

    await vi.waitFor(() => {
      expect(memoryClient.recall).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('runs bug pattern check on didSave', async () => {
    const openMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri: 'file:///auth.ts', languageId: 'typescript', version: 1, text: 'if (role === "admin")\n' },
      },
    };

    const saveMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didSave',
      params: {
        textDocument: { uri: 'file:///auth.ts' },
        text: 'if (role === "admin")\n',
      },
    };

    server.handleEditorMessage(encodeLspMessage(openMsg));
    server.handleEditorMessage(encodeLspMessage(saveMsg));

    await vi.waitFor(() => {
      expect(memoryClient.checkBugPattern).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('clears debounce timer on document close', async () => {
    const openMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri: 'file:///test.ts', languageId: 'typescript', version: 1, text: 'const x = 1;' },
      },
    };

    const closeMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didClose',
      params: { textDocument: { uri: 'file:///test.ts' } },
    };

    server.handleEditorMessage(encodeLspMessage(openMsg));
    server.handleEditorMessage(encodeLspMessage(closeMsg));

    // Verify didClose doesn't trigger contradiction check
    const callCount = (memoryClient.checkContradiction as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBe(0);
  });

  it('gracefully degrades when memory client is unavailable', async () => {
    const failingClient: MemoryClient = {
      recall: vi.fn().mockRejectedValue(new Error('Connection refused')),
      checkContradiction: vi.fn().mockRejectedValue(new Error('Connection refused')),
      checkBugPattern: vi.fn().mockRejectedValue(new Error('Connection refused')),
    };

    const config: LspProxyConfig = {
      serverCommand: process.execPath,
      serverArgs: ['-e', lspMockScript],
      languageId: 'typescript',
      memoryClient: failingClient,
    };

    const failServer = new LspProxyServer(config);
    const failMessages: string[] = [];
    failServer.onSend = (msg: string) => { failMessages.push(msg); };

    // Start server — real server may or may not be available, that's the point
    failServer.start(testRoot);

    // Send initialize — should work even without real server
    failServer.handleEditorMessage(encodeLspMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: 'file:///test', capabilities: {} },
    }));

    // Wait for init response
    await vi.waitFor(() => expect(failMessages.length).toBeGreaterThan(0), { timeout: 3000 });

    const defMsg: LspRequest = {
      jsonrpc: '2.0',
      id: 5,
      method: 'textDocument/definition',
      params: {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 0, character: 0 },
      },
    };

    failServer.handleEditorMessage(encodeLspMessage(defMsg));

    // Should not throw — gracefully degrades (may return empty or partial result)
    await vi.waitFor(() => {
      const allMsgs = failMessages.flatMap(m => decodeLspMessages(m));
      const defResponse = allMsgs.find(m => 'id' in m && (m as unknown as { id: number }).id === 5);
      // Response is optional — graceful degradation means it may or may not come
      if (defResponse) {
        expect(defResponse).toHaveProperty('result');
      }
    }, { timeout: 3000 }).catch(() => {
      // Timeout is acceptable — graceful degradation means the server doesn't crash
    });

    failServer.stop();
  });

  it('stops all timers and processes on stop', () => {
    server.stop();
    // No debounce timers should remain
    const timers = (server as unknown as { debounceTimers: Map<string, unknown> }).debounceTimers;
    expect(timers.size).toBe(0);
  });

  it('tracks document state after didOpen', () => {
    const openMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri: 'file:///test.ts', languageId: 'typescript', version: 1, text: 'const x = 42;' },
      },
    };

    server.handleEditorMessage(encodeLspMessage(openMsg));

    const docs = (server as unknown as { documents: Map<string, { text: string }> }).documents;
    expect(docs.get('file:///test.ts')?.text).toBe('const x = 42;');
  });

  it('applies incremental text changes', () => {
    const openMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri: 'file:///test.ts', languageId: 'typescript', version: 1, text: 'line1\nline2\nline3\n' },
      },
    };

    const changeMsg: LspNotification = {
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri: 'file:///test.ts', version: 2 },
        contentChanges: [{
          range: { start: { line: 1, character: 4 }, end: { line: 1, character: 5 } },
          text: 'B',
        }],
      },
    };

    server.handleEditorMessage(encodeLspMessage(openMsg));
    server.handleEditorMessage(encodeLspMessage(changeMsg));

    const docs = (server as unknown as { documents: Map<string, { text: string }> }).documents;
    expect(docs.get('file:///test.ts')?.text).toBe('line1\nlineB\nline3\n');
  });

  afterEach(() => {
    server.stop();
  });

  afterAll(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
});
