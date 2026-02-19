export declare class EmbeddingService {
    private model;
    private dimension;
    constructor();
    getEmbedding(text: string): Promise<number[]>;
    getEmbeddings(texts: string[]): Promise<number[][]>;
    computeSimilarity(a: number[], b: number[]): Promise<number>;
    findMostSimilar(target: number[], candidates: number[][]): Promise<{
        index: number;
        similarity: number;
    }>;
    getDimension(): number;
}
//# sourceMappingURL=embedding.d.ts.map