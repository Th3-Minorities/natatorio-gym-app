import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const shots = process.env.USER_SCREENSHOT_DIR
const frames = ['179-6122', '179-6300', '179-6324', '179-6216', '4099-2498', '4099-2530', '4099-2548', '4099-2577'] as const

async function acknowledge(page: Page) {
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page.getByRole('heading', { name: 'Registro', exact: true })).toBeVisible()
}

test.describe('paid registration Figma frames', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  for (const frame of frames) {
    test(frame, async ({ page }, testInfo) => {
      await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
        const endpoint = new URL(route.request().url()).pathname
        if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
        if (endpoint.endsWith('/privacy') && route.request().method() === 'GET') {
          if (frame === '4099-2530') return new Promise(() => {})
          if (frame === '4099-2548') return route.fulfill({ status: 500, json: { error: { code: 'server_error' } } })
          return route.fulfill({ json: { version: 'draft', draft: true, store_url: null } })
        }
        if (endpoint.endsWith('/lookup')) return route.fulfill({ json: { state: 'ready', name: '[Nombre]', masked_email: 'c***@upr.edu' } })
        return route.fulfill({ status: 204 })
      })
      await page.goto('/register')
      if (frame === '4099-2530') await expect(page.getByText('Cargando el aviso…')).toBeVisible()
      else if (frame === '4099-2548') await expect(page.getByText('No pudimos mostrar el aviso')).toBeVisible()
      else {
        await expect(page.getByRole('heading', { name: 'Antes de comenzar' })).toBeVisible()
        if (frame.startsWith('179-') && frame !== '179-6122') {
          await acknowledge(page)
          if (frame !== '179-6300') {
            await page.getByRole('link', { name: 'Pagué la membresía. Me registro con el número de mi recibo.' }).click()
            await expect(page.getByLabel('Número de autorización')).toBeVisible()
            if (frame === '179-6216') {
              await page.getByLabel('Número de autorización').fill('12345A')
              await page.getByRole('button', { name: 'Continuar', exact: true }).click()
              await expect(page.getByRole('heading', { name: 'Crea una contraseña' })).toBeVisible()
            }
          }
        }
        if (frame === '4099-2498') {
          await page.getByRole('link', { name: 'Aviso de privacidad', exact: true }).click()
          await page.getByRole('link', { name: 'English', exact: true }).click()
          await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible()
        }
        if (frame === '4099-2577') {
          await page.evaluate("window.dispatchEvent(new Event('offline'))")
          await expect(page.getByText('El aviso está disponible sin conexión.')).toBeVisible()
        }
      }
      await page.evaluate('document.fonts.ready')
      // Navigation focuses the new heading on the next animation frame. Capture after it has painted.
      await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      if (shots) {
        await mkdir(shots, { recursive: true })
        await page.screenshot({ path: join(shots, `${frame}-${testInfo.project.name}.png`) })
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
  await page.getByRole('link', { name: 'Pagué la membresía. Me registro con el número de mi recibo.' }).click()
  await page.getByLabel('Número de autorización').fill('A')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText('¡Hola, María!')).toBeVisible()
  await page.getByLabel('Contraseña', { exact: true }).fill('a long password')
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('a long password')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Crea una contraseña' })).toBeVisible()
  expect(completed).toBe(false)
})
