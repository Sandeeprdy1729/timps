// ── Google Gemini Model Provider ──
import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../types.js';

export function createGeminiProvider(apiKey: string, modelId?: string): ModelProvider {
  const model = modelId || 'gemini-2.5-flash';

  return {
    name: 'gemini',
    model,
    supportsFunctionCalling: true,

    async *stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent> {
      const body: Record<string, unknown> = {
        contents: convertMessages(messages),
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 8192,
        },
      };

      if (options?.temperature !== undefined) {
        (body.generationConfig as Record<string, unknown>).temperature = options.temperature;
      }

      // System instruction
      const sysMsg = messages.find(m => m.role === 'system');
      if (sysMsg) body.system_instruction = { parts: [{ text: sysMsg.content }] };

      // Tools
      if (tools.length > 0) {
        body.tools = [{
          function_declarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: convertSchema(t.inputSchema),
          })),
        }];
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `Gemini API ${res.status}: ${err}` };
        return;
      }

      let inputTokens = 0, outputTokens = 0;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const candidate = data.candidates?.[0];

            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  yield { type: 'text', content: part.text };
                } else if (part.functionCall) {
                  const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                  yield { type: 'tool_start', id, name: part.functionCall.name };
                  yield { type: 'tool_delta', id, argumentsChunk: JSON.stringify(part.functionCall.args || {}) };
                  yield { type: 'tool_end', id };
                }
              }
            }

            if (data.usageMetadata) {
              inputTokens = data.usageMetadata.promptTokenCount || 0;
              outputTokens = data.usageMetadata.candidatesTokenCount || 0;
            }

            if (candidate?.finishReason) {
              yield { type: 'done', stopReason: candidate.finishReason, usage: { inputTokens, outputTokens } };
            }
          } catch {
            // skip bad JSON
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

    const geminiRole = msg.role === 'assistant' ? 'model' : 'user';

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const parts: unknown[] = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const tc of msg.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      }
      result.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      result.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name || 'tool',
            response: { content: msg.content },
          },
        }],
      });
    } else {
      result.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
  }
  return result;
}

function convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = { type: 'OBJECT' };
  const props = schema.properties as Record<string, { type: string; description?: string; enum?: string[] }>;
  if (props) {
    converted.properties = {};
    for (const [key, val] of Object.entries(props)) {
      (converted.properties as Record<string, unknown>)[key] = {
        type: val.type.toUpperCase(),
        description: val.description,
        ...(val.enum ? { enum: val.enum } : {}),
      };
    }
  }
  if (schema.required) converted.required = schema.required;
  return converted;
}
