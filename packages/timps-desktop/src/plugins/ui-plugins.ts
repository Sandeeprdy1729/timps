import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class RouterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/router',
    name: 'Router',
    version: '1.0.0',
    description: 'Client-side routing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['router', 'navigation', 'route'],
  };

  public capabilities: PluginCapabilities = {
    ui: { commands: true },
  };

  private routes: Map<string, {
    path: string;
    component: unknown;
    name?: string;
    children?: Map<string, unknown>;
  }> = new Map();

  private currentPath = '';

  addRoute(options: {
    path: string;
    component: unknown;
    name?: string;
  }): void {
    this.routes.set(options.path, { path: options.path, component: options.component, name: options.name });
  }

  removeRoute(path: string): void {
    this.routes.delete(path);
  }

  navigate(path: string): void {
    this.currentPath = path;
    window.history.pushState({}, '', path);
  }

  getRoute(path: string): { component: unknown; name?: string } | undefined {
    return this.routes.get(path);
  }

  getCurrentPath(): string {
    return this.currentPath;
  }

  getRoutes(): Array<{ path: string; name?: string }> {
    return Array.from(this.routes.values()).map(r => ({ path: r.path, name: r.name }));
  }

  matchRoute(path: string): { component: unknown; params: Record<string, string> } | null {
    const route = this.routes.get(path);
    if (route) return { component: route.component, params: {} };

    for (const [routePath, routeData] of this.routes.entries()) {
      const paramMatch = routePath.match(/^([^:]+):(\w+)(.*)$/);
      if (paramMatch) {
        const pathMatch = path.match(new RegExp(`^${paramMatch[1]}(.+)$`));
        if (pathMatch) {
          return {
            component: routeData.component,
            params: { [paramMatch[2]]: pathMatch[1] },
          };
        }
      }
    }

    return null;
  }
}

export class NavigationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/navigation',
    name: 'Navigation',
    version: '1.0.0',
    description: 'Navigation and breadcrumb',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['navigation', 'breadcrumb', 'menu'],
  };

  public capabilities: PluginCapabilities = {
    ui: { sidebar: true },
  };

  private items: Array<{
    id: string;
    label: string;
    href?: string;
    icon?: string;
    children?: Array<{ id: string; label: string; href?: string }>;
  }> = [];

  addItem(item: {
    id: string;
    label: string;
    href?: string;
    icon?: string;
    children?: Array<{ id: string; label: string; href?: string }>;
  }): void {
    this.items.push(item);
  }

  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  getItems(): Array<{ id: string; label: string; href?: string }> {
    return this.items;
  }

  getBreadcrumb(path: string): Array<{ label: string; href?: string }> {
    const breadcrumb: Array<{ label: string; href?: string }> = [];

    for (const item of this.items) {
      if (item.href === path || item.children?.some(c => c.href === path)) {
        breadcrumb.push({ label: item.label, href: item.href });
        if (item.children) {
          const child = item.children.find(c => c.href === path);
          if (child) {
            breadcrumb.push({ label: child.label, href: child.href });
          }
        }
      }
    }

    return breadcrumb;
  }
}

export class SidebarPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sidebar',
    name: 'Sidebar Manager',
    version: '1.0.0',
    description: 'Sidebar navigation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sidebar', 'navigation', 'menu'],
  };

  public capabilities: PluginCapabilities = {
    ui: { sidebar: true },
  };

  private sections: Map<string, Array<{
    id: string;
    label: string;
    icon?: string;
    action?: () => void;
    divider?: boolean;
  }>> = new Map();

  addSection(id: string, items: Array<{
    id: string;
    label: string;
    icon?: string;
    action?: () => void;
    divider?: boolean;
  }>): void {
    this.sections.set(id, items);
  }

  removeSection(id: string): void {
    this.sections.delete(id);
  }

  getSections(): Array<{ id: string; items: Array<{ id: string; label: string }> }> {
    return Array.from(this.sections.entries()).map(([id, items]) => ({
      id,
      items: items.map(i => ({ id: i.id, label: i.label })),
    }));
  }

  toggle(): void {
    console.log('Toggle sidebar');
  }

  isOpen(): boolean {
    return true;
  }
}

