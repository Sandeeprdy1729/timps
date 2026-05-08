export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokens?: number;
  finish_reason?: string;
}

export interface ChatCompletionRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { content?: string; role?: string };
    finish_reason?: string;
  }>;
}

export interface ChatProvider {
  name: string;
  baseURL?: string;
  apiKey?: string;
  defaultModel?: string;
  supportsStreaming?: boolean;
  supportsFunctionCall?: boolean;
}

export interface ChatError {
  message: string;
  code?: string;
  status?: number;
  provider?: string;
}

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public provider?: string
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

export interface ChatOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  onChunk?: (chunk: ChatStreamChunk) => void;
  onError?: (error: ChatServiceError) => void;
}

export interface ChatHistory {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getMessages: (role?: ChatMessage['role']) => ChatMessage[];
}

export function createChatHistory(initialMessages: ChatMessage[] = []): ChatHistory {
  const messages: ChatMessage[] = [...initialMessages];

  return {
    messages,
    addMessage(message) {
      const newMessage: ChatMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      messages.push(newMessage);
    },
    clearHistory() {
      messages.length = 0;
    },
    getMessages(role) {
      if (role) {
        return messages.filter((m) => m.role === role);
      }
      return messages;
    },
  };
}

export function formatChatMessagesForProvider(
  messages: ChatMessage[],
  provider: ChatProvider
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateMessage(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
}

export function parseStreamChunk(line: string): ChatStreamChunk | null {
  if (!line.startsWith('data: ')) return null;
  if (line === 'data: [DONE]') return null;

  try {
    return JSON.parse(line.slice(5));
  } catch {
    return null;
  }
}

export function combineStreamChunks(chunks: ChatStreamChunk[]): string {
  return chunks
    .map((chunk) => chunk.choices[0]?.delta?.content || '')
    .join('');
}