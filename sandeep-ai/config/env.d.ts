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
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
    };
}
export declare function loadConfig(): Config;
export declare const config: Config;
//# sourceMappingURL=env.d.ts.map