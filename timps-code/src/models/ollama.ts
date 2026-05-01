import type { Message, ModelProvider, StreamEvent, StreamOptions } from '../../config/types.js';

export function createOllamaProvider(
  baseUrl?: string, 
  modelId?: string
): ModelProvider {
  const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const model = modelId || 'qwen2.5-coder:7b';

  return {
    name: 'ollama',
    model,
    supportsFunctionCalling: false,
    async *stream(
      messages: Message[], 
      _tools: any[], 
      options?: StreamOptions
    ): AsyncGenerator<StreamEvent> {
      const ollamaMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.role === 'tool'
            ? `Tool result (${m.name || 'unknown'}): ${m.content}`
            : m.content,
        }));

      const sysMsg = messages.find(m => m.role === 'system');
      const body: Record<string, unknown> = {
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          num_ctx: 32768,
          ...(options?.temperature !== undefined && { temperature: options.temperature }),
        },
      };
      if (sysMsg) body.system = sysMsg.content;

      let res: Response;
      try {
        res = await fetch(`${url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: options?.signal,
        });
      } catch (e) {
        yield { type: 'error', message: `Cannot reach Ollama at ${url}. Is it running? (ollama serve)` };
        return;
      }

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `Ollama ${res.status}: ${err}` };
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let inputTokens = 0, outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n').filter(l => l.trim())) {
            let data: any;
            try { data = JSON.parse(line); } catch { continue; }
            if (data.message?.content) yield { type: 'text', content: data.message.content };
            if (data.done) {
              inputTokens = data.prompt_eval_count || 0;
              outputTokens = data.eval_count || 0;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: 'done', usage: { inputTokens, outputTokens } };
    },
  };
}

export async function listOllamaModels(baseUrl = 'http://localhost:11434'): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models || []).map(m => m.name);
  } catch { return []; }
}

export function isCodeModel(modelId: string): boolean {
  const codeFamilies = [
    'codellama', 'codegemma', 'qwen2.5-coder', 'qwen3-coder', 
    'deepseek-coder', 'codestral', 'codegeex4', 'granite-code', 
    'starcoder', 'starcoder2', 'wizardcoder', 'starchat'
  ];
  const [family] = modelId.split(':');
  return codeFamilies.includes(family);
}