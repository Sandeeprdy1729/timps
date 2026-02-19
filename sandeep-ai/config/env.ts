export interface Config {
  port: number;
  nodeEnv: string;
  
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  
  qdrant: {
    url: string;
    apiKey?: string;
    collectionName: string;
  };
  
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  
  models: {
    defaultProvider: 'openai' | 'gemini' | 'ollama';
    openai?: {
      apiKey: string;
      defaultModel: string;
    };
    gemini?: {
      apiKey: string;
      defaultModel: string;
    };
    ollama?: {
      baseUrl: string;
      defaultModel: string;
    };
  };
  
  embeddings: {
    provider: 'ollama';
    model: string;
    dimension: number;
  };
  
  memory: {
    shortTermTokenLimit: number;
    shortTermMaxMessages: number;
    longTermTopResults: number;
    reflectionThreshold: number;
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'sandeep_ai',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    },
    
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION || 'sandeep_ai_memories',
    },
    
    redis: process.env.REDIS_HOST ? {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    } : undefined,
    
    models: {
      defaultProvider: (process.env.DEFAULT_MODEL_PROVIDER as any) || 'ollama',
      openai: process.env.OPENAI_API_KEY ? {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-turbo-preview',
      } : undefined,
      gemini: process.env.GEMINI_API_KEY ? {
        apiKey: process.env.GEMINI_API_KEY,
        defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-pro',
      } : undefined,
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1:8b',
      },
    },
    
    embeddings: {
      provider: 'ollama',
      model: 'nomic-embed-text',
      dimension: parseInt(process.env.EMBEDDINGS_DIMENSION || '768', 10),
    },
    
    memory: {
      shortTermTokenLimit: parseInt(process.env.SHORT_TERM_TOKEN_LIMIT || '4000', 10),
      shortTermMaxMessages: parseInt(process.env.SHORT_TERM_MAX_MESSAGES || '20', 10),
      longTermTopResults: parseInt(process.env.LONG_TERM_TOP_RESULTS || '5', 10),
      reflectionThreshold: parseInt(process.env.REFLECTION_THRESHOLD || '10', 10),
    },
    
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
    },
  };
}

export const config = loadConfig();
