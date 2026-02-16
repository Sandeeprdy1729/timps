import { BaseModel } from './baseModel';
export type ModelProvider = 'openai' | 'gemini' | 'ollama';
export declare function createModel(provider?: ModelProvider): BaseModel;
export declare function createEmbeddingModel(provider?: ModelProvider): BaseModel;
export { BaseModel } from './baseModel';
export { OpenAIModel } from './openaiModel';
export { GeminiModel } from './geminiModel';
export { OllamaModel } from './ollamaModel';
//# sourceMappingURL=index.d.ts.map