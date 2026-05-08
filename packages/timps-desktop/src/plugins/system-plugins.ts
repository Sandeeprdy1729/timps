import { PluginManifest, PluginCapabilities } from './types';
import { Plugin } from '../core/types';

export class FileSystemPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/filesystem',
    name: 'File System',
    version: '1.0.0',
    description: 'File system operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['filesystem', 'files', 'storage'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      filesystem: true,
    },
  };

  private watchCallbacks: Map<string, () => void> = new Map();

  async readFile(path: string): Promise<string> {
    const response = await fetch(`file://${path}`);
    return response.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    console.log(`Writing to: ${path}`);
  }

  async readDir(path: string): Promise<string[]> {
    return [];
  }

  async createDir(path: string): Promise<void> {
    console.log(`Creating directory: ${path}`);
  }

  async deleteFile(path: string): Promise<void> {
    console.log(`Deleting: ${path}`);
  }

  async exists(path: string): Promise<boolean> {
    return false;
  }

  async stat(path: string): Promise<{ size: number; mtime: Date; isDirectory: boolean } | null> {
    return null;
  }

  async watch(path: string, callback: () => void): string {
    const id = `watch-${Date.now()}`;
    this.watchCallbacks.set(id, callback);
    return id;
  }

  async unwatch(id: string): void {
    this.watchCallbacks.delete(id);
  }

  async copy(src: string, dest: string): Promise<void> {
    console.log(`Copying ${src} to ${dest}`);
  }

  async move(src: string, dest: string): Promise<void> {
    console.log(`Moving ${src} to ${dest}`);
  }

  async getTempPath(): Promise<string> {
    return '/tmp';
  }

  async download(url: string, destination: string): Promise<void> {
    console.log(`Downloading ${url} to ${destination}`);
  }

  async hash(path: string): Promise<string> {
    return 'hash';
  }
}

export class NetworkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/network',
    name: 'Network Tools',
    version: '1.0.0',
    description: 'Network utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['network', 'http', 'fetch'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      network: true,
    },
  };

  async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    return response.json();
  }

  async ping(host: string): Promise<boolean> {
    return true;
  }

  async getPublicIP(): Promise<string> {
    return '127.0.0.1';
  }

  async getLocalIPs(): Promise<string[]> {
    return ['127.0.0.1'];
  }

  async checkPort(host: string, port: number): Promise<boolean> {
    return true;
  }

  async downloadProgress(url: string, onProgress: (received: number, total: number) => void): Promise<void> {
    onProgress(0, 0);
  }

  async requestWithRetry<T>(url: string, retries = 3): Promise<T> {
    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        return await this.fetch<T>(url);
      } catch (error) {
        lastError = error as Error;
      }
    }
    throw lastError;
  }
}

export class ProcessPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/process',
    name: 'Process Manager',
    version: '1.0.0',
    description: 'Process and system utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['process', 'system', 'monitoring'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      ipc: true,
    },
  };

  async list(): Promise<Array<{ pid: number; name: string; cpu: number; memory: number }>> {
    return [];
  }

  async kill(pid: number): Promise<void> {
    console.log(`Killing process: ${pid}`);
  }

  async spawn(command: string, args?: string[]): Promise<number> {
    console.log(`Spawning: ${command}`);
    return Date.now();
  }

  async exec(command: string): Promise<string> {
    console.log(`Executing: ${command}`);
    return '';
  }

  async getInfo(): Promise<{ platform: string; arch: string; cpus: number; memory: number }> {
    return {
      platform: 'darwin',
      arch: 'x64',
      cpus: 4,
      memory: 8 * 1024 * 1024 * 1024,
    };
  }

  async getUptime(): Promise<number> {
    return Date.now();
  }

  async getLoadAverage(): Promise<number[]> {
    return [0, 0, 0];
  }
}

export class WindowPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/window',
    name: 'Window Manager',
    version: '1.0.0',
    description: 'Window management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['window', 'ui', 'management'],
  };

  public capabilities: PluginCapabilities = {};

  async minimize(): Promise<void> {
    console.log('Minimizing window');
  }

  async maximize(): Promise<void> {
    console.log('Maximizing window');
  }

  async restore(): Promise<void> {
    console.log('Restoring window');
  }

  async close(): Promise<void> {
    console.log('Closing window');
  }

  async setTitle(title: string): Promise<void> {
    document.title = title;
  }

  async setFullScreen(fullscreen: boolean): Promise<void> {
    console.log(`Fullscreen: ${fullscreen}`);
  }

  async getSize(): Promise<{ width: number; height: number }> {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  async getPosition(): Promise<{ x: number; y: number }> {
    return { x: 0, y: 0 };
  }

  async setAlwaysOnTop(flag: boolean): Promise<void> {
    console.log(`Always on top: ${flag}`);
  }
}

