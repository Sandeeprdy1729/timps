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
export declare function loadConfig(): Config;
export declare const config: Config;
//# sourceMappingURL=env.d.ts.map