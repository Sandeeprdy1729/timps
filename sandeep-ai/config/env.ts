import 'dotenv/config';
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
    defaultProvider: 'openai' | 'gemini' | 'ollama' | 'openrouter';
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
    openrouter?: {
      apiKey: string;
      defaultModel: string;
    };
  };
  
  embeddings: {
    provider: 'ollama' | 'gemini';
    model: string;
    dimension: number;
  };
  
  memory: {
    shortTermTokenLimit: number;
    shortTermMaxMessages: number;
    longTermTopResults: number;
    reflectionThreshold: number;
  };

  forgeLink: {
    enabled: boolean;
    minEdgeConfidence: number;
    maxEdgesPerProcess: number;
    evolveIntervalHours: number;
  };
  
  aetherForge: {
    enabled: boolean;
    maxTraverseSteps: number;
    confidenceThreshold: number;
    refusalThreshold: number;
    maxSummaryLength: number;
  };

  veilForge: {
    enabled: boolean;
    maxTraverseSteps: number;
    confidenceThreshold: number;
    refusalThreshold: number;
    maxSummaryLength: number;
  };

  temporaTree: {
    enabled: boolean;
    bmmThreshold: number;
    maxTreeDepth: number;
    policyLearnRate: number;
  };

  bindWeave: {
    enabled: boolean;
    inductionThreshold: number;
    maxWeaveDegree: number;
    reflectionDepth: number;
  };

  echoForge: {
    enabled: boolean;
    minConfidence: number;
    maxEchoDepth: number;
    reflectionDepth: number;
  };

  aetherWeft: {
    enabled: boolean;
    maturityThreshold: number;
    decayRate: number;
    maxRiverDepth: number;
  };

  apexSynapse: {
    enabled: boolean;
    maxResolutionSteps: number;
    minConfidence: number;
    maxPropagationDepth: number;
  };

  quaternaryForge: {
    enabled: boolean;
    wisdomThreshold: number;
    memoryDecayRate: number;
    intelligenceMaxAge: number;
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
      openrouter: process.env.OPENROUTER_API_KEY ? {
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-haiku',
      } : undefined,
    },
    
    embeddings: {
      provider: (process.env.EMBEDDINGS_PROVIDER || 'ollama') as 'ollama' | 'gemini',
      model: process.env.EMBEDDINGS_MODEL || 'nomic-embed-text',
      dimension: parseInt(process.env.EMBEDDINGS_DIMENSION || '768', 10),
    },
    
    memory: {
      shortTermTokenLimit: parseInt(process.env.SHORT_TERM_TOKEN_LIMIT || '4000', 10),
      shortTermMaxMessages: parseInt(process.env.SHORT_TERM_MAX_MESSAGES || '20', 10),
      longTermTopResults: parseInt(process.env.LONG_TERM_TOP_RESULTS || '5', 10),
      reflectionThreshold: parseInt(process.env.REFLECTION_THRESHOLD || '10', 10),
    },

    forgeLink: {
      enabled: process.env.ENABLE_FORGELINK !== 'false',
      minEdgeConfidence: parseFloat(process.env.FORGELINK_MIN_CONFIDENCE || '0.3'),
      maxEdgesPerProcess: parseInt(process.env.FORGELINK_MAX_EDGES || '20', 10),
      evolveIntervalHours: parseInt(process.env.FORGELINK_EVOLVE_INTERVAL || '24', 10),
    },
    
    aetherForge: {
      enabled: process.env.ENABLE_AETHERFORGE !== 'false',
      maxTraverseSteps: parseInt(process.env.AETHERFORGE_MAX_TRAVERSE || '8', 10),
      confidenceThreshold: parseFloat(process.env.AETHERFORGE_CONFIDENCE_THRESHOLD || '0.65'),
      refusalThreshold: parseFloat(process.env.AETHERFORGE_REFUSAL_THRESHOLD || '0.15'),
      maxSummaryLength: parseInt(process.env.AETHERFORGE_MAX_SUMMARY || '500', 10),
    },

    veilForge: {
      enabled: process.env.ENABLE_VEILFORGE !== 'false',
      maxTraverseSteps: parseInt(process.env.VEILFORGE_MAX_TRAVERSE || '8', 10),
      confidenceThreshold: parseFloat(process.env.VEILFORGE_CONFIDENCE_THRESHOLD || '0.65'),
      refusalThreshold: parseFloat(process.env.VEILFORGE_REFUSAL_THRESHOLD || '0.15'),
      maxSummaryLength: parseInt(process.env.VEILFORGE_MAX_SUMMARY || '500', 10),
    },

    temporaTree: {
      enabled: process.env.ENABLE_TEMPORATREE !== 'false',
      bmmThreshold: parseFloat(process.env.TEMPORATREE_BMM_THRESHOLD || '0.55'),
      maxTreeDepth: parseInt(process.env.TEMPORATREE_MAX_DEPTH || '4', 10),
      policyLearnRate: parseFloat(process.env.TEMPORATREE_POLICY_RATE || '0.1'),
    },

    bindWeave: {
      enabled: process.env.ENABLE_BINDWEAVE !== 'false',
      inductionThreshold: parseFloat(process.env.BINDWEAVE_INDUCTION_THRESHOLD || '0.45'),
      maxWeaveDegree: parseInt(process.env.BINDWEAVE_MAX_DEGREE || '6', 10),
      reflectionDepth: parseInt(process.env.BINDWEAVE_REFLECTION_DEPTH || '3', 10),
    },

    echoForge: {
      enabled: process.env.ENABLE_ECHOFORGE !== 'false',
      minConfidence: parseFloat(process.env.ECHOFORGE_MIN_CONFIDENCE || '0.65'),
      maxEchoDepth: parseInt(process.env.ECHOFORGE_MAX_DEPTH || '4', 10),
      reflectionDepth: parseInt(process.env.ECHOFORGE_REFLECTION_DEPTH || '3', 10),
    },

    aetherWeft: {
      enabled: process.env.ENABLE_AETHERWEFT !== 'false',
      maturityThreshold: parseFloat(process.env.AETHERWEFT_MATURITY_THRESHOLD || '0.6'),
      decayRate: parseFloat(process.env.AETHERWEFT_DECAY_RATE || '0.02'),
      maxRiverDepth: parseInt(process.env.AETHERWEFT_MAX_RIVER_DEPTH || '5', 10),
    },

    apexSynapse: {
      enabled: process.env.ENABLE_APEXSYNAPSE !== 'false',
      maxResolutionSteps: parseInt(process.env.APEXSYNAPSE_MAX_STEPS || '8', 10),
      minConfidence: parseFloat(process.env.APEXSYNAPSE_MIN_CONFIDENCE || '0.6'),
      maxPropagationDepth: parseInt(process.env.APEXSYNAPSE_MAX_PROPAGATION || '3', 10),
    },

    quaternaryForge: {
      enabled: process.env.ENABLE_QUATERNARYFORGE !== 'false',
      wisdomThreshold: parseFloat(process.env.QUATERNARYFORGE_WISDOM_THRESHOLD || '0.65'),
      memoryDecayRate: parseFloat(process.env.QUATERNARYFORGE_MEMORY_DECAY || '0.03'),
      intelligenceMaxAge: parseInt(process.env.QUATERNARYFORGE_INTELLIGENCE_AGE || '30', 10),
    },

    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
    },
  };
}

export const config = loadConfig();