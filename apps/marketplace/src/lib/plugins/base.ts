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
