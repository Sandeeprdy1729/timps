import { PluginManifest, PluginCapabilities } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  permission: unknown[];
  root: string;
  parent: string | null;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: { name: string; arguments: string };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }>;
  function_call?: string | { name: string };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  input: string | string[];
  model: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse {
  object: string;
  model: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  model?: 'dall-e-3' | 'dall-e-2';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid' | 'animated';
  response_format?: 'url' | 'b64_json';
  user?: string;
}

export interface ImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface ImageEditRequest {
  image: string;
  prompt: string;
  mask?: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024';
  response_format?: 'url' | 'b64_json';
  user?: string;
}

export interface ImageVariationRequest {
  image: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024';
  response_format?: 'url' | 'b64_json';
  user?: string;
}

export interface AudioTranscriptionRequest {
  file: File | Blob;
  model: 'whisper-1' | 'gpt-4o-transcribe';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  timestamp_granularities?: Array<'word' | 'segment'>;
}

export interface AudioTranslationRequest {
  file: File | Blob;
  model: 'whisper-1';
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface FineTuneRequest {
  training_file: string;
  validation_file?: string;
  model: string;
  epochs?: number;
  batch_size?: number;
  learning_rate_multiplier?: number;
  prompt_loss_weight?: number;
  compute_classification_n_classes?: number;
  classification_n_classes?: number;
  classification_positive_class_name?: string;
  suffix?: string;
}

export interface FineTuneJob {
  id: string;
  object: string;
  created_at: number;
  updated_at: number;
  model: string;
  fine_tuned_model: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  trained_tokens?: number;
  hyperparams: {
    n_epochs: number | 'auto';
    batch_size: number | 'auto';
    learning_rate_multiplier: number | 'auto';
    prompt_loss_weight: number | 'auto';
  };
  training_file: string;
  validation_file: string | null;
  result_files: string[];
  events: Array<{
    object: string;
    created_at: number;
    level: string;
    message: string;
  }>;
}

export interface FineTuneEvent {
  object: string;
  created_at: number;
  level: string;
  message: string;
}

export interface Assistant {
  id: string;
  object: string;
  created_at: number;
  name: string | null;
  description: string | null;
  model: string;
  instructions: string | null;
  tools: Array<{ type: string; function?: { name: string; description: string; parameters: unknown } }>;
  file_ids: string[];
  metadata: Record<string, unknown>;
}

export interface Thread {
  id: string;
  object: string;
  created_at: number;
  metadata: Record<string, unknown>;
}

export interface Run {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  assistant_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  required_action: string | null;
  last_error: string | null;
  expires_at: number | null;
}

export interface OpenAIFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: 'fine-tune' | 'fine-tune-results' | 'assistants' | 'assistants_output';
}

export interface UsageRecord {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  timestamp: number;
}

export interface ModelPricing {
  [model: string]: {
    prompt: number;
    completion: number;
    currency: string;
  };
}

const DEFAULT_PRICING: ModelPricing = {
  'gpt-4': { prompt: 0.03, completion: 0.06, currency: 'USD' },
  'gpt-4-32k': { prompt: 0.06, completion: 0.12, currency: 'USD' },
  'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002, currency: 'USD' },
  'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004, currency: 'USD' },
  'text-embedding-ada-002': { prompt: 0.0001, completion: 0, currency: 'USD' },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0, currency: 'USD' },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0, currency: 'USD' },
  'dall-e-3': { prompt: 0.04, completion: 0, currency: 'USD' },
  'dall-e-2': { prompt: 0.016, completion: 0, currency: 'USD' },
  'whisper-1': { prompt: 0.006, completion: 0, currency: 'USD' },
};

const MANIFEST: PluginManifest = {
  id: 'openai',
  name: 'OpenAI',
  version: '1.0.0',
  description: 'OpenAI integration for GPT models, embeddings, fine-tuning, images, and audio',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['openai', 'gpt', 'chatgpt', 'embedding', 'dalle', 'whisper', 'fine-tuning'],
};

