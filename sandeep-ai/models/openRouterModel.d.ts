import { BaseModel, Message, GenerateOptions, GenerateResponse, EmbeddingResponse } from './baseModel';
export declare class OpenRouterModel extends BaseModel {
    private client;
    constructor(modelName?: string, temperature?: number);
    generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
    getEmbedding(_text: string): Promise<EmbeddingResponse>;
}
//# sourceMappingURL=openRouterModel.d.ts.map