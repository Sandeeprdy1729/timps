import { PERMISSIONS, PluginCapabilities } from './types';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'data' | 'ui';
  dangerous?: boolean;
}

export const ALLOWLISTED_PERMISSIONS: Permission[] = [
  { id: 'storage:get', name: 'Get Storage', description: 'Read from plugin storage', category: 'data' },
  { id: 'storage:set', name: 'Set Storage', description: 'Write to plugin storage', category: 'data' },
  { id: 'storage:delete', name: 'Delete Storage', description: 'Delete from plugin storage', category: 'data' },
  { id: 'clipboard:read', name: 'Read Clipboard', description: 'Read clipboard contents', category: 'api' },
  { id: 'clipboard:write', name: 'Write Clipboard', description: 'Write to clipboard', category: 'api' },
  { id: 'notifications:show', name: 'Show Notifications', description: 'Show system notifications', category: 'api', dangerous: true },
  { id: 'http:request', name: 'HTTP Requests', description: 'Make HTTP requests', category: 'api', dangerous: true },
  { id: 'shell:open', name: 'Open External', description: 'Open external URLs', category: 'api', dangerous: true },
  { id: 'dialog:open', name: 'Open Dialog', description: 'Open file dialogs', category: 'api' },
  { id: 'menu:add', name: 'Add Menu', description: 'Add menu items', category: 'ui' },
  { id: 'panel:add', name: 'Add Panel', description: 'Add side panels', category: 'ui' },
  { id: 'shortcuts:register', name: 'Register Shortcuts', description: 'Register keyboard shortcuts', category: 'ui' },
  { id: 'ipc:send', name: 'IPC Send', description: 'Send IPC messages', category: 'api' },
  { id: 'ipc:receive', name: 'IPC Receive', description: 'Receive IPC messages', category: 'api' },
  { id: 'window:minimize', name: 'Minimize Window', description: 'Minimize window', category: 'api' },
  { id: 'window:maximize', name: 'Maximize Window', description: 'Maximize window', category: 'api' },
  { id: 'window:close', name: 'Close Window', description: 'Close window', category: 'api' },
  { id: 'system:info', name: 'System Info', description: 'Get system information', category: 'api' },
  { id: 'tray:add', name: 'Add System Tray', description: 'Add system tray icon', category: 'api' },
];

export class PermissionManager {
  private granted: Map<string, Set<string>> = new Map();

  grant(pluginId: string, permission: string): void {
    if (!this.granted.has(pluginId)) {
      this.granted.set(pluginId, new Set());
    }
    this.granted.get(pluginId)!.add(permission);
  }

  revoke(pluginId: string, permission: string): void {
    this.granted.get(pluginId)?.delete(permission);
  }

  revokeAll(pluginId: string): void {
    this.granted.delete(pluginId);
  }

  has(pluginId: string, permission: string): boolean {
    const pluginPermissions = this.granted.get(pluginId);
    if (!pluginPermissions) return false;
    if (pluginPermissions.has('*')) return true;
    return pluginPermissions.has(permission);
  }

  getGranted(pluginId: string): string[] {
    return Array.from(this.granted.get(pluginId) || []);
  }

  getAll(): Map<string, string[]> {
    const result: Map<string, string[]> = new Map();
    this.granted.forEach((permissions, pluginId) => {
      result.set(pluginId, Array.from(permissions));
    });
    return result;
  }

  request(
    pluginId: string,
    requested: string[],
    onResult: (granted: string[], denied: string[]) => void
  ): void {
    const granted: string[] = [];
    const denied: string[] = [];

    requested.forEach(permission => {
      const permDef = ALLOWLISTED_PERMISSIONS.find(p => p.id === permission);
      if (permDef?.dangerous) {
        denied.push(permission);
      } else {
        this.grant(pluginId, permission);
        granted.push(permission);
      }
    });

    onResult(granted, denied);
  }
}

export class PluginSecurityPolicy {
  private static instance: PluginSecurityPolicy;
  private policy: Map<string, PluginCapabilities> = new Map();
  private blocked: Set<string> = new Set();

  static getInstance(): PluginSecurityPolicy {
    if (!PluginSecurityPolicy.instance) {
      PluginSecurityPolicy.instance = new PluginSecurityPolicy();
    }
    return PluginSecurityPolicy.instance;
  }

  setPolicy(pluginId: string, capabilities: PluginCapabilities): void {
    this.policy.set(pluginId, capabilities);
  }

  getPolicy(pluginId: string): PluginCapabilities | undefined {
    return this.policy.get(pluginId);
  }

  block(pluginId: string, reason?: string): void {
    this.blocked.add(pluginId);
    console.warn(`Plugin ${pluginId} blocked: ${reason || 'Security policy violation'}`);
  }

  unblock(pluginId: string): void {
    this.blocked.delete(pluginId);
  }

  isBlocked(pluginId: string): boolean {
    return this.blocked.has(pluginId);
  }

  canAccess(pluginId: string, capability: string): boolean {
    if (this.isBlocked(pluginId)) return false;

    const policy = this.getPolicy(pluginId);
    if (!policy) return false;

    if (capability.startsWith('ui.')) {
      return policy.ui?.[capability.replace('ui.', '') as keyof typeof policy.ui] ?? false;
    }
    if (capability.startsWith('api.')) {
      return policy.api?.[capability.replace('api.', '') as keyof typeof policy.api] ?? false;
    }
    if (capability.startsWith('data.')) {
      return policy.data?.[capability.replace('data.', '') as keyof typeof policy.data] ?? false;
    }

    return false;
  }

  validateManifest(manifest: { id: string; capabilities?: PluginCapabilities }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.id) {
      errors.push('Plugin ID is required');
    }

    if (manifest.capabilities?.api?.network && !manifest.capabilities?.api?.http) {
      errors.push('Network capability requires http permission');
    }

    if (manifest.capabilities?.api?.systemTray) {
      errors.push('System tray requires explicit permission');
    }

    return { valid: errors.length === 0, errors };
  }
}

export const permissionManager = new PermissionManager();
export const securityPolicy = PluginSecurityPolicy.getInstance();

export default { permissionManager, securityPolicy };