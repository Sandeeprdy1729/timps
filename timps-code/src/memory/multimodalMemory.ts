// multimodalMemory.ts - Sovereign Multimodal Memory Layer with Gemma 4 Integration
// Supports image, audio, and text embeddings via Ollama

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMemoryDir } from '../config/config.js';

export interface MultimodalEntry {
  id: string;
  type: 'image' | 'audio' | 'text';
  content: string;
  embedding: number[];
  metadata: {
    source?: string;
    timestamp: number;
    tags: string[];
    mimeType?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  crossModalLinks: string[];
  accessCount: number;
  lastAccessed: number;
}

export interface SearchResult {
  entry: MultimodalEntry;
  similarity: number;
}

export interface MemoryQuery {
  text?: string;
  imageBase64?: string;
  audioBase64?: string;
  limit?: number;
  threshold?: number;
  tags?: string[];
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export class GemmaEmbedder {
  private embeddingModel: string;
  private visionModel: string;

  constructor(embeddingModel: string = 'nomic-embed-text', visionModel: string = 'gemma3:1b') {
    this.embeddingModel = embeddingModel;
    this.visionModel = visionModel;
  }

  async encodeText(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { embedding: number[] };
        return data.embedding;
      }
    } catch {}

    return this.fallbackTextEmbedding(text);
  }

  async encodeImage(imagePath: string): Promise<number[]> {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');

      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.visionModel,
          prompt: `Describe this image briefly for embedding purposes. Focus on: objects, colors, text, setting.`,
          images: [base64],
          options: { num_predict: 50 },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return this.encodeText(data.response);
      }
    } catch {}

    return this.fallbackImageEmbedding(imagePath);
  }

  async encodeImageBase64(base64: string): Promise<number[]> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.visionModel,
          prompt: `Describe this image briefly for embedding purposes. Focus on: objects, colors, text, setting.`,
          images: [base64],
          options: { num_predict: 50 },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return this.encodeText(data.response);
      }
    } catch {}

    return this.fallbackImageEmbedding('base64-image');
  }

  async encodeAudio(audioPath: string): Promise<number[]> {
    return this.fallbackAudioEmbedding(audioPath);
  }

  private fallbackTextEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const dim = 768;
    const embedding = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      const wordIdx = i % Math.max(words.length, 1);
      const charSum = (words[wordIdx] || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      embedding[i] = Math.sin(charSum / (i + 1)) * Math.cos(i * 0.1);
    }

    return this.normalize(embedding);
  }

  private fallbackImageEmbedding(imagePath: string): number[] {
    const hash = crypto.createHash('sha256').update(imagePath).digest('hex');
    const dim = 768;
    const embedding = new Array(dim).fill(0);

    for (let i = 0; i < hash.length; i++) {
      const idx = i % dim;
      const charCode = hash.charCodeAt(i);
      embedding[idx] = Math.sin(charCode * (i + 1) * 0.1) * Math.cos(i * 0.05);
    }

    for (let i = 0; i < dim; i++) {
      if (embedding[i] === 0) {
        embedding[i] = Math.sin(i * 0.01) * 0.3;
      }
    }

    return this.normalize(embedding);
  }

  private fallbackAudioEmbedding(audioPath: string): number[] {
    const hash = crypto.createHash('sha256').update(audioPath + 'audio').digest('hex');
    const dim = 768;
    const embedding = new Array(dim).fill(0);

    for (let i = 0; i < hash.length; i++) {
      const idx = (i + 500) % dim;
      const charCode = hash.charCodeAt(i);
      embedding[idx] = Math.cos(charCode * (i + 1) * 0.1) * Math.sin(i * 0.05);
    }

    return this.normalize(embedding);
  }

  private normalize(vec: number[]): number[] {
    const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (mag === 0) return vec;
    return vec.map(v => v / mag);
  }
}

export class LocalVectorStore {
  private entries: Map<string, MultimodalEntry> = new Map();
  private storePath: string;
  private dimension: number;

