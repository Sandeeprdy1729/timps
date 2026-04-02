import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('timps');
  return {
    serverUrl: cfg.get<string>('serverUrl', 'https://timps-api.onrender.com'),
    userId: cfg.get<number>('userId', 1),
  };
}

export class TimpsClient {
  private request(path: string, method: string, body?: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const { serverUrl } = getConfig();
      const url = new URL(serverUrl + '/api' + path);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const data = body ? JSON.stringify(body) : undefined;
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        timeout: 8000,
      };

      const req = lib.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(null); }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('TIMPs request timed out')); });
      if (data) req.write(data);
      req.end();
    });
  }

  async addMemory(params: {
    projectId: string;
    content: string;
    memory_type: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const { userId } = getConfig();
    return this.request('/chat', 'POST', {
      userId,
      message: `Store memory [${params.memory_type}]: ${params.content.slice(0, 300)}`,
    });
  }

  async retrieveMemories(params: {
    projectId: string;
    query: string;
    limit?: number;
  }): Promise<any[]> {
    const { userId } = getConfig();
    const res = await this.request(`/memory/${userId}`, 'GET');
    return res?.memories || [];
  }
}
