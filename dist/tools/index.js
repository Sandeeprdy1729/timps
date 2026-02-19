"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFetchTool = exports.WebSearchTool = exports.FileTool = exports.BaseTool = void 0;
exports.getAllTools = getAllTools;
exports.getToolDefinitions = getToolDefinitions;
exports.getToolByName = getToolByName;
exports.executeTool = executeTool;
const fileTool_1 = require("./fileTool");
const webSearchTool_1 = require("./webSearchTool");
var baseTool_1 = require("./baseTool");
Object.defineProperty(exports, "BaseTool", { enumerable: true, get: function () { return baseTool_1.BaseTool; } });
var fileTool_2 = require("./fileTool");
Object.defineProperty(exports, "FileTool", { enumerable: true, get: function () { return fileTool_2.FileTool; } });
var webSearchTool_2 = require("./webSearchTool");
Object.defineProperty(exports, "WebSearchTool", { enumerable: true, get: function () { return webSearchTool_2.WebSearchTool; } });
Object.defineProperty(exports, "WebFetchTool", { enumerable: true, get: function () { return webSearchTool_2.WebFetchTool; } });
function getAllTools() {
    return [
        new fileTool_1.FileTool(),
        new webSearchTool_1.WebSearchTool(),
        new webSearchTool_1.WebFetchTool(),
    ];
}
function getToolDefinitions() {
    return getAllTools().map(tool => tool.getDefinition());
}
function getToolByName(name) {
    return getAllTools().find(tool => tool.name === name);
}
async function executeTool(name, params) {
    const tool = getToolByName(name);
    if (!tool) {
        return {
            toolCallId: params.tool_call_id || 'unknown',
            result: '',
            error: `Tool not found: ${name}`,
        };
    }
    try {
        const result = await tool.execute(params);
        return {
            toolCallId: params.tool_call_id || 'unknown',
            result,
        };
    }
    catch (error) {
        return {
            toolCallId: params.tool_call_id || 'unknown',
            result: '',
            error: error.message,
        };
    }
}
//# sourceMappingURL=index.js.map