import { expect, test } from '@playwright/test'
import { expectNoViolations } from './axe.ts'

// #82: User screens no other spec scans (N-09 install help, the gym occupancy screen, the privacy notice from Mi cuenta). API mocked, no Docker.
const profile = {
  name: 'María Rodríguez', email: 'm***z@upr.edu', locale: 'es', account_type: 'paid',
  authorization: { type: 'paid', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z',
}

test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
    if (endpoint.endsWith('/me')) return route.fulfill({ json: profile })
    if (endpoint.endsWith('/occupancy')) return route.fulfill({ json: { count: 12, max: 30, updated_at: '2026-11-07T14:00:00Z' } })
    if (endpoint.endsWith('/privacy')) return route.fulfill({ json: { version: 'draft', draft: true, store_url: null, contact_number: '265-3866' } })
    return route.fulfill({ status: 204 })
  })
})

for (const platform of ['iPhone', 'Android']) {
  test(`install help, ${platform} tab`, async ({ page }) => {
    await page.goto('/install')
    await page.getByRole('tab', { name: platform }).click()
    await expect(page.getByRole('tab', { name: platform })).toHaveAttribute('aria-selected', 'true')
    await expectNoViolations(page)
  })
}

test('install help after registration', async ({ page }) => {
  await page.goto('/install?registered')
  await expect(page.getByRole('tab', { name: 'iPhone' })).toBeVisible()
  await expectNoViolations(page)
})

test('gym occupancy', async ({ page }) => {
  await page.goto('/gym')
  await expect(page.getByText('personas', { exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('privacy notice from Mi cuenta', async ({ page }) => {
  await page.goto('/account/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Aviso de privacidad', exact: true })).toBeVisible()
  await expect(page.getByText('Este aviso también está disponible sin conexión.', { exact: true })).toBeVisible()
  await expectNoViolations(page)
})