export class TabsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tabs',
    name: 'Tabs Manager',
    version: '1.0.0',
    description: 'Tabbed interface',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tabs', 'tabbed', 'interface'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  private tabs: Map<string, {
    id: string;
    label: string;
    closable: boolean;
    active: boolean;
  }> = new Map();
  private activeTab: string | null = null;

  addTab(options: {
    id: string;
    label: string;
    closable?: boolean;
  }): void {
    this.tabs.set(options.id, {
      id: options.id,
      label: options.label,
      closable: options.closable ?? true,
      active: false,
    });
  }

  removeTab(id: string): void {
    this.tabs.delete(id);
    if (this.activeTab === id) {
      const tabs = Array.from(this.tabs.values());
      if (tabs.length > 0) {
        this.setActive(tabs[0].id);
      }
    }
  }

  setActive(id: string): void {
    for (const tab of this.tabs.values()) {
      tab.active = tab.id === id;
    }
    this.activeTab = id;
  }

  getActive(): string | null {
    return this.activeTab;
  }

  getTabs(): Array<{ id: string; label: string; closable: boolean; active: boolean }> {
    return Array.from(this.tabs.values());
  }
}

export class CommandPalettePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/command-palette',
    name: 'Command Palette',
    version: '1.0.0',
    description: 'Fuzzy command search',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['command', 'palette', 'fuzzy'],
  };

  public capabilities: PluginCapabilities = {
    ui: { commands: true },
  };

  private commands: Map<string, {
    id: string;
    name: string;
    description?: string;
    shortcut?: string;
    category?: string;
    action: () => void;
  }> = new Map();

  registerCommand(command: {
    id: string;
    name: string;
    description?: string;
    shortcut?: string;
    category?: string;
    action: () => void;
  }): void {
    this.commands.set(command.id, command);
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id);
  }

  getCommands(filter?: { category?: string }): Array<{
    id: string;
    name: string;
    description?: string;
    shortcut?: string;
  }> {
    let commands = Array.from(this.commands.values());

    if (filter?.category) {
      commands = commands.filter(c => c.category === filter.category);
    }

    return commands.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      shortcut: c.shortcut,
    }));
  }

  search(query: string): Array<{
    id: string;
    name: string;
    score: number;
  }> {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ id: string; name: string; score: number }> = [];

    for (const command of this.commands.values()) {
      const nameLower = command.name.toLowerCase();
      let score = 0;

      if (nameLower === lowerQuery) {
        score = 100;
      } else if (nameLower.startsWith(lowerQuery)) {
        score = 50;
      } else if (nameLower.includes(lowerQuery)) {
        score = 25;
      }

      if (score > 0) {
        results.push({ id: command.id, name: command.name, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  execute(id: string): void {
    const command = this.commands.get(id);
    if (command) {
      command.action();
    }
  }
}

export class ContextMenuPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/context-menu',
    name: 'Context Menu',
    version: '1.0.0',
    description: 'Context menu management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['context-menu', 'menu', 'right-click'],
  };

  public capabilities: PluginCapabilities = {
    ui: { contextMenu: true },
  };

  private menus: Map<string, Array<{
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    divider?: boolean;
    action?: () => void;
    submenu?: Array<{ id: string; label: string; action?: () => void }>;
  }>> = new Map();

  registerMenu(id: string, items: Array<{
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    divider?: boolean;
    action?: () => void;
    submenu?: Array<{ id: string; label: string; action?: () => void }>;
  }>): void {
    this.menus.set(id, items);
  }

  unregisterMenu(id: string): void {
    this.menus.delete(id);
  }

  showMenu(id: string, x: number, y: number): void {
    console.log(`Showing menu ${id} at ${x},${y}`);
  }

  hideMenu(): void {
    console.log('Hiding menu');
  }

  getMenu(id: string): Array<{ id: string; label: string }> | undefined {
    return this.menus.get(id)?.map(i => ({ id: i.id, label: i.label }));
  }
}

export class DropdownPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/dropdowns',
    name: 'Dropdowns',
    version: '1.0.0',
    description: 'Dropdown menu management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['dropdown', 'menu', 'popup'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  private dropdowns: Map<string, {
    trigger: string;
    items: Array<{ id: string; label: string; value?: string; action?: () => void }>;
    position: 'bottom-left' | 'bottom-right';
  }> = new Map();

  registerDropdown(id: string, config: {
    trigger: string;
    items: Array<{ id: string; label: string; value?: string; action?: () => void }>;
    position?: 'bottom-left' | 'bottom-right';
  }): void {
    this.dropdowns.set(id, {
      trigger: config.trigger,
      items: config.items,
      position: config.position || 'bottom-left',
    });
  }

  unregisterDropdown(id: string): void {
    this.dropdowns.delete(id);
  }

  toggle(id: string): void {
    const dropdown = this.dropdowns.get(id);
    if (dropdown) {
      console.log(`Toggling dropdown ${id}`);
    }
  }

  closeAll(): void {
    console.log('Closing all dropdowns');
  }

  getDropdowns(): Array<{ id: string; trigger: string }> {
    return Array.from(this.dropdowns.entries()).map(([id, d]) => ({
      id,
      trigger: d.trigger,
    }));
  }
}

