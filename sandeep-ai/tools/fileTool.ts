import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { BaseTool, ToolParameter } from './baseTool';

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
    
    switch (operation) {
      case 'read':
        return this.readFile(filePath);
      case 'write':
        return this.writeFile(filePath, content);
      case 'list':
        return this.listDirectory(filePath);
      case 'exists':
        return this.checkExists(filePath);
      case 'mkdir':
        return this.makeDirectory(filePath);
      case 'delete':
        return this.deleteFile(filePath);
      case 'append':
        return this.appendFile(filePath, content);
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
