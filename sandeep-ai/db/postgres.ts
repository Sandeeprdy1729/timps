import { Pool } from 'pg';
import { config } from '../config/env';

console.log("POSTGRES CONFIG:", process.env.DATABASE_URL ? '(using DATABASE_URL)' : config.postgres);

// Prefer DATABASE_URL (Neon/Supabase connection string) over individual vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

export const pool = new Pool(poolConfig);


pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uuid VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id),
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        tool_calls JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        content TEXT NOT NULL,
        memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('explicit', 'reflection')),
        importance INTEGER DEFAULT 1,
        retrieval_count INTEGER DEFAULT 0,
        tags TEXT[],
        source_conversation_id TEXT,
        source_message_id TEXT,
        last_retrieved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        priority INTEGER DEFAULT 1,
        target_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        preference_key VARCHAR(255) NOT NULL,
        preference_value TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, preference_key)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        tech_stack TEXT[],
        repository_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user_id_project_id ON memories(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
      CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        content TEXT NOT NULL,
        extracted_claim TEXT NOT NULL,
        topic_cluster VARCHAR(100) NOT NULL,
        claim_type VARCHAR(50) NOT NULL DEFAULT 'general',
        confidence_expressed FLOAT DEFAULT 0.5,
        source_context TEXT,
        embedding_id VARCHAR(255),
        contradiction_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contradiction_history (
        id SERIAL PRIMARY KEY,
        position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
        contradicted_by_position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
        contradicted_by_text TEXT NOT NULL,
        contradiction_score FLOAT NOT NULL,
        semantic_similarity FLOAT NOT NULL,
        explanation TEXT,
        memory_quote TEXT,
        acknowledged BOOLEAN DEFAULT FALSE,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_positions_user_project ON positions(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_positions_topic ON positions(topic_cluster);
      CREATE INDEX IF NOT EXISTS idx_contradiction_history_position ON contradiction_history(position_id);

      -- VeilForge: Four-layer persistence projector + ontology-driven append-only entity graph
      CREATE TABLE IF NOT EXISTS veilforge_events (
        event_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        layer VARCHAR(20) NOT NULL CHECK (layer IN ('knowledge', 'memory', 'wisdom', 'intelligence')),
        entity_keys TEXT[],
        content TEXT,
        raw_event JSONB,
        evidence TEXT,
        confidence FLOAT DEFAULT 0.5,
        supersedes_event_id VARCHAR(255) REFERENCES veilforge_events(event_id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS veilforge_layer_projections (
        event_id VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        layer VARCHAR(20) NOT NULL CHECK (layer IN ('knowledge', 'memory', 'wisdom', 'intelligence')),
        source_module VARCHAR(100),
        entity_keys TEXT[],
        decay_weight FLOAT DEFAULT 1.0,
        revision_gate_passed BOOLEAN DEFAULT TRUE,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (event_id, layer)
      );

      CREATE TABLE IF NOT EXISTS veilforge_entity_edges (
        source_event_id VARCHAR(255) NOT NULL REFERENCES veilforge_events(event_id),
        target_event_id VARCHAR(255) NOT NULL REFERENCES veilforge_events(event_id),
        edge_type VARCHAR(30) NOT NULL,
        entity_keys TEXT[],
        confidence FLOAT DEFAULT 0.5,
        provenance_module VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_event_id, target_event_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_veilforge_user_project ON veilforge_events(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_veilforge_layer ON veilforge_events(layer);
      CREATE INDEX IF NOT EXISTS idx_veilforge_entities ON veilforge_events USING GIN(entity_keys);
      CREATE INDEX IF NOT EXISTS idx_veilforge_created ON veilforge_events(created_at DESC);

      -- TemporaTree: Temporal memory tree with gated hierarchical consolidation
      CREATE TABLE IF NOT EXISTS tempora_nodes (
        node_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        level VARCHAR(20) NOT NULL CHECK (level IN ('raw', 'episodic', 'persona')),
        layer VARCHAR(20) NOT NULL CHECK (layer IN ('stim', 'mtem', 'ltsm')),
        node_data JSONB,
        parent_id VARCHAR(255) REFERENCES tempora_nodes(node_id),
        confidence FLOAT DEFAULT 0.5,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tempora_gating_log (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(255) REFERENCES tempora_nodes(node_id),
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        from_layer VARCHAR(20),
        to_layer VARCHAR(20),
        bmm_probability FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tempora_policy_log (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(255) REFERENCES tempora_nodes(node_id),
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        layer VARCHAR(20),
        confidence FLOAT,
        action VARCHAR(20) CHECK (action IN ('consolidate', 'update', 'prune', 'retain')),
        source_module VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tempora_edges (
        source_node_id VARCHAR(255) NOT NULL REFERENCES tempora_nodes(node_id),
        target_node_id VARCHAR(255) NOT NULL REFERENCES tempora_nodes(node_id),
        edge_type VARCHAR(30) NOT NULL,
        confidence FLOAT DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_node_id, target_node_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_tempora_user_project ON tempora_nodes(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_tempora_level ON tempora_nodes(level);
      CREATE INDEX IF NOT EXISTS idx_tempora_layer ON tempora_nodes(layer);
      CREATE INDEX IF NOT EXISTS idx_tempora_parent ON tempora_nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tempora_created ON tempora_nodes(created_at DESC);

      -- BindWeave: Structure-enriched binding weaver with cross-event induction
      CREATE TABLE IF NOT EXISTS bindweave_events (
        event_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        layer VARCHAR(20) NOT NULL CHECK (layer IN ('interaction', 'reasoning', 'consolidation')),
        frame_data JSONB,
        entity_bindings TEXT[],
        temporal_anchor VARCHAR(100),
        causal_links TEXT[],
        coherence_score FLOAT DEFAULT 0.5,
        content TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bindweave_edges (
        source_event_id VARCHAR(255) NOT NULL REFERENCES bindweave_events(event_id),
        target_event_id VARCHAR(255) NOT NULL REFERENCES bindweave_events(event_id),
        edge_type VARCHAR(30) NOT NULL,
        weight FLOAT DEFAULT 0.5,
        provenance_module VARCHAR(100),
        reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_event_id, target_event_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_bindweave_user_project ON bindweave_events(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_bindweave_layer ON bindweave_events(layer);
      CREATE INDEX IF NOT EXISTS idx_bindweave_entities ON bindweave_events USING GIN(entity_bindings);
      CREATE INDEX IF NOT EXISTS idx_bindweave_coherence ON bindweave_events(coherence_score DESC);
      CREATE INDEX IF NOT EXISTS idx_bindweave_created ON bindweave_events(created_at DESC);

      -- EchoForge: Hierarchical abstraction echo chamber (H-MEM style)
      CREATE TABLE IF NOT EXISTS echo_hierarchical_nodes (
        node_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        level VARCHAR(20) NOT NULL CHECK (level IN ('domain', 'category', 'trace', 'episode')),
        module VARCHAR(20) NOT NULL CHECK (module IN ('interaction', 'reasoning', 'consolidation')),
        content TEXT,
        confidence FLOAT DEFAULT 0.5,
        parent_id VARCHAR(255) REFERENCES echo_hierarchical_nodes(node_id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_echo_hier_user_project ON echo_hierarchical_nodes(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_echo_hier_level ON echo_hierarchical_nodes(level);
      CREATE INDEX IF NOT EXISTS idx_echo_hier_module ON echo_hierarchical_nodes(module);
      CREATE INDEX IF NOT EXISTS idx_echo_hier_confidence ON echo_hierarchical_nodes(confidence DESC);

      -- AetherWeft: Adaptive Knowledge Lifecycle Weaver with context trees + validity rivers
      CREATE TABLE IF NOT EXISTS aetherweft_entries (
        entry_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        level VARCHAR(20) NOT NULL CHECK (level IN ('domain', 'topic', 'subcategory', 'entry')),
        maturity VARCHAR(20) NOT NULL CHECK (maturity IN ('draft', 'validated', 'stable', 'core')),
        content TEXT,
        akl_data JSONB,
        parent_path TEXT[],
        validity_score FLOAT DEFAULT 0.5,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aetherweft_rivers (
        source_entry_id VARCHAR(255) NOT NULL REFERENCES aetherweft_entries(entry_id),
        target_entry_id VARCHAR(255) NOT NULL REFERENCES aetherweft_entries(entry_id),
        river_type VARCHAR(30) NOT NULL,
        shared_entities TEXT[],
        confidence FLOAT DEFAULT 0.5,
        decay_rate FLOAT DEFAULT 0.9,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_entry_id, target_entry_id, river_type)
      );

      CREATE INDEX IF NOT EXISTS idx_aether_user_project ON aetherweft_entries(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_aether_level ON aetherweft_entries(level);
      CREATE INDEX IF NOT EXISTS idx_aether_maturity ON aetherweft_entries(maturity);
      CREATE INDEX IF NOT EXISTS idx_aether_validity ON aetherweft_entries(validity_score DESC);

      -- ApexSynapse: Entity-centric temporal graph with validity windows
      CREATE TABLE IF NOT EXISTS apexsynapse_events (
        event_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        entities TEXT[],
        content TEXT,
        raw_event JSONB,
        confidence FLOAT DEFAULT 0.5,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS apexsynapse_edges (
        source_event_id VARCHAR(255) NOT NULL REFERENCES apexsynapse_events(event_id),
        target_event_id VARCHAR(255) NOT NULL REFERENCES apexsynapse_events(event_id),
        edge_type VARCHAR(30) NOT NULL,
        shared_entities TEXT[],
        weight FLOAT DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_event_id, target_event_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_apex_user_project ON apexsynapse_events(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_apex_entities ON apexsynapse_events USING GIN(entities);
      CREATE INDEX IF NOT EXISTS idx_apex_valid ON apexsynapse_events(valid_from, valid_to);
      CREATE INDEX IF NOT EXISTS idx_apex_confidence ON apexsynapse_events(confidence DESC);

      -- QuaternaryForge: Typed four-layer persistence router with evidence gating
      CREATE TABLE IF NOT EXISTS quaternaryforge_entries (
        entry_id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        project_id TEXT DEFAULT 'default',
        source_module VARCHAR(100),
        source_record_id TEXT,
        layer VARCHAR(20) NOT NULL CHECK (layer IN ('knowledge', 'memory', 'wisdom', 'intelligence')),
        content TEXT,
        raw_data JSONB,
        evidence_score FLOAT DEFAULT 0.5,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quaternaryforge_propagations (
        source_entry_id VARCHAR(255) NOT NULL REFERENCES quaternaryforge_entries(entry_id),
        target_entry_id VARCHAR(255) NOT NULL REFERENCES quaternaryforge_entries(entry_id),
        source_layer VARCHAR(20),
        target_layer VARCHAR(20),
        propagation_score FLOAT DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_entry_id, target_entry_id)
      );

      CREATE INDEX IF NOT EXISTS idx_quat_user_project ON quaternaryforge_entries(user_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_quat_layer ON quaternaryforge_entries(layer);
      CREATE INDEX IF NOT EXISTS idx_quat_evidence ON quaternaryforge_entries(evidence_score DESC);
      CREATE INDEX IF NOT EXISTS idx_quat_valid ON quaternaryforge_entries(valid_from, valid_to);
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount || 0;
}