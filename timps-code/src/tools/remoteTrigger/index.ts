import type { RegisteredTool } from '../../tools/tools.js';

interface RemoteTrigger {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
}

const triggers = new Map<string, RemoteTrigger>();

export const remoteTriggerTool: RegisteredTool = {
  definition: {
    name: 'remote_trigger',
    description: 'Manage scheduled remote agent triggers. List, get, create, update, or run remote triggers.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: list, get, create, update, run', enum: ['list', 'get', 'create', 'update', 'run'] },
        trigger_id: { type: 'string', description: 'Required for get, update, and run actions' },
        body: { type: 'object', description: 'JSON body for create and update actions' },
      },
      required: ['action'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const action = String(args.action);
    const triggerId = args.trigger_id ? String(args.trigger_id) : undefined;
    const body = args.body as Record<string, unknown> | undefined;
    switch (action) {
      case 'list': {
        const all = Array.from(triggers.values());
        if (all.length === 0) return { content: 'No triggers found', isError: false };
        const lines = all.map(t => `${t.id} | ${t.name} | ${t.schedule} | ${t.enabled ? 'enabled' : 'disabled'}`);
        return { content: 'Triggers:\n' + lines.join('\n'), isError: false };
      }
      case 'get': {
        if (!triggerId) return { content: 'get requires trigger_id', isError: true };
        const t = triggers.get(triggerId);
        if (!t) return { content: `Trigger not found: ${triggerId}`, isError: true };
        return { content: `ID: ${t.id}\nName: ${t.name}\nSchedule: ${t.schedule}\nEnabled: ${t.enabled}`, isError: false };
      }
      case 'create': {
        if (!body) return { content: 'create requires body', isError: true };
        const id = `trigger_${Date.now()}`;
        const trigger: RemoteTrigger = {
          id,
          name: String(body.name || 'Unnamed'),
          schedule: String(body.schedule || ''),
          enabled: true,
        };
        triggers.set(id, trigger);
        return { content: `Created trigger ${id}: ${trigger.name}`, isError: false };
      }
      case 'update': {
        if (!triggerId || !body) return { content: 'update requires trigger_id and body', isError: true };
        const t = triggers.get(triggerId);
        if (!t) return { content: `Trigger not found: ${triggerId}`, isError: true };
        if (body.name) t.name = String(body.name);
        if (body.schedule) t.schedule = String(body.schedule);
        if (typeof body.enabled === 'boolean') t.enabled = body.enabled;
        triggers.set(triggerId, t);
        return { content: `Updated trigger ${triggerId}`, isError: false };
      }
      case 'run': {
        if (!triggerId) return { content: 'run requires trigger_id', isError: true };
        const t = triggers.get(triggerId);
        if (!t) return { content: `Trigger not found: ${triggerId}`, isError: true };
        return { content: `Trigger ${triggerId} ("${t.name}") executed`, isError: false };
      }
      default:
        return { content: `Unknown action: ${action}`, isError: true };
    }
  },
};