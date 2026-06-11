// db/curateTierDb.ts — CurateTier schema migrations
import { execute } from './postgres';

export async function initCurateTierTables(): Promise<void> {
  // ── CurateTier decisions log ─────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS curate_tier_decisions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      memory_id INTEGER,
      tier VARCHAR(20) NOT NULL DEFAULT 'raw' CHECK (tier IN ('raw', 'episodic', 'semantic')),
      curation_score FLOAT NOT NULL DEFAULT 0,
      relevance_score FLOAT DEFAULT 0,
      utility_score FLOAT DEFAULT 0,
      novelty_score FLOAT DEFAULT 0,
      recency_score FLOAT DEFAULT 0,
      gated BOOLEAN DEFAULT FALSE,
      source_type VARCHAR(50) DEFAULT 'reflection',
      propagated_to TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_curate_decisions_user ON curate_tier_decisions(user_id, tier);
    CREATE INDEX IF NOT EXISTS idx_curate_decisions_score ON curate_tier_decisions(curation_score DESC);
  `);

  // ── CurateTier summaries (periodic tier evolution snapshots) ──────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS curate_tier_summaries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      tier VARCHAR(20) NOT NULL CHECK (tier IN ('raw', 'episodic', 'semantic')),
      memory_count INTEGER DEFAULT 0,
      avg_score FLOAT DEFAULT 0,
      top_tags TEXT[],
      summary TEXT,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_curate_summaries_user ON curate_tier_summaries(user_id, tier);
  `);

  // ── Add tier + curation_score columns to memories (safe IF NOT EXISTS) ────
  await execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'tier'
      ) THEN
        ALTER TABLE memories ADD COLUMN tier VARCHAR(20) DEFAULT 'raw'
          CHECK (tier IN ('raw', 'episodic', 'semantic'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'curation_score'
      ) THEN
        ALTER TABLE memories ADD COLUMN curation_score FLOAT DEFAULT 0;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);
    CREATE INDEX IF NOT EXISTS idx_memories_curation_score ON memories(curation_score DESC);
  `);

  console.log('[CurateTier] Tables initialized (curate_tier_decisions, curate_tier_summaries, memories columns)');
}