export class ModalPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/modals',
    name: 'Modal Manager',
    version: '1.0.0',
    description: 'Modal dialog management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['modal', 'dialog', 'popup'],
  };

  public capabilities: PluginCapabilities = {
    ui: { modal: true },
  };

  private modals: Map<string, {
    component: unknown;
    title?: string;
    closable?: boolean;
    size?: 'small' | 'medium' | 'large';
    onClose?: () => void;
  }> = new Map();

  openModal(id: string, config: {
    component: unknown;
    title?: string;
    closable?: boolean;
    size?: 'small' | 'medium' | 'large';
    onClose?: () => void;
  }): void {
    this.modals.set(id, config);
  }

  closeModal(id: string): void {
    const modal = this.modals.get(id);
    if (modal) {
      modal.onClose?.();
      this.modals.delete(id);
    }
  }

  closeAllModals(): void {
    for (const modal of this.modals.values()) {
      modal.onClose?.();
    }
    this.modals.clear();
  }

  getOpenModals(): string[] {
    return Array.from(this.modals.keys());
  }

  isModalOpen(id: string): boolean {
    return this.modals.has(id);
  }
}

export class ToastPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/toasts',
    name: 'Toast Notifications',
    version: '1.0.0',
    description: 'Toast notification system',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['toast', 'notification', 'alert'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true },
    ui: { toolbar: true },
  };

  private toasts: Map<string, {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration: number;
  }> = new Map();

  show(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000): string {
    const id = `toast-${Date.now()}`;
    this.toasts.set(id, {
      id,
      message,
      type,
      duration,
    });

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id: string): void {
    this.toasts.delete(id);
  }

  dismissAll(): void {
    this.toasts.clear();
  }

  getToasts(): Array<{ id: string; message: string; type: string }> {
    return Array.from(this.toasts.values()).map(t => ({
      id: t.id,
      message: t.message,
      type: t.type,
    }));
  }

  success(message: string): string {
    return this.show(message, 'success');
  }

  error(message: string): string {
    return this.show(message, 'error');
  }

  warning(message: string): string {
    return this.show(message, 'warning');
  }

  info(message: string): string {
    return this.show(message, 'info');
  }
}

export class AlertPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/alerts',
    name: 'Alert System',
    version: '1.0.0',
    description: 'Alert banner system',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['alert', 'banner', 'notification'],
  };

  public capabilities: PluginCapabilities = {
    ui: { statusBar: true },
  };

  private alerts: Map<string, {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    dismissible: boolean;
  }> = new Map();

  add(alert: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    dismissible?: boolean;
  }): string {
    const id = `alert-${Date.now()}`;
    this.alerts.set(id, {
      id,
      ...alert,
      dismissible: alert.dismissible ?? true,
    });
    return id;
  }

  dismiss(id: string): void {
    this.alerts.delete(id);
  }

  dismissAll(): void {
    this.alerts.clear();
  }

  getAlerts(filter?: { type?: string }): Array<{
    id: string;
    title: string;
    message: string;
    type: string;
  }> {
    let alerts = Array.from(this.alerts.values());

    if (filter?.type) {
      alerts = alerts.filter(a => a.type === filter.type);
    }

    return alerts.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
    }));
  }
}

