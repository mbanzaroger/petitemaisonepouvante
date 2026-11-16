/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En développement, les appels /api/v1 sont relayés vers les services lancés par « docker compose --profile app »
// (même origine pour le navigateur, comme derrière le Gateway en staging).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/v1/products': 'http://127.0.0.1:8081',
      '/api/v1/categories': 'http://127.0.0.1:8081',
      '/api/v1/orders': 'http://127.0.0.1:8082',
    },
  },
  build: {
    sourcemap: false,
    // Pas de script ni de style en ligne : compatible avec la CSP stricte servie par nginx.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
    },
  },
});
