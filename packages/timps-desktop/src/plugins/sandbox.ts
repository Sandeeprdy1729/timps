import { PluginSettings } from './store';

export interface PluginSandboxConfig {
  id: string;
  version: string;
  enabled: boolean;
  capabilities: string[];
}

export interface SandboxAPI {
  console: Console;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  fetch: typeof fetch;
  atob: typeof atob;
  btoa: typeof btoa;
  Math: typeof Math;
  Date: typeof Date;
  JSON: typeof JSON;
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  localStorage: GlobalStorage;
  sessionStorage: GlobalStorage;
  location: Location;
  history: History;
  navigator: Navigator;
}

interface GlobalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  get length(): number;
  key(index: number): string | null;
}

type SandboxFunction = (...args: unknown[]) => unknown;

export class PluginSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private config: PluginSandboxConfig;
  private allowedAPIs: Set<string> = new Set();

  constructor(config: PluginSandboxConfig) {
    this.config = config;
    this.initializeAllowedAPIs();
  }

  private initializeAllowedAPIs(): void {
    const defaultAPIs = [
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'Date',
      'Math',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Map',
      'Set',
      'Promise',
    ];

    if (this.config.capabilities.includes('storage')) {
      defaultAPIs.push('localStorage', 'sessionStorage');
    }

    if (this.config.capabilities.includes('network')) {
      defaultAPIs.push('fetch', 'atob', 'btoa');
    }

    defaultAPIs.forEach(api => this.allowedAPIs.add(api));
  }

  create(): HTMLIFrameElement {
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('sandbox', 'allow-scripts');
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('data-plugin-id', this.config.id);
    document.body.appendChild(this.iframe);
    return this.iframe;
  }

  destroy(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  execute(code: string): unknown {
    if (!this.iframe) {
      throw new Error('Sandbox not initialized');
    }

    const iframeWindow = this.iframe.contentWindow;
    if (!iframeWindow) {
      throw new Error('Cannot access iframe window');
    }

    const fn = new iframeWindow.Function(code);
    return fn();
  }

  executeAsync(code: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.execute(code);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  postMessage(message: unknown): void {
    if (!this.iframe?.contentWindow) {
      throw new Error('Sandbox not initialized');
    }
    this.iframe.contentWindow.postMessage(message, '*');
  }

  isAllowedAPI(api: string): boolean {
    return this.allowedAPIs.has(api);
  }

  addAllowedAPI(api: string): void {
    this.allowedAPIs.add(api);
  }

  removeAllowedAPI(api: string): void {
    this.allowedAPIs.delete(api);
  }
}

export class SandboxManager {
  private sandboxes: Map<string, PluginSandbox> = new Map();
  private config: PluginSandboxConfig;

  constructor(config: PluginSandboxConfig) {
    this.config = config;
  }

  createSandbox(pluginId: string): PluginSandbox {
    const sandbox = new PluginSandbox({
      ...this.config,
      id: pluginId,
    });
    this.sandboxes.set(pluginId, sandbox);
    return sandbox;
  }

  getSandbox(pluginId: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginId);
  }

  destroySandbox(pluginId: string): void {
    const sandbox = this.sandboxes.get(pluginId);
    if (sandbox) {
      sandbox.destroy();
      this.sandboxes.delete(pluginId);
    }
  }

  destroyAll(): void {
    for (const sandbox of this.sandboxes.values()) {
      sandbox.destroy();
    }
    this.sandboxes.clear();
  }

  hasSandbox(pluginId: string): boolean {
    return this.sandboxes.has(pluginId);
  }
}

export default PluginSandbox;