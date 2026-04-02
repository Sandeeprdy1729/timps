// ── Claude (Anthropic) Model Provider ──
import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../types.js';
import { parseSSE } from '../utils.js';

export function createClaudeProvider(apiKey: string, modelId?: string): ModelProvider {
  const model = modelId || 'claude-sonnet-4-20250514';

  return {
    name: 'claude',
    model,
    supportsFunctionCalling: true,

    async *stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent> {
      const body: Record<string, unknown> = {
        model,
        max_tokens: options?.maxTokens || 8192,
        stream: true,
        messages: convertMessages(messages),
      };
      if (options?.temperature !== undefined) body.temperature = options.temperature;
      if (tools.length > 0) {
        body.tools = tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        }));
      }

      // Extract system message
      const sysMsg = messages.find(m => m.role === 'system');
      if (sysMsg) body.system = sysMsg.content;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `Claude API ${res.status}: ${err}` };
        return;
      }

      let currentToolId = '';
      let inputTokens = 0, outputTokens = 0;

      for await (const raw of parseSSE(res.body!)) {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(raw.data); } catch { /* skip */ }
        const eventType = raw.event || '';

        switch (eventType) {
          case 'content_block_start': {
            const block = data.content_block as Record<string, unknown> | undefined;
            if (block?.type === 'tool_use') {
              currentToolId = String(block.id);
              yield { type: 'tool_start', id: String(block.id), name: String(block.name) };
            } else if (block?.type === 'thinking') {
              yield { type: 'thinking', content: '' };
            }
            break;
          }
          case 'content_block_delta': {
            const delta = data.delta as Record<string, unknown> | undefined;
            if (delta?.type === 'text_delta') {
              yield { type: 'text', content: String(delta.text) };
            } else if (delta?.type === 'input_json_delta') {
              yield { type: 'tool_delta', id: currentToolId, argumentsChunk: String(delta.partial_json) };
            } else if (delta?.type === 'thinking_delta') {
              yield { type: 'thinking', content: String(delta.thinking) };
            }
            break;
          }
          case 'content_block_stop':
            if (currentToolId) {
              yield { type: 'tool_end', id: currentToolId };
              currentToolId = '';
            }
            break;
          case 'message_delta': {
            const usage = data.usage as Record<string, number> | undefined;
            if (usage) outputTokens = usage.output_tokens || 0;
            break;
          }
          case 'message_start': {
            const msg = data.message as Record<string, unknown> | undefined;
            const usage = msg?.usage as Record<string, number> | undefined;
            if (usage) inputTokens = usage.input_tokens || 0;
            break;
          }
          case 'message_stop':
            yield { type: 'done', usage: { inputTokens, outputTokens } };
            break;
          case 'error': {
            const err = data.error as Record<string, unknown> | undefined;
            yield { type: 'error', message: String(err?.message || 'Stream error') };
            break;
          }
        }
      }
    },
  };
}

function convertMessages(messages: Message[]): unknown[] {
  const result: unknown[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // handled separately

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const content: unknown[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.toolCalls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      }
      result.push({ role: 'assistant', content });
    } else if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolCallId, content: msg.content }],
      });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}
