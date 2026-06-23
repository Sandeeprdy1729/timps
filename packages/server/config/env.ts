import 'dotenv/config';

const modelProviders = ['openai', 'gemini', 'ollama', 'openrouter'] as const;
const embeddingProviders = ['ollama', 'gemini'] as const;
const logLevels = ['debug', 'info', 'warn', 'error'] as const;

function readInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  console.warn(`[config] Invalid integer for ${name}: ${value}. Using ${fallback}.`);
  return fallback;
}

function readFloat(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseFloat(value);
  if (Number.isFinite(parsed)) return parsed;
  console.warn(`[config] Invalid number for ${name}: ${value}. Using ${fallback}.`);
  return fallback;
}

function readEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (!value) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  console.warn(`[config] Invalid value for ${name}: ${value}. Using ${fallback}.`);
  return fallback;
}

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
    port: readInt('PORT', 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: readInt('POSTGRES_PORT', 5432),
      database: process.env.POSTGRES_DB || 'timps',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    },
    
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION || 'timps_memories',
    },
    
    redis: process.env.REDIS_HOST ? {
      host: process.env.REDIS_HOST,
      port: readInt('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD,
    } : undefined,
    
    models: {
      defaultProvider: readEnum('DEFAULT_MODEL_PROVIDER', modelProviders, 'ollama'),
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
      provider: readEnum('EMBEDDINGS_PROVIDER', embeddingProviders, 'ollama'),
      model: process.env.EMBEDDINGS_MODEL || 'nomic-embed-text',
      dimension: readInt('EMBEDDINGS_DIMENSION', 768),
    },
    
    memory: {
      shortTermTokenLimit: readInt('SHORT_TERM_TOKEN_LIMIT', 4000),
      shortTermMaxMessages: readInt('SHORT_TERM_MAX_MESSAGES', 20),
      longTermTopResults: readInt('LONG_TERM_TOP_RESULTS', 5),
      reflectionThreshold: readInt('REFLECTION_THRESHOLD', 10),
    },

    forgeLink: {
      enabled: process.env.ENABLE_FORGELINK !== 'false',
      minEdgeConfidence: readFloat('FORGELINK_MIN_CONFIDENCE', 0.3),
      maxEdgesPerProcess: readInt('FORGELINK_MAX_EDGES', 20),
      evolveIntervalHours: readInt('FORGELINK_EVOLVE_INTERVAL', 24),
    },
    
    aetherForge: {
      enabled: process.env.ENABLE_AETHERFORGE !== 'false',
      maxTraverseSteps: readInt('AETHERFORGE_MAX_TRAVERSE', 8),
      confidenceThreshold: readFloat('AETHERFORGE_CONFIDENCE_THRESHOLD', 0.65),
      refusalThreshold: readFloat('AETHERFORGE_REFUSAL_THRESHOLD', 0.15),
      maxSummaryLength: readInt('AETHERFORGE_MAX_SUMMARY', 500),
    },

    veilForge: {
      enabled: process.env.ENABLE_VEILFORGE !== 'false',
      maxTraverseSteps: readInt('VEILFORGE_MAX_TRAVERSE', 8),
      confidenceThreshold: readFloat('VEILFORGE_CONFIDENCE_THRESHOLD', 0.65),
      refusalThreshold: readFloat('VEILFORGE_REFUSAL_THRESHOLD', 0.15),
      maxSummaryLength: readInt('VEILFORGE_MAX_SUMMARY', 500),
    },

    temporaTree: {
      enabled: process.env.ENABLE_TEMPORATREE !== 'false',
      bmmThreshold: readFloat('TEMPORATREE_BMM_THRESHOLD', 0.55),
      maxTreeDepth: readInt('TEMPORATREE_MAX_DEPTH', 4),
      policyLearnRate: readFloat('TEMPORATREE_POLICY_RATE', 0.1),
    },

    bindWeave: {
      enabled: process.env.ENABLE_BINDWEAVE !== 'false',
      inductionThreshold: readFloat('BINDWEAVE_INDUCTION_THRESHOLD', 0.45),
      maxWeaveDegree: readInt('BINDWEAVE_MAX_DEGREE', 6),
      reflectionDepth: readInt('BINDWEAVE_REFLECTION_DEPTH', 3),
    },

    echoForge: {
      enabled: process.env.ENABLE_ECHOFORGE !== 'false',
      minConfidence: readFloat('ECHOFORGE_MIN_CONFIDENCE', 0.65),
      maxEchoDepth: readInt('ECHOFORGE_MAX_DEPTH', 4),
      reflectionDepth: readInt('ECHOFORGE_REFLECTION_DEPTH', 3),
    },

    aetherWeft: {
      enabled: process.env.ENABLE_AETHERWEFT !== 'false',
      maturityThreshold: readFloat('AETHERWEFT_MATURITY_THRESHOLD', 0.6),
      decayRate: readFloat('AETHERWEFT_DECAY_RATE', 0.02),
      maxRiverDepth: readInt('AETHERWEFT_MAX_RIVER_DEPTH', 5),
    },

    apexSynapse: {
      enabled: process.env.ENABLE_APEXSYNAPSE !== 'false',
      maxResolutionSteps: readInt('APEXSYNAPSE_MAX_STEPS', 8),
      minConfidence: readFloat('APEXSYNAPSE_MIN_CONFIDENCE', 0.6),
      maxPropagationDepth: readInt('APEXSYNAPSE_MAX_PROPAGATION', 3),
    },

    quaternaryForge: {
      enabled: process.env.ENABLE_QUATERNARYFORGE !== 'false',
      wisdomThreshold: readFloat('QUATERNARYFORGE_WISDOM_THRESHOLD', 0.65),
      memoryDecayRate: readFloat('QUATERNARYFORGE_MEMORY_DECAY', 0.03),
      intelligenceMaxAge: readInt('QUATERNARYFORGE_INTELLIGENCE_AGE', 30),
    },

    logging: {
      level: readEnum('LOG_LEVEL', logLevels, 'info'),
    },
  };
}

export const config = loadConfig();
