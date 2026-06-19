// ── TIMPS Code — Tool Registry
// All tools are defined in their own folders under src/tools/
// This file imports and re-exports them all.

import type { ToolDefinition, RiskLevel } from '../config/types.js';

// Re-export shared types so existing import paths still work
export type { RegisteredTool, ToolExecResult, ToolExecutor } from './_shared/index.js';
import type { RegisteredTool, ToolExecResult } from './_shared/index.js';

// ── Inline tool definitions (each from own folder) ──
import { readFile } from './readFile/index.js';
import { writeFile } from './writeFile/index.js';
import { editFile } from './editFile/index.js';
import { multiEdit } from './multiEdit/index.js';
import { listDirectory } from './listDirectory/index.js';
import { bash } from './bash/index.js';
import { searchCode } from './searchCode/index.js';
import { findFiles } from './findFiles/index.js';
import { gitStatus } from './gitStatus/index.js';
import { gitCommit } from './gitCommit/index.js';
import { gitDiff } from './gitDiff/index.js';
import { gitLog } from './gitLog/index.js';
import { gitStash } from './gitStash/index.js';
import { patchFile } from './patchFile/index.js';
import { think } from './think/index.js';
import { webSearch } from './webSearch/index.js';
import { fetchUrl } from './fetchUrl/index.js';
import { notebook } from './notebook/index.js';
import { runDiagnostics } from './runDiagnostics/index.js';
import { askUser } from './askUser/index.js';
import { projectInfo } from './projectInfo/index.js';
import { todoWrite } from './todoWrite/index.js';
import { todoRead } from './todoRead/index.js';
import { memoryStore } from './memoryStore/index.js';
import { memorySearch } from './memorySearch/index.js';
import { memoryBenchmark } from './memoryBenchmark/index.js';
import { memoryCompress } from './memoryCompress/index.js';
import { memoryKgQuery } from './memoryKgQuery/index.js';
import { memoryTimeline } from './memoryTimeline/index.js';
import { memoryPredict } from './memoryPredict/index.js';
import { memoryStats } from './memoryStats/index.js';
import { memoryDecay } from './memoryDecay/index.js';

// ── Import subdirectory tools ──
import { sleepTool } from './sleep/index.js';
import { browserTool } from './browser/index.js';
import { workflowTool } from './workflow/index.js';
import { taskCreateTool } from './taskCreate/index.js';
import { taskGetTool } from './taskGet/index.js';
import { taskListTool } from './taskList/index.js';
import { taskUpdateTool } from './taskUpdate/index.js';
import { taskOutputTool } from './taskOutput/index.js';
import { taskStopTool } from './taskStop/index.js';
import { skillTool } from './skill/index.js';
import { scheduleCronTool } from './scheduleCron/index.js';
import { toolSearchTool } from './toolSearch/index.js';
import { webFetchTool } from './webFetch/index.js';
import { remoteTriggerTool } from './remoteTrigger/index.js';
import { teamCreateTool } from './teamCreate/index.js';
import { teamDeleteTool } from './teamDelete/index.js';
import { syntheticOutputTool } from './syntheticOutput/index.js';

export const ALL_TOOLS: RegisteredTool[] = [
  readFile, writeFile, editFile, multiEdit, listDirectory,
  bash, searchCode, findFiles, gitStatus, gitCommit,
  gitDiff, gitLog, gitStash, patchFile, think,
  webSearch, fetchUrl, notebook, runDiagnostics, askUser,
  projectInfo, todoWrite, todoRead, memoryStore, memorySearch,
  memoryBenchmark, memoryCompress, memoryKgQuery, memoryTimeline,
  memoryPredict, memoryStats, memoryDecay,
  sleepTool, browserTool, workflowTool,
  taskCreateTool, taskGetTool, taskListTool, taskUpdateTool,
  taskOutputTool, taskStopTool,
  skillTool, scheduleCronTool, toolSearchTool,
  webFetchTool, remoteTriggerTool, teamCreateTool, teamDeleteTool,
  syntheticOutputTool,
];

const LOCAL_TOOLS = ['read_file', 'write_file', 'edit_file', 'list_directory', 'bash', 'search_code', 'find_files'];

export function getToolDefinitions(localMode = false): ToolDefinition[] {
  if (localMode) {
    return ALL_TOOLS.filter(t => LOCAL_TOOLS.includes(t.definition.name)).map(t => t.definition);
  }
  return ALL_TOOLS.map(t => t.definition);
}

export function getTool(name: string): RegisteredTool | undefined {
  return ALL_TOOLS.find(t => t.definition.name === name);
}

export function getToolRisk(name: string): RiskLevel {
  return getTool(name)?.risk || 'high';
}

export function getToolByName(name: string): RegisteredTool | undefined {
  return ALL_TOOLS.find(t => t.definition.name === name);
}
