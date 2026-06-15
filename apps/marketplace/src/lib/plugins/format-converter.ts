import { BasePlugin, PluginResult, PluginConfig } from './base';

export class FormatConverterPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('format-converter', 'Format Converter', config);
  }

  getDescription(): string {
    return 'Convert between JSON, YAML, XML, TOML';
  }

  async run(): Promise<PluginResult> {
    try {
      const input = this.config?.params?.input;
      const from = this.config?.params?.from || 'json';
      const to = this.config?.params?.to || 'yaml';

      if (!input) {
        return { success: false, error: 'No input data provided. Pass params.input with the data to convert.' };
      }

      let parsed: Record<string, unknown>;
      if (from === 'json') {
        parsed = JSON.parse(input);
      } else if (from === 'yaml') {
        const YAML = await import('yaml');
        parsed = YAML.parse(input);
      } else {
        return { success: false, error: `Unsupported source format: ${from}` };
      }

      let output: string;
      if (to === 'json') {
        output = JSON.stringify(parsed, null, 2);
      } else if (to === 'yaml') {
        const YAML = await import('yaml');
        output = YAML.stringify(parsed);
      } else if (to === 'xml') {
        const keys = Object.keys(parsed);
        output = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${keys.map(k => `  <${k}>${typeof parsed[k] === 'object' ? JSON.stringify(parsed[k]) : String(parsed[k])}</${k}>`).join('\n')}\n</root>`;
      } else {
        output = JSON.stringify(parsed, null, 2);
      }

      return {
        success: true,
        output: `Converted from ${from.toUpperCase()} to ${to.toUpperCase()} (${output.length} chars)`,
        data: { from, to, inputLength: input.length, output, outputLength: output.length },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Conversion failed' };
    }
  }
}
