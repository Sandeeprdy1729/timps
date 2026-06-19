// TIMPS Code — LSP Tool
// Language Server Protocol tool for code intelligence

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RegisteredTool, ToolExecutor } from '../../tools/tools.js';
import {
  initializeLsp,
  isLspConnected,
  getLspServerManager,
} from '../../services/lsp/manager.js';

export interface LspOperation {
  operation: 'goToDefinition' | 'findReferences' | 'hover' | 'documentSymbol' | 'workspaceSymbol' | 'goToImplementation';
  filePath: string;
  line: number;
  character: number;
}

export const lspTool: RegisteredTool = {
  definition: {
    name: 'lsp',
    description: 'Perform LSP operations: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation. Requires LSP servers to be installed.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['goToDefinition', 'findReferences', 'hover', 'documentSymbol', 'workspaceSymbol', 'goToImplementation'],
          description: 'The LSP operation to perform',
        },
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file',
        },
        line: {
          type: 'number',
          description: 'Line number (1-based)',
        },
        character: {
          type: 'number',
          description: 'Character position (1-based)',
        },
      },
      required: ['operation', 'filePath', 'line', 'character'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    const input = args as unknown as LspOperation;
    const absolutePath = path.isAbsolute(input.filePath) 
      ? input.filePath 
      : path.resolve(cwd, input.filePath);

    if (!isLspConnected()) {
      try {
        await initializeLsp(cwd);
      } catch (err) {
        return { content: `LSP server not connected. ${(err as Error).message}`, isError: true };
      }
    }

    const manager = getLspServerManager();
    if (!manager) {
      return { content: 'LSP server manager not initialized.', isError: true };
    }

    try {
      const result = await executeLspOperation(manager, input, absolutePath);
      return { content: result, isError: false };
    } catch (err) {
      return { content: `LSP operation failed: ${(err as Error).message}`, isError: true };
    }
  },
};

interface LspLocation {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

interface HoverResult {
  contents: string | { kind: string; value: string };
}

interface SymbolInfo {
  name: string;
  kind: number;
  location: { uri: string; range: { start: { line: number } } };
}

async function executeLspOperation(
  manager: NonNullable<ReturnType<typeof getLspServerManager>>,
  input: LspOperation,
  absolutePath: string,
): Promise<string> {
  const uri = pathToFileURL(absolutePath).href;
  const position = { line: input.line - 1, character: input.character - 1 };

  if (!manager.isFileOpen(absolutePath)) {
    try {
      const content = await fs.promises.readFile(absolutePath, 'utf-8');
      await manager.openFile(absolutePath, content);
    } catch {
      // File might not exist, continue anyway
    }
  }

  switch (input.operation) {
    case 'goToDefinition': {
      const locations = await manager.sendRequest<LspLocation[]>(
        absolutePath,
        'textDocument/definition',
        { textDocument: { uri }, position },
      );
      if (!locations || locations.length === 0) {
        return 'No definitions found.';
      }
      return locations.map((loc: LspLocation) => {
        const locPath = loc.uri.replace('file://', '');
        const start = loc.range.start;
        return `${locPath}:${start.line + 1}:${start.character + 1}`;
      }).join('\n');
    }

    case 'findReferences': {
      const locations = await manager.sendRequest<LspLocation[]>(
        absolutePath,
        'textDocument/references',
        { textDocument: { uri }, position, context: { includeDeclaration: true } },
      );
      if (!locations || locations.length === 0) {
        return 'No references found.';
      }
      return locations.map((loc: LspLocation) => {
        const locPath = loc.uri.replace('file://', '');
        const start = loc.range.start;
        return `${locPath}:${start.line + 1}:${start.character + 1}`;
      }).join('\n');
    }

    case 'hover': {
      const result = await manager.sendRequest<HoverResult>(
        absolutePath,
        'textDocument/hover',
        { textDocument: { uri }, position },
      );
      if (!result || !result.contents) {
        return 'No hover information available.';
      }
      return typeof result.contents === 'string' ? result.contents : result.contents.value || '';
    }

    case 'documentSymbol': {
      const symbols = await manager.sendRequest<SymbolInfo[]>(
        absolutePath,
        'textDocument/documentSymbol',
        { textDocument: { uri } },
      );
      if (!symbols || symbols.length === 0) {
        return 'No symbols found in document.';
      }
      return symbols.map((s: SymbolInfo) => `${s.name} (kind: ${s.kind}) at line ${s.location.range.start.line + 1}`).join('\n');
    }

    case 'workspaceSymbol': {
      const symbols = await manager.sendRequest<SymbolInfo[]>(
        absolutePath,
        'workspace/symbol',
        { query: '' },
      );
      if (!symbols || symbols.length === 0) {
        return 'No symbols found in workspace.';
      }
      return symbols.slice(0, 50).map((s: SymbolInfo) => {
        const filePath = s.location.uri.replace('file://', '');
        return `${s.name} (${path.basename(filePath)})`;
      }).join('\n');
    }

    case 'goToImplementation': {
      const locations = await manager.sendRequest<LspLocation[]>(
        absolutePath,
        'textDocument/implementation',
        { textDocument: { uri }, position },
      );
      if (!locations || locations.length === 0) {
        return 'No implementations found.';
      }
      return locations.map((loc: LspLocation) => {
        const locPath = loc.uri.replace('file://', '');
        const start = loc.range.start;
        return `${locPath}:${start.line + 1}:${start.character + 1}`;
      }).join('\n');
    }

    default:
      return `Unknown operation: ${input.operation}`;
  }
}

// Extended tool executor (simpler mock for non-connected usage)
export const LSPTool: ToolExecutor = async (args) => {
  const { operation, path: filePath, line, column } = args as any;
  return {
    content: `[LSP] ${operation} at ${filePath}:${line}:${column}`,
    toolName: 'LSP',
  };
};