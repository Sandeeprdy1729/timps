"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionStore = exports.ContradictionTool = exports.BaseTool = void 0;
exports.getAllTools = getAllTools;
exports.getToolDefinitions = getToolDefinitions;
exports.getToolByName = getToolByName;
exports.executeTool = executeTool;
const fileTool_1 = require("./fileTool");
const webSearchTool_1 = require("./webSearchTool");
const contradictionTool_1 = require("./contradictionTool");
const allTools_1 = require("./allTools");
var baseTool_1 = require("./baseTool");
Object.defineProperty(exports, "BaseTool", { enumerable: true, get: function () { return baseTool_1.BaseTool; } });
var contradictionTool_2 = require("./contradictionTool");
Object.defineProperty(exports, "ContradictionTool", { enumerable: true, get: function () { return contradictionTool_2.ContradictionTool; } });
var positionStore_1 = require("./positionStore");
Object.defineProperty(exports, "positionStore", { enumerable: true, get: function () { return positionStore_1.positionStore; } });
function getAllTools() {
    return [
        // Core utilities
        new fileTool_1.FileTool(),
        new webSearchTool_1.WebSearchTool(),
        new webSearchTool_1.WebFetchTool(),
        // Tool 1–4: Self-Intelligence
        new allTools_1.TemporalMirrorTool(),
        new allTools_1.RegretOracleTool(),
        new allTools_1.LivingManifestoTool(),
        new allTools_1.BurnoutSeismographTool(),
        // Tool 5: Argument DNA Mapper (contradiction detection)
        new contradictionTool_1.ContradictionTool(),
        // Tool 6–8: Cognitive Intelligence
        new allTools_1.DeadReckoningTool(),
        new allTools_1.SkillShadowTool(),
        new allTools_1.CurriculumArchitectTool(),
        // Tool 9–12: Developer Intelligence
        new allTools_1.TechDebtSeismographTool(),
        new allTools_1.BugPatternProphetTool(),
        new allTools_1.APIArchaeologistTool(),
        new allTools_1.CodebaseAnthropologistTool(),
        // Tool 13–16: Collective Intelligence
        new allTools_1.InstitutionalMemoryTool(),
        new allTools_1.ChemistryEngineTool(),
        new allTools_1.MeetingGhostTool(),
        new allTools_1.CollectiveWisdomTool(),
        // Tool 17: Relationship Intelligence
        new allTools_1.RelationshipIntelligenceTool(),
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
        return { toolCallId: params.tool_call_id || 'unknown', result: '', error: `Tool not found: ${name}` };
    }
    try {
        const result = await tool.execute(params);
        return { toolCallId: params.tool_call_id || 'unknown', result };
    }
    catch (error) {
        return { toolCallId: params.tool_call_id || 'unknown', result: '', error: error.message };
    }
}
//# sourceMappingURL=index.js.map