export class NotificationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/system-notifications',
    name: 'System Notifications',
    version: '1.0.0',
    description: 'Native notification integration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['notifications', 'system', 'native'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true },
  };

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.requestPermission();
  }

  async show(options: {
    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: unknown;
    requireInteraction?: boolean;
  }): Promise<Notification | null> {
    if (Notification.permission === 'granted') {
      return new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
      });
    }
    return null;
  }

  getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }
}

export class SpinnerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/spinners',
    name: 'Spinner',
    version: '1.0.0',
    description: 'Loading spinner component',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['spinner', 'loading', 'indicator'],
  };

  public capabilities: PluginCapabilities = {};

  private activeSpinners: Set<string> = new Set();

  show(id: string): void {
    this.activeSpinners.add(id);
  }

  hide(id: string): void {
    this.activeSpinners.delete(id);
  }

  isVisible(id?: string): boolean {
    if (id) {
      return this.activeSpinners.has(id);
    }
    return this.activeSpinners.size > 0;
  }

  getActive(): string[] {
    return Array.from(this.activeSpinners);
  }
}

export class ProgressPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/progress-bar',
    name: 'Progress Bar',
    version: '1.0.0',
    description: 'Progress bar component',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['progress', 'bar', 'loading'],
  };

  public capabilities: PluginCapabilities = {};

  private progress: Map<string, number> = new Map();

  setProgress(id: string, value: number): void {
    this.progress.set(id, Math.min(100, Math.max(0, value)));
  }

  getProgress(id: string): number {
    return this.progress.get(id) || 0;
  }

  reset(id: string): void {
    this.progress.delete(id);
  }

  getAllProgress(): Array<{ id: string; value: number }> {
    return Array.from(this.progress.entries()).map(([id, value]) => ({
      id,
      value,
    }));
  }
}

export class LoaderPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/loader',
    name: 'Loader',
    version: '1.0.0',
    description: 'Async resource loader',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['loader', 'async', 'resource'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private cache: Map<string, unknown> = new Map();
  private loading: Map<string, Promise<unknown>> = new Map();

  async load<T>(id: string, loader: () => Promise<T>): Promise<T> {
    if (this.cache.has(id)) {
      return this.cache.get(id) as T;
    }

    if (this.loading.has(id)) {
      return this.loading.get(id) as Promise<T>;
    }

    const promise = loader().then(value => {
      this.cache.set(id, value);
      this.loading.delete(id);
      return value;
    });

    this.loading.set(id, promise);
    return promise;
  }

  preload<T>(id: string, loader: () => Promise<T>): void {
    loader().then(value => {
      this.cache.set(id, value);
    }).catch(() => {});
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  get<T>(id: string): T | undefined {
    return this.cache.get(id) as T | undefined;
  }

  isLoading(id: string): boolean {
    return this.loading.has(id);
  }

  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }

  delete(id: string): void {
    this.cache.delete(id);
    this.loading.delete(id);
  }
}

export const routerPlugin = new RouterPlugin();
export const navigationPlugin = new NavigationPlugin();
export const sidebarPlugin = new SidebarPlugin();
export const tabsPlugin = new TabsPlugin();
export const commandPalettePlugin = new CommandPalettePlugin();
export const contextMenuPlugin = new ContextMenuPlugin();
export const dropdownPlugin = new DropdownPlugin();
export const modalPlugin = new ModalPlugin();
export const toastPlugin = new ToastPlugin();
export const alertPlugin = new AlertPlugin();
export const notificationPlugin = new NotificationPlugin();
export const spinnerPlugin = new SpinnerPlugin();
export const progressPlugin = new ProgressPlugin();
export const loaderPlugin = new LoaderPlugin();

export function registerUIPugins(): Plugin[] {
  return [
    routerPlugin,
    navigationPlugin,
    sidebarPlugin,
    tabsPlugin,
    commandPalettePlugin,
    contextMenuPlugin,
    dropdownPlugin,
    modalPlugin,
    toastPlugin,
    alertPlugin,
    notificationPlugin,
    spinnerPlugin,
    progressPlugin,
    loaderPlugin,
  ];
}