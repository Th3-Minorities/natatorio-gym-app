/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { serviceWorkerSource } from './service-worker.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    // Emits sw.js with the build's own files, so the precache list and version follow every build.
    name: 'offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const publicFiles = ['/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png']
      const files = [...new Set(['/index.html', ...publicFiles, ...Object.keys(bundle).map((file) => `/${file}`)])]
      const hash = createHash('sha256').update(readFileSync(new URL('./index.html', import.meta.url)))
      for (const file of publicFiles) hash.update(readFileSync(new URL(`./public${file}`, import.meta.url)))
      for (const output of Object.values(bundle)) hash.update(output.type === 'chunk' ? output.code : output.source)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(files, hash.digest('hex').slice(0, 16)) })
    },
  }],
  server: {
    // Same origin as the API: the browser only sees localhost:5173 (README, "Frontend").
    // 8080 is the APP_PORT default in docker-compose.yml.
    // changeOrigin stays false: Laravel must see the address the page came from (localhost:5173), or Sanctum
    // takes the page for another site and gives it no sign-in session (config/sanctum.php, "stateful").
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // Browser tests in e2e/ run with Playwright, not Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest empties CSS files by default; tokens.test.ts reads the design values and CheckIn.test.tsx the motion rules.
    css: { include: [/tokens\.css/, /checkIn\.css/] },
  },
})
