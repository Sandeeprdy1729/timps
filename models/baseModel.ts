export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: ToolDefinition[];
  tool_choice?: string | { type: 'function'; function: { name: string } };
  stop?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface GenerateResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export abstract class BaseModel {
  protected modelName: string;
  protected temperature: number = 0.7;
  
  constructor(modelName: string, temperature?: number) {
    this.modelName = modelName;
    if (temperature !== undefined) {
      this.temperature = temperature;
    }
  }
  
  abstract generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
  abstract getEmbedding(text: string): Promise<EmbeddingResponse>;
  
  getModelName(): string {
    return this.modelName;
  }
  
  setTemperature(temperature: number): void {
    this.temperature = Math.max(0, Math.min(2, temperature));
  }
  
  protected parseToolCalls(responseContent: string): ToolCall[] | undefined {
    try {
      const parsed = JSON.parse(responseContent);
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return parsed.tool_calls;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}
