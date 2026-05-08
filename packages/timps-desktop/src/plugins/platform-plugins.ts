import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class AnimationsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/animations',
    name: 'Animations',
    version: '1.0.0',
    description: 'CSS animations and transitions',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['animation', 'css', 'transition'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  fadeIn(element: HTMLElement, duration = 300): Promise<void> {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ease-in`;

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  fadeOut(element: HTMLElement, duration = 300): Promise<void> {
    element.style.transition = `opacity ${duration}ms ease-out`;

    return new Promise(resolve => {
      element.style.opacity = '0';
      setTimeout(resolve, duration);
    });
  }

  slideIn(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left', duration = 300): Promise<void> {
    const transforms: Record<string, string> = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      up: 'translateY(-100%)',
      down: 'translateY(100%)',
    };

    element.style.transition = `transform ${duration}ms ease-out`;
    element.style.transform = transforms[direction];
    element.style.opacity = '0';

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        element.style.transform = 'translate(0)';
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  slideOut(element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left', duration = 300): Promise<void> {
    const transforms: Record<string, string> = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      up: 'translateY(-100%)',
      down: 'translateY(100%)',
    };

    element.style.transition = `transform ${duration}ms ease-in, opacity ${duration}ms ease-in`;
    element.style.transform = transforms[direction];
    element.style.opacity = '0';

    return new Promise(resolve => setTimeout(resolve, duration));
  }

  scaleIn(element: HTMLElement, duration = 300): Promise<void> {
    element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
    element.style.transform = 'scale(0)';
    element.style.opacity = '0';

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  animateCSS(element: HTMLElement, animation: string, duration = 1000): Promise<void> {
    element.style.animation = `${animation} ${duration}ms ease`;

    return new Promise(resolve => setTimeout(resolve, duration));
  }

  addKeyframes(name: string, keyframes: Keyframe[]): void {
    const style = document.createElement('style');
    style.textContent = `@keyframes ${name} { ${keyframes.map(k => `${k.offset * 100}% { ${Object.entries(k).filter(([k]) => k !== 'offset').map(([k, v]) => `${k}: ${v}`).join('; ')} }`).join(' ')} }`;
    document.head.appendChild(style);
  }
}

export class ScrollPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/scroll',
    name: 'Scroll Utilities',
    version: '1.0.0',
    description: 'Scroll and scrolling utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['scroll', 'scrolling', 'scrollbar'],
  };

  public capabilities: PluginCapabilities = {};

  scrollTo(target: string | HTMLElement, options?: { behavior?: 'auto' | 'smooth'; block?: 'start' | 'center' | 'end' | 'nearest' }): void {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (element) {
      element.scrollIntoView({ behavior: options?.behavior || 'smooth', block: options?.block || 'start' });
    }
  }

  scrollToTop(options?: { behavior?: 'auto' | 'smooth' }): void {
    window.scrollTo({ top: 0, behavior: options?.behavior || 'smooth' });
  }

  scrollToBottom(options?: { behavior?: 'auto' | 'smooth' }): void {
    window.scrollTo({ top: document.body.scrollHeight, behavior: options?.behavior || 'smooth' });
  }

  scrollBy(offset: number, options?: { behavior?: 'auto' | 'smooth' }): void {
    window.scrollBy({ top: offset, behavior: options?.behavior || 'smooth' });
  }

  getScrollPosition(): { x: number; y: number } {
    return { x: window.scrollX, y: window.scrollY };
  }

  getScrollHeight(): number {
    return document.body.scrollHeight;
  }

  getViewportHeight(): number {
    return window.innerHeight;
  }

  isScrolledToBottom(threshold = 50): boolean {
    const scrollTop = window.scrollY;
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;

    return scrollHeight - scrollTop - viewportHeight < threshold;
  }

  enableSmoothScroll(): void {
    document.documentElement.style.scrollBehavior = 'smooth';
  }

  disableSmoothScroll(): void {
    document.documentElement.style.scrollBehavior = 'auto';
  }
}

export class ResizePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/resize',
    name: 'Resize Utilities',
    version: '1.0.0',
    description: 'Resize observer and utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['resize', 'observer', 'responsive'],
  };

  public capabilities: PluginCapabilities = {};

  observe(element: HTMLElement, callback: (entry: ResizeObserverEntry) => void): () => void {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        callback(entry);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }

  getSize(element: HTMLElement): { width: number; height: number } {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  getBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' {
    const width = window.innerWidth;
    if (width < 576) return 'xs';
    if (width < 768) return 'sm';
    if (width < 992) return 'md';
    if (width < 1200) return 'lg';
    if (width < 1400) return 'xl';
    return 'xxl';
  }
}

export class IntersectionPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/intersection',
    name: 'Intersection Observer',
    version: '1.0.0',
    description: 'Intersection observer utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['intersection', 'observer', 'viewport'],
  };

  public capabilities: PluginCapabilities = {};

  observe(element: HTMLElement, callback: (isIntersecting: boolean) => void, options?: {
    threshold?: number | number[];
    root?: HTMLElement;
    rootMargin?: string;
  }): () => void {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        callback(entry.isIntersecting);
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }

  isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0 &&
           rect.left < window.innerWidth && rect.right > 0;
  }

  getVisibility(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);

    if (visibleHeight <= 0 || visibleWidth <= 0) return 0;

    const visibleArea = visibleHeight * visibleWidth;
    const elementArea = rect.height * rect.width;

    return (visibleArea / elementArea) * 100;
  }
}

export class DragDropPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/drag-drop',
    name: 'Drag and Drop',
    version: '1.0.0',
    description: 'Drag and drop utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['drag', 'drop', 'dnd'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  private draggables: Map<string, HTMLElement> = new Map();
  private dropZones: Map<string, HTMLElement> = new Map();

  makeDraggable(element: HTMLElement, id: string): void {
    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', this.handleDragStart);
    element.addEventListener('dragend', this.handleDragEnd);
    this.draggables.set(id, element);
  }

  makeDroppable(element: HTMLElement, id: string): void {
    element.addEventListener('dragover', this.handleDragOver);
    element.addEventListener('drop', this.handleDrop);
    element.addEventListener('dragleave', this.handleDragLeave);
    this.dropZones.set(id, element);
  }

  private handleDragStart = (e: DragEvent): void => {
    e.dataTransfer?.setData('text/plain', '');
  };

  private handleDragEnd = (): void => {};

  private handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleDrop = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleDragLeave = (): void => {};

  removeDraggable(id: string): void {
    const element = this.draggables.get(id);
    if (element) {
      element.removeAttribute('draggable');
      this.draggables.delete(id);
    }
  }

  removeDroppable(id: string): void {
    this.dropZones.delete(id);
  }
}

export class ClipboardPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/clipboard-v2',
    name: 'Clipboard v2',
    version: '1.0.0',
    description: 'Clipboard API wrapper',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['clipboard', 'copy', 'paste'],
  };

  public capabilities: PluginCapabilities = {
    api: { clipboard: true },
  };

  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async paste(): Promise<string> {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }

  async copyHTML(html: string): Promise<boolean> {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      return true;
    } catch {
      return false;
    }
  }

  async readHTML(): Promise<string | null> {
    try {
      const data = await navigator.clipboard.read();
      for (const item of data) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          return await blob.text();
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  isSupported(): boolean {
    return 'clipboard' in navigator;
  }

  async hasPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      return result.state === 'granted';
    } catch {
      return false;
    }
  }
}

export class FocusPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/focus',
    name: 'Focus Utilities',
    version: '1.0.0',
    description: 'Focus management utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['focus', 'keyboard', 'accessibility'],
  };

  public capabilities: PluginCapabilities = {};

  focusableSelectors = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'];

  getFirstFocusable(container: HTMLElement): HTMLElement | null {
    return container.querySelector(this.focusableSelectors.join(', ')) as HTMLElement | null;
  }

  getLastFocusable(container: HTMLElement): HTMLElement | null {
    const focusables = container.querySelectorAll(this.focusableSelectors.join(', '));
    return focusables[focusables.length - 1] as HTMLElement | null;
  }

  trapFocus(container: HTMLElement): () => void {
    const firstFocusable = this.getFirstFocusable(container);
    const lastFocusable = this.getLastFocusable(container);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }

  isFocused(element: HTMLElement): boolean {
    return document.activeElement === element;
  }

  focus(element: HTMLElement): void {
    element.focus();
  }

  blur(): void {
    (document.activeElement as HTMLElement)?.blur();
  }
}

export class KeyboardPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/keyboard-v2',
    name: 'Keyboard Utilities',
    version: '1.0.0',
    description: 'Keyboard event utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['keyboard', 'shortcuts', 'hotkey'],
  };

  public capabilities: PluginCapabilities = {
    api: { globalShortcuts: true },
  };

  private shortcuts: Map<string, () => void> = new Map();

  register(shortcut: string, handler: () => void): void {
    this.shortcuts.set(shortcut.toLowerCase(), handler);
  }

  unregister(shortcut: string): void {
    this.shortcuts.delete(shortcut.toLowerCase());
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.getShortcutKey(event);
    const handler = this.shortcuts.get(key);

    if (handler) {
      handler();
      return true;
    }

    return false;
  }

  private getShortcutKey(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    parts.push(event.key.toLowerCase());

    return parts.join('+');
  }

  getRegistered(): string[] {
    return Array.from(this.shortcuts.keys());
  }

  isRegistered(shortcut: string): boolean {
    return this.shortcuts.has(shortcut.toLowerCase());
  }
}

export class TouchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/touch',
    name: 'Touch Utilities',
    version: '1.0.0',
    description: 'Touch event utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['touch', 'gesture', 'mobile'],
  };

  public capabilities: PluginCapabilities = {};

  getTouches(event: TouchEvent): Array<{ x: number; y: number }> {
    const touches: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      touches.push({ x: touch.clientX, y: touch.clientY });
    }

    return touches;
  }

  getCenter(touches: Array<{ x: number; y: number }>): { x: number; y: number } {
    const sum = touches.reduce(
      (acc, touch) => ({ x: acc.x + touch.x, y: acc.y + touch.y }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / touches.length,
      y: sum.y / touches.length,
    };
  }

  getDistance(touches: Array<{ x: number; y: number }>): number {
    if (touches.length < 2) return 0;

    const dx = touches[1].x - touches[0].x;
    const dy = touches[1].y - touches[0].y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  isDoubleTap(lastTap: number, now: number): boolean {
    return now - lastTap < 300;
  }

  isSupported(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

export class DevicePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/device',
    name: 'Device Detection',
    version: '1.0.0',
    description: 'Device and platform detection',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['device', 'platform', 'detection'],
  };

  public capabilities: PluginCapabilities = {};

  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  getOS(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  getBrowser(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'IE';
    return 'Unknown';
  }

  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  isIOS(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  hasWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }
}

export class NetworkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/network-v2',
    name: 'Network Status',
    version: '1.0.0',
    description: 'Network status detection',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['network', 'online', 'offline'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  onStatusChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  async getConnection(): Promise<NetworkInformation | null> {
    return (navigator as unknown as { connection?: NetworkInformation }).connection || null;
  }

  getEffectiveType(): 'slow-2g' | '2g' | '3g' | '4g' | undefined {
    const conn = navigator.connection;
    return conn?.effectiveType;
  }

  isSaveDataEnabled(): boolean {
    return navigator.connection?.saveData || false;
  }
}

export const animationsPlugin = new AnimationsPlugin();
export const scrollPlugin = new ScrollPlugin();
export const resizePlugin = new ResizePlugin();
export const intersectionPlugin = new IntersectionPlugin();
export const dragDropPlugin = new DragDropPlugin();
export const clipboardPlugin = new ClipboardPlugin();
export const focusPlugin = new FocusPlugin();
export const keyboardPlugin = new KeyboardPlugin();
export const touchPlugin = new TouchPlugin();
export const devicePlugin = new DevicePlugin();
export const networkPlugin = new NetworkPlugin();

export function registerPlatformPlugins(): Plugin[] {
  return [
    animationsPlugin,
    scrollPlugin,
    resizePlugin,
    intersectionPlugin,
    dragDropPlugin,
    clipboardPlugin,
    focusPlugin,
    keyboardPlugin,
    touchPlugin,
    devicePlugin,
    networkPlugin,
  ];
}