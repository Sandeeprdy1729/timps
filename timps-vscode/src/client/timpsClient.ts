import * as vscode from 'vscode';

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('timps');
  return {
    serverUrl: cfg.get<string>('serverUrl', 'http://localhost:4100'),
    memoryServerUrl: cfg.get<string>('memoryServerUrl', 'http://localhost:4100'),
    userId: cfg.get<number>('userId', 1),
    token: cfg.get<string>('token', ''),
  };
}

interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  tags: string[];
  confidence: number;
  timestamp: string;
  source?: string;
  actorId?: string;
}

interface RecallResult {
  entries: MemoryEntry[];
  total: number;
}

interface ContradictionResult {
  hasContradiction: boolean;
  confidence: number;
  evidence?: string[];
  entries?: MemoryEntry[];
}

function makeHeaders(): Record<string, string> {
  const { token } = getConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export class TimpsClient {
  private async request(path: string, method: string, body?: object): Promise<any> {
    const { serverUrl } = getConfig();
    const url = new URL(serverUrl + path);
    const data = body ? JSON.stringify(body) : undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: makeHeaders(),
        body: data,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`TIMPS ${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async recall(query: string, options?: { limit?: number; type?: string; minConfidence?: number }): Promise<MemoryEntry[]> {
    try {
      const res = await this.request('/api/memory/recall', 'POST', {
        query,
        limit: options?.limit ?? 10,
        type: options?.type,
        minConfidence: options?.minConfidence ?? 0.3,
        userId: getConfig().userId,
        projectId: vscode.workspace.name || 'default',
      });
      return res?.entries || [];
    } catch {
      return [];
    }
  }

  async store(params: { content: string; type?: string; tags?: string[]; source?: string }): Promise<boolean> {
    try {
      await this.request('/api/memory/store', 'POST', {
        content: params.content,
        type: params.type || 'observation',
        tags: params.tags || [],
        source: params.source || 'vscode-extension',
        userId: getConfig().userId,
        projectId: vscode.workspace.name || 'default',
      });
      return true;
    } catch {
      return false;
    }
  }

  async checkContradiction(statement: string): Promise<ContradictionResult | null> {
    try {
      return await this.request('/api/memory/contradiction', 'POST', {
        statement,
        projectId: vscode.workspace.name || 'default',
      });
    } catch {
      return null;
    }
  }

  async getStats(): Promise<{ total: number; layers: number; contradictions: number; velocity: number } | null> {
    try {
      return await this.request('/api/memory/stats', 'GET');
    } catch {
      return null;
    }
  }

  async getContext(filePath?: string, cursorLine?: number): Promise<MemoryEntry[]> {
    try {
      const res = await this.request('/api/memory/context', 'POST', {
        filePath: filePath || vscode.window.activeTextEditor?.document.uri.fsPath || '',
        cursorLine: cursorLine ?? vscode.window.activeTextEditor?.selection.active.line ?? 0,
        projectId: vscode.workspace.name || 'default',
      });
      return res?.entries || [];
    } catch {
      return [];
    }
  }

  async recordEdit(params: { filePath: string; content: string; language: string }): Promise<boolean> {
    try {
      await this.request('/api/episodic/record', 'POST', {
        filePath: params.filePath,
        content: params.content,
        language: params.language,
        projectId: vscode.workspace.name || 'default',
      });
      return true;
    } catch {
      return false;
    }
  }
}
