import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class HTTPPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/http',
    name: 'HTTP Client',
    version: '1.0.0',
    description: 'HTTP request utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['http', 'client', 'request'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

export class FetchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/fetch',
    name: 'Fetch',
    version: '1.0.0',
    description: 'Fetch wrapper with retry',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['fetch', 'retry', 'network'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private retryCount = 3;
  private retryDelay = 1000;

  async fetchWithRetry<T>(url: string, options?: RequestInit): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response.json();
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryCount - 1) {
          await new Promise(r => setTimeout(r, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  async fetchHTML(url: string, options?: RequestInit): Promise<string> {
    const response = await fetch(url, options);
    return response.text();
  }

  async fetchBlob(url: string, options?: RequestInit): Promise<Blob> {
    const response = await fetch(url, options);
    return response.blob();
  }

  async fetchArrayBuffer(url: string, options?: RequestInit): Promise<ArrayBuffer> {
    const response = await fetch(url, options);
    return response.arrayBuffer();
  }

  setRetry(count: number, delay: number): void {
    this.retryCount = count;
    this.retryDelay = delay;
  }
}

export class FormPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/form',
    name: 'Form Utilities',
    version: '1.0.0',
    description: 'Form handling utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['form', 'input', 'validation'],
  };

  public capabilities: PluginCapabilities = {};

  getFormData(form: HTMLFormElement): Record<string, FormDataEntryValue> {
    const formData = new FormData(form);
    const data: Record<string, FormDataEntryValue> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  setFormValues(form: HTMLFormElement, values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      const input = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (input) {
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else if (input) {
          input.value = String(value);
        }
      }
    }
  }

  validateForm(form: HTMLFormElement): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const inputs = form.querySelectorAll('input, textarea, select');

    for (const input of inputs) {
      const el = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (!el.checkValidity()) {
        errors[el.name] = el.validationMessage;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  serializeForm(form: HTMLFormElement): string {
    const formData = new FormData(form);
    return new URLSearchParams(formData as unknown as [string, string][]).toString();
  }
}

export class InputPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/input',
    name: 'Input Utilities',
    version: '1.0.0',
    description: 'Input handling utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['input', 'events', 'handling'],
  };

  public capabilities: PluginCapabilities = {};

  debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  throttle<T extends (...args: unknown[]) => void>(fn: T, limit: number): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  }

  onEnter(input: HTMLInputElement, handler: () => void): () => void {
    const handlerFn = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handler();
      }
    };
    input.addEventListener('keydown', handlerFn);
    return () => input.removeEventListener('keydown', handlerFn);
  }

  onEsc(input: HTMLInputElement, handler: () => void): () => void {
    const handlerFn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler();
      }
    };
    input.addEventListener('keydown', handlerFn);
    return () => input.removeEventListener('keydown', handlerFn);
  }
}

export class ImageLoaderPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/image-loader',
    name: 'Image Loader',
    version: '1.0.0',
    description: 'Async image loading',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['image', 'loading', 'preload'],
  };

  public capabilities: PluginCapabilities = {};

  private cache: Map<string, HTMLImageElement> = new Map();

  async load(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  preload(srcs: string[]): Promise<HTMLImageElement[]> {
    return Promise.all(srcs.map(src => this.load(src)));
  }

  getCached(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class AudioPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/audio-v2',
    name: 'Audio Player',
    version: '1.0.0',
    description: 'Audio playback',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['audio', 'player', 'sound'],
  };

  public capabilities: PluginCapabilities = {};

  private audio: HTMLAudioElement | null = null;

  play(src: string): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.audio = new Audio(src);
    this.audio.play();
  }

  pause(): void {
    this.audio?.pause();
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }
}

export class VideoPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/video-v2',
    name: 'Video Player',
    version: '1.0.0',
    description: 'Video playback',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['video', 'player', 'media'],
  };

  public capabilities: PluginCapabilities = {};

  async load(element: HTMLVideoElement, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      element.oncanplaythrough = () => resolve();
      element.onerror = reject;
      element.src = src;
      element.load();
    });
  }

  play(element: HTMLVideoElement): void {
    element.play();
  }

  pause(element: HTMLVideoElement): void {
    element.pause();
  }

  seek(element: HTMLVideoElement, time: number): void {
    element.currentTime = time;
  }

  setVolume(element: HTMLVideoElement, volume: number): void {
    element.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(element: HTMLVideoElement, muted: boolean): void {
    element.muted = muted;
  }

  setPlaybackRate(element: HTMLVideoElement, rate: number): void {
    element.playbackRate = rate;
  }

  getCurrentTime(element: HTMLVideoElement): number {
    return element.currentTime;
  }

  getDuration(element: HTMLVideoElement): number {
    return element.duration;
  }
}

export class CanvasPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/canvas',
    name: 'Canvas Utilities',
    version: '1.0.0',
    description: 'Canvas drawing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['canvas', 'drawing', 'graphics'],
  };

  public capabilities: PluginCapabilities = {};

  clear(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
  }

  drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill?: string): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill?: string): void {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  }

  drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options?: {
    font?: string;
    fill?: string;
    align?: CanvasTextAlign;
  }): void {
    ctx.font = options?.font || '16px sans-serif';
    ctx.fillStyle = options?.fill || '#000';
    ctx.textAlign = options?.align || 'left';
    ctx.fillText(text, x, y);
  }

  drawImageScaled(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, maxWidth: number, maxHeight: number): void {
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, x, y, w, h);
  }

  toDataURL(ctx: CanvasRenderingContext2D, type = 'image/png', quality = 0.92): string {
    return ctx.canvas.toDataURL(type, quality);
  }
}

export class SVGPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/svg',
    name: 'SVG Utilities',
    version: '1.0.0',
    description: 'SVG manipulation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['svg', 'graphics', 'vector'],
  };

  public capabilities: PluginCapabilities = {};

  createElement(name: string, attrs?: Record<string, string>): SVGElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
    }
    return el;
  }

  setAttributes(el: SVGElement, attrs: Record<string, string>): void {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }

  getAttributes(el: SVGElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  setTransform(el: SVGElement, transform: string): void {
    el.setAttribute('transform', transform);
  }

  setStyle(el: SVGElement, style: Record<string, string>): void {
    for (const [key, value] of Object.entries(style)) {
      (el.style as Record<string, string>)[key] = value;
    }
  }
}

export const httpPlugin = new HTTPPlugin();
export const fetchPlugin = new FetchPlugin();
export const formPlugin = new FormPlugin();
export const inputPlugin = new InputPlugin();
export const imageLoaderPlugin = new ImageLoaderPlugin();
export const audioPlugin = new AudioPlugin();
export const videoPlugin = new VideoPlugin();
export const canvasPlugin = new CanvasPlugin();
export const svgPlugin = new SVGPlugin();

export function registerMediaPlugins(): Plugin[] {
  return [
    httpPlugin,
    fetchPlugin,
    formPlugin,
    inputPlugin,
    imageLoaderPlugin,
    audioPlugin,
    videoPlugin,
    canvasPlugin,
    svgPlugin,
  ];
}