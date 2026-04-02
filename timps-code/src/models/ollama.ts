// ── Ollama Model Provider ──
// Supports: DeepSeek R1, Qwen 2.5 Coder, CodeLlama, Llama 3.1, Mistral, etc.
import type { Message, ModelProvider, StreamEvent, StreamOptions, ToolDefinition } from '../types.js';
import { parseNDJSON, parseXmlToolCalls } from '../utils.js';

// Models known to support native function calling via Ollama
// Note: qwen2.5-coder outputs tool calls as raw JSON text, NOT native FC — use XML fallback
const FUNCTION_CALLING_MODELS = ['llama3.1', 'llama3.2', 'mistral', 'mixtral'];

export function createOllamaProvider(baseUrl?: string, modelId?: string): ModelProvider {
  const model = modelId || 'qwen2.5-coder:7b';
  const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const supportsFn = FUNCTION_CALLING_MODELS.some(m => model.startsWith(m));

  return {
    name: 'ollama',
    model,
    supportsFunctionCalling: supportsFn,

    async *stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent> {
      const useNativeTools = supportsFn && tools.length > 0;

      const body: Record<string, unknown> = {
        model,
        stream: true,
        messages: convertMessages(messages, useNativeTools ? [] : tools),
        options: {
          num_predict: options?.maxTokens || 4096,
          num_ctx: 16384,             // adequate context window for coding
          temperature: options?.temperature ?? 0.3,  // lower = more focused coding output
          top_p: 0.9,
          repeat_penalty: 1.1,        // avoid repetitive output
        },
      };

      if (options?.temperature !== undefined) {
        (body.options as Record<string, unknown>).temperature = options.temperature;
      }

      if (useNativeTools) {
        body.tools = tools.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      const res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        yield { type: 'error', message: `Ollama ${res.status}: ${err}` };
        return;
      }

      let fullContent = '';
      let inputTokens = 0, outputTokens = 0;
      let hasNativeToolCalls = false;
      const textBuffer: StreamEvent[] = [];
      // Buffer text for both native-FC and XML-fallback models so we can strip tool markup
      const shouldBuffer = useNativeTools || tools.length > 0;

      for await (const raw of parseNDJSON(res.body!)) {
        const data = raw as Record<string, unknown>;
        const msg = data.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          fullContent += String(msg.content);
          if (shouldBuffer) {
            textBuffer.push({ type: 'text', content: String(msg.content) });
          } else {
            yield { type: 'text', content: String(msg.content) };
          }
        }

        // Native tool calls
        if (msg?.tool_calls) {
          hasNativeToolCalls = true;
          for (const tc of msg.tool_calls as { function: { name: string; arguments: Record<string, unknown> } }[]) {
            const id = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            yield { type: 'tool_start', id, name: tc.function.name };
            yield { type: 'tool_delta', id, argumentsChunk: JSON.stringify(tc.function.arguments) };
            yield { type: 'tool_end', id };
          }
        }

        if (data.done) {
          inputTokens = Number(data.prompt_eval_count) || 0;
          outputTokens = Number(data.eval_count) || 0;
        }
      }

      // Post-processing: handle buffered text for native FC models
      if (useNativeTools && textBuffer.length > 0) {
        if (!hasNativeToolCalls) {
          // Model may have output tool call as raw JSON text instead of native FC
          const rawCall = tryParseRawToolCall(fullContent.trim(), tools);
          if (rawCall) {
            const id = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            yield { type: 'tool_start', id, name: rawCall.name };
            yield { type: 'tool_delta', id, argumentsChunk: JSON.stringify(rawCall.arguments) };
            yield { type: 'tool_end', id };
          } else {
            // Genuine text, flush buffer
            for (const ev of textBuffer) yield ev;
          }
        } else {
          // Had native tool calls AND text — flush the text
          for (const ev of textBuffer) yield ev;
        }
      }

      // For non-native FC models, parse XML tool calls from content
      if (!useNativeTools && tools.length > 0) {
        const parsed = parseXmlToolCalls(fullContent);
        if (parsed.length > 0) {
          // Strip XML/JSON tool call markup from text before yielding
          let cleanText = fullContent;
          // Strip various tool call patterns
          cleanText = cleanText.replace(/```(?:xml|tool_call|text)?\s*\n?[\s\S]*?```/g, '');
          cleanText = cleanText.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '');
          cleanText = cleanText.replace(/<name>\s*[\w]+\s*<\/name>\s*<arguments>[\s\S]*?<\/arguments>/g, '');
          cleanText = cleanText.replace(/\{\s*"name"\s*:\s*"\w+"[\s\S]*?"arguments"[\s\S]*?\}\s*\}/g, '');
          cleanText = cleanText.replace(/To save this file.*$/gm, '');
          cleanText = cleanText.trim();
          // Yield the clean explanatory text (if any)
          if (cleanText) {
            yield { type: 'text', content: cleanText };
          }
          // Yield the parsed tool calls
          for (const tc of parsed) {
            const validTool = tools.find(t => t.name === tc.name);
            if (validTool) {
              const tcId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              yield { type: 'tool_start', id: tcId, name: tc.name };
              yield { type: 'tool_delta', id: tcId, argumentsChunk: JSON.stringify(tc.arguments) };
              yield { type: 'tool_end', id: tcId };
            }
          }
        } else {
          // No tool calls — flush all buffered text
          for (const ev of textBuffer) yield ev;
        }
      }

      yield { type: 'done', usage: { inputTokens, outputTokens } };
    },
  };
}

