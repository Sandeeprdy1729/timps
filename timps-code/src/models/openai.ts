import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition, ProviderName } from '../config/types.js';
import { parseSSE } from '../utils/utils.js';

interface OpenAIOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  providerName?: ProviderName;
}

export function createOpenAIProvider(opts: OpenAIOptions): ModelProvider {
  const model = opts.model || 'gpt-4o';
  const baseUrl = opts.baseUrl || 'https://api.openai.com/v1';
  const name = opts.providerName || 'openai';

  return {
    name,
    model,
    supportsFunctionCalling: true,
    async *stream(messages, tools, options): AsyncGenerator<StreamEvent> {
      const body: Record<string, unknown> = {
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: messages.map(convertMessage),
      };
      if (options?.maxTokens) body.max_tokens = options.maxTokens;
      if (options?.temperature !== undefined) body.temperature = options.temperature;
      if (tools.length > 0) {
        body.tools = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
        body.tool_choice = 'auto';
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `${name} API ${res.status}: ${err}` };
        return;
      }

      const toolCalls = new Map<number, { id: string; name: string; args: string }>();
      let inputTokens = 0, outputTokens = 0;

      for await (const raw of parseSSE(res.body!)) {
        let data: Record<string, unknown>;
        try { data = JSON.parse(raw.data); } catch { continue; }

        const choices = data.choices as any[];
        if (!choices?.length) {
          if (data.usage) {
            const u = data.usage as any;
            yield { type: 'done', usage: { inputTokens: u.prompt_tokens || 0, outputTokens: u.completion_tokens || 0 } };
          }
          continue;
        }

        const delta = choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) yield { type: 'text', content: delta.content };

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
              if (tc.id) yield { type: 'tool_start', id: tc.id, name: tc.function?.name || '' };
            }
            const cur = toolCalls.get(idx)!;
            if (tc.id && !cur.id) cur.id = tc.id;
            if (tc.function?.name && !cur.name) cur.name = tc.function.name;
            if (tc.function?.arguments) {
              cur.args += tc.function.arguments;
              yield { type: 'tool_delta', id: cur.id, argumentsChunk: tc.function.arguments };
            }
          }
        }

        if (choices[0]?.finish_reason === 'tool_calls' || choices[0]?.finish_reason === 'stop') {
          for (const [, tc] of toolCalls) {
            yield { type: 'tool_end', id: tc.id };
          }
          yield { type: 'done', usage: { inputTokens, outputTokens } };
        }
      }
    },
  };
}

export function createOpenRouterProvider(apiKey: string, model?: string): ModelProvider {
  return createOpenAIProvider({
    apiKey,
    model: model || 'google/gemini-2.0-flash-exp:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    providerName: 'openrouter',
  });
}

export function createDeepSeekProvider(apiKey: string, model?: string): ModelProvider {
  return createOpenAIProvider({
    apiKey,
    model: model || 'deepseek-coder',
    baseUrl: 'https://api.deepseek.com/v1',
    providerName: 'deepseek',
  });
}

export function createGroqProvider(apiKey: string, model?: string): ModelProvider {
  return createOpenAIProvider({
    apiKey,
    model: model || 'llama-3.1-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    providerName: 'groq',
  });
}

function convertMessage(msg: Message): unknown {
  if (msg.role === 'assistant' && msg.toolCalls?.length) {
    return {
      role: 'assistant',
      content: msg.content || null,
      tool_calls: msg.toolCalls.map(tc => ({
        id: tc.id, type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
  }
  if (msg.role === 'tool') {
    return { role: 'tool', tool_call_id: msg.toolCallId, content: msg.content };
  }
  return { role: msg.role, content: msg.content };
}
