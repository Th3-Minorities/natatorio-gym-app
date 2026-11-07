import { defineConfig, devices } from '@playwright/test'

// Health tests run against the built app through the proxy, so the stack must be up.
// E2E_BASE_URL is for a stack on another port (APP_PORT).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Without the vendor volume, the API on Windows can take 7 to 20 s per request (README, "PHP packages in a Docker volume").
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/dashboard-preview.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],
})
