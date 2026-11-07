/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same origin as the API: the browser only sees localhost:5173 (README, "Frontend").
    // 8080 is the APP_PORT default in docker-compose.yml.
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // Browser tests in e2e/ run with Playwright, not Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest empties CSS files by default; tokens.test.ts reads the design values.
    css: { include: [/tokens\.css/] },
  },
})
