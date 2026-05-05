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
export declare function loadConfig(): Config;
export declare const config: Config;
//# sourceMappingURL=env.d.ts.map