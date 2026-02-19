import { BaseModel, Message, GenerateOptions, GenerateResponse, EmbeddingResponse } from './baseModel';
export declare class OllamaModel extends BaseModel {
    private baseUrl;
    constructor(modelName?: string, baseUrl?: string, temperature?: number);
    generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
    getEmbedding(text: string): Promise<EmbeddingResponse>;
}
//# sourceMappingURL=ollamaModel.d.ts.map