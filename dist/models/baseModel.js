"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModel = void 0;
class BaseModel {
    modelName;
    temperature = 0.7;
    constructor(modelName, temperature) {
        this.modelName = modelName;
        if (temperature !== undefined) {
            this.temperature = temperature;
        }
    }
    getModelName() {
        return this.modelName;
    }
    setTemperature(temperature) {
        this.temperature = Math.max(0, Math.min(2, temperature));
    }
    parseToolCalls(responseContent) {
        try {
            const parsed = JSON.parse(responseContent);
            if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
                return parsed.tool_calls;
            }
        }
        catch {
            return undefined;
        }
        return undefined;
    }
}
exports.BaseModel = BaseModel;
//# sourceMappingURL=baseModel.js.map