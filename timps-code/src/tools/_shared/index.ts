import * as path from 'node:path';
import type { ToolDefinition, RiskLevel } from '../../config/types.js';

export interface ToolExecResult {
  content: string;
  isError: boolean;
  filesModified?: string[];
}

export interface RegisteredTool {
  definition: ToolDefinition;
  risk: RiskLevel;
  execute: (args: Record<string, unknown>, cwd: string) => Promise<ToolExecResult>;
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

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

export function resolvePath(filePath: string, cwd: string): string {
  const cwdAbs = path.resolve(cwd);
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(cwdAbs, filePath);
  if (!resolved.startsWith(cwdAbs + path.sep) && resolved !== cwdAbs) {
    throw new Error(`Path traversal denied: ${filePath} is outside working directory`);
  }
  return resolved;
}

const PRIVATE_HOSTS = ['169.254.169.254', '127.0.0.1', '0.0.0.0', 'localhost', 'metadata.google.internal', '100.100.100.200'];
const PRIVATE_RANGES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];

export function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (PRIVATE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) return true;
    if (PRIVATE_RANGES.some(range => hostname.startsWith(range))) return true;
    return false;
  } catch {
    return true;
  }
}
