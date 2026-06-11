// Real-time event bus — broadcasts tool activations to SSE clients
import { Response } from 'express';

export interface TIMPsEvent {
  type: 'contradiction' | 'burnout' | 'bug_warning' | 'memory_stored' |
        'commitment_added' | 'relationship_drift' | 'regret_warning' |
        'tool_activated' | 'chat_message' | 'chronos_event' | 'nexus_event' | 'synapse_event';
  userId: number;
  payload: Record<string, any>;
  timestamp: string;
}

class EventBus {
  private clients = new Map<number, Set<Response>>();

  subscribe(userId: number, res: Response): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(res);
    res.on('close', () => this.unsubscribe(userId, res));
  }

  unsubscribe(userId: number, res: Response): void {
    this.clients.get(userId)?.delete(res);
  }

  emit(event: TIMPsEvent): void {
    const clients = this.clients.get(event.userId);
    if (!clients?.size) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    clients.forEach(res => {
      try { res.write(data); } catch { this.unsubscribe(event.userId, res); }
    });
  }

  // Broadcast to all connected clients (for system events)
  broadcast(event: Omit<TIMPsEvent, 'userId'>): void {
    this.clients.forEach((clients, userId) => {
      this.emit({ ...event, userId });
    });
  }
}

export const eventBus = new EventBus();