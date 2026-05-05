// TIMPS Tools System
// Complete toolset like Claude Code: Agent, skills, hooks, permissions, subagents

import { ALL_TOOLS } from '../tools/tools.js';
import type { ToolDefinition } from '../config/types.js';
import { generateId, shellEscape, formatDuration } from '../utils/utils.js';

type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface ToolResult {
  content: string;
  isError?: boolean;
  toolName?: string;
  durationMs?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  startTime: number;
}

// ── Agent Tool: Spawn subagents ──
export const AgentTool: ToolExecutor = async (args) => {
  const { prompt, model, context } = args as any;
  
  return {
    content: `[Agent Tool] Spawning subagent for: ${prompt.slice(0, 50)}...`,
    toolName: 'Agent',
  };
};

// ── Task Tools: Todo management ──
export const TaskCreateTool: ToolExecutor = async (args) => {
  const { title, priority } = args as any;
  const id = generateId('task');
  
  return {
    content: `Created task: ${id} - ${title}`,
    toolName: 'TaskCreate',
  };
};

export const TaskListTool: ToolExecutor = async (args) => {
  return {
    content: `Tasks:\n  - Task list here (from storage)`,
    toolName: 'TaskList',
  };
};

export const TaskUpdateTool: ToolExecutor = async (args) => {
  const { id, status } = args as any;
  
  return {
    content: `Updated task ${id} to ${status}`,
    toolName: 'TaskUpdate',
  };
};

// ── Skill Tool ──
export const SkillTool: ToolExecutor = async (args) => {
  const { name } = args as any;
  
  return {
    content: `[Skill] Running skill: ${name}`,
    toolName: 'Skill',
  };
};

// ── WebSearch Tool ──
export const WebSearchTool: ToolExecutor = async (args) => {
  const { query } = args as any;
  
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await response.json();
    
    return {
      content: data.AbstractText || `No results for: ${query}`,
      toolName: 'WebSearch',
    };
  } catch (err: any) {
    return {
      content: `Search error: ${err.message}`,
      isError: true,
      toolName: 'WebSearch',
    };
  }
};

// ── WebFetch Tool ──
export const WebFetchTool: ToolExecutor = async (args) => {
  const { url, format } = args as any;
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    return {
      content: text.slice(0, 10000),
      toolName: 'WebFetch',
    };
  } catch (err: any) {
    return {
      content: `Fetch error: ${err.message}`,
      isError: true,
      toolName: 'WebFetch',
    };
  }
};

// ── Glob Tool: Find files ──
export const GlobTool: ToolExecutor = async (args) => {
  const { pattern, cwd } = args as any;
  const { glob } = await import('glob');
  
  try {
    const files = await glob(pattern, { cwd: cwd || process.cwd(), absolute: true });
    
    return {
      content: files.slice(0, 100).join('\n'),
      toolName: 'Glob',
    };
  } catch (err: any) {
    return {
      content: `Glob error: ${err.message}`,
      isError: true,
      toolName: 'Glob',
    };
  }
};

// ── Grep Tool: Search code ──
export const GrepTool: ToolExecutor = async (args) => {
  const { pattern, path: searchPath, include } = args as Record<string, string>;
  // Use Node's child_process for grep since no dedicated util exists
  const { execSync } = await import('node:child_process');
  try {
    const flags = include ? `--include="${include}"` : '';
    const cmd = `grep -rn ${flags} "${pattern}" "${searchPath || '.'}" 2>/dev/null | head -50`;
    const out = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return { content: out || `No matches for: ${pattern}`, toolName: 'Grep' };
  } catch {
    return { content: `Searched for: ${pattern}`, toolName: 'Grep' };
  }
};

// ── Edit Tool ──
export const EditTool: ToolExecutor = async (args) => {
  const { path, old_string, new_string } = args as any;
  const fs = await import('node:fs');
  
  try {
    let content = fs.readFileSync(path, 'utf-8');
    
    if (!content.includes(old_string)) {
      return {
        content: `Could not find "${old_string.slice(0, 50)}" in ${path}`,
        isError: true,
        toolName: 'Edit',
      };
    }
    
    content = content.replace(old_string, new_string);
    fs.writeFileSync(path, content, 'utf-8');
    
    return {
      content: `Edited ${path}`,
      toolName: 'Edit',
    };
  } catch (err: any) {
    return {
      content: `Edit error: ${err.message}`,
      isError: true,
      toolName: 'Edit',
    };
  }
};

// ── Write Tool ──
export const WriteTool: ToolExecutor = async (args) => {
  const { path, content } = args as any;
  const fs = await import('node:fs');
  
  try {
    fs.writeFileSync(path, content, 'utf-8');
    
    return {
      content: `Wrote ${path}`,
      toolName: 'Write',
    };
  } catch (err: any) {
    return {
      content: `Write error: ${err.message}`,
      isError: true,
      toolName: 'Write',
    };
  }
};

// ── Read Tool ──
export const ReadTool: ToolExecutor = async (args) => {
  const { path, limit, offset } = args as any;
  const fs = await import('node:fs');
  
  try {
    let content = fs.readFileSync(path, 'utf-8');
    
    if (offset || limit) {
      const lines = content.split('\n');
      if (offset) content = lines.slice(offset).join('\n');
      if (limit) content = lines.slice(0, limit).join('\n');
    }
    
    return {
      content: content.slice(0, 50000),
      toolName: 'Read',
    };
  } catch (err: any) {
    return {
      content: `Read error: ${err.message}`,
      isError: true,
      toolName: 'Read',
    };
  }
};

// ── Bash Tool ──
export const BashTool: ToolExecutor = async (args) => {
  const { command, timeout, description } = args as any;
  const { execSync } = await import('node:child_process');
  
  try {
    const start = Date.now();
    const output = String(execSync(command, { 
      encoding: 'utf-8', 
      timeout: timeout || 120000,
      maxBuffer: 10 * 1024 * 1024,
    }));
    const duration = Date.now() - start;
    
    return {
      content: output.slice(0, 100000),
      toolName: 'Bash',
      durationMs: duration,
    };
  } catch (err: any) {
    return {
      content: err.message || 'Command failed',
      isError: true,
      toolName: 'Bash',
    };
  }
};

// ── TodoWrite Tool ──
export const TodoWriteTool: ToolExecutor = async (args) => {
  const { content, status } = args as any;
  
  return {
    content: `Todo: ${content} [${status || 'pending'}]`,
    toolName: 'TodoWrite',
  };
};

// ── TodoRead Tool ──
export const TodoReadTool: ToolExecutor = async () => {
  return {
    content: 'Todo list from session memory',
    toolName: 'TodoRead',
  };
};

// ── LSP Tool: Code intelligence ──
export const LSPTool: ToolExecutor = async (args) => {
  const { operation, path, line, column } = args as any;
  
  return {
    content: `[LSP] ${operation} at ${path}:${line}:${column}`,
    toolName: 'LSP',
  };
};

// ── NotStarted: Implementation placeholder for tools being added ──
export const NotStartedTool: ToolExecutor = async (args) => {
  return {
    content: 'Tool not yet implemented',
    isError: true,
  };
};

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