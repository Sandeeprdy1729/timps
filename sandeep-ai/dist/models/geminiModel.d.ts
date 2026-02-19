import { BaseModel, Message, GenerateOptions, GenerateResponse, EmbeddingResponse } from './baseModel';
export declare class GeminiModel extends BaseModel {
    private apiKey;
    private baseUrl;
    constructor(modelName?: string, apiKey?: string, temperature?: number);
    generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
    getEmbedding(text: string): Promise<EmbeddingResponse>;
    private convertMessagesToContents;
    private convertTools;
}
//# sourceMappingURL=geminiModel.d.ts.map