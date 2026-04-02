// db/gateWeaveDb.ts — Database tables for GateWeave: Adaptive Memory Admission Weaver
import { execute } from './postgres';

export async function initGateWeaveTables(): Promise<void> {
  // ── Belief Versions: Versioned belief chains for user positions ──────────
  await execute(`
    CREATE TABLE IF NOT EXISTS belief_versions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      statement_hash VARCHAR(64) NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      confidence FLOAT NOT NULL DEFAULT 0.5,
      parent_version_id INTEGER REFERENCES belief_versions(id) ON DELETE SET NULL,
      linked_position_id INTEGER,
      linked_contradiction_ids INTEGER[] DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'superseded', 'retracted')),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_belief_versions_user_project
      ON belief_versions(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_belief_versions_hash
      ON belief_versions(statement_hash);
    CREATE INDEX IF NOT EXISTS idx_belief_versions_status
      ON belief_versions(user_id, status);
  `);

  // ── GateWeave Decisions: Audit log of admission decisions ──────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS gateweave_decisions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      content_preview VARCHAR(500) NOT NULL,
      decision VARCHAR(20) NOT NULL
        CHECK (decision IN ('admit', 'summarize', 'discard')),
      score FLOAT NOT NULL,
      score_breakdown JSONB NOT NULL DEFAULT '{}',
      memory_id INTEGER,
      summary_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gateweave_decisions_user
      ON gateweave_decisions(user_id, created_at DESC);
  `);

  // ── GateWeave Summaries: Compressed summaries for gated-out memories ───
  await execute(`
    CREATE TABLE IF NOT EXISTS gateweave_summaries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      summary TEXT NOT NULL,
      source_count INTEGER NOT NULL DEFAULT 1,
      source_previews TEXT[] DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gateweave_summaries_user
      ON gateweave_summaries(user_id, project_id);
  `);

  console.log('[GateWeave] Admission & belief-versioning tables initialized');
}
