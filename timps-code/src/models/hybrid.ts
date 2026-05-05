import type { ModelProvider, ProviderName, StreamEvent, Message, ToolDefinition, StreamOptions } from '../config/types.js';

export class HybridProvider implements ModelProvider {
  name: ProviderName = 'hybrid';
  model = 'Intelligence Router';
  supportsFunctionCalling = true;

  constructor(public fastProvider: ModelProvider, public heavyProvider: ModelProvider) {
    this.model = `Hybrid (${fastProvider.name} + ${heavyProvider.name})`;
  }

  async *stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent> {
    const lastMsg = messages[messages.length - 1];
    let providerToUse = this.heavyProvider;

    if (lastMsg && lastMsg.role === 'user') {
      const content = lastMsg.content.toLowerCase();
      // Simple heuristic for free/local operations
      if (content.length < 100 && (
          content.startsWith('list') || 
          content.startsWith('show') || 
          content.startsWith('what') || 
          content.startsWith('pwd') || 
          content.startsWith('who')
      )) {
        providerToUse = this.fastProvider;
        yield { type: 'text', content: `\n> *(Router: Delegated simple task to **${this.fastProvider.name}**)*\n\n` };
      } else {
        yield { type: 'text', content: `\n> *(Router: Escalated complex task to **${this.heavyProvider.name}**)*\n\n` };
      }
    }

    yield* providerToUse.stream(messages, tools, options);
  }
}
