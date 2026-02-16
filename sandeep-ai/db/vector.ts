import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/env';

export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, any>;
}

let client: QdrantClient | null = null;

export function getVectorClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
    });
  }
  return client;
}

export async function initVectorStore(): Promise<void> {
  const qdrant = getVectorClient();
  
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      c => c.name === config.qdrant.collectionName
    );
    
    if (!exists) {
      await qdrant.createCollection(config.qdrant.collectionName, {
        vectors: {
          size: config.embeddings.dimension,
          distance: 'Cosine',
        },
      });
      console.log(`Vector collection '${config.qdrant.collectionName}' created`);
    }
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    throw error;
  }
}

export async function upsertVectors(points: VectorPoint[]): Promise<void> {
  const qdrant = getVectorClient();
  await qdrant.upsert(config.qdrant.collectionName, {
    wait: true,
    points,
  });
}

export async function searchVectors(
  vector: number[],
  limit: number = 5,
  filter?: Record<string, any>
): Promise<VectorPoint[]> {
  const qdrant = getVectorClient();
  const results = await qdrant.search(config.qdrant.collectionName, {
    vector,
    limit,
    filter,
    with_payload: true,
  });
  
  return results.map(r => ({
    id: r.id as string,
    vector: r.vector as number[],
    payload: r.payload as Record<string, any>,
  }));
}

export async function deleteVector(id: string): Promise<void> {
  const qdrant = getVectorClient();
  await qdrant.delete(config.qdrant.collectionName, {
    wait: true,
    points: [id],
  });
}

export async function deleteUserVectors(userId: number): Promise<void> {
  const qdrant = getVectorClient();
  await qdrant.delete(config.qdrant.collectionName, {
    wait: true,
    filter: {
      must: [
        {
          key: 'user_id',
          match: { value: userId },
        },
      ],
    },
  });
}
