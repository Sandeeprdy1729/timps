import { BasePlugin, PluginConfig } from './base';
import { CodeAnalysisPlugin } from './code-analysis';
import { AutoRefactorPlugin } from './auto-refactor';
import { TestGeneratorPlugin } from './test-generator';
import { SecurityScannerPlugin } from './security-scanner';
import { DocGeneratorPlugin } from './doc-generator';
import { GitHelperPlugin } from './git-helper';
import { DockerBuildPlugin } from './docker-build';
import { AISummarizerPlugin } from './ai-summarizer';
import { SlackNotifierPlugin } from './slack-notifier';
import { MetricDashboardPlugin } from './metric-dashboard';
import { DBMigratorPlugin } from './db-migrator';
import { EnvManagerPlugin } from './env-manager';
import { ApiClientPlugin } from './api-client';
import { OpenAPIGeneratorPlugin } from './openapi-generator';
import { GraphQLClientPlugin } from './graphql-client';
import { SchemaMigratorPlugin } from './schema-migrator';
import { SeedGeneratorPlugin } from './seed-generator';
import { QueryBuilderPlugin } from './query-builder';
import { FormatConverterPlugin } from './format-converter';
import { SecretScannerPlugin } from './secret-scanner';
import { LicenseCheckerPlugin } from './license-checker';
import { PerfProfilerPlugin } from './perf-profiler';
import { BundleAnalyzerPlugin } from './bundle-analyzer';
import { I18nHelperPlugin } from './i18n-helper';
import { DeployHelperPlugin } from './deploy-helper';
import { LogViewerPlugin } from './log-viewer';
import { EnvValidatorPlugin } from './env-validator';

const pluginConstructors: Record<string, new (config?: PluginConfig) => BasePlugin> = {
  'code-analysis': CodeAnalysisPlugin,
  'auto-refactor': AutoRefactorPlugin,
  'test-generator': TestGeneratorPlugin,
  'security-scanner': SecurityScannerPlugin,
  'doc-generator': DocGeneratorPlugin,
  'git-helper': GitHelperPlugin,
  'docker-build': DockerBuildPlugin,
  'ai-summarizer': AISummarizerPlugin,
  'slack-notifier': SlackNotifierPlugin,
  'metric-dashboard': MetricDashboardPlugin,
  'db-migrator': DBMigratorPlugin,
  'env-manager': EnvManagerPlugin,
  'api-client': ApiClientPlugin,
  'openapi-generator': OpenAPIGeneratorPlugin,
  'graphql-client': GraphQLClientPlugin,
  'schema-migrator': SchemaMigratorPlugin,
  'seed-generator': SeedGeneratorPlugin,
  'query-builder': QueryBuilderPlugin,
  'format-converter': FormatConverterPlugin,
  'secret-scanner': SecretScannerPlugin,
  'license-checker': LicenseCheckerPlugin,
  'perf-profiler': PerfProfilerPlugin,
  'bundle-analyzer': BundleAnalyzerPlugin,
  'i18n-helper': I18nHelperPlugin,
  'deploy-helper': DeployHelperPlugin,
  'log-viewer': LogViewerPlugin,
  'env-validator': EnvValidatorPlugin,
};

export function getPlugin(id: string, config?: PluginConfig): BasePlugin | null {
  const Constructor = pluginConstructors[id];
  if (!Constructor) return null;
  return new Constructor(config);
}

export function getAllPluginIds(): string[] {
  return Object.keys(pluginConstructors);
}
