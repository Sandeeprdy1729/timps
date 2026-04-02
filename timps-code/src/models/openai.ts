// ── OpenAI Model Provider (also powers OpenRouter) ──
import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../types.js';
import { parseSSE } from '../utils.js';

interface OpenAIOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  providerName?: string;
}

export function createOpenAIProvider(opts: OpenAIOptions): ModelProvider {
  const model = opts.model || 'gpt-4o';
  const baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const providerName = opts.providerName || 'openai';

  return {
    name: providerName,
    model,
    supportsFunctionCalling: true,

    async *stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent> {
      const body: Record<string, unknown> = {
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: convertMessages(messages),
      };
      if (options?.maxTokens) body.max_tokens = options.maxTokens;
      if (options?.temperature !== undefined) body.temperature = options.temperature;
      if (tools.length > 0) {
        body.tools = tools.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      };
      // OpenRouter extras
      if (providerName === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/nicktimps/timps';
        headers['X-Title'] = 'TIMPS Code';
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body), signal: options?.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `${providerName} API ${res.status}: ${err}` };
        return;
      }

      const toolCalls = new Map<number, { id: string; name: string; args: string }>();
      let inputTokens = 0, outputTokens = 0;

      for await (const event of parseSSE(res.body!)) {
        if (event.data === '[DONE]') continue;
        try {
          const data = JSON.parse(event.data);
          const choice = data.choices?.[0];
          if (!choice) {
            // usage-only chunk
            if (data.usage) {
              inputTokens = data.usage.prompt_tokens || 0;
              outputTokens = data.usage.completion_tokens || 0;
            }
            continue;
          }

          const delta = choice.delta;
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (tc.id) {
                toolCalls.set(idx, { id: tc.id, name: tc.function?.name || '', args: '' });
                yield { type: 'tool_start', id: tc.id, name: tc.function?.name || '' };
              }
              if (tc.function?.arguments) {
                const entry = toolCalls.get(idx);
                if (entry) {
                  entry.args += tc.function.arguments;
                  yield { type: 'tool_delta', id: entry.id, argumentsChunk: tc.function.arguments };
                }
              }
            }
          }

          if (choice.finish_reason) {
            for (const [, tc] of toolCalls) {
              yield { type: 'tool_end', id: tc.id };
            }
            toolCalls.clear();

            if (data.usage) {
              inputTokens = data.usage.prompt_tokens || 0;
              outputTokens = data.usage.completion_tokens || 0;
            }
            yield { type: 'done', stopReason: choice.finish_reason, usage: { inputTokens, outputTokens } };
          }
        } catch {
          // skip unparseable chunks
        }
      }
    },
  };
}

function convertMessages(messages: Message[]): unknown[] {
  const result: unknown[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      result.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id, type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    } else if (msg.role === 'tool') {
      result.push({ role: 'tool', tool_call_id: msg.toolCallId, content: msg.content });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}

export function createOpenRouterProvider(apiKey: string, model?: string): ModelProvider {
  return createOpenAIProvider({
    apiKey,
    model: model || 'anthropic/claude-sonnet-4-20250514',
    baseUrl: 'https://openrouter.ai/api/v1',
    providerName: 'openrouter',
  });
}
