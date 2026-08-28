import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3742',
        changeOrigin: true,
        // When MEMORY_DASH_TOKEN is set on the API server, forward it so the
        // browser-facing UI (which is same-origin via this proxy) stays authorized.
        headers: process.env.MEMORY_DASH_TOKEN
          ? { 'X-TIMPS-DASH-TOKEN': process.env.MEMORY_DASH_TOKEN }
          : undefined,
      },
    },
  },
  build: {
    outDir: 'dist/ui',
    emptyOutDir: true,
  },
});
