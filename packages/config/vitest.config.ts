import { defineConfig, defineWorkspace } from 'vitest/config';
import { resolve } from 'path';

export default defineWorkspace({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/coverage/**',
        '**/fixtures/**',
        '**/examples/**',
        '**/.{git,github,gitlab}/**',
      ],
    },
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retries: 2,
    setupFiles: ['./test/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@timps/core': resolve(__dirname, '../timps-core/src'),
      '@timps/memory': resolve(__dirname, '../memory-core/src'),
      '@timps/integrations': resolve(__dirname, '../integrations/src'),
    },
  },
});