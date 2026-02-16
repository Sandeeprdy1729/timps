import { QdrantClient } from '@qdrant/js-client-rest';
export interface VectorPoint {
    id: string;
    vector: number[];
    payload: Record<string, any>;
}
export declare function getVectorClient(): QdrantClient;
export declare function initVectorStore(): Promise<void>;
export declare function upsertVectors(points: VectorPoint[]): Promise<void>;
export declare function searchVectors(vector: number[], limit?: number, filter?: Record<string, any>): Promise<VectorPoint[]>;
export declare function deleteVector(id: string): Promise<void>;
export declare function deleteUserVectors(userId: number): Promise<void>;
//# sourceMappingURL=vector.d.ts.map