const SCOPES = [
  'listModels', 'getModel', 'deleteModel',
  'createChatCompletion', 'createChatCompletionStream', 'createCompletion', 'createCompletionStream',
  'createEmbedding', 'createEmbeddingBatch',
  'generateImage', 'editImage', 'createImageVariation',
  'createTranscription', 'createTranslation',
  'createFineTuneJob', 'listFineTuneJobs', 'getFineTuneJob', 'cancelFineTuneJob', 'listFineTuneEvents',
  'createAssistant', 'listAssistants', 'getAssistant', 'updateAssistant', 'deleteAssistant',
  'createThread', 'listThreads', 'getThread', 'deleteThread',
  'createRun', 'listRuns', 'getRun', 'cancelRun', 'submitToolOutputs',
  'uploadFile', 'listFiles', 'getFile', 'deleteFile', 'downloadFile',
  'getUsage', 'getUsageByModel', 'getUsageByDay',
];

export default class OpenAIIntegration extends IntegrationBase {
  private apiBase = 'https://api.openai.com/v1';
  private usageCache: UsageRecord[] = [];
  private pricing: ModelPricing;

  constructor(customPricing?: ModelPricing) {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.pricing = customPricing || DEFAULT_PRICING;
    this.capabilities = {
      actions: SCOPES,
      triggers: ['rate_limit_warning', 'fine_tune_completed', 'usage_threshold'],
      dataModels: ['model', 'chat_completion', 'embedding', 'image', 'audio', 'fine_tune', 'assistant', 'thread', 'file', 'usage'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey) throw new Error('API key is required');
    this.setApiKey(config.apiKey);
    try {
      const models = await this.apiCall<{ data: OpenAIModel[] }>(`${this.apiBase}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      return Array.isArray(models.data) && models.data.length > 0;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.apiCall(`${this.apiBase}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return true;
    } catch { return false; }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const headers = this.getHeaders();

    switch (action) {
      case 'listModels':
        return this.apiCall<{ data: OpenAIModel[] }>(`${this.apiBase}/models`, { headers });

      case 'getModel':
        return this.apiCall<OpenAIModel>(`${this.apiBase}/models/${params.model}`, { headers });

      case 'createChatCompletion':
        return this.createChatCompletion(params as unknown as ChatCompletionRequest);

      case 'createChatCompletionStream':
        return this.createChatCompletionStream(params as unknown as ChatCompletionRequest);

      case 'createCompletion':
        return this.apiCall<unknown>(`${this.apiBase}/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });

      case 'createCompletionStream':
        return this.createCompletionStream(params);

      case 'createEmbedding':
        return this.createEmbedding(params as unknown as EmbeddingRequest);

      case 'createEmbeddingBatch':
        return this.createEmbeddingBatch(params);

      case 'generateImage':
        return this.generateImage(params as unknown as ImageGenerationRequest);

      case 'editImage':
        return this.editImage(params as unknown as ImageEditRequest);

      case 'createImageVariation':
        return this.createImageVariation(params as unknown as ImageVariationRequest);

      case 'createTranscription':
        return this.createTranscription(params.file as File, params as Partial<AudioTranscriptionRequest>);

      case 'createTranslation':
        return this.createTranslation(params.file as File, params as Partial<AudioTranslationRequest>);

      case 'createFineTuneJob':
        return this.createFineTuneJob(params as unknown as FineTuneRequest);

      case 'listFineTuneJobs':
        return this.apiCall<{ data: FineTuneJob[] }>(`${this.apiBase}/fine-tuning/jobs`, { headers });

      case 'getFineTuneJob':
        return this.apiCall<FineTuneJob>(`${this.apiBase}/fine-tuning/jobs/${params.job_id}`, { headers });

      case 'cancelFineTuneJob':
        return this.apiCall<FineTuneJob>(`${this.apiBase}/fine-tuning/jobs/${params.job_id}/cancel`, {
          method: 'POST',
          headers,
        });

      case 'listFineTuneEvents':
        return this.apiCall<{ data: FineTuneEvent[] }>(`${this.apiBase}/fine-tuning/jobs/${params.job_id}/events`, { headers });

      case 'createAssistant':
        return this.apiCall<Assistant>(`${this.apiBase}/assistants`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.assistant),
        });

      case 'listAssistants':
        return this.apiCall<{ data: Assistant[] }>(`${this.apiBase}/assistants`, { headers });

      case 'getAssistant':
        return this.apiCall<Assistant>(`${this.apiBase}/assistants/${params.assistant_id}`, { headers });

      case 'updateAssistant':
        return this.apiCall<Assistant>(`${this.apiBase}/assistants/${params.assistant_id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteAssistant':
        return this.apiCall<{ id: string; deleted: boolean }>(`${this.apiBase}/assistants/${params.assistant_id}`, {
          method: 'DELETE',
          headers,
        });

      case 'createThread':
        return this.apiCall<Thread>(`${this.apiBase}/threads`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.thread || {}),
        });

      case 'listThreads':
        return this.apiCall<{ data: Thread[] }>(`${this.apiBase}/threads`, { headers });

      case 'getThread':
        return this.apiCall<Thread>(`${this.apiBase}/threads/${params.thread_id}`, { headers });

      case 'deleteThread':
        return this.apiCall<{ id: string; deleted: boolean }>(`${this.apiBase}/threads/${params.thread_id}`, {
          method: 'DELETE',
          headers,
        });

      case 'createRun':
        return this.apiCall<Run>(`${this.apiBase}/threads/${params.thread_id}/runs`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.run),
        });

      case 'listRuns':
        return this.apiCall<{ data: Run[] }>(`${this.apiBase}/threads/${params.thread_id}/runs`, { headers });

      case 'getRun':
        return this.apiCall<Run>(`${this.apiBase}/threads/${params.thread_id}/runs/${params.run_id}`, { headers });

      case 'cancelRun':
        return this.apiCall<Run>(`${this.apiBase}/threads/${params.thread_id}/runs/${params.run_id}/cancel`, {
          method: 'POST',
          headers,
        });

      case 'submitToolOutputs':
        return this.apiCall<Run>(`${this.apiBase}/threads/${params.thread_id}/runs/${params.run_id}/submit_tool_outputs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tool_outputs: params.tool_outputs }),
        });

      case 'uploadFile':
        return this.uploadFile(params.file as File, params.purpose as string);

      case 'listFiles':
        return this.apiCall<{ data: OpenAIFile[] }>(`${this.apiBase}/files`, { headers });

      case 'getFile':
        return this.apiCall<OpenAIFile>(`${this.apiBase}/files/${params.file_id}`, { headers });

      case 'deleteFile':
        return this.apiCall<{ id: string; deleted: boolean }>(`${this.apiBase}/files/${params.file_id}`, {
          method: 'DELETE',
          headers,
        });

      case 'downloadFile':
        return this.downloadFile(params.file_id as string);

      case 'getUsage':
        return this.getUsage(params.start_date as string, params.end_date as string);

      case 'getUsageByModel':
        return this.getUsageByModel(params.start_date as string, params.end_date as string, params.model as string);

      case 'getUsageByDay':
        return this.getUsageByDay(params.start_date as string, params.end_date as string);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'models':
        return this.executeAction('listModels', {});
      case 'assistants':
        return this.executeAction('listAssistants', {});
      case 'files':
        return this.executeAction('listFiles', {});
      case 'fine_tune_jobs':
        return this.executeAction('listFineTuneJobs', {});
      case 'threads':
        return this.executeAction('listThreads', {});
      case 'usage':
        return this.getUsage(options?.start_date as string, options?.end_date as string);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  private async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async createChatCompletionStream(request: ChatCompletionRequest): Promise<ReadableStream> {
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'text/event-stream' },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.body as unknown as ReadableStream;
  }

  private async createCompletionStream(params: Record<string, unknown>): Promise<ReadableStream> {
    const response = await fetch(`${this.apiBase}/completions`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'text/event-stream' },
      body: JSON.stringify({ ...params, stream: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.body as unknown as ReadableStream;
  }

  private async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const response = await fetch(`${this.apiBase}/embeddings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async createEmbeddingBatch(params: Record<string, unknown>): Promise<EmbeddingResponse[]> {
    const inputs = params.inputs as string[];
    const results: EmbeddingResponse[] = [];

    for (const input of inputs) {
      const result = await this.createEmbedding({
        input,
        model: params.model as string,
        encoding_format: params.encoding_format as 'float' | 'base64',
        dimensions: params.dimensions as number,
      });
      results.push(result);
    }

    return results;
  }

  private async generateImage(request: ImageGenerationRequest): Promise<ImageResponse> {
    const response = await fetch(`${this.apiBase}/images/generations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async editImage(request: ImageEditRequest): Promise<ImageResponse> {
    const formData = new FormData();
    formData.append('image', request.image as unknown as Blob);
    formData.append('prompt', request.prompt);

    if (request.mask) {
      formData.append('mask', request.mask);
    }
    if (request.n) formData.append('n', String(request.n));
    if (request.size) formData.append('size', request.size);
    if (request.response_format) formData.append('response_format', request.response_format);
    if (request.user) formData.append('user', request.user);

    const response = await fetch(`${this.apiBase}/images/edits`, {
      method: 'POST',
      headers: { Authorization: this.getHeaders().Authorization },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async createImageVariation(request: ImageVariationRequest): Promise<ImageResponse> {
    const formData = new FormData();
    formData.append('image', request.image as unknown as Blob);

    if (request.n) formData.append('n', String(request.n));
    if (request.size) formData.append('size', request.size);
    if (request.response_format) formData.append('response_format', request.response_format);
    if (request.user) formData.append('user', request.user);

    const response = await fetch(`${this.apiBase}/images/variations`, {
      method: 'POST',
      headers: { Authorization: this.getHeaders().Authorization },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async createTranscription(file: File, params: Partial<AudioTranscriptionRequest>): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', params.model || 'whisper-1');

    if (params.language) formData.append('language', params.language);
    if (params.prompt) formData.append('prompt', params.prompt);
    if (params.response_format) formData.append('response_format', params.response_format);
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature));
    if (params.timestamp_granularities) {
      formData.append('timestamp_granularities', JSON.stringify(params.timestamp_granularities));
    }

    const response = await fetch(`${this.apiBase}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: this.getHeaders().Authorization },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    if (params.response_format === 'json' || !params.response_format) {
      return response.json();
    }
    return response.text();
  }

  private async createTranslation(file: File, params: Partial<AudioTranslationRequest>): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', params.model || 'whisper-1');

    if (params.prompt) formData.append('prompt', params.prompt);
    if (params.response_format) formData.append('response_format', params.response_format);
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature));

    const response = await fetch(`${this.apiBase}/audio/translations`, {
      method: 'POST',
      headers: { Authorization: this.getHeaders().Authorization },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    if (params.response_format === 'json' || !params.response_format) {
      return response.json();
    }
    return response.text();
  }

  private async createFineTuneJob(request: FineTuneRequest): Promise<FineTuneJob> {
    const response = await fetch(`${this.apiBase}/fine-tuning/jobs`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async uploadFile(file: File, purpose: string): Promise<OpenAIFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const response = await fetch(`${this.apiBase}/files`, {
      method: 'POST',
      headers: { Authorization: this.getHeaders().Authorization },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async downloadFile(fileId: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/files/${fileId}/content`, {
      headers: { Authorization: this.getHeaders().Authorization },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response.text();
  }

  private async getUsage(startDate: string, endDate: string): Promise<{ data: UsageRecord[]; total: number }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: UsageRecord[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      try {
        const response = await fetch(
          `https://api.openai.com/v1/usage?date=${dateStr}`,
          { headers: { Authorization: `Bearer ${this.apiKey}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const usage = data.data?.[0] || {};
          const tokens = usage.prompt_tokens || 0 + (usage.completion_tokens || 0);
          const cost = this.calculateCost(tokens, 'gpt-3.5-turbo');

          days.push({
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: tokens,
            cost,
            timestamp: d.getTime(),
          });
        }
      } catch {
        days.push({
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
          timestamp: d.getTime(),
        });
      }
    }

    this.usageCache = days;
    const total = days.reduce((sum, d) => sum + d.cost, 0);

    return { data: days, total };
  }

  private async getUsageByModel(startDate: string, endDate: string, model: string): Promise<UsageRecord> {
    const { data } = await this.getUsage(startDate, endDate);
    const totalTokens = data.reduce((sum, d) => sum + d.total_tokens, 0);
    const cost = this.calculateCost(totalTokens, model);

    return {
      prompt_tokens: data.reduce((sum, d) => sum + d.prompt_tokens, 0),
      completion_tokens: data.reduce((sum, d) => sum + d.completion_tokens, 0),
      total_tokens: totalTokens,
      cost,
      timestamp: Date.now(),
    };
  }

  private async getUsageByDay(startDate: string, endDate: string): Promise<Record<string, UsageRecord>> {
    const { data } = await this.getUsage(startDate, endDate);
    const byDay: Record<string, UsageRecord> = {};

    for (const record of data) {
      const date = new Date(record.timestamp).toISOString().slice(0, 10);
      if (!byDay[date]) {
        byDay[date] = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0, timestamp: record.timestamp };
      }
      byDay[date].prompt_tokens += record.prompt_tokens;
      byDay[date].completion_tokens += record.completion_tokens;
      byDay[date].total_tokens += record.total_tokens;
      byDay[date].cost += record.cost;
    }

    return byDay;
  }

  private calculateCost(tokens: number, model: string): number {
    const pricing = this.pricing[model];
    if (!pricing) return 0;
    return (tokens / 1000) * pricing.prompt;
  }

  async cleanup(): Promise<void> {
    this.apiKey = null;
    this.usageCache = [];
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createOpenAIIntegration(pricing?: ModelPricing): OpenAIIntegration {
  return new OpenAIIntegration(pricing);
}

export interface OpenAISettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  organizationId?: string;
  monitoringEnabled: boolean;
  usageAlerts: boolean;
  usageThreshold: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface UsageAlert {
  id: string;
  threshold: number;
  currentUsage: number;
  model: string;
  triggered: boolean;
  timestamp: number;
}

export function createOpenAISettingsUI(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'integration-settings openai-settings';
  container.innerHTML = `
    <style>
      .openai-settings { padding: 16px; font-family: system-ui; }
      .openai-settings h3 { margin: 0 0 16px; font-size: 18px; display: flex; align-items: center; gap: 8px; }
      .openai-settings .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
      .openai-settings .status-badge.connected { background: #dcfce7; color: #166534; }
      .openai-settings .form-group { margin-bottom: 16px; }
      .openai-settings label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      .openai-settings select, .openai-settings input[type="text"], .openai-settings input[type="number"] {
        width: 100%; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;
      }
      .openai-settings .checkbox-group { display: flex; align-items: center; gap: 8px; }
      .openai-settings .checkbox-group input { width: auto; }
      .openai-settings button {
        width: 100%; padding: 10px 16px; background: #10a37f; color: white; border: none;
        border-radius: 6px; font-weight: 500; cursor: pointer; transition: background 0.2s;
      }
      .openai-settings button:hover { background: #0d8c6d; }
      .openai-settings .model-info { font-size: 12px; color: #6b7280; margin-top: 4px; }
      .openai-settings .slider-group { display: flex; align-items: center; gap: 12px; }
      .openai-settings input[type="range"] { flex: 1; }
      .openai-settings .slider-value { min-width: 40px; text-align: right; font-size: 14px; color: #6b7280; }
    </style>
    <h3>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#10a37f">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.141 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.377-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.142-4.78-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.142-4.779 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
      OpenAI
      <span class="status-badge connected" id="connection-status">Connected</span>
    </h3>
    <div class="form-group">
      <label>Default Model</label>
      <select id="default-model">
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="gpt-3.5-turbo" selected>GPT-3.5 Turbo</option>
      </select>
      <div class="model-info">Select the default model for chat completions</div>
    </div>
    <div class="form-group">
      <label>Temperature</label>
      <div class="slider-group">
        <input type="range" id="temperature" min="0" max="2" step="0.1" value="0.7" />
        <span class="slider-value" id="temperature-value">0.7</span>
      </div>
    </div>
    <div class="form-group">
      <label>Max Tokens</label>
      <input type="number" id="max-tokens" value="4096" min="1" max="32000" />
    </div>
    <div class="form-group">
      <label>Organization ID (optional)</label>
      <input type="text" id="org-id" placeholder="org-xxxx" />
    </div>
    <div class="form-group checkbox-group">
      <input type="checkbox" id="monitoring-enabled" checked />
      <label for="monitoring-enabled">Enable usage monitoring</label>
    </div>
    <div class="form-group checkbox-group">
      <input type="checkbox" id="usage-alerts" checked />
      <label for="usage-alerts">Enable usage alerts</label>
    </div>
    <div class="form-group">
      <label>Alert Threshold (USD)</label>
      <input type="number" id="usage-threshold" value="100" min="1" />
    </div>
    <button id="test-connection">Test Connection</button>
  `;

  const temperatureSlider = container.querySelector('#temperature') as HTMLInputElement;
  const temperatureValue = container.querySelector('#temperature-value') as HTMLElement;
  temperatureSlider.addEventListener('input', () => {
    temperatureValue.textContent = temperatureSlider.value;
  });

  return container;
}

export function createChatSession(messages: ChatMessage[], model: string): ChatSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    messages,
    model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {},
  };
}

export function createUsageAlert(threshold: number, currentUsage: number, model: string): UsageAlert {
  return {
    id: `alert_${Date.now()}`,
    threshold,
    currentUsage,
    model,
    triggered: currentUsage >= threshold,
    timestamp: Date.now(),
  };
}

export async function setupOpenAIMonitoring(
  onUsageUpdate: (usage: UsageRecord) => void,
  onAlert: (alert: UsageAlert) => void,
  checkInterval: number = 60000
): Promise<() => void> {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkUsage = async () => {
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const usage = await fetchUsage(startDate, endDate);

      onUsageUpdate(usage);

      const threshold = parseFloat(localStorage.getItem('openai-alert-threshold') || '100');
      if (usage.cost >= threshold) {
        const alert = createUsageAlert(threshold, usage.cost, 'all');
        onAlert(alert);
      }
    } catch (error) {
      console.error('Usage check error:', error);
    }
  };

  intervalId = setInterval(checkUsage, checkInterval);
  checkUsage();

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}

async function fetchUsage(startDate: string, endDate: string): Promise<UsageRecord> {
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) throw new Error('API key not configured');

  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalTokens = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const response = await fetch(`https://api.openai.com/v1/usage?date=${dateStr}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        const data = await response.json();
        const dayData = data.data?.[0] || {};
        totalTokens += (dayData.prompt_tokens || 0) + (dayData.completion_tokens || 0);
      }
    } catch {
      // ignore
    }
  }

  const cost = (totalTokens / 1000) * 0.002;

  return {
    prompt_tokens: Math.floor(totalTokens * 0.6),
    completion_tokens: Math.floor(totalTokens * 0.4),
    total_tokens: totalTokens,
    cost,
    timestamp: Date.now(),
  };
}

export async function streamChatCompletion(
  request: ChatCompletionRequest,
  onChunk: (chunk: string) => void,
  onComplete: (full: string) => void
): Promise<void> {
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) throw new Error('API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  if (!reader) throw new Error('No response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          onChunk(content);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  onComplete(fullText);
}

export function calculatePromptCost(tokens: number, model: string): number {
  const pricing: Record<string, number> = {
    'gpt-4': 0.03,
    'gpt-4-32k': 0.06,
    'gpt-3.5-turbo': 0.0015,
    'gpt-3.5-turbo-16k': 0.003,
  };
  return (tokens / 1000) * (pricing[model] || 0.001);
}

export function calculateCompletionCost(tokens: number, model: string): number {
  const pricing: Record<string, number> = {
    'gpt-4': 0.06,
    'gpt-4-32k': 0.12,
    'gpt-3.5-turbo': 0.002,
    'gpt-3.5-turbo-16k': 0.004,
  };
  return (tokens / 1000) * (pricing[model] || 0.002);
}

export async function runE2ETests(): Promise<{ passed: boolean; results: Array<{ test: string; passed: boolean; error?: string }> }> {
  const results: Array<{ test: string; passed: boolean; error?: string }> = [];

  const runTest = async (testName: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ test: testName, passed: true });
    } catch (error) {
      results.push({ test: testName, passed: false, error: String(error) });
    }
  };

  await runTest('Authentication', async () => {
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) throw new Error('No API key');
    const integration = createOpenAIIntegration();
    await integration.authenticate({ type: 'apiKey', apiKey });
    if (!await integration.testConnection()) throw new Error('Connection failed');
  });

  await runTest('List Models', async () => {
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) throw new Error('No API key');
    const integration = createOpenAIIntegration();
    await integration.authenticate({ type: 'apiKey', apiKey });
    const result = await integration.executeAction('listModels', {}) as { data: OpenAIModel[] };
    if (!result.data?.length) throw new Error('No models returned');
  });

  await runTest('Chat Completion', async () => {
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) throw new Error('No API key');
    const integration = createOpenAIIntegration();
    await integration.authenticate({ type: 'apiKey', apiKey });
    const result = await integration.executeAction('createChatCompletion', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test" if you receive this.' }],
      max_tokens: 5,
    }) as ChatCompletionResponse;
    if (!result.choices?.[0]?.message?.content) throw new Error('No response');
  });

  await runTest('Embedding', async () => {
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) throw new Error('No API key');
    const integration = createOpenAIIntegration();
    await integration.authenticate({ type: 'apiKey', apiKey });
    const result = await integration.executeAction('createEmbedding', {
      input: 'test text',
      model: 'text-embedding-ada-002',
    }) as EmbeddingResponse;
    if (!result.data?.[0]?.embedding) throw new Error('No embedding returned');
  });

  return {
    passed: results.every(r => r.passed),
    results,
  };
}

export const openaiPlugin = {
  manifest: MANIFEST,
  create: () => createOpenAIIntegration(),
};