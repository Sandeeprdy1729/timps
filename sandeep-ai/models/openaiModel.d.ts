import { BaseModel, Message, GenerateOptions, GenerateResponse, EmbeddingResponse } from './baseModel';
export declare class OpenAIModel extends BaseModel {
    private client;
    constructor(modelName?: string, apiKey?: string, temperature?: number);
    generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResponse>;
    getEmbedding(text: string): Promise<EmbeddingResponse>;
}
//# sourceMappingURL=openaiModel.d.ts.map