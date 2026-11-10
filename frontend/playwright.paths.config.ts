import { defineConfig, devices } from '@playwright/test'

if (!process.env.KIM_PROJECT) throw new Error('KIM_PROJECT is not set: select a local test stack')

export default defineConfig({
  testDir: './e2e-paths',
  // Path tests change shared term dates, schedules and rate limiters on this stack.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${process.env.APP_PORT ?? '8096'}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // Preserve the project names used by the path inventory's device guards.
  // Mixed flows select devices per row, including dashboard effects on phone users.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
})
