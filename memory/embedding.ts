import { createEmbeddingModel, BaseModel } from '../models';
import { config } from '../config/env';

export class EmbeddingService {
  private model: BaseModel;
  private dimension: number;
  
  constructor() {
    this.model = createEmbeddingModel();
    this.dimension = config.embeddings.dimension;
  }
  
  async getEmbedding(text: string): Promise<number[]> {
    const result = await this.model.getEmbedding(text);
    return result.embedding;
  }
  
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const batchSize = 100;
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (text) => {
          const result = await this.model.getEmbedding(text);
          return result.embedding;
        })
      );
      embeddings.push(...results);
    }
    
    return embeddings;
  }
  
  async computeSimilarity(a: number[], b: number[]): Promise<number> {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async findMostSimilar(
    target: number[],
    candidates: number[][]
  ): Promise<{ index: number; similarity: number }> {
    let maxSimilarity = -1;
    let bestIndex = 0;
    
    for (let i = 0; i < candidates.length; i++) {
      const similarity = await this.computeSimilarity(target, candidates[i]);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestIndex = i;
      }
    }
    
    return { index: bestIndex, similarity: maxSimilarity };
  }
  
  getDimension(): number {
    return this.dimension;
  }
}