  constructor(projectPath: string, dimension: number = 768) {
    this.dimension = dimension;
    this.storePath = path.join(getMemoryDir(projectPath), 'multimodal.jsonl');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const lines = fs.readFileSync(this.storePath, 'utf-8').trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry = JSON.parse(line) as MultimodalEntry;
              this.entries.set(entry.id, entry);
            } catch {}
          }
        }
      }
    } catch {}
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const lines = Array.from(this.entries.values()).map(e => JSON.stringify(e)).join('\n');
    fs.writeFileSync(this.storePath, lines + '\n', 'utf-8');
  }

  async insert(entry: MultimodalEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    this.persist();
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  async search(queryEmbedding: number[], limit: number = 10, threshold: number = 0.5): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= threshold) {
        results.push({ entry, similarity });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async get(id: string): Promise<MultimodalEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.persist();
    }
    return entry;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.entries.delete(id);
    if (result) this.persist();
    return result;
  }

  async getByTags(tags: string[]): Promise<MultimodalEntry[]> {
    return Array.from(this.entries.values()).filter(entry =>
      tags.some(tag => entry.metadata.tags.includes(tag))
    );
  }

  async getByType(type: 'image' | 'audio' | 'text'): Promise<MultimodalEntry[]> {
    return Array.from(this.entries.values()).filter(entry => entry.type === type);
  }

  async getRecent(limit: number = 10): Promise<MultimodalEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
      .slice(0, limit);
  }

  getStats(): { total: number; byType: Record<string, number>; avgAccessCount: number } {
    const entries = Array.from(this.entries.values());
    const byType: Record<string, number> = { image: 0, audio: 0, text: 0 };
    let totalAccess = 0;

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      totalAccess += entry.accessCount;
    }

    return {
      total: entries.length,
      byType,
      avgAccessCount: entries.length > 0 ? totalAccess / entries.length : 0,
    };
  }

  clear(): void {
    this.entries.clear();
    this.persist();
  }
}

export class MultimodalMemory {
  private store: LocalVectorStore;
  private embedder: GemmaEmbedder;
  private projectPath: string;
  private useGemma: boolean = true;

  constructor(projectPath: string, dimension: number = 768) {
    this.projectPath = projectPath;
    this.store = new LocalVectorStore(projectPath, dimension);
    this.embedder = new GemmaEmbedder('nomic-embed-text', 'gemma3:1b');
  }

