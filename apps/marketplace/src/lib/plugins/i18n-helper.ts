import { BasePlugin, PluginResult, PluginConfig } from './base';

export class I18nHelperPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('i18n-helper', 'i18n Helper', config);
  }

  getDescription(): string {
    return 'Manage internationalization strings';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const localesDir = path.join(cwd, 'locales');
      if (!fs.existsSync(localesDir)) {
        return { success: true, output: 'No locales/ directory found', data: { message: 'Run with params.create=true to create one' } };
      }

      const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
      if (localeFiles.length === 0) {
        return { success: true, output: 'No locale files found in locales/', data: { localesDir } };
      }

      const translations: Record<string, Record<string, string>> = {};
      for (const file of localeFiles) {
        const locale = path.basename(file, '.json');
        translations[locale] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'));
      }

      const locales = Object.keys(translations);
      if (locales.length < 2) {
        return {
          success: true,
          output: `Found ${locales.length} locale: ${locales[0]}`,
          data: { locales, keys: Object.keys(translations[locales[0]]).length },
          warnings: ['Only one locale found. Add more for i18n comparison.'],
        };
      }

      const baseLocale = locales[0];
      const baseKeys = Object.keys(translations[baseLocale]);
      const missingKeys: Array<{ locale: string; keys: string[] }> = [];

      for (let i = 1; i < locales.length; i++) {
        const otherKeys = Object.keys(translations[locales[i]]);
        const missing = baseKeys.filter(k => !otherKeys.includes(k));
        if (missing.length > 0) {
          missingKeys.push({ locale: locales[i], keys: missing });
        }
      }

      return {
        success: true,
        output: `Checked ${locales.length} locales, ${baseKeys.length} keys. ${missingKeys.length} locales have missing translations`,
        data: { locales, keyCount: baseKeys.length, missingKeys: missingKeys.slice(0, 5) },
        warnings: missingKeys.length > 0
          ? missingKeys.map(m => `${m.locale}: missing ${m.keys.length} keys (${m.keys.slice(0, 5).join(', ')})`)
          : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'i18n check failed' };
    }
  }
}
