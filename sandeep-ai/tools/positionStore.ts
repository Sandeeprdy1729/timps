import { query, execute } from '../db/postgres';
import { EmbeddingService } from '../memory/embedding';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/env';

export interface Position {
  id?: number;
  user_id: number;
  project_id: string;
  content: string;
  extracted_claim: string;
  topic_cluster: string;
  claim_type: 'normative' | 'empirical' | 'predictive' | 'general';
  confidence_expressed: number;
  source_context: string;
  embedding_id?: string;
  contradiction_count: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ContradictionRecord {
  id?: number;
  position_id: number;
  contradicted_by_position_id?: number;
  contradicted_by_text: string;
  contradiction_score: number;
  semantic_similarity: number;
  explanation: string;
  memory_quote?: string;
  acknowledged: boolean;
  resolved: boolean;
  created_at?: Date;
}

export interface ContradictionResult {
  verdict: 'CONTRADICTION' | 'PARTIAL' | 'CLEAN';
  contradiction_score: number;
  semantic_similarity: number;
  matched_position?: Position;
  explanation: string;
  memory_quote?: string;
  extracted_claims: string[];
  positions_checked: number;
}

const POSITIONS_COLLECTION = 'timps_positions';

export class PositionStore {
  private embeddingService: EmbeddingService;
  private qdrantClient: QdrantClient | null = null;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  private getQdrantClient(): QdrantClient | null {
    if (!config.qdrant.url) return null;
    if (!this.qdrantClient) {
      this.qdrantClient = new QdrantClient({
        url: config.qdrant.url,
        apiKey: config.qdrant.apiKey,
      });
    }
    return this.qdrantClient;
  }

  async initPositionsCollection(): Promise<void> {
    const client = this.getQdrantClient();
    if (!client) return;
    try {
      const collections = await client.getCollections();
      const exists = collections.collections.some(c => c.name === POSITIONS_COLLECTION);
      if (!exists) {
        await client.createCollection(POSITIONS_COLLECTION, {
          vectors: {
            size: config.embeddings.dimension,
            distance: 'Cosine',
          },
        });
        console.log(`[ArgumentDNA] Qdrant collection '${POSITIONS_COLLECTION}' created`);
      }
    } catch (err) {
      console.error('[ArgumentDNA] Failed to init positions collection:', err);
    }
  }

  async storePosition(
    pos: Omit<Position, 'id' | 'created_at' | 'updated_at' | 'contradiction_count'>
  ): Promise<Position> {
    const result = await query<Position>(
      `INSERT INTO positions
         (user_id, project_id, content, extracted_claim, topic_cluster,
          claim_type, confidence_expressed, source_context, contradiction_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)
       RETURNING *`,
      [
        pos.user_id,
        pos.project_id,
        pos.content,
        pos.extracted_claim,
        pos.topic_cluster,
        pos.claim_type,
        pos.confidence_expressed,
        pos.source_context,
      ]
    );
    const stored = result[0];
    if (!stored) throw new Error('[ArgumentDNA] Failed to store position');

    const client = this.getQdrantClient();
    if (client) {
      try {
        const embedding = await this.embeddingService.getEmbedding(pos.extracted_claim);
        await client.upsert(POSITIONS_COLLECTION, {
          wait: true,
          points: [
            {
              id: stored.id!,
              vector: embedding,
              payload: {
                user_id: pos.user_id,
                project_id: pos.project_id,
                position_id: stored.id!,
                topic_cluster: pos.topic_cluster,
                claim_type: pos.claim_type,
              },
            },
          ],
        });
        await execute(`UPDATE positions SET embedding_id = $1 WHERE id = $2`, [
          stored.id!.toString(),
          stored.id!,
        ]);
      } catch (err) {
        console.error('[ArgumentDNA] Vector upsert failed:', err);
      }
    }
    return stored;
  }

  async searchSimilarPositions(
    userId: number,
    projectId: string,
    claimText: string,
    topK: number = 5
  ): Promise<Position[]> {
    const client = this.getQdrantClient();
    if (!client) {
      return query<Position>(
        `SELECT * FROM positions WHERE user_id = $1 AND project_id = $2
         ORDER BY created_at DESC LIMIT $3`,
        [userId, projectId, topK]
      );
    }
    try {
      const embedding = await this.embeddingService.getEmbedding(claimText);
      const results = await client.search(POSITIONS_COLLECTION, {
        vector: embedding,
        limit: topK,
        filter: {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'project_id', match: { value: projectId } },
          ],
        },
        with_payload: true,
      });
      if (results.length === 0) return [];
      const ids = results.map(r => (r.payload as any).position_id as number);
      const positions = await query<Position>(
        `SELECT * FROM positions WHERE id = ANY($1) ORDER BY created_at DESC`,
        [ids]
      );
      return positions;
    } catch (err) {
      console.error('[ArgumentDNA] Similarity search failed:', err);
      return query<Position>(
        `SELECT * FROM positions WHERE user_id = $1 AND project_id = $2
         ORDER BY created_at DESC LIMIT $3`,
        [userId, projectId, topK]
      );
    }
  }

  async getUserPositions(userId: number, projectId: string): Promise<Position[]> {
    return query<Position>(
      `SELECT * FROM positions WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC`,
      [userId, projectId]
    );
  }

  async deletePosition(id: number, userId: number): Promise<boolean> {
    const client = this.getQdrantClient();
    if (client) {
      try {
        await client.delete(POSITIONS_COLLECTION, {
          wait: true,
          points: [id],
        });
      } catch (err) {
        console.error('[ArgumentDNA] Vector delete failed:', err);
      }
    }
    const count = await execute(
      `DELETE FROM positions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return count > 0;
  }

  async storeContradictionRecord(rec: Omit<ContradictionRecord, 'id' | 'created_at'>): Promise<void> {
    await execute(
      `INSERT INTO contradiction_history
         (position_id, contradicted_by_position_id, contradicted_by_text,
          contradiction_score, semantic_similarity, explanation,
          memory_quote, acknowledged, resolved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        rec.position_id,
        rec.contradicted_by_position_id || null,
        rec.contradicted_by_text,
        rec.contradiction_score,
        rec.semantic_similarity,
        rec.explanation,
        rec.memory_quote || null,
        rec.acknowledged,
        rec.resolved,
      ]
    );
    await execute(
      `UPDATE positions SET contradiction_count = contradiction_count + 1,
       updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [rec.position_id]
    );
  }

  async getContradictionHistory(positionId: number): Promise<ContradictionRecord[]> {
    return query<ContradictionRecord>(
      `SELECT * FROM contradiction_history WHERE position_id = $1 ORDER BY created_at DESC`,
      [positionId]
    );
  }

  async acknowledgeContradiction(contradictionId: number): Promise<void> {
    await execute(
      `UPDATE contradiction_history SET acknowledged = true WHERE id = $1`,
      [contradictionId]
    );
  }
}

export const positionStore = new PositionStore();