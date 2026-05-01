import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../config/types.js';

export function createGeminiProvider(apiKey: string, modelId?: string): ModelProvider {
  const model = modelId || 'gemini-2.0-flash';
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  return {
    name: 'gemini',
    model,
    supportsFunctionCalling: true,
    async *stream(messages, tools, options): AsyncGenerator<StreamEvent> {
      const geminiMessages = convertMessages(messages);
      const sysMsg = messages.find(m => m.role === 'system');

      const body: Record<string, unknown> = {
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 8192,
          ...(options?.temperature !== undefined && { temperature: options.temperature }),
        },
      };

      if (sysMsg) {
        body.systemInstruction = { parts: [{ text: sysMsg.content }] };
      }

      if (tools.length > 0) {
        body.tools = [{
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          })),
        }];
      }

      const res = await fetch(baseUrl, {
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

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;
            let data: any;
            try { data = JSON.parse(raw); } catch { continue; }

            const candidate = data.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (part.text) yield { type: 'text', content: part.text };
              if (part.functionCall) {
                const id = `fc_${Date.now()}`;
                yield { type: 'tool_start', id, name: part.functionCall.name };
                yield { type: 'tool_delta', id, argumentsChunk: JSON.stringify(part.functionCall.args || {}) };
                yield { type: 'tool_end', id };
              }
            }

            if (data.usageMetadata) {
              inputTokens = data.usageMetadata.promptTokenCount || 0;
              outputTokens = data.usageMetadata.candidatesTokenCount || 0;
            }

            if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
              // keep going
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

function convertMessages(messages: Message[]): unknown[] {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [{ functionResponse: { name: m.name || 'tool', response: { result: m.content } } }],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        const parts: unknown[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const tc of m.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
        }
        return { role: 'model', parts };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      };
    });
}
