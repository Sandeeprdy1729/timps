export interface PluginResult {
  success: boolean;
  output?: string;
  data?: unknown;
  error?: string;
  warnings?: string[];
}

export interface PluginConfig {
  cwd?: string;
  params?: Record<string, string>;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export abstract class BasePlugin {
  constructor(
    public readonly id: string,
    public readonly name: string,
    protected config?: PluginConfig
  ) {}

  setConfig(config: PluginConfig): void {
    this.config = config;
  }

  abstract run(): Promise<PluginResult>;
  abstract getDescription(): string;
}
