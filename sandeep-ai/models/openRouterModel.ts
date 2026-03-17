import OpenAI from 'openai';
import {
  BaseModel,
  Message,
  GenerateOptions,
  GenerateResponse,
  EmbeddingResponse,
} from './baseModel';
import { config } from '../config/env';

// OpenRouter is OpenAI-compatible — same SDK, different baseURL + headers
export class OpenRouterModel extends BaseModel {
  private client: OpenAI;

  constructor(modelName?: string, temperature?: number) {
    super(
      modelName || config.models.openrouter?.defaultModel || 'anthropic/claude-3.5-haiku',
      temperature
    );
    this.client = new OpenAI({
      apiKey: config.models.openrouter?.apiKey || process.env.OPENROUTER_API_KEY || '',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/Sandeeprdy1729/timps',
        'X-Title': 'TIMPs',
      },
    });
  }

  async generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse> {
    const model = options?.model || this.modelName;
    const temperature = options?.temperature ?? this.temperature;

    const openaiMessages: any = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_calls: msg.tool_calls as any,
      tool_call_id: msg.tool_call_id,
    }));

    const requestOptions: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: openaiMessages,
      temperature,
      max_tokens: options?.max_tokens || 4096,
      top_p: options?.top_p,
      tools: options?.tools as any,
      tool_choice: options?.tool_choice as any,
      stop: options?.stop,
    };

    const response = await this.client.chat.completions.create(requestOptions);
    const choice = response.choices[0];

    let toolCalls: GenerateResponse['toolCalls'];
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return {
      content: choice.message.content || '',
      toolCalls,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  // OpenRouter doesn't provide embeddings — fall back to Ollama's nomic-embed-text
  async getEmbedding(_text: string): Promise<EmbeddingResponse> {
    throw new Error(
      'OpenRouter does not support embeddings. ' +
      'Keep EMBEDDINGS_PROVIDER=ollama and ensure Ollama is running for memory search.'
    );
  }
}