export class MenuPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/menu',
    name: 'Menu Manager',
    version: '1.0.0',
    description: 'Application menu management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['menu', 'context-menu', 'application-menu'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      menu: true,
    },
  };

  private menus: Map<string, Array<{ id: string; label: string; action: () => void }>> = new Map();

  async createMenu(id: string, items: Array<{ id: string; label: string; action?: () => void; divider?: boolean }>): Promise<void> {
    this.menus.set(id, items.map(i => ({ id: i.id, label: i.label, action: i.action || (() => {}) })));
  }

  async removeMenu(id: string): Promise<void> {
    this.menus.delete(id);
  }

  async showMenu(id: string, x: number, y: number): Promise<void> {
    console.log(`Showing menu ${id} at ${x},${y}`);
  }

  async addMenuItem(menuId: string, item: { id: string; label: string; action: () => void }): Promise<void> {
    const items = this.menus.get(menuId) || [];
    items.push(item);
    this.menus.set(menuId, items);
  }

  async removeMenuItem(menuId: string, itemId: string): Promise<void> {
    const items = this.menus.get(menuId);
    if (items) {
      this.menus.set(menuId, items.filter(i => i.id !== itemId));
    }
  }
}

export class DialogPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/dialog',
    name: 'Dialog Manager',
    version: '1.0.0',
    description: 'Native dialog management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['dialog', 'file-dialog', 'folder-picker'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      dialog: true,
    },
  };

  async openFile(options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }): Promise<string[]> {
    return [];
  }

  async openFolder(options?: { title?: string }): Promise<string | null> {
    return null;
  }

  async saveFile(options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null> {
    return null;
  }

  async message(title: string, message: string, type?: 'info' | 'warning' | 'error'): Promise<void> {
    console.log(`${title}: ${message}`);
  }

  async confirm(title: string, message: string): Promise<boolean> {
    return true;
  }

  async input(title: string, message: string, defaultValue?: string): Promise<string | null> {
    return defaultValue || null;
  }
}

export class TrayPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tray',
    name: 'System Tray',
    version: '1.0.0',
    description: 'System tray integration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tray', 'system-tray', 'notification-area'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      systemTray: true,
    },
  };

  async create(icon: string, tooltip?: string): Promise<string> {
    console.log(`Creating tray: ${icon}`);
    return 'tray-id';
  }

  async setTooltip(trayId: string, tooltip: string): Promise<void> {
    console.log(`Setting tooltip: ${tooltip}`);
  }

  async setIcon(trayId: string, icon: string): Promise<void> {
    console.log(`Setting icon: ${icon}`);
  }

  async setMenu(trayId: string, items: Array<{ id: string; label: string; action?: () => void }>): Promise<void> {
    console.log(`Setting menu for tray`);
  }

  async destroy(trayId: string): Promise<void> {
    console.log(`Destroying tray: ${trayId}`);
  }

  async showBalloon(trayId: string, title: string, content: string): Promise<void> {
    console.log(`Showing balloon: ${title}`);
  }
}

export class ShortcutPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/shortcuts',
    name: 'Keyboard Shortcuts',
    version: '1.0.0',
    description: 'Keyboard shortcut management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['shortcut', 'hotkey', 'keyboard'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      globalShortcuts: true,
    },
  };

  private shortcuts: Map<string, () => void> = new Map();

  async register(key: string, callback: () => void, description?: string): Promise<void> {
    console.log(`Registering shortcut: ${key}`);
    this.shortcuts.set(key, callback);
  }

  async unregister(key: string): Promise<void> {
    this.shortcuts.delete(key);
  }

  async unregisterAll(): Promise<void> {
    this.shortcuts.clear();
  }

  async isRegistered(key: string): Promise<boolean> {
    return this.shortcuts.has(key);
  }

  async getRegistered(): Promise<string[]> {
    return Array.from(this.shortcuts.keys());
  }
}

export const filesystemPlugin = new FileSystemPlugin();
export const networkPlugin = new NetworkPlugin();
export const processPlugin = new ProcessPlugin();
export const windowPlugin = new WindowPlugin();
export const menuPlugin = new MenuPlugin();
export const dialogPlugin = new DialogPlugin();
export const trayPlugin = new TrayPlugin();
export const shortcutPlugin = new ShortcutPlugin();

export function registerSystemPlugins(): Plugin[] {
  return [
    filesystemPlugin,
    networkPlugin,
    processPlugin,
    windowPlugin,
    menuPlugin,
    dialogPlugin,
    trayPlugin,
    shortcutPlugin,
  ];
}