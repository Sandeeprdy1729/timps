import { defineConfig } from 'vitest/config';

// Package-local vitest config so `npm test` from within packages/server runs
// only this package's tests. The repo root vitest.config.ts also discovers
// packages/*/test/**/*.test.ts when running the whole workspace.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'out/**'],
    env: {
      TIMPS_JWT_SECRET: 'test-secret',
    },
  },
});
