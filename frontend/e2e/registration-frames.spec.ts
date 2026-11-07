import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const shots = process.env.USER_SCREENSHOT_DIR
const scenarios = ['179-6122', '179-6139', '179-6216', 'privacy-english', 'privacy-loading', 'privacy-error', 'privacy-offline'] as const

async function acknowledge(page: Page) {
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page.getByRole('heading', { name: 'Registro', exact: true })).toBeVisible()
}

test.describe('paid registration screen states', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  for (const scenario of scenarios) {
    test(scenario, async ({ page }, testInfo) => {
      await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
        const endpoint = new URL(route.request().url()).pathname
        if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
        if (endpoint.endsWith('/privacy') && route.request().method() === 'GET') {
          if (scenario === 'privacy-loading') return new Promise(() => {})
          if (scenario === 'privacy-error') return route.fulfill({ status: 500, json: { error: { code: 'server_error' } } })
          return route.fulfill({ json: { version: 'draft', draft: true, store_url: null } })
        }
        if (endpoint.endsWith('/lookup')) return route.fulfill({ json: { state: 'ready', name: '[Nombre]', masked_email: 'c***@upr.edu' } })
        return route.fulfill({ status: 204 })
      })
      await page.goto('/register')
      if (scenario === 'privacy-loading') await expect(page.getByText('Cargando el aviso…')).toBeVisible()
      else if (scenario === 'privacy-error') await expect(page.getByText('No pudimos mostrar el aviso')).toBeVisible()
      else {
        await expect(page.getByRole('heading', { name: 'Antes de comenzar' })).toBeVisible()
        if (scenario === '179-6139' || scenario === '179-6216') {
          await acknowledge(page)
          await expect(page.getByLabel('Número de estudiante o transacción')).toBeVisible()
          if (scenario === '179-6216') {
            await page.getByLabel('Número de estudiante o transacción').fill('12345A')
            await page.getByRole('button', { name: 'Continuar', exact: true }).click()
            await expect(page.getByRole('heading', { name: 'Crea una contraseña' })).toBeVisible()
          }
        }
        if (scenario === 'privacy-english') {
          await page.getByRole('link', { name: 'Aviso de privacidad', exact: true }).click()
          await page.getByRole('link', { name: 'English', exact: true }).click()
          await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible()
        }
        if (scenario === 'privacy-offline') {
          await page.evaluate("window.dispatchEvent(new Event('offline'))")
          await expect(page.getByText('El aviso está disponible sin conexión.')).toBeVisible()
        }
      }
      await page.evaluate('document.fonts.ready')
      // Navigation focuses the new heading on the next animation frame. Capture after it has painted.
      await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      if (shots) {
        await mkdir(shots, { recursive: true })
        await page.screenshot({ path: join(shots, `${scenario}-${testInfo.project.name}.png`) })
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test('paid registration stops at the last drawn step without claiming the number', async ({ page }) => {
  let completed = false
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
    if (endpoint.endsWith('/privacy') && route.request().method() === 'GET') return route.fulfill({ json: { version: 'draft', draft: true, store_url: null } })
    if (endpoint.endsWith('/lookup')) return route.fulfill({ json: { state: 'ready', name: 'María', masked_email: 'm***a@upr.edu' } })
    if (endpoint.endsWith('/complete')) completed = true
    return route.fulfill({ status: 204 })
  })
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Comenzar' }).click()
  await acknowledge(page)
  await page.getByLabel('Número de estudiante o transacción').fill('A')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText('¡Hola, María!')).toBeVisible()
  await page.getByLabel('Contraseña', { exact: true }).fill('a long password')
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('a long password')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Crea una contraseña' })).toBeVisible()
  expect(completed).toBe(false)
})
