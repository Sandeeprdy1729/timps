import { Message } from '../models/baseModel';
import { config } from '../config/env';

export interface ShortTermMemory {
  messages: Message[];
  tokenCount: number;
}

export class ShortTermMemoryStore {
  private messages: Message[] = [];
  private tokenCount: number = 0;
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  addMessage(message: Message): void {
    const messageTokens = this.estimateTokens(message.content);
    
    while (
      this.tokenCount + messageTokens > config.memory.shortTermTokenLimit ||
      this.messages.length >= config.memory.shortTermMaxMessages
    ) {
      const removed = this.messages.shift();
      if (removed) {
        this.tokenCount -= this.estimateTokens(removed.content);
      }
    }
    
    this.messages.push(message);
    this.tokenCount += messageTokens;
  }
  
  addMessages(messages: Message[]): void {
    for (const msg of messages) {
      this.addMessage(msg);
    }
  }
  
  getMessages(): Message[] {
    return [...this.messages];
  }
  
  getLastMessages(count: number): Message[] {
    return this.messages.slice(-count);
  }
  
  getSystemMessages(): Message[] {
    return this.messages.filter(m => m.role === 'system');
  }
  
  getUserMessages(): Message[] {
    return this.messages.filter(m => m.role === 'user');
  }
  
  getAssistantMessages(): Message[] {
    return this.messages.filter(m => m.role === 'assistant');
  }
  
  getConversations(): Array<{ user: string; assistant: string }> {
    const conversations: Array<{ user: string; assistant: string }> = [];
    let currentUser = '';
    
    for (const msg of this.messages) {
      if (msg.role === 'user') {
        currentUser = msg.content;
      } else if (msg.role === 'assistant' && currentUser) {
        conversations.push({ user: currentUser, assistant: msg.content });
        currentUser = '';
      }
    }
    
    return conversations;
  }
  
  clear(): void {
    this.messages = [];
    this.tokenCount = 0;
  }
  
  getTokenCount(): number {
    return this.tokenCount;
  }
  
  toContextString(): string {
    const recentMessages = this.getLastMessages(config.memory.shortTermMaxMessages);
    return recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
  }
}
