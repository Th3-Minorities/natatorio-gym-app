import { defineConfig, devices } from '@playwright/test'

// The demo screenshots for the test plan evidence (#81). Not part of CI: `npm run evidence` runs it on a fresh seed.
export default defineConfig({
  testDir: './e2e-evidence',
  workers: 1,
  retries: 0,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    serviceWorkers: 'block',
    locale: 'es-PR',
    timezoneId: 'America/Puerto_Rico',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
