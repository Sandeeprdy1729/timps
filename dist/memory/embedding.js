"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const models_1 = require("../models");
const env_1 = require("../config/env");
class EmbeddingService {
    model;
    dimension;
    constructor() {
        this.model = (0, models_1.createEmbeddingModel)();
        this.dimension = env_1.config.embeddings.dimension;
    }
    async getEmbedding(text) {
        const result = await this.model.getEmbedding(text);
        return result.embedding;
    }
    async getEmbeddings(texts) {
        const embeddings = [];
        const batchSize = 100;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(async (text) => {
                const result = await this.model.getEmbedding(text);
                return result.embedding;
            }));
            embeddings.push(...results);
        }
        return embeddings;
    }
    async computeSimilarity(a, b) {
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
    async findMostSimilar(target, candidates) {
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
    getDimension() {
        return this.dimension;
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=embedding.js.map