import { BasePlugin, PluginResult, PluginConfig } from './base';

export class GraphQLClientPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('graphql-client', 'GraphQL Client', config);
  }

  getDescription(): string {
    return 'Query and mutate GraphQL endpoints';
  }

  async run(): Promise<PluginResult> {
    try {
      const endpoint = this.config?.params?.endpoint || 'https://countries.trevorblades.com/graphql';
      const query = this.config?.params?.query || `{ countries { name code } }`;
      const operationName = this.config?.params?.operationName;

      const body: Record<string, unknown> = { query };
      if (operationName) body.operationName = operationName;
      if (this.config?.params?.variables) {
        body.variables = JSON.parse(this.config.params.variables);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.errors) {
        return {
          success: false,
          error: result.errors.map((e: { message: string }) => e.message).join(', '),
          data: result,
        };
      }

      const dataKeys = result.data ? Object.keys(result.data) : [];
      return {
        success: true,
        output: `GraphQL query succeeded. Returned data for: ${dataKeys.join(', ')}`,
        data: result.data,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'GraphQL query failed' };
    }
  }
}
