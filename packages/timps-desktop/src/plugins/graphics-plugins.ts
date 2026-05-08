import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class AnimationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/animation',
    name: 'Animation',
    version: '1.0.0',
    description: 'Animation utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['animation', 'ease', 'tween', 'transition'],
  };

  public capabilities: PluginCapabilities = {};

  tween(from: number, to: number, duration: number, easing?: EasingFunction): Animation {
    return new Animation(from, to, duration, easing);
  }

  animate(options: AnimationOptions): AnimationController {
    return new AnimationController(options);
  }

  easeIn(type: EasingType): EasingFunction {
    const eases: Record<EasingType, EasingFunction> = {
      linear: (t) => t,
      quadIn: (t) => t * t,
      quadOut: (t) => t * (2 - t),
      quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
      cubicIn: (t) => t * t * t,
      cubicOut: (t) => (--t) * t * t + 1,
      cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
      quartIn: (t) => t * t * t * t,
      quartOut: (t) => 1 - (--t) * t * t * t,
      quartInOut: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),
      quintIn: (t) => t * t * t * t * t,
      quintOut: (t) => 1 + (--t) * t * t * t * t,
      quintInOut: (t) =>
        t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
      sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
      sineOut: (t) => Math.sin((t * Math.PI) / 2),
      sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
      expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
      expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      expoInOut: (t) => {
        if (t === 0 || t === 1) return t;
        if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
        return (2 - Math.pow(2, -20 * t + 10)) / 2;
      },
      circIn: (t) => 1 - Math.sqrt(1 - t * t),
      circOut: (t) => Math.sqrt(1 - (--t) * t),
      circInOut: (t) =>
        t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - 4 * (t - 1) * (t - 1)) + 1) / 2,
      elasticIn: (t) => {
        if (t === 0 || t === 1) return t;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
      },
      elasticOut: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
      },
      elasticInOut: (t) => {
        if (t === 0 || t === 1) return t;
        if (t < 0.5)
          return (
            -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 3))) / 2
          );
        return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 3))) / 2 + 1;
      },
      backIn: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
      },
      backOut: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      },
      backInOut: (t) => {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        if (t < 0.5)
          return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
        return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
      },
      bounceIn: (t) => 1 - this.bounceOut(1 - t),
      bounceOut: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      },
      bounceInOut: (t) => {
        if (t < 0.5) return (1 - this.bounceOut(1 - 2 * t)) / 2;
        return (1 + this.bounceOut(2 * t - 1)) / 2;
      }
    };
    return eases[type];
  }

  private bounceOut(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

export class Animation {
  constructor(
    private from: number,
    private to: number,
    private duration: number,
    private easing?: EasingFunction
  ) {}

  valueAt(progress: number): number {
    const eased = this.easing ? this.easing(progress) : progress;
    return this.from + (this.to - this.from) * eased;
  }
}

export class AnimationController {
  private startTime = 0;
  private paused = false;
  private pausedAt = 0;

  constructor(private options: AnimationOptions) {}

  start(): void {
    this.options.onStart?.();
    this.startTime = Date.now();
    this.tick();
  }

  pause(): void {
    this.paused = true;
    this.pausedAt = Date.now();
  }

  resume(): void {
    if (this.paused) {
      this.startTime += Date.now() - this.pausedAt;
      this.paused = false;
      this.tick();
    }
  }

  stop(): void {
    this.paused = true;
    this.options.onComplete?.();
  }

  private tick(): void {
    if (this.paused) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.options.duration, 1);

    this.options.onUpdate?.(progress);

    if (progress < 1) {
      requestAnimationFrame(() => this.tick());
    } else {
      this.options.onComplete?.();
    }
  }
}

export interface AnimationOptions {
  duration: number;
  onStart?: () => void;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
  easing?: EasingFunction;
}

export type EasingFunction = (t: number) => number;

export type EasingType =
  | 'linear'
  | 'quadIn'
  | 'quadOut'
  | 'quadInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut'
  | 'quartIn'
  | 'quartOut'
  | 'quartInOut'
  | 'quintIn'
  | 'quintOut'
  | 'quintInOut'
  | 'sineIn'
  | 'sineOut'
  | 'sineInOut'
  | 'expoIn'
  | 'expoOut'
  | 'expoInOut'
  | 'circIn'
  | 'circOut'
  | 'circInOut'
  | 'elasticIn'
  | 'elasticOut'
  | 'elasticInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'bounceIn'
  | 'bounceOut'
  | 'bounceInOut';

export class GesturePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/gesture',
    name: 'Gesture',
    version: '1.0.0',
    description: 'Touch gesture detection',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['gesture', 'touch', 'swipe', 'drag'],
  };

  public capabilities: PluginCapabilities = {};

  private recognizers: Map<string, GestureRecognizer> = new Map();

  on(event: string, handler: (data: GestureData) => void): void {
    if (!this.recognizers.has(event)) {
      this.recognizers.set(event, new GestureRecognizer(event));
    }
    this.recognizers.get(event)!.on('gesture', handler);
  }

  detect(touches: TouchData[]): GestureRecognizer | null {
    if (touches.length === 0) return null;

    const start = touches[0];
    const current = touches[touches.length - 1];

    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;
    const time = current.timestamp - start.timestamp;

    if (time > 0 && time < 300 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      const recognizer = new GestureRecognizer('tap');
      return recognizer;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const recognizer = new GestureRecognizer(deltaX > 0 ? 'swipeRight' : 'swipeLeft');
      return recognizer;
    } else {
      const recognizer = new GestureRecognizer(deltaY > 0 ? 'swipeDown' : 'swipeUp');
      return recognizer;
    }
  }
}

export class GestureRecognizer {
  private handlers: ((data: GestureData) => void)[] = [];

