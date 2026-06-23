import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'timps-code/src/**/*.test.ts',
      'timps-mcp/test/**/*.test.ts',
      'timps-vscode/test/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'out/**',
      'packages/timps-desktop/src/plugins/integrations/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/memory-core/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 65,
        lines: 70,
      },
    },
    env: {
      TIMPS_JWT_SECRET: 'test-secret',
    },
  },
});
