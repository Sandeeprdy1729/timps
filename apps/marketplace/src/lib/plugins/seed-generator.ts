import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as crypto from 'crypto';

const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const EMAIL_DOMAINS = ['example.com', 'test.org', 'demo.net', 'sample.io'];
const CITIES = ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Mumbai', 'Toronto', 'Seoul', 'Dubai'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(crypto.randomBytes(1)[0] / 256 * arr.length)];
}

export class SeedGeneratorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('seed-generator', 'Seed Generator', config);
  }

  getDescription(): string {
    return 'Generate seed data for development databases';
  }

  async run(): Promise<PluginResult> {
    try {
      const count = parseInt(this.config?.params?.count || '10', 10);
      const type = this.config?.params?.type || 'users';

      const records: Record<string, unknown>[] = [];
      for (let i = 0; i < count; i++) {
        const firstName = randomItem(FIRST_NAMES);
        const lastName = randomItem(LAST_NAMES);
        records.push({
          id: crypto.randomUUID(),
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomItem(EMAIL_DOMAINS)}`,
          age: Math.floor(Math.random() * 50) + 18,
          city: randomItem(CITIES),
          createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: Math.random() > 0.2,
          score: Math.round(Math.random() * 10000) / 100,
        });
      }

      const format = this.config?.params?.format || 'json';
      let output: string;
      if (format === 'json') {
        output = JSON.stringify(records, null, 2);
      } else if (format === 'csv') {
        const headers = Object.keys(records[0] || {}).join(',');
        const rows = records.map(r => Object.values(r).map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(','));
        output = [headers, ...rows].join('\n');
      } else {
        output = JSON.stringify(records, null, 2);
      }

      return {
        success: true,
        output: `Generated ${count} ${type} records`,
        data: { count, type, format, records, output: output.slice(0, 2000) },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Seed generation failed' };
    }
  }
}
