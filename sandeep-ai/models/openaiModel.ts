import OpenAI from 'openai';
import {
  BaseModel,
  Message,
  GenerateOptions,
  GenerateResponse,
  EmbeddingResponse,
} from './baseModel';
import { config } from '../config/env';

export class OpenAIModel extends BaseModel {
  private client: OpenAI;
  
  constructor(
    modelName?: string,
    apiKey?: string,
    temperature?: number
  ) {
    super(
      modelName || config.models.openai?.defaultModel || 'gpt-4-turbo-preview',
      temperature
    );
    this.client = new OpenAI({
      apiKey: apiKey || config.models.openai?.apiKey || process.env.OPENAI_API_KEY,
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
      max_tokens: options?.max_tokens,
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
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
  
  async getEmbedding(text: string): Promise<EmbeddingResponse> {
    const embeddingModel = config.embeddings.model;
    const response = await this.client.embeddings.create({
      model: embeddingModel,
      input: text,
    });
    
    return {
      embedding: response.data[0].embedding,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }
}