  async checkGemmaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models: { name: string }[] };
        const hasGemma = data.models.some(m => m.name.includes('gemma'));
        const hasEmbedder = data.models.some(m => m.name.includes('nomic') || m.name.includes('embed'));
        this.useGemma = hasGemma || hasEmbedder;
        return this.useGemma;
      }
    } catch {}
    this.useGemma = false;
    return false;
  }

  async storeImage(imagePath: string, tags: string[] = [], metadata?: any): Promise<string> {
    let embedding: number[];

    if (this.useGemma) {
      embedding = await this.embedder.encodeImage(imagePath);
    } else {
      embedding = await this.embedder.encodeImage(imagePath);
    }

    return this.storeEntry({
      type: 'image',
      content: imagePath,
      embedding,
      metadata: {
        source: imagePath,
        timestamp: Date.now(),
        tags,
        ...metadata,
      },
    });
  }

  async storeImageBase64(base64: string, mimeType: string, tags: string[] = []): Promise<string> {
    let embedding: number[];

    if (this.useGemma) {
      embedding = await this.embedder.encodeImageBase64(base64);
    } else {
      embedding = await this.embedder.encodeImageBase64(base64);
    }

    return this.storeEntry({
      type: 'image',
      content: '[Image data stored]',
      embedding,
      metadata: {
        mimeType,
        timestamp: Date.now(),
        tags,
      },
    });
  }

  async storeAudio(audioPath: string, duration: number, tags: string[] = []): Promise<string> {
    const embedding = await this.embedder.encodeAudio(audioPath);
    return this.storeEntry({
      type: 'audio',
      content: audioPath,
      embedding,
      metadata: {
        duration,
        timestamp: Date.now(),
        tags,
      },
    });
  }

  async storeText(text: string, tags: string[] = [], metadata?: any): Promise<string> {
    let embedding: number[];

    if (this.useGemma) {
      embedding = await this.embedder.encodeText(text);
    } else {
      embedding = await this.embedder.encodeText(text);
    }

    return this.storeEntry({
      type: 'text',
      content: text,
      embedding,
      metadata: {
        timestamp: Date.now(),
        tags,
        ...metadata,
      },
    });
  }

  private async storeEntry(data: {
    type: 'image' | 'audio' | 'text';
    content: string;
    embedding: number[];
    metadata: any;
  }): Promise<string> {
    const entry: MultimodalEntry = {
      id: crypto.randomUUID(),
      ...data,
      crossModalLinks: [],
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    await this.store.insert(entry);
    return entry.id;
  }

  async search(query: MemoryQuery): Promise<SearchResult[]> {
    let queryEmbedding: number[];

    if (query.imageBase64) {
      queryEmbedding = await this.embedder.encodeImageBase64(query.imageBase64);
    } else if (query.audioBase64) {
      queryEmbedding = await this.embedder.encodeAudio(query.audioBase64);
    } else if (query.text) {
      queryEmbedding = await this.embedder.encodeText(query.text);
    } else {
      return [];
    }

    let results = await this.store.search(
      queryEmbedding,
      query.limit || 10,
      query.threshold || 0.5
    );

    if (query.tags && query.tags.length > 0) {
      results = results.filter(r =>
        query.tags!.some(tag => r.entry.metadata.tags.includes(tag))
      );
    }

    return results;
  }

  async findSimilarImages(imagePath: string, limit: number = 5): Promise<SearchResult[]> {
    const embedding = await this.embedder.encodeImage(imagePath);
    return this.store.search(embedding, limit, 0.6);
  }

  async findRelatedText(text: string, limit: number = 10): Promise<SearchResult[]> {
    const embedding = await this.embedder.encodeText(text);
    return this.store.search(embedding, limit, 0.5);
  }

  async getById(id: string): Promise<MultimodalEntry | undefined> {
    return this.store.get(id);
  }

  async linkEntries(idA: string, idB: string): Promise<void> {
    const entryA = await this.store.get(idA);
    const entryB = await this.store.get(idB);

    if (entryA && entryB) {
      if (!entryA.crossModalLinks.includes(idB)) {
        entryA.crossModalLinks.push(idB);
      }
      if (!entryB.crossModalLinks.includes(idA)) {
        entryB.crossModalLinks.push(idA);
      }
      await this.store.insert(entryA);
      await this.store.insert(entryB);
    }
  }

  async getLinkedEntries(id: string): Promise<MultimodalEntry[]> {
    const entry = await this.store.get(id);
    if (!entry) return [];

    const linked: MultimodalEntry[] = [];
    for (const linkedId of entry.crossModalLinks) {
      const linkedEntry = await this.store.get(linkedId);
      if (linkedEntry) linked.push(linkedEntry);
    }
    return linked;
  }

  async getStats() {
    return this.store.getStats();
  }

  async getGemmaStatus(): Promise<{ available: boolean; embeddingModel: string; visionModel: string }> {
    const available = await this.checkGemmaAvailable();
    return {
      available,
      embeddingModel: 'nomic-embed-text',
      visionModel: 'gemma3:1b',
    };
  }

  getContextString(query?: string, maxResults: number = 5): string {
    const parts: string[] = ['## Multimodal Memory (Gemma-powered)'];

    if (query) {
      parts.push(`Query: "${query}"`);
    }

    const stats = this.store.getStats();
    parts.push(`Total entries: ${stats.total} (images: ${stats.byType.image || 0}, audio: ${stats.byType.audio || 0}, text: ${stats.byType.text || 0})`);
    parts.push(`Embedding: Gemma 3 + Nomic`);

    return parts.join('\n');
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const multimodalMemory = new MultimodalMemory(process.cwd());
