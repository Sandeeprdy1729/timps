"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTool = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const baseTool_1 = require("./baseTool");
class FileTool extends baseTool_1.BaseTool {
    name = 'file_operations';
    description = 'Perform file operations including reading, writing, listing directories, and checking file existence. Use this tool when you need to work with files on the local filesystem.';
    parameters = {
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
    async execute(params) {
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
    async readFile(filePath) {
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
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return `Error: File not found: ${filePath}`;
            }
            return `Error reading file: ${error.message}`;
        }
    }
    async writeFile(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            return `Successfully wrote to ${filePath}`;
        }
        catch (error) {
            return `Error writing file: ${error.message}`;
        }
    }
    async appendFile(filePath, content) {
        try {
            await fs.appendFile(filePath, content, 'utf-8');
            return `Successfully appended to ${filePath}`;
        }
        catch (error) {
            return `Error appending to file: ${error.message}`;
        }
    }
    async listDirectory(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const result = entries.map(entry => ({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile(),
            }));
            return JSON.stringify(result, null, 2);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return `Error: Directory not found: ${dirPath}`;
            }
            return `Error listing directory: ${error.message}`;
        }
    }
    async checkExists(filePath) {
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
        }
        catch {
            return JSON.stringify({ exists: false });
        }
    }
    async makeDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return `Successfully created directory: ${dirPath}`;
        }
        catch (error) {
            return `Error creating directory: ${error.message}`;
        }
    }
    async deleteFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                await fs.rm(filePath, { recursive: true });
            }
            else {
                await fs.unlink(filePath);
            }
            return `Successfully deleted: ${filePath}`;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return `Error: File not found: ${filePath}`;
            }
            return `Error deleting: ${error.message}`;
        }
    }
}
exports.FileTool = FileTool;
//# sourceMappingURL=fileTool.js.map