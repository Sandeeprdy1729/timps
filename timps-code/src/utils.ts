// ── Utilities ──

export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent: string | undefined;
      let currentData: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData.push(line.slice(6));
        } else if (line === '' && currentData.length > 0) {
          const data = currentData.join('\n');
          if (data !== '[DONE]') yield { event: currentEvent, data };
          currentEvent = undefined;
          currentData = [];
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* parseNDJSON(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try { yield JSON.parse(trimmed); } catch { /* skip */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function generateId(prefix = 'tc'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function parseXmlToolCalls(text: string): { name: string; arguments: Record<string, unknown> }[] {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];

  // Strip markdown code fences — models sometimes wrap tool calls in ```xml ... ```
  const stripped = text.replace(/```(?:xml|tool_call|text)?\s*\n?([\s\S]*?)```/g, '$1');

  // Format 1: <tool_call>{"name":"...","arguments":{...}}</tool_call>  (JSON inside tags)
  const jsonRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;
  while ((match = jsonRegex.exec(stripped)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && parsed.arguments) calls.push(parsed);
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Format 2: <tool_call><name>...</name><arguments>{...}</arguments></tool_call>  (XML-nested)
  const xmlNestedRegex = /<tool_call>\s*<name>\s*([\w]+)\s*<\/name>\s*<arguments>\s*([\s\S]*?)\s*<\/arguments>\s*<\/tool_call>/g;
  while ((match = xmlNestedRegex.exec(stripped)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      calls.push({ name: match[1], arguments: args });
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Format 3: <name>...</name><arguments>{...}</arguments>  (no wrapper — common with small models)
  const bareRegex = /<name>\s*([\w]+)\s*<\/name>\s*<arguments>\s*([\s\S]*?)\s*<\/arguments>/g;
  while ((match = bareRegex.exec(stripped)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      calls.push({ name: match[1], arguments: args });
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Format 4: raw JSON tool call {"name":"write_file","arguments":{...}} (fallback)
  const jsonCallRegex = /\{\s*"name"\s*:\s*"(\w+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
  while ((match = jsonCallRegex.exec(stripped)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      calls.push({ name: match[1], arguments: args });
    } catch { /* skip */ }
  }

  return calls;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function formatCost(dollars: number): string {
  if (dollars < 0.001) return '<$0.001';
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

// Per-million-token pricing: [input, output]
const MODEL_PRICING: Record<string, [number, number]> = {
  // Claude
  'claude-sonnet-4-20250514': [3, 15],
  'claude-opus-4-20250514': [15, 75],
  'claude-3-5-sonnet': [3, 15],
  'claude-3-haiku': [0.25, 1.25],
  // OpenAI
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'o3-mini': [1.1, 4.4],
  'o3': [10, 40],
  'gpt-4-turbo': [10, 30],
  // Gemini
  'gemini-2.0-flash': [0, 0],  // free tier
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.15, 0.6],
  // Ollama = always free
  // OpenRouter — varies, use rough averages
  'google/gemini-2.0-flash-exp:free': [0, 0],
  'deepseek/deepseek-r1:free': [0, 0],
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Find best matching pricing key
  const key = Object.keys(MODEL_PRICING).find(k => model.includes(k) || model.startsWith(k));
  if (!key) {
    // If model is local (ollama) or unknown, cost is 0
    if (model.includes(':') && !model.includes('/')) return 0; // ollama format "model:tag"
    return 0;
  }
  const [inPrice, outPrice] = MODEL_PRICING[key];
  return (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
}

export function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}

export function relPath(fullPath: string, cwd: string): string {
  if (fullPath.startsWith(cwd)) {
    const rel = fullPath.slice(cwd.length);
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  return fullPath;
}
