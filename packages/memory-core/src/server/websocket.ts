import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { MemoryEngine } from '../MemoryEngine';

export interface WsClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

export type WsEvent =
  | { type: 'memory_stored'; userId: string; payload: Record<string, unknown> }
  | { type: 'memory_recalled'; userId: string; payload: Record<string, unknown> }
  | { type: 'insight'; userId: string; payload: Record<string, unknown> }
  | { type: 'contradiction'; userId: string; payload: Record<string, unknown> }
  | { type: 'error'; userId: string; payload: { message: string } }
  | { type: 'connected'; userId: string }
  | { type: 'decay_complete'; userId: string; payload: { entriesPruned: number } }
  | { type: 'conflict_detected'; userId: string; payload: Record<string, unknown> }
  | { type: 'conflict_resolved'; userId: string; payload: Record<string, unknown> }
  | { type: 'agent_joined'; userId: string; payload: Record<string, unknown> }
  | { type: 'agent_left'; userId: string; payload: Record<string, unknown> }
  | { type: 'project_event'; userId: string; payload: Record<string, unknown> };

export class MemoryWsServer {
  private wss: WebSocketServer;
  private clients = new Map<string, WsClient>();
  private engine: MemoryEngine;

  constructor(server: any, engine: MemoryEngine, path = '/ws') {
    this.engine = engine;
    this.wss = new WebSocketServer({ server, path });
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const userId = url.searchParams.get('userId') ?? 'anonymous';
    const token = url.searchParams.get('token');

    if (!token || !this.verifyToken(token, userId)) {
      ws.close(4001, 'Unauthorized: missing or invalid token');
      return;
    }

    const client: WsClient = { ws, userId, subscriptions: new Set(['all']) };
    this.clients.set(userId, client);

    ws.send(JSON.stringify({ type: 'connected', userId, timestamp: Date.now() }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.channel) {
          client.subscriptions.add(msg.channel);
        }
        if (msg.type === 'unsubscribe' && msg.channel) {
          client.subscriptions.delete(msg.channel);
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
      }
    });

    ws.on('close', () => {
      this.clients.delete(userId);
    });

    ws.on('error', () => {
      this.clients.delete(userId);
    });
  }

  private verifyToken(token: string, _userId: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;
      return payload.userId === _userId || !payload.userId;
    } catch {
      return false;
    }
  }

  broadcast(event: WsEvent): void {
    const msg = JSON.stringify(event);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (client.userId === event.userId || client.subscriptions.has('all')) {
          client.ws.send(msg);
        }
      }
    }
  }

  sendToUser(userId: string, event: WsEvent): void {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(event));
    }
  }

  getConnectedUserIds(): string[] {
    return Array.from(this.clients.keys());
  }

  close(): void {
    this.wss.close();
  }
}
