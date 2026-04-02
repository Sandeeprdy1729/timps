import { BaseTool, InternalToolDefinition, ToolResult } from './baseTool';
import { FileTool } from './fileTool';
import { WebSearchTool, WebFetchTool } from './webSearchTool';
import { ContradictionTool } from './contradictionTool';
import { GateWeaveTool } from './gateWeaveTool';
import {
  TemporalMirrorTool,
  RegretOracleTool,
  LivingManifestoTool,
  BurnoutSeismographTool,
  DeadReckoningTool,
  SkillShadowTool,
  CurriculumArchitectTool,
  TechDebtSeismographTool,
  BugPatternProphetTool,
  APIArchaeologistTool,
  CodebaseAnthropologistTool,
  InstitutionalMemoryTool,
  ChemistryEngineTool,
  MeetingGhostTool,
  CollectiveWisdomTool,
  RelationshipIntelligenceTool,
} from './allTools';

export { BaseTool } from './baseTool';
export { InternalToolDefinition, ToolResult } from './baseTool';
export { ContradictionTool } from './contradictionTool';
export { GateWeaveTool } from './gateWeaveTool';
export { positionStore } from './positionStore';

export function getAllTools(): BaseTool[] {
  return [
    // Core utilities
    new FileTool(),
    new WebSearchTool(),
    new WebFetchTool(),
    // Tool 1–4: Self-Intelligence
    new TemporalMirrorTool(),
    new RegretOracleTool(),
    new LivingManifestoTool(),
    new BurnoutSeismographTool(),
    // Tool 5: Argument DNA Mapper (contradiction detection)
    new ContradictionTool(),
    // Tool 6–8: Cognitive Intelligence
    new DeadReckoningTool(),
    new SkillShadowTool(),
    new CurriculumArchitectTool(),
    // Tool 9–12: Developer Intelligence
    new TechDebtSeismographTool(),
    new BugPatternProphetTool(),
    new APIArchaeologistTool(),
    new CodebaseAnthropologistTool(),
    // Tool 13–16: Collective Intelligence
    new InstitutionalMemoryTool(),
    new ChemistryEngineTool(),
    new MeetingGhostTool(),
    new CollectiveWisdomTool(),
    // Tool 17: Relationship Intelligence
    new RelationshipIntelligenceTool(),
    // Tool 18: GateWeave — Adaptive Memory Admission
    new GateWeaveTool(),
  ];
}

export function getToolDefinitions(): InternalToolDefinition[] {
  return getAllTools().map(tool => tool.getDefinition());
}

export function getToolByName(name: string): BaseTool | undefined {
  return getAllTools().find(tool => tool.name === name);
}

export async function executeTool(name: string, params: Record<string, any>): Promise<ToolResult> {
  const tool = getToolByName(name);
  if (!tool) {
    return { toolCallId: params.tool_call_id || 'unknown', result: '', error: `Tool not found: ${name}` };
  }
  try {
    const result = await tool.execute(params);
    return { toolCallId: params.tool_call_id || 'unknown', result };
  } catch (error: any) {
    return { toolCallId: params.tool_call_id || 'unknown', result: '', error: error.message };
  }
}