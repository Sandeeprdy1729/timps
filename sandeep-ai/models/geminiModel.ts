import {
  BaseModel,
  Message,
  GenerateOptions,
  GenerateResponse,
  EmbeddingResponse,
} from './baseModel';
import { config } from '../config/env';

export class GeminiModel extends BaseModel {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(
    modelName?: string,
    apiKey?: string,
    temperature?: number
  ) {
    super(
      modelName || config.models.gemini?.defaultModel || 'gemini-pro',
      temperature
    );
    this.apiKey = apiKey || config.models.gemini?.apiKey || process.env.GEMINI_API_KEY || '';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  async generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse> {
    const model = options?.model || this.modelName;
    const temperature = options?.temperature ?? this.temperature;
    
    const contents = this.convertMessagesToContents(messages);
    
    const requestBody: Record<string, any> = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: options?.max_tokens,
        topP: options?.top_p,
        stopSequences: options?.stop,
      },
    };
    
    if (options?.tools) {
      requestBody.tools = this.convertTools(options.tools);
    }
    
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }
    
    const data:any = await response.json();
    
    let content = '';
    let toolCalls: GenerateResponse['toolCalls'];
    
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls = [{
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          }];
        }
      }
    }
    
    return {
      content,
      toolCalls,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
  
  async getEmbedding(text: string): Promise<EmbeddingResponse> {
    const url = `${this.baseUrl}/models/embedding-001:embedContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          role: 'user',
          parts: [{ text }],
        },
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini Embedding API error: ${error}`);
    }
    
    const data:any = await response.json();
    
    return {
      embedding: data.embedding?.values || [],
      usage: {
        promptTokens: data.usageMetadata?.totalTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
  
  private convertMessagesToContents(messages: Message[]): any[] {
    const contents: any[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        contents.push({
          role: 'system',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const part: any = {};
        if (msg.content) {
          part.text = msg.content;
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            const args = JSON.parse(tc.function.arguments);
            part.functionCall = {
              name: tc.function.name,
              args,
            };
          }
        }
        if (Object.keys(part).length > 0) {
          contents.push({
            role: 'model',
            parts: [part],
          });
        }
      }
    }
    
    return contents;
  }
  
  private convertTools(tools: any[]): any[] {
    return tools.map(tool => ({
      functionDeclarations: [tool.function],
    }));
  }
}
