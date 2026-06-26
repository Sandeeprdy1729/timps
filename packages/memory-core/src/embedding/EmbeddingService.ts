import type { EmbeddingConfig } from './types.js';

export class EmbeddingService {
  private config: EmbeddingConfig;
  private _connected = false;
  private _lastError: string | null = null;
  private _totalEmbedded = 0;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get totalEmbedded(): number {
    return this._totalEmbedded;
  }

  get model(): string {
    return this.config.model;
  }

  get provider(): string {
    return this.config.provider;
  }

  async testConnection(): Promise<boolean> {
    if (this.config.provider === 'none') return false;
    try {
      if (this.config.provider === 'ollama') {
        const resp = await fetch(`${this.config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        this._connected = resp.ok;
        return resp.ok;
      }
      if (this.config.provider === 'openai') {
        if (!this.config.apiKey) { this._connected = false; return false; }
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        this._connected = resp.ok;
        return resp.ok;
      }
      return false;
    } catch {
      this._connected = false;
      return false;
    }
  }

  async computeEmbedding(text: string): Promise<number[]> {
    const results = await this.computeEmbeddings([text]);
    return results[0] ?? new Array(this.config.dimensions).fill(0);
  }

  async computeEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (this.config.provider === 'none') {
      return texts.map(() => new Array(this.config.dimensions).fill(0));
    }

    if (this.config.provider === 'ollama') {
      return this._ollamaEmbed(texts);
    }

    if (this.config.provider === 'openai') {
      return this._openaiEmbed(texts);
    }

    this._connected = false;
    this._lastError = `Unknown provider: ${this.config.provider}`;
    return texts.map(() => new Array(this.config.dimensions).fill(0));
  }

  private async _ollamaEmbed(texts: string[]): Promise<number[][]> {
    try {
      const resp = await fetch(`${this.config.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, input: texts }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        this._connected = false;
        this._lastError = `Ollama embed ${resp.status}`;
        return texts.map(() => new Array(this.config.dimensions).fill(0));
      }
      const json = await resp.json() as any;
      this._connected = true;
      this._lastError = null;
      this._totalEmbedded += texts.length;
      const embeddings: number[][] = json.embeddings ?? [];
      return embeddings.map(v => {
        const arr = v as number[];
        if (arr.length === this.config.dimensions) return arr;
        if (arr.length < this.config.dimensions) return [...arr, ...new Array(this.config.dimensions - arr.length).fill(0)];
        return arr.slice(0, this.config.dimensions);
      });
    } catch (err) {
      this._connected = false;
      this._lastError = (err as Error).message;
      return texts.map(() => new Array(this.config.dimensions).fill(0));
    }
  }

  private async _openaiEmbed(texts: string[]): Promise<number[][]> {
    try {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          dimensions: this.config.dimensions,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        this._connected = false;
        this._lastError = `OpenAI embed ${resp.status}`;
        return texts.map(() => new Array(this.config.dimensions).fill(0));
      }
      const json = await resp.json() as any;
      this._connected = true;
      this._lastError = null;
      this._totalEmbedded += texts.length;
      const byIndex = new Map<number, number[]>();
      for (const d of json.data ?? []) {
        byIndex.set(d.index, d.embedding as number[]);
      }
      return texts.map((_, i) => {
        const vec = byIndex.get(i);
        if (!vec) return new Array(this.config.dimensions).fill(0);
        if (vec.length === this.config.dimensions) return vec;
        if (vec.length < this.config.dimensions) return [...vec, ...new Array(this.config.dimensions - vec.length).fill(0)];
        return vec.slice(0, this.config.dimensions);
      });
    } catch (err) {
      this._connected = false;
      this._lastError = (err as Error).message;
      return texts.map(() => new Array(this.config.dimensions).fill(0));
    }
  }
}
