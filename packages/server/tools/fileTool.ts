import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { BaseTool, ToolParameter } from './baseTool';

// Sandbox for the LLM-driven file tool. Defaults to the server's working
// directory ONLY — an allowlist that implicitly includes $HOME is not a
// sandbox (prompt-injected output could read ~/.ssh, ~/.aws, browser profiles,
// etc.). Operators may explicitly widen the sandbox with TIMPS_FILE_BASE_DIRS
// (path.delimiter-separated). cwd is always allowed; everything else must be
// opted in explicitly.
function getAllowedBaseDirs(): string[] {
  const explicit = (process.env.TIMPS_FILE_BASE_DIRS || '')
    .split(path.delimiter)
    .map(dir => dir.trim())
    .filter(Boolean);
  const candidates = [process.cwd(), ...explicit];
  const canonical = new Set<string>();
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    try {
      // Resolve symlinks (e.g. /tmp -> /private/tmp on macOS) so later realpath
      // comparisons stay consistent.
      canonical.add(fsSync.realpathSync(resolved));
    } catch {
      canonical.add(resolved);
    }
  }
  return [...canonical];
}

const ALLOWED_BASE_DIRS = getAllowedBaseDirs();

function isInsideBaseDir(resolved: string, base: string): boolean {
  return resolved === base || resolved.startsWith(base + path.sep);
}

// Fully resolves symlinks (e.g. /tmp -> /private/tmp on macOS). For paths that
// do not exist yet (write/mkdir) it walks up to the closest existing ancestor,
// realpaths that, then re-appends the remaining suffix.
async function canonicalize(targetPath: string): Promise<string | null> {
  const resolved = path.resolve(targetPath);
  let current = resolved;
  const suffix: string[] = [];
  for (;;) {
    try {
      const real = await fs.realpath(current);
      return suffix.length === 0 ? real : path.join(real, ...suffix);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
}

// Checks the fully canonical (symlink-resolved) path stays inside an allowed
// base dir. A symlink that points outside the sandbox (e.g. cwd/creds ->
// ~/.ssh) cannot escape it because the link target is resolved before the
// containment test.
async function isPathTraversalSafe(targetPath: string): Promise<boolean> {
  const canonical = await canonicalize(targetPath);
  if (!canonical) {
    return false;
  }
  return ALLOWED_BASE_DIRS.some(base => isInsideBaseDir(canonical, base));
}

export class FileTool extends BaseTool {
  name = 'file_operations';
  description = 'Perform file operations including reading, writing, listing directories, and checking file existence. Use this tool when you need to work with files on the local filesystem.';
  
  parameters: ToolParameter = {
    type: 'object',
    description: 'File operation parameters',
    properties: {
      operation: {
        type: 'string',
        description: 'The operation to perform: read, write, list, exists, mkdir, delete, append',
        enum: ['read', 'write', 'list', 'exists', 'mkdir', 'delete', 'append'],
      },
      path: {
        type: 'string',
        description: 'The file or directory path',
      },
      content: {
        type: 'string',
        description: 'Content to write (for write and append operations)',
      },
    },
    required: ['operation', 'path'],
  };
  
  async execute(params: Record<string, any>): Promise<string> {
    const { operation, path: filePath, content } = params;
    const resolvedPath = path.resolve(filePath);
    
    if (!(await isPathTraversalSafe(resolvedPath))) {
      return `Error: Path traversal denied: ${filePath} is outside allowed directories`;
    }
    
    switch (operation) {
      case 'read':
        return this.readFile(resolvedPath);
      case 'write':
        return this.writeFile(resolvedPath, content);
      case 'list':
        return this.listDirectory(resolvedPath);
      case 'exists':
        return this.checkExists(resolvedPath);
      case 'mkdir':
        return this.makeDirectory(resolvedPath);
      case 'delete':
        return this.deleteFile(resolvedPath);
      case 'append':
        return this.appendFile(resolvedPath, content);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  private async readFile(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        return JSON.stringify(await fs.readdir(filePath));
      }
      
      if (stats.size > 1024 * 1024) {
        return `Error: File too large (${stats.size} bytes). Maximum file size is 1MB.`;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`;
      }
      return `Error reading file: ${error.message}`;
    }
  }
  
  private async writeFile(filePath: string, content: string): Promise<string> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `Successfully wrote to ${filePath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }
  
  private async appendFile(filePath: string, content: string): Promise<string> {
    try {
      await fs.appendFile(filePath, content, 'utf-8');
      return `Successfully appended to ${filePath}`;
    } catch (error: any) {
      return `Error appending to file: ${error.message}`;
    }
  }
  
  private async listDirectory(dirPath: string): Promise<string> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `Error: Directory not found: ${dirPath}`;
      }
      return `Error listing directory: ${error.message}`;
    }
  }
  
  private async checkExists(filePath: string): Promise<string> {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      return JSON.stringify({
        exists: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      });
    } catch {
      return JSON.stringify({ exists: false });
    }
  }
  
  private async makeDirectory(dirPath: string): Promise<string> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return `Successfully created directory: ${dirPath}`;
    } catch (error: any) {
      return `Error creating directory: ${error.message}`;
    }
  }
  
  private async deleteFile(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
      return `Successfully deleted: ${filePath}`;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`;
      }
      return `Error deleting: ${error.message}`;
    }
  }
}
