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

  // ── WeaveForge: Hybrid graph/experience/passage memory ───────────────────
  await execute(`
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS utility_weight FLOAT DEFAULT 0.5;
    CREATE INDEX IF NOT EXISTS idx_memories_utility ON memories(user_id, project_id, utility_weight DESC);

    CREATE TABLE IF NOT EXISTS weave_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      memory_id INTEGER,
      version_id VARCHAR(255),
      content TEXT NOT NULL,
      abstraction TEXT,
      utility_weight FLOAT DEFAULT 0.5,
      reward_score FLOAT DEFAULT 0,
      layers TEXT[] DEFAULT ARRAY['semantic'],
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS weave_experiences (
      id SERIAL PRIMARY KEY,
      node_id VARCHAR(255) UNIQUE REFERENCES weave_nodes(node_id) ON DELETE CASCADE,
      abstraction TEXT NOT NULL,
      pattern_tags TEXT[],
      utility_weight FLOAT DEFAULT 0.5,
      source_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS weave_passages (
      id SERIAL PRIMARY KEY,
      node_id VARCHAR(255) UNIQUE REFERENCES weave_nodes(node_id) ON DELETE CASCADE,
      evidence TEXT NOT NULL,
      provenance_module VARCHAR(100),
      raw_signal JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS weave_edges (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES weave_nodes(node_id) ON DELETE CASCADE,
      target_node_id VARCHAR(255) REFERENCES weave_nodes(node_id) ON DELETE CASCADE,
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('semantic', 'temporal', 'causal', 'entity')),
      edge_type VARCHAR(80) NOT NULL,
      weight FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, layer, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_weave_nodes_user_project ON weave_nodes(user_id, project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_weave_nodes_layers ON weave_nodes USING GIN(layers);
    CREATE INDEX IF NOT EXISTS idx_weave_nodes_utility ON weave_nodes(utility_weight DESC, reward_score DESC);
    CREATE INDEX IF NOT EXISTS idx_weave_nodes_source ON weave_nodes(source_module);
    CREATE INDEX IF NOT EXISTS idx_weave_edges_layer ON weave_edges(layer, weight DESC);
    CREATE INDEX IF NOT EXISTS idx_weave_edges_source ON weave_edges(source_node_id, layer);
    CREATE INDEX IF NOT EXISTS idx_weave_edges_target ON weave_edges(target_node_id, layer);
  `);

  // ── SkillWeave: Evolvable memory skill policies ───────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS skill_policies (
      id SERIAL PRIMARY KEY,
      skill_id VARCHAR(160) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL CHECK (action IN ('extract', 'consolidate', 'prune', 'route')),
      utility FLOAT DEFAULT 0.5,
      version INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(skill_id, user_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS skill_weave_events (
      id SERIAL PRIMARY KEY,
      skill_id VARCHAR(160) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      selected_skills TEXT[],
      action VARCHAR(50) NOT NULL,
      content TEXT,
      processed JSONB DEFAULT '{}',
      outcome_score FLOAT DEFAULT 0.5,
      utility FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_skill_policies_user_project ON skill_policies(user_id, project_id, utility DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_policies_skill ON skill_policies(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_events_user_project ON skill_weave_events(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_events_skill ON skill_weave_events(skill_id, created_at DESC);
  `);

  // ── AtomChain: Atomic continuum and DAG-tag indexing ─────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS atomic_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      op_type VARCHAR(50) NOT NULL CHECK (op_type IN ('create', 'read', 'update', 'delete', 'consolidate')),
      tags TEXT[] DEFAULT ARRAY['general'],
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      utility FLOAT DEFAULT 0.5,
      pruned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS atomic_edges (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES atomic_nodes(node_id) ON DELETE CASCADE,
      target_node_id VARCHAR(255) REFERENCES atomic_nodes(node_id) ON DELETE CASCADE,
      edge_type VARCHAR(80) NOT NULL,
      tags TEXT[],
      weight FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, edge_type)
    );
    CREATE TABLE IF NOT EXISTS atomic_tag_index (
      id SERIAL PRIMARY KEY,
      tag VARCHAR(100) NOT NULL,
      node_id VARCHAR(255) REFERENCES atomic_nodes(node_id) ON DELETE CASCADE,
      weight FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tag, node_id)
    );
    CREATE TABLE IF NOT EXISTS atomic_policy_utilities (
      id SERIAL PRIMARY KEY,
      op_type VARCHAR(50) NOT NULL CHECK (op_type IN ('create', 'read', 'update', 'delete', 'consolidate')),
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      utility FLOAT DEFAULT 0.5,
      version INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(op_type, user_id, project_id)
    );
    CREATE INDEX IF NOT EXISTS idx_atomic_nodes_user_project ON atomic_nodes(user_id, project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_atomic_nodes_tags ON atomic_nodes USING GIN(tags);
    CREATE INDEX IF NOT EXISTS idx_atomic_nodes_utility ON atomic_nodes(utility DESC, pruned);
    CREATE INDEX IF NOT EXISTS idx_atomic_edges_source ON atomic_edges(source_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_atomic_edges_target ON atomic_edges(target_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_atomic_tag_index_tag ON atomic_tag_index(tag, weight DESC);
    CREATE INDEX IF NOT EXISTS idx_atomic_policy_user_project ON atomic_policy_utilities(user_id, project_id, utility DESC);
  `);

  // ── Chronos Veil: Layered persistence + append-only entity graph ─────────
  await execute(`
    CREATE TABLE IF NOT EXISTS chronos_events (
      event_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('knowledge', 'memory', 'wisdom', 'intelligence')),
      entity_keys TEXT[] DEFAULT ARRAY['general'],
      content TEXT NOT NULL,
      raw_event JSONB DEFAULT '{}',
      evidence TEXT,
      confidence FLOAT DEFAULT 0.5,
      supersedes_event_id VARCHAR(255),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chronos_layer_projections (
      id SERIAL PRIMARY KEY,
      event_id VARCHAR(255) REFERENCES chronos_events(event_id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('knowledge', 'memory', 'wisdom', 'intelligence')),
      source_module VARCHAR(100) NOT NULL,
      entity_keys TEXT[],
      decay_weight FLOAT DEFAULT 1.0,
      revision_gate_passed BOOLEAN DEFAULT TRUE,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, layer)
    );
    CREATE TABLE IF NOT EXISTS chronos_entity_edges (
      id SERIAL PRIMARY KEY,
      source_event_id VARCHAR(255) REFERENCES chronos_events(event_id) ON DELETE CASCADE,
      target_event_id VARCHAR(255) REFERENCES chronos_events(event_id) ON DELETE CASCADE,
      edge_type VARCHAR(80) NOT NULL,
      entity_keys TEXT[],
      confidence FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_event_id, target_event_id, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_chronos_events_user_project ON chronos_events(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chronos_events_layer ON chronos_events(layer, confidence DESC);
    CREATE INDEX IF NOT EXISTS idx_chronos_events_entities ON chronos_events USING GIN(entity_keys);
    CREATE INDEX IF NOT EXISTS idx_chronos_events_source ON chronos_events(source_module);
    CREATE INDEX IF NOT EXISTS idx_chronos_events_supersedes ON chronos_events(supersedes_event_id);
    CREATE INDEX IF NOT EXISTS idx_chronos_projections_user_layer ON chronos_layer_projections(user_id, project_id, layer, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chronos_edges_source ON chronos_entity_edges(source_event_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_chronos_edges_target ON chronos_entity_edges(target_event_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_chronos_edges_entities ON chronos_entity_edges USING GIN(entity_keys);
  `);

  // ── PolicyMetabol: Runtime RL write-manage-read governor ─────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS metabol_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      action_type VARCHAR(160) NOT NULL,
      phase VARCHAR(50) NOT NULL CHECK (phase IN ('write', 'manage', 'read', 'govern', 'consolidate')),
      content TEXT NOT NULL,
      tags TEXT[] DEFAULT ARRAY['general'],
      utility FLOAT DEFAULT 0.5,
      governed BOOLEAN DEFAULT FALSE,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS metabol_policy_utilities (
      id SERIAL PRIMARY KEY,
      action_type VARCHAR(160) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      phase VARCHAR(50) NOT NULL CHECK (phase IN ('write', 'manage', 'read', 'govern', 'consolidate')),
      utility FLOAT DEFAULT 0.5,
      version INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(action_type, user_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS metabol_episodes (
      id SERIAL PRIMARY KEY,
      node_id VARCHAR(255) REFERENCES metabol_nodes(node_id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      action_type VARCHAR(160) NOT NULL,
      phase VARCHAR(50) NOT NULL,
      outcome_score FLOAT DEFAULT 0.5,
      utility FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS metabol_links (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES metabol_nodes(node_id) ON DELETE CASCADE,
      target_node_id VARCHAR(255) REFERENCES metabol_nodes(node_id) ON DELETE CASCADE,
      link_type VARCHAR(100) NOT NULL,
      action_type VARCHAR(160),
      utility FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, link_type)
    );
    CREATE INDEX IF NOT EXISTS idx_metabol_nodes_user_project ON metabol_nodes(user_id, project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_metabol_nodes_tags ON metabol_nodes USING GIN(tags);
    CREATE INDEX IF NOT EXISTS idx_metabol_nodes_utility ON metabol_nodes(utility DESC, governed);
    CREATE INDEX IF NOT EXISTS idx_metabol_policy_user_project ON metabol_policy_utilities(user_id, project_id, utility DESC);
    CREATE INDEX IF NOT EXISTS idx_metabol_episodes_action ON metabol_episodes(action_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_metabol_links_source ON metabol_links(source_node_id, link_type);
  `);

  // ── LayerForge: Hierarchical semantic compression + intent gating ─────────
  await execute(`
    CREATE TABLE IF NOT EXISTS layer_units (
      unit_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('working', 'episodic', 'semantic')),
      density_score FLOAT DEFAULT 0.5,
      intent_tags TEXT[] DEFAULT ARRAY['general'],
      gist TEXT NOT NULL,
      compressed JSONB DEFAULT '{}',
      raw_content TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS layer_gates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      content TEXT,
      density_score FLOAT DEFAULT 0,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS layer_synthesis_edges (
      id SERIAL PRIMARY KEY,
      source_unit_id VARCHAR(255) REFERENCES layer_units(unit_id) ON DELETE CASCADE,
      target_unit_id VARCHAR(255) REFERENCES layer_units(unit_id) ON DELETE CASCADE,
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('working', 'episodic', 'semantic')),
      intent_tags TEXT[],
      weight FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_unit_id, target_unit_id, layer)
    );
    CREATE INDEX IF NOT EXISTS idx_layer_units_user_project ON layer_units(user_id, project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_layer_units_layer ON layer_units(layer, density_score DESC);
    CREATE INDEX IF NOT EXISTS idx_layer_units_tags ON layer_units USING GIN(intent_tags);
    CREATE INDEX IF NOT EXISTS idx_layer_units_source ON layer_units(source_module);
    CREATE INDEX IF NOT EXISTS idx_layer_gates_user_project ON layer_gates(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_layer_edges_source ON layer_synthesis_edges(source_unit_id, layer);
  `);

  // ── EchoForge: Multi-agent episodic reconstruction + intent hierarchies ───
  await execute(`
    CREATE TABLE IF NOT EXISTS echo_segments (
      segment_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      raw_context TEXT NOT NULL,
      local_evidence TEXT,
      intent_tags TEXT[] DEFAULT ARRAY['general'],
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS echo_hierarchies (
      hierarchy_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      segment_id VARCHAR(255) REFERENCES echo_segments(segment_id) ON DELETE CASCADE,
      intent_tags TEXT[] DEFAULT ARRAY['general'],
      gist TEXT NOT NULL,
      hierarchy JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS echo_edges (
      id SERIAL PRIMARY KEY,
      source_segment_id VARCHAR(255) REFERENCES echo_segments(segment_id) ON DELETE CASCADE,
      target_segment_id VARCHAR(255) REFERENCES echo_segments(segment_id) ON DELETE CASCADE,
      edge_type VARCHAR(100) NOT NULL,
      intent_tags TEXT[],
      confidence FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_segment_id, target_segment_id, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_echo_segments_user_project ON echo_segments(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_echo_segments_tags ON echo_segments USING GIN(intent_tags);
    CREATE INDEX IF NOT EXISTS idx_echo_hierarchies_user_project ON echo_hierarchies(user_id, project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_echo_hierarchies_tags ON echo_hierarchies USING GIN(intent_tags);
    CREATE INDEX IF NOT EXISTS idx_echo_edges_source ON echo_edges(source_segment_id, edge_type);
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

  // ── NexusForge: Episodic Sub-Agent Trinity Tables ────────────────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS nexus_episodic_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      gist TEXT NOT NULL,
      facts JSONB DEFAULT '[]',
      entity_keys TEXT[] DEFAULT ARRAY['general'],
      content TEXT NOT NULL,
      raw_signal JSONB DEFAULT '{}',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_nexus_nodes_user_project ON nexus_episodic_nodes(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_nexus_nodes_gist ON nexus_episodic_nodes USING GIN(gist);
    CREATE INDEX IF NOT EXISTS idx_nexus_nodes_entities ON nexus_episodic_nodes USING GIN(entity_keys);
    CREATE INDEX IF NOT EXISTS idx_nexus_nodes_source ON nexus_episodic_nodes(source_module);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS nexus_temporal_edges (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES nexus_episodic_nodes(node_id) ON DELETE CASCADE,
      target_node_id VARCHAR(255) REFERENCES nexus_episodic_nodes(node_id) ON DELETE CASCADE,
      edge_type VARCHAR(80) NOT NULL,
      confidence FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_nexus_temporal_source ON nexus_temporal_edges(source_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_nexus_temporal_target ON nexus_temporal_edges(target_node_id, edge_type);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS nexus_causal_edges (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES nexus_episodic_nodes(node_id) ON DELETE CASCADE,
      target_tool VARCHAR(100) NOT NULL,
      edge_type VARCHAR(80) NOT NULL,
      confidence FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_tool, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_nexus_causal_source ON nexus_causal_edges(source_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_nexus_causal_tool ON nexus_causal_edges(target_tool);
  `);

  console.log('[TIMPs] NexusForge sub-agent trinity tables initialized');

  // ── SynapseMetabolon: Spreading Activation Metabolic Graph ─────────────────
  await execute(`
    CREATE TABLE IF NOT EXISTS metabolic_nodes (
      node_id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id TEXT DEFAULT 'default',
      source_module VARCHAR(100) NOT NULL,
      source_record_id VARCHAR(255),
      layer VARCHAR(50) NOT NULL CHECK (layer IN ('interaction', 'reasoning', 'audit')),
      entity_keys TEXT[] DEFAULT ARRAY['general'],
      content TEXT NOT NULL,
      raw_signal JSONB DEFAULT '{}',
      activation FLOAT DEFAULT 0.5,
      utility FLOAT DEFAULT 0.5,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_metabolic_nodes_user_project ON metabolic_nodes(user_id, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_metabolic_nodes_layer ON metabolic_nodes(layer, activation DESC);
    CREATE INDEX IF NOT EXISTS idx_metabolic_nodes_entities ON metabolic_nodes USING GIN(entity_keys);
    CREATE INDEX IF NOT EXISTS idx_metabolic_nodes_source ON metabolic_nodes(source_module);
    CREATE INDEX IF NOT EXISTS idx_metabolic_nodes_utility ON metabolic_nodes(utility DESC, activation DESC);
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS metabolic_edges (
      id SERIAL PRIMARY KEY,
      source_node_id VARCHAR(255) REFERENCES metabolic_nodes(node_id) ON DELETE CASCADE,
      target_node_id VARCHAR(255) REFERENCES metabolic_nodes(node_id) ON DELETE CASCADE,
      edge_type VARCHAR(80) NOT NULL,
      entity_keys TEXT[],
      weight FLOAT DEFAULT 0.5,
      confidence FLOAT DEFAULT 0.5,
      provenance_module VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_metabolic_edges_source ON metabolic_edges(source_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_metabolic_edges_target ON metabolic_edges(target_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS idx_metabolic_edges_entities ON metabolic_edges USING GIN(entity_keys);
    CREATE INDEX IF NOT EXISTS idx_metabolic_edges_weight ON metabolic_edges(weight DESC);
  `);

  console.log('[TIMPs] SynapseMetabolon spreading activation tables initialized');
}
