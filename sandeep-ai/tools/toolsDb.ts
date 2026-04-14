// tools/toolsDb.ts — runs additional CREATE TABLE migrations for all 18 tools
import { execute } from '../db/postgres';
import { initCurateTierTables } from '../db/curateTierDb';

export async function initToolsTables(): Promise<void> {
  // ── Tool 1: Temporal Mirror ──────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS behavioral_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      event_type VARCHAR(100) NOT NULL,
      context TEXT,
      outcome VARCHAR(50),
      emotional_valence FLOAT DEFAULT 0,
      tags TEXT[],
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_behavioral_events_user ON behavioral_events(user_id, recorded_at DESC);
  `);

  // ── Tool 2: Regret Oracle ────────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS decisions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      description TEXT NOT NULL,
      decision_type VARCHAR(50),
      regret_score FLOAT DEFAULT 0,
      outcome_noted TEXT,
      regret_tags TEXT[],
      decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      outcome_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id, decided_at DESC);
  `);

  // ── Tool 3: Living Manifesto ─────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS value_observations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      inferred_value VARCHAR(100) NOT NULL,
      evidence TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS manifestos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      content TEXT NOT NULL,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_value_obs_user ON value_observations(user_id);
  `);

  // ── Tool 4: Burnout Seismograph ──────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS burnout_signals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      signal_type VARCHAR(100) NOT NULL,
      value FLOAT NOT NULL,
      baseline_value FLOAT,
      deviation_pct FLOAT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS burnout_baseline (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      baseline_data JSONB NOT NULL,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_burnout_signals_user ON burnout_signals(user_id, recorded_at DESC);
  `);

  // ── Tool 6: Dead Reckoning Engine ────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS life_simulations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      scenario TEXT NOT NULL,
      simulation_result JSONB,
      confidence FLOAT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_simulations_user ON life_simulations(user_id);
  `);

  // ── Tool 7: Skill Shadow ─────────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS workflow_patterns (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      pattern_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      success_rate FLOAT DEFAULT 0.5,
      context_tags TEXT[],
      observed_count INTEGER DEFAULT 1,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_patterns_user ON workflow_patterns(user_id);
  `);

  // ── Tool 8: Curriculum Architect ────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS learning_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      topic VARCHAR(200) NOT NULL,
      outcome VARCHAR(50),
      retention_days INTEGER,
      analogy_used TEXT,
      session_duration_mins INTEGER,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS curricula (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      topic VARCHAR(200) NOT NULL,
      plan JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_learning_events_user ON learning_events(user_id, topic);
  `);

  // ── Tool 9: Technical Debt Seismograph ──────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS code_incidents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      pattern TEXT NOT NULL,
      incident_type VARCHAR(100),
      time_to_debug_hrs FLOAT,
      code_context TEXT,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_code_incidents_user_project ON code_incidents(user_id, project_id);
  `);

  // ── Tool 10: Bug Pattern Prophet ────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS bug_patterns (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      bug_type VARCHAR(100) NOT NULL,
      trigger_context TEXT,
      frequency INTEGER DEFAULT 1,
      last_occurrence TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      environmental_tags TEXT[]
    );
    CREATE INDEX IF NOT EXISTS idx_bug_patterns_user ON bug_patterns(user_id);
  `);

  // ── Tool 11: API Archaeologist ───────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS api_knowledge (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      api_name VARCHAR(200) NOT NULL,
      endpoint TEXT,
      discovered_quirk TEXT NOT NULL,
      severity VARCHAR(50) DEFAULT 'info',
      verified BOOLEAN DEFAULT FALSE,
      discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_knowledge_user ON api_knowledge(user_id, api_name);
  `);

  // ── Tool 12: Codebase Anthropologist ────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS codebase_culture (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      insight_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_codebase_culture_project ON codebase_culture(user_id, project_id);
  `);

  // ── Tool 13: Institutional Memory Necromancer ────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS institutional_knowledge (
      id SERIAL PRIMARY KEY,
      org_id TEXT NOT NULL,
      person_name VARCHAR(200),
      decision TEXT NOT NULL,
      rationale TEXT,
      alternatives_rejected TEXT,
      source_type VARCHAR(50),
      preserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_inst_knowledge_org ON institutional_knowledge(org_id);
  `);

  // ── Tool 14: Chemistry Engine ────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS behavioral_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      person_identifier VARCHAR(200) NOT NULL,
      profile_data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, person_identifier)
    );
    CREATE TABLE IF NOT EXISTS compatibility_scores (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      person_a VARCHAR(200) NOT NULL,
      person_b VARCHAR(200) NOT NULL,
      score FLOAT NOT NULL,
      analysis JSONB,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_user ON behavioral_profiles(user_id);
  `);

  // ── Tool 15: Meeting Ghost ───────────────────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS meeting_commitments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      meeting_title TEXT,
      person_name VARCHAR(200) NOT NULL,
      commitment TEXT NOT NULL,
      due_date TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      meeting_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_commitments_user ON meeting_commitments(user_id, status);
  `);

  // ── Tool 16: Collective Wisdom Harvester ─────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS wisdom_contributions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      profile_hash VARCHAR(64) NOT NULL,
      decision_context TEXT NOT NULL,
      outcome VARCHAR(50),
      profile_tags TEXT[],
      contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wisdom_profile ON wisdom_contributions(profile_hash);
  `);

  // ── Tool 17: Relationship Intelligence Engine ────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS relationship_signals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      contact_name VARCHAR(200) NOT NULL,
      signal_type VARCHAR(100) NOT NULL,
      value FLOAT DEFAULT 1,
      context TEXT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS relationship_health (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      contact_name VARCHAR(200) NOT NULL,
      health_score FLOAT DEFAULT 1.0,
      drift_alert BOOLEAN DEFAULT FALSE,
      last_interaction TIMESTAMP,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, contact_name)
    );
    CREATE INDEX IF NOT EXISTS idx_rel_signals_user ON relationship_signals(user_id, contact_name, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rel_health_user ON relationship_health(user_id);
  `);


  // ── Tool 18: CurateTier (Agent-Native Hierarchical Curation) ──────────────
  await initCurateTierTables();

  console.log('[TIMPs] All 18 tool tables initialized');
  
  // ── ProvenForge: Temporal Version Control ──────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS versioned_memories (
      version_id VARCHAR(255) PRIMARY KEY,
      parent_version_id VARCHAR(255),
      tier VARCHAR(50) NOT NULL,
      provenance JSONB,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS provenance_edges (
      id SERIAL PRIMARY KEY,
      source_version_id VARCHAR(255) REFERENCES versioned_memories(version_id) ON DELETE CASCADE,
      target_version_id VARCHAR(255) REFERENCES versioned_memories(version_id) ON DELETE CASCADE,
      edge_type VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    DO $$
    DECLARE
      tname text;
    BEGIN
      FOR tname IN (SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')
      LOOP
        IF tname NOT IN ('versioned_memories', 'provenance_edges') THEN
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS version_id VARCHAR(255)', tname);
        END IF;
      END LOOP;
    END $$;
  `);

  // ── ForgeLink: Typed Relationship Edges ──────────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS typed_edges (
      id SERIAL PRIMARY KEY,
      source_memory_id INTEGER NOT NULL,
      target_memory_id INTEGER NOT NULL,
      edge_type VARCHAR(50) NOT NULL CHECK (edge_type IN ('causal', 'dependency', 'temporal', 'influence', 'contradiction', 'evolution')),
      weight FLOAT DEFAULT 1.0,
      confidence FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100) NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_typed_edges_source ON typed_edges(source_memory_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_typed_edges_target ON typed_edges(target_memory_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_typed_edges_type ON typed_edges(edge_type, confidence DESC);
    CREATE INDEX IF NOT EXISTS idx_typed_edges_provenance ON typed_edges(provenance_module);
  `);

  // ── GovernTier: Policy-Driven Governance Tables ─────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS governance_policies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('decay', 'conflict', 'privacy', 'admission', 'evolution')),
      config JSONB NOT NULL DEFAULT '{}',
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_governance_policies_type ON governance_policies(policy_type);
    CREATE INDEX IF NOT EXISTS idx_governance_policies_name ON governance_policies(name);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS governance_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}',
      provenance VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_governance_events_user ON governance_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_governance_events_module ON governance_events(source_module);
    CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(event_type);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS governed_memories (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES governance_events(id),
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      tier VARCHAR(20) NOT NULL CHECK (tier IN ('raw', 'episodic', 'semantic', 'wisdom')),
      governance_score FLOAT NOT NULL,
      policy_version INTEGER NOT NULL,
      resolved_conflicts JSONB,
      decay_applied BOOLEAN DEFAULT FALSE,
      privacy_masked BOOLEAN DEFAULT FALSE,
      admission_status VARCHAR(20) NOT NULL CHECK (admission_status IN ('admitted', 'decayed', 'flagged', 'rejected')),
      linked_insights JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_governed_memories_user ON governed_memories(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_governed_memories_tier ON governed_memories(tier, governance_score DESC);
    CREATE INDEX IF NOT EXISTS idx_governed_memories_status ON governed_memories(admission_status);
    CREATE INDEX IF NOT EXISTS idx_governed_memories_policy ON governed_memories(policy_version DESC);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS tech_debt_incidents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      incident_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      linked_memory_id INTEGER REFERENCES governed_memories(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tech_debt_user ON tech_debt_incidents(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tech_debt_severity ON tech_debt_incidents(severity);
  `);

  console.log('[TIMPs] All 17 tool tables + ForgeLink edges + GovernTier initialized');

}