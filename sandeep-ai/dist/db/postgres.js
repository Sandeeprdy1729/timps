"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initDatabase = initDatabase;
exports.query = query;
exports.queryOne = queryOne;
exports.execute = execute;
const pg_1 = require("pg");
const env_1 = require("../config/env");
console.log("POSTGRES CONFIG:", env_1.config.postgres);
exports.pool = new pg_1.Pool({
    host: env_1.config.postgres.host,
    port: env_1.config.postgres.port,
    database: env_1.config.postgres.database,
    user: env_1.config.postgres.user,
    password: env_1.config.postgres.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
async function initDatabase() {
    const client = await exports.pool.connect();
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
    `);
        console.log('Database initialized successfully');
    }
    finally {
        client.release();
    }
}
async function query(text, params) {
    const result = await exports.pool.query(text, params);
    return result.rows;
}
async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}
async function execute(text, params) {
    const result = await exports.pool.query(text, params);
    return result.rowCount || 0;
}
//# sourceMappingURL=postgres.js.map