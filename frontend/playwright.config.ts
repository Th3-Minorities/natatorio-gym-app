import { defineConfig, devices } from '@playwright/test'

// Browser tests run against the built app through the proxy, so the stack must be up.
// E2E_BASE_URL is for a stack on another port (APP_PORT).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  // On Windows the API can take 7 to 20 s per request (README, "Slow on Windows").
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
