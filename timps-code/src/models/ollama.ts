import type { Message, ModelProvider, StreamEvent, StreamOptions } from '../config/types.js';

// ── XML Tool-Call Parser ──
// Parses <tool_call> XML emitted by local models and yields tool_start/tool_delta/tool_end events.
// State machine that accumulates text and detects <tool_call> blocks across streaming chunks.

interface ToolCallState {
  id: string;
  name: string;
  argsJson: string;
  inToolCall: boolean;
  tagBuffer: string;       // accumulates text inside <tool_call> ... </tool_call>
  nameBuffer: string;       // accumulates text inside <name>...</name>
  argsBuffer: string;       // accumulates text inside <arguments>...</arguments>
  parsingTag: 'none' | 'name' | 'arguments' | 'end';
  pendingText: string;      // text before the current tag (for non-tool-call output)
  emitIndex: number;        // counter for unique IDs
}

function createState(): ToolCallState {
  return {
    id: '',
    name: '',
    argsJson: '',
    inToolCall: false,
    tagBuffer: '',
    nameBuffer: '',
    argsBuffer: '',
    parsingTag: 'none',
    pendingText: '',
    emitIndex: 0,
  };
}

// Known tool names (matched case-insensitively)
const KNOWN_TOOLS = new Set([
  'write_file', 'read_file', 'run_bash', 'edit_file', 'think',
  'edit', 'read', 'bash', 'glob', 'grep', 'write',
]);

function* parseXmlToolCalls(
  text: string,
  state: ToolCallState,
): Generator<StreamEvent> {
  // Process character by character to handle tags that span chunks
  let i = 0;
  while (i < text.length) {
    if (!state.inToolCall) {
      // Look for <tool_call> opening tag
      const openIdx = text.indexOf('<tool_call>', i);
      if (openIdx === -1) {
        // No tool_call tag — emit remaining text as-is
        const remaining = text.slice(i);
        if (remaining) yield { type: 'text', content: remaining };
        break;
      }
      // Emit text before the tag
      const before = text.slice(i, openIdx);
      if (before) yield { type: 'text', content: before };
      // Start a new tool call
      state.emitIndex++;
      state.id = `xml_tc_${state.emitIndex}`;
      state.name = '';
      state.argsJson = '';
      state.nameBuffer = '';
      state.argsBuffer = '';
      state.parsingTag = 'none';
      state.inToolCall = true;
      state.tagBuffer = '';
      i = openIdx + '<tool_call>'.length;
    } else {
      // Inside a <tool_call> block — look for closing </tool_call>
      const closeIdx = text.indexOf('</tool_call>', i);
      if (closeIdx === -1) {
        // No closing tag yet — accumulate content
        state.tagBuffer += text.slice(i);
        break;
      }
      // Process content up to the closing tag
      const content = text.slice(i, closeIdx);
      processToolCallContent(content, state);
      // Process the content within the tag buffer
      if (state.tagBuffer) {
        processToolCallContent(state.tagBuffer, state);
        state.tagBuffer = '';
      }
      // Finalize the tool call
      if (state.name) {
        const toolName = KNOWN_TOOLS.has(state.name.toLowerCase()) ? state.name.toLowerCase() : state.name;
        state.name = toolName;
        // If argsBuffer still has unprocessed content, use it as raw args
        if (state.argsBuffer && !state.argsJson) {
          state.argsJson = state.argsBuffer;
        }
        if (!state.argsJson) {
          state.argsJson = '{}';
        }
        yield { type: 'tool_start', id: state.id, name: toolName };
        yield { type: 'tool_delta', id: state.id, argumentsChunk: state.argsJson };
        yield { type: 'tool_end', id: state.id };
      } else {
        // No name found — emit as text
        yield { type: 'text', content: `<tool_call>${state.tagBuffer}</tool_call>` };
      }
      state.inToolCall = false;
      state.tagBuffer = '';
      state.nameBuffer = '';
      state.argsBuffer = '';
      state.parsingTag = 'none';
      i = closeIdx + '</tool_call>'.length;
    }
  }
}

function processToolCallContent(content: string, state: ToolCallState): void {
  // Simple state machine to parse <name> and <arguments> within <tool_call>
  let pos = 0;
  const str = state.tagBuffer + content;
  state.tagBuffer = '';

  while (pos < str.length) {
    if (state.parsingTag === 'none') {
      // Look for opening tags
      const nameIdx = str.indexOf('<name>', pos);
      const argsIdx = str.indexOf('<arguments>', pos);
      const endIdx = str.indexOf('</arguments>', pos);

      if (nameIdx !== -1 && (argsIdx === -1 || nameIdx < argsIdx) && (endIdx === -1 || nameIdx < endIdx)) {
        // Found <name>
        state.parsingTag = 'name';
        pos = nameIdx + '<name>'.length;
      } else if (argsIdx !== -1 && (endIdx === -1 || argsIdx < endIdx)) {
        // Found <arguments>
        state.parsingTag = 'arguments';
        pos = argsIdx + '<arguments>'.length;
      } else if (endIdx !== -1) {
        // Found </arguments> without matching open — skip
        pos = endIdx + '</arguments>'.length;
      } else {
        // No more tags — buffer remaining
        state.tagBuffer = str.slice(pos);
        break;
      }
    } else if (state.parsingTag === 'name') {
      const closeIdx = str.indexOf('</name>', pos);
      if (closeIdx === -1) {
        state.nameBuffer += str.slice(pos);
        break;
      }
      state.nameBuffer += str.slice(pos, closeIdx);
      state.name = state.nameBuffer.trim();
      state.parsingTag = 'none';
      pos = closeIdx + '</name>'.length;
    } else if (state.parsingTag === 'arguments') {
      const closeIdx = str.indexOf('</arguments>', pos);
      if (closeIdx === -1) {
        state.argsBuffer += str.slice(pos);
        break;
      }
      state.argsBuffer += str.slice(pos, closeIdx);
      state.argsJson = state.argsBuffer.trim();
      state.parsingTag = 'none';
      pos = closeIdx + '</arguments>'.length;
    } else {
      break;
    }
  }
}

export function createOllamaProvider(
  baseUrl?: string,
  modelId?: string
): ModelProvider {
  const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const model = modelId || 'llama3.2:1b';

  return {
    name: 'ollama',
    model,
    supportsFunctionCalling: false,
    async *stream(
      messages: Message[],
      _tools: any[],
      options?: StreamOptions
    ): AsyncGenerator<StreamEvent> {
      // Include system messages as role:'system' in the array (Ollama supports this natively)
      const ollamaMessages = messages
        .filter(m => m.role !== 'tool')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const body: Record<string, unknown> = {
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          num_ctx: 32768,
          ...(options?.temperature !== undefined && { temperature: options.temperature }),
        },
      };

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
      const parserState = createState();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n').filter(l => l.trim())) {
            let data: any;
            try { data = JSON.parse(line); } catch { continue; }
            if (data.message?.content) {
              // Parse <tool_call> XML from the streamed text
              for (const event of parseXmlToolCalls(data.message.content, parserState)) {
                yield event;
              }
            }
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
