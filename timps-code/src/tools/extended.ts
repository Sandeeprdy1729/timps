// TIMPS Tools System — Extended tool definitions (Claude Code-style)
// Each tool implementation lives in its own folder under src/tools/

import { ALL_TOOLS } from '../tools/tools.js';
import type { ToolDefinition } from '../config/types.js';

// Import shared types
import type { ToolExecutor, ToolResult, ToolCall } from './_shared/index.js';
export type { ToolResult, ToolCall };

// Import tool implementations
import { AgentTool } from './agent/index.js';
import { GlobTool } from './glob/index.js';

import { TaskCreateTool } from './taskCreate/index.js';
import { TaskListTool } from './taskList/index.js';
import { TaskUpdateTool } from './taskUpdate/index.js';
import { SkillTool } from './skill/index.js';

import { WebSearchTool } from './webSearch/index.js';
import { WebFetchTool } from './webFetch/index.js';
import { GrepTool } from './searchCode/index.js';
import { EditTool } from './editFile/index.js';
import { WriteTool } from './writeFile/index.js';
import { ReadTool } from './readFile/index.js';
import { BashTool } from './bash/index.js';
import { TodoWriteTool } from './todoWrite/index.js';
import { TodoReadTool } from './todoRead/index.js';
import { LSPTool } from './lsp/index.js';

// ── Extended tool definitions (matching Claude Code) ──
export const EXTENDED_TOOLS: ToolDefinition[] = [
  {
    name: 'Agent',
    description: 'Spawn a subagent with its own context to handle a task',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task for the subagent' },
        model: { type: 'string', description: 'Model to use (optional)' },
        context: { type: 'string', description: 'Additional context (optional)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'TaskCreate',
    description: 'Create a new task in the task list',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'string', description: 'Task priority', enum: ['high', 'medium', 'low'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'TaskList',
    description: 'List all tasks with their current status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'TaskUpdate',
    description: 'Update a task status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
        status: { type: 'string', description: 'Task status', enum: ['done', 'pending', 'in_progress', 'failed'] },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'Skill',
    description: 'Execute a skill within the conversation',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name to execute' },
      },
      required: ['name'],
    },
  },
  {
    name: 'WebSearch',
    description: 'Perform web searches',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'WebFetch',
    description: 'Fetch content from a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        format: { type: 'string', description: 'Output format', enum: ['text', 'markdown', 'html'] },
      },
      required: ['url'],
    },
  },
  {
    name: 'Glob',
    description: 'Find files by glob pattern',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
        cwd: { type: 'string', description: 'Working directory' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: 'Search file contents with regex',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        path: { type: 'string', description: 'Path to search in' },
        include: { type: 'string', description: 'File pattern to include' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Edit',
    description: 'Edit a file by replacing exact text',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        old_string: { type: 'string', description: 'Text to replace' },
        new_string: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'Write',
    description: 'Create or overwrite a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'Read',
    description: 'Read a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        limit: { type: 'number', description: 'Max lines' },
        offset: { type: 'number', description: 'Line offset' },
      },
      required: ['path'],
    },
  },
  {
    name: 'Bash',
    description: 'Execute shell commands',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in ms' },
        description: { type: 'string', description: 'Description' },
      },
      required: ['command'],
    },
  },
  {
    name: 'TodoWrite',
    description: 'Manage session task checklist',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Task content' },
        status: { type: 'string', description: 'Todo status', enum: ['pending', 'in_progress', 'done', 'cancelled'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'TodoRead',
    description: 'Read all todo items',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'LSP',
    description: 'Code intelligence via language servers',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Language server operation', enum: ['definition', 'references', 'hover', 'type'] },
        path: { type: 'string', description: 'File path' },
        line: { type: 'number', description: 'Line number' },
        column: { type: 'number', description: 'Column number' },
      },
      required: ['operation', 'path'],
    },
  },
];

export const ALL_EXTENDED_TOOLS: ToolDefinition[] = [
  ...EXTENDED_TOOLS,
  ...ALL_TOOLS.map(t => t.definition),
];

// Extended tool executors map
export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  Agent: AgentTool,
  TaskCreate: TaskCreateTool,
  TaskList: TaskListTool,
  TaskUpdate: TaskUpdateTool,
  Skill: SkillTool,
  WebSearch: WebSearchTool,
  WebFetch: WebFetchTool,
  Glob: GlobTool,
  Grep: GrepTool,
  Edit: EditTool,
  Write: WriteTool,
  Read: ReadTool,
  Bash: BashTool,
  TodoWrite: TodoWriteTool,
  TodoRead: TodoReadTool,
  LSP: LSPTool,
};

// ── Get tool by name ──
export function getTool(name: string): ToolDefinition | undefined {
  return ALL_EXTENDED_TOOLS.find(t => t.name === name);
}

// ── Execute tool ──
export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const executor = TOOL_EXECUTORS[name];

  if (!executor) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }

  const start = Date.now();
  try {
    const result = await executor(args);
    return { ...result, durationMs: Date.now() - start };
  } catch (err: any) {
    return {
      content: `Tool error: ${err.message}`,
      isError: true,
      toolName: name,
      durationMs: Date.now() - start,
    };
  }
}