  constructor(private type: string) {}

  on(event: string, handler: (data: GestureData) => void): void {
    this.handlers.push(handler);
  }

  emit(data: GestureData): void {
    for (const handler of this.handlers) {
      handler(data);
    }
  }
}

export interface TouchData {
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureData {
  type: string;
  start: TouchData;
  current: TouchData;
  velocity?: number;
}

export class MediaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/media',
    name: 'Media',
    version: '1.0.0',
    description: 'Media utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['media', 'audio', 'video', 'image'],
  };

  public capabilities: PluginCapabilities = {};

  loadImage(src: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height, src });
      img.onerror = reject;
      img.src = src;
    });
  }

  loadAudio(src: string): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 0, sampleRate: 0, length: 0, channels: [] });
  }

  loadVideo(src: string): Promise<VideoData> {
    return Promise.resolve({
      width: 0,
      height: 0,
      duration: 0,
      paused: true,
      src
    });
  }

  play(video: VideoData): void {}

  pause(video: VideoData): void {}

  stop(video: VideoData): void {}

  seek(video: VideoData, time: number): void {}

  mute(video: VideoData): void {}

  unmute(video: VideoData): void {}

  setVolume(video: VideoData, volume: number): void {}

  getDuration(video: VideoData): number {
    return video.duration;
  }

  getCurrentTime(video: VideoData): number {
    return 0;
  }

  isPaused(video: VideoData): boolean {
    return video.paused;
  }
}

export interface ImageData {
  src: string;
  width: number;
  height: number;
}

export interface AudioBuffer {
  duration: number;
  sampleRate: number;
  length: number;
  channels: Float32Array[];
}

export interface VideoData {
  src: string;
  width: number;
  height: number;
  duration: number;
  paused: boolean;
}

export class CanvasPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/canvas',
    name: 'Canvas',
    version: '1.0.0',
    description: 'Canvas drawing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['canvas', 'draw', 'graphics', 'render'],
  };

  public capabilities: PluginCapabilities = {};

  create(w: number, h: number): Canvas {
    return new Canvas(w, h);
  }

  drawLine(ctx: CanvasRenderingContext, x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawRect(ctx: CanvasRenderingContext, x: number, y: number, w: number, h: number, fill?: string): void {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  }

  drawCircle(ctx: CanvasRenderingContext, x: number, y: number, r: number, fill?: string): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  drawText(ctx: CanvasRenderingContext, text: string, x: number, y: number, options?: TextOptions): void {
    ctx.font = (options?.size || 16) + 'px ' + (options?.font || 'sans-serif');
    ctx.fillStyle = options?.color || '#000';
    ctx.fillText(text, x, y);
  }

  drawImage(ctx: CanvasRenderingContext, image: ImageData, x: number, y: number, w?: number, h?: number): void {
    ctx.drawImage(image as unknown as HTMLImageElement, x, y, w, h);
  }

  clear(ctx: CanvasRenderingContext): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  toDataURL(ctx: CanvasRenderingContext, type = 'image/png', quality = 1): string {
    return ctx.canvas.toDataURL(type, quality);
  }
}

export class Canvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext;

  constructor(private w: number, private h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext;
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }
}

export interface CanvasRenderingContext {
  canvas: { width: number; height: number };
  fillStyle: string;
  strokeStyle: string;
  font: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: unknown, x: number, y: number, w?: number, h?: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  toDataURL(type?: string, quality?: number): string;
}

export interface TextOptions {
  font?: string;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export class SvgPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/svg',
    name: 'SVG',
    version: '1.0.0',
    description: 'SVG generation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['svg', 'graphics', 'vector', 'draw'],
  };

  public capabilities: PluginCapabilities = {};

  create(tag: string, attrs?: Record<string, string>): SvgElement {
    return new SvgElement(tag, attrs);
  }

  circle(cx: number, cy: number, r: number, attrs?: Record<string, string>): SvgElement {
    return new SvgElement('circle', { cx: String(cx), cy: String(cy), r: String(r), ...attrs });
  }

  rect(x: number, y: number, w: number, h: number, attrs?: Record<string, string>): SvgElement {
    return new SvgElement('rect', { x: String(x), y: String(y), width: String(w), height: String(h), ...attrs });
  }

  line(x1: number, y1: number, x2: number, y2: number, attrs?: Record<string, string>): SvgElement {
    return new SvgElement('line', { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), ...attrs });
  }

  path(d: string, attrs?: Record<string, string>): SvgElement {
    return new SvgElement('path', { d, ...attrs });
  }

  text(x: number, y: number, content: string, attrs?: Record<string, string>): SvgElement {
    return new SvgElement('text', { x: String(x), y: String(y), ...attrs }, content);
  }

  group(elements: SvgElement[], attrs?: Record<string, string>): SvgElement {
    const group = new SvgElement('g', attrs);
    for (const el of elements) {
      group.append(el);
    }
    return group;
  }

  render(elements: SvgElement[], w: number, h: number): string {
    const children = elements.map(el => el.render()).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${children}</svg>`;
  }
}

export class SvgElement {
  private children: SvgElement[] = [];

  constructor(
    private tag: string,
    private attrs: Record<string, string> = {},
    private content = ''
  ) {}

  append(child: SvgElement): void {
    this.children.push(child);
  }

  attr(key: string, value: string): this {
    this.attrs[key] = value;
    return this;
  }

  render(): string {
    const attrs = Object.entries(this.attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    const children = this.children.map(c => c.render()).join('');

    if (this.content || this.children.length > 0) {
      return `<${this.tag} ${attrs}>${this.content}${children}</${this.tag}>`;
    }

    return `<${this.tag} ${attrs}/>`;
  }
}