import * as crypto from 'node:crypto';

// ── ID generation ──
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

// ── Token estimation ──
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

// ── Cost estimation (USD per 1M tokens) ──
const COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514':   { input: 15.0, output: 75.0 },
  'claude-haiku-4-20251001':  { input: 0.8, output: 4.0 },
  'gpt-4o':                   { input: 2.5, output: 10.0 },
  'gpt-4o-mini':              { input: 0.15, output: 0.6 },
  'gemini-2.0-flash':         { input: 0.075, output: 0.3 },
  'deepseek-coder':           { input: 0.14, output: 0.28 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COSTS[model] || { input: 1.0, output: 3.0 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

// ── Shell escaping ──
export function shellEscape(s: string): string {
  if (/^[a-zA-Z0-9_\-./]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ── File size formatting ──
/** Alias for estimateCost — formats cost as a readable string */
export function formatCost(model: string, inputTokens: number, outputTokens: number): string {
  const cost = estimateCost(model, inputTokens, outputTokens);
  return cost < 0.001 ? '<$0.001' : `$${cost.toFixed(4)}`;
}

export function generateRandomSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ── Duration formatting ──
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ── SSE parser for streaming ──
export async function* parseSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let event: string | undefined;
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          data = line.slice(6).trim();
        } else if (line === '' && data) {
          if (data !== '[DONE]') yield { event, data };
          event = undefined;
          data = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Truncate text for display ──
export function truncate(s: string, max = 120): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ── Strip ANSI codes ──
export function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[mGKHFJ]/g, '');
}

// ── Wait helper ──
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
