"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
class BaseTool {
    getDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters,
        };
    }
    validateParams(params) {
        const required = this.parameters.required || [];
        for (const field of required) {
            if (params[field] === undefined) {
                throw new Error(`Missing required parameter: ${field}`);
            }
        }
    }
}
exports.BaseTool = BaseTool;
//# sourceMappingURL=baseTool.js.map