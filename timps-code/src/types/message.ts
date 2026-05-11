// ── TIMPS Code — Message Types
// Core message types for the agent loop

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface UserMessage extends Message {
  role: 'user';
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  type: 'text' | 'image' | 'audio' | 'file';
  content: string;
  name?: string;
  mimeType?: string;
}

export interface AssistantMessage extends Message {
  role: 'assistant';
  stopReason?: string;
  usage?: TokenUsage;
}

export interface ToolResultMessage extends Message {
  role: 'tool';
  toolName: string;
  toolUseId: string;
}

export interface ConversationSummary {
  id: string;
  timestamp: number;
  summary: string;
  messageCount: number;
  tokenCount: number;
}

export interface MessageSearchResult {
  messageId: string;
  role: string;
  content: string;
  timestamp: number;
  score: number;
}