function convertMessages(messages: Message[], toolsForPrompt: ToolDefinition[]): unknown[] {
  const result: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      let systemContent = msg.content;
      // For non-native-FC models, inject tool descriptions into system prompt
      if (toolsForPrompt.length > 0) {
        // Only add XML format instructions if not already in the prompt
        if (!systemContent.includes('<tool_call>')) {
          systemContent += '\n\n# Available Tools\n\nTo use a tool, output EXACTLY this XML (do NOT wrap in code fences):\n\n<tool_call>\n<name>tool_name</name>\n<arguments>{"arg": "value"}</arguments>\n</tool_call>\n';
        }
        systemContent += '\n# Tools Reference\n';
        for (const t of toolsForPrompt) {
          systemContent += `\n## ${t.name}\n${t.description}\nParameters: ${JSON.stringify(t.inputSchema.properties)}\nRequired: ${(t.inputSchema.required || []).join(', ')}\n`;
        }
      }
      result.push({ role: 'system', content: systemContent });
    } else if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const content = msg.toolCalls.map(tc =>
        `<tool_call>\n<name>${tc.name}</name>\n<arguments>${JSON.stringify(tc.arguments)}</arguments>\n</tool_call>`
      ).join('\n');
      result.push({ role: 'assistant', content: msg.content ? msg.content + '\n' + content : content });
    } else if (msg.role === 'tool') {
      result.push({ role: 'user', content: `Tool result for ${msg.name || 'tool'}:\n${msg.content}` });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}

/** Detect when a small model outputs a tool call as raw JSON text instead of native FC */
function tryParseRawToolCall(
  text: string,
  tools: ToolDefinition[]
): { name: string; arguments: Record<string, unknown> } | null {
  try {
    const obj = JSON.parse(text);
    // Single object: {"name":"think","arguments":{...}}
    if (obj && typeof obj.name === 'string' && tools.some(t => t.name === obj.name)) {
      return { name: obj.name, arguments: obj.arguments || {} };
    }
    // Array: [{"name":"think","arguments":{...}}]
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0]?.name === 'string') {
      if (tools.some(t => t.name === obj[0].name)) {
        return { name: obj[0].name, arguments: obj[0].arguments || {} };
      }
    }
  } catch {
    // Not valid JSON — genuine text
  }
  return null;
}
