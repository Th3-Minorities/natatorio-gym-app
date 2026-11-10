import { expect, test } from '@playwright/test'
import { expectNoViolations } from './axe.ts'

test.use({ baseURL: 'http://127.0.0.1:5173' })

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard-preview.html')
  await expect(page.locator('#dashboard-content')).toBeVisible()
})

test('keyboard users can skip to the dashboard content', async ({ page }) => {
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido' })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()
  await expect(skipLink).toBeInViewport()

  await page.keyboard.press('Enter')
  await expect(page.locator('#dashboard-content')).toBeFocused()
})

test('dashboard shell has no automated WCAG 2.2 AA violations', async ({ page }) => {
  await expectNoViolations(page)
})

test('dashboard shell reflows at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })

  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
})
