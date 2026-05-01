import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../config/types.js';
import { parseSSE } from '../utils/utils.js';

export function createClaudeProvider(apiKey: string, modelId?: string): ModelProvider {
  const model = modelId || 'claude-sonnet-4-20250514';
  return {
    name: 'claude',
    model,
    supportsFunctionCalling: true,
    async *stream(messages, tools, options): AsyncGenerator<StreamEvent> {
      const sysMsg = messages.find(m => m.role === 'system');
      const body: Record<string, unknown> = {
        model,
        max_tokens: options?.maxTokens || 8192,
        stream: true,
        messages: convertMessages(messages),
      };
      if (sysMsg) body.system = sysMsg.content;
      if (options?.temperature !== undefined) body.temperature = options.temperature;
      if (tools.length > 0) {
        body.tools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
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
        try { data = JSON.parse(raw.data); } catch { continue; }
        const ev = raw.event || '';

        if (ev === 'content_block_start') {
          const block = data.content_block as any;
          if (block?.type === 'tool_use') { currentToolId = block.id; yield { type: 'tool_start', id: block.id, name: block.name }; }
          else if (block?.type === 'thinking') yield { type: 'thinking', content: '' };
        } else if (ev === 'content_block_delta') {
          const delta = data.delta as any;
          if (delta?.type === 'text_delta') yield { type: 'text', content: delta.text };
          else if (delta?.type === 'input_json_delta') yield { type: 'tool_delta', id: currentToolId, argumentsChunk: delta.partial_json };
          else if (delta?.type === 'thinking_delta') yield { type: 'thinking', content: delta.thinking };
        } else if (ev === 'content_block_stop') {
          if (currentToolId) { yield { type: 'tool_end', id: currentToolId }; currentToolId = ''; }
        } else if (ev === 'message_start') {
          const u = (data.message as any)?.usage; if (u) inputTokens = u.input_tokens || 0;
        } else if (ev === 'message_delta') {
          const u = (data as any).usage; if (u) outputTokens = u.output_tokens || 0;
        } else if (ev === 'message_stop') {
          yield { type: 'done', usage: { inputTokens, outputTokens } };
        } else if (ev === 'error') {
          yield { type: 'error', message: String((data.error as any)?.message || 'Stream error') };
        }
      }
    },
  };
}

function convertMessages(messages: Message[]): unknown[] {
  const result: unknown[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const content: unknown[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.toolCalls) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      result.push({ role: 'assistant', content });
    } else if (msg.role === 'tool') {
      result.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: msg.toolCallId, content: msg.content }] });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}
