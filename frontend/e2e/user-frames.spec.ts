import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.USER_SCREENSHOT_DIR ?? ''
const profile = {
  name: 'María Rodríguez', email: 'm***z@upr.edu', locale: 'es',
  authorization: { type: 'paid', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z',
}
const frames = [
  ['179-6164', 'sign-in', 'normal'], ['4099-2001', 'sign-in', 'busy'], ['4099-2040', 'sign-in', 'wrong'],
  ['4099-2091', 'sign-in', 'wait'], ['4099-2136', 'sign-in', 'offline'], ['4099-2180', 'account', 'replaced'],
  ['179-6186', 'recover-password', 'normal'], ['4099-2231', 'recover-password', 'busy'],
  ['4099-2260', 'recover-password', 'server'], ['4099-2295', 'recover-password', 'offline'], ['4099-2335', 'recover-password', 'received'],
  ['179-6199', 'reset-password', 'normal'], ['4099-2359', 'reset-password', 'validating'],
  ['4099-2377', 'reset-password', 'expired'], ['4099-2412', 'reset-password', 'invalid'], ['4099-2453', 'reset-password', 'offline'],
  ['4099-1533', 'account/delete', 'normal'], ['4099-1587', 'account/delete', 'confirm'],
  ['4099-1634', 'account/delete', 'active'], ['4099-1680', 'account/delete', 'offline'], ['4099-1739', 'account/delete', 'deleted'],
  ['4099-626', 'account', 'active'], ['4099-683', 'account', 'normal'], ['4099-800', 'account', 'loading'],
  ['4099-835', 'account', 'server'], ['4099-875', 'account', 'offline'],
  ['4099-740', 'account/settings', 'normal'], ['4099-1774', 'account/settings', 'saved'], ['4099-1207', 'account/settings', 'offline'],
] as const

async function fillAccess(page: Page, path: string) {
  if (path !== 'reset-password') await page.getByLabel('Correo electrónico').fill('maria.rodriguez@upr.edu')
  if (path === 'sign-in') await page.getByLabel('Contraseña', { exact: true }).fill('0123456789')
  if (path === 'reset-password') {
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('12345678')
    await page.getByLabel('Confirmar contraseña').fill('abcdefgh')
  }
}

test.describe('User Figma frames at 390x844', () => {
  // All API requests are mocked; these captures run without Docker.
  test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 } })
  for (const [id, path, state] of frames) {
    test(`${id} ${path} ${state}`, async ({ page }, testInfo) => {
      let finish: (() => Promise<void>) | undefined
      let cached = false
      // Match API endpoints only, not Vite's /src/api/client.ts module.
      await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
        const url = new URL(route.request().url())
        const endpoint = url.pathname
        if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
        const fail = (code: string, status = 422, details?: object, headers?: Record<string, string>) => route.fulfill({
          status, headers, contentType: 'application/json', body: JSON.stringify({ error: { code, details } }),
        })
        if (endpoint.endsWith('/me')) {
          if (state === 'replaced') return fail('user_session_replaced', 401)
          if (state === 'loading') { finish = () => route.fulfill({ json: profile }); return }
          if (state === 'server') return fail('server_error', 500)
          if (state === 'offline' && cached) return route.abort('internetdisconnected')
          cached = true
          return route.fulfill({ json: { ...profile, authorization: state === 'active' || (path === 'account' && state === 'offline') ? profile.authorization : null } })
        }
        if (endpoint.endsWith('/validate')) {
          if (state === 'validating') { finish = () => route.fulfill({ status: 204 }); return }
          return state === 'expired' ? fail('user_reset_link_invalid') : route.fulfill({ status: 204 })
        }
        if (endpoint.endsWith('/locale')) return route.fulfill({ json: { ...profile, authorization: null } })
        if (state === 'busy') { finish = () => route.fulfill({ json: profile }); return }
        if (state === 'wrong') return fail('user_credentials_invalid')
        if (state === 'wait') return fail('too_many_requests', 429, undefined, { 'Retry-After': '300' })
        if (state === 'server') return fail('server_error', 500)
        if (state === 'invalid') return fail('validation_failed', 422, { password: ['min'], password_confirmation: ['confirmed'] })
        if (state === 'offline') return route.abort('internetdisconnected')
        if (endpoint.endsWith('/email')) return route.fulfill({ json: { status: 'received' } })
        return route.fulfill({ status: 204 })
      })
      await page.goto(`/${path}${path === 'reset-password' ? '?token=token&email=maria.rodriguez%40upr.edu' : ''}`)
      if (path.startsWith('account') && !['loading', 'replaced', 'server'].includes(state)) {
        await expect(page.getByRole('heading', { name: path === 'account' ? 'Mi cuenta' : path === 'account/settings' ? 'Ajustes' : state === 'active' ? 'No puedes eliminar la cuenta' : 'Eliminar cuenta', exact: true })).toBeVisible()
      }
      if (state === 'saved') {
        await page.getByRole('button', { name: 'Español', exact: true }).click()
        await expect(page.getByRole('status')).toContainText('Idioma guardado')
      }
      if (['busy', 'wrong', 'wait', 'received', 'invalid'].includes(state) || (['offline', 'server'].includes(state) && !path.startsWith('account'))) {
        await fillAccess(page, path)
        await page.getByRole('button', { name: path === 'sign-in' ? 'Iniciar sesión' : path === 'recover-password' ? 'Enviar enlace' : 'Guardar contraseña', exact: true }).click()
      }
      if (['confirm', 'deleted'].includes(state)) {
        await page.getByRole('button', { name: 'Eliminar mi cuenta', exact: true }).click()
        if (state === 'deleted') await page.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click()
      }
      if (state === 'offline' && path.startsWith('account')) {
        await page.evaluate("window.dispatchEvent(new Event('offline'))")
      }
      const ready = state === 'busy' ? path === 'sign-in' ? 'Iniciando sesión…' : 'Enviando enlace…'
        : state === 'wrong' ? 'No pudimos iniciar sesión' : state === 'wait' ? 'Espera antes de intentar de nuevo'
        : state === 'replaced' ? 'Iniciaste sesión en otro dispositivo' : state === 'received' ? 'Solicitud recibida'
        : state === 'expired' ? 'El enlace ya no es válido' : state === 'validating' ? 'Estamos verificando el enlace…'
        : state === 'invalid' ? 'Las contraseñas deben coincidir.' : state === 'offline' ? 'Sin conexión · Datos no actualizados'
        : state === 'deleted' ? 'Tu cuenta se eliminó' : state === 'confirm' ? '¿Eliminar tu cuenta?'
        : state === 'loading' ? 'Cargando tu cuenta…' : state === 'server' ? path === 'account' ? 'No pudimos cargar tu cuenta' : 'No pudimos enviar la solicitud' : null
      if (ready) await expect(page.getByText(ready, { exact: true })).toBeVisible()
      if (state === 'replaced') await fillAccess(page, 'sign-in')
      if (path === 'reset-password' && state === 'normal') await expect(page.getByLabel('Confirmar contraseña')).toBeVisible()
      await page.evaluate('document.fonts.ready')
      // Keyboard focus is verified separately; the visual target has no focus ring.
      await page.evaluate('document.activeElement && document.activeElement.blur()')
      if (SHOTS) {
        await mkdir(SHOTS, { recursive: true })
        const screenshot = join(SHOTS, `${id}${testInfo.project.name === 'chromium' ? '' : `-${testInfo.project.name}`}.png`)
        await page.screenshot({ path: screenshot })
      }
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(accessibility.violations).toEqual([])
      if (finish) await finish()
    })
  }
})
