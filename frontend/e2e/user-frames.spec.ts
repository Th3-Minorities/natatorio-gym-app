import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { expectNoViolations } from './axe.ts'

const SHOTS = process.env.USER_SCREENSHOT_DIR ?? ''
const profile = {
  name: 'María Rodríguez', email: 'm***z@upr.edu', locale: 'es', account_type: 'paid',
  authorization: { type: 'paid', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z',
}
const scenarios = [
  ['179-6068', 'welcome', 'normal'],
  ['179-6164', 'sign-in', 'normal'], ['sign-in-busy', 'sign-in', 'busy'], ['sign-in-wrong', 'sign-in', 'wrong'],
  ['4256-1822', 'sign-in', 'invalid'],
  ['4099-2091', 'sign-in', 'wait'], ['4099-2136', 'sign-in', 'offline'], ['4099-2180', 'account', 'replaced'],
  ['179-6186', 'recover-password', 'normal'], ['4099-2231', 'recover-password', 'busy'],
  ['4256-1846', 'recover-password', 'invalid'],
  ['4099-2260', 'recover-password', 'server'], ['4099-2295', 'recover-password', 'offline'], ['4099-2335', 'recover-password', 'received'],
  ['179-6199', 'reset-password', 'normal'], ['4099-2359', 'reset-password', 'validating'],
  ['4099-2377', 'reset-password', 'expired'], ['4256-1861', 'reset-password', 'invalid'], ['reset-offline', 'reset-password', 'offline'],
  ['4099-1533', 'account/delete', 'normal'], ['4099-1587', 'account/delete', 'confirm'],
  ['4099-1634', 'account/delete', 'active'], ['4099-1680', 'account/delete', 'offline'],
  ['4099-626', 'account', 'active'], ['4099-683', 'account', 'normal'], ['4099-800', 'account', 'loading'],
  ['4099-835', 'account', 'server'], ['4099-875', 'account', 'offline'],
  ['4099-740', 'account/settings', 'normal'], ['4099-1153', 'account/settings', 'english'],
  ['4099-1774', 'account/settings', 'saved'], ['4099-1207', 'account/settings', 'offline'],
] as const

async function fillAccess(page: Page, path: string, invalid = false) {
  if (path !== 'reset-password') await page.getByLabel('Correo electrónico').fill(invalid ? 'nombre@' : 'maria.rodriguez@upr.edu')
  if (path === 'sign-in' && !invalid) await page.getByLabel('Contraseña', { exact: true }).fill('0123456789')
  if (path === 'reset-password') {
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(invalid ? '1234' : '12345678')
    await page.getByLabel('Confirmar contraseña').fill(invalid ? 'abcdef' : 'abcdefgh')
  }
}

test.describe('User screen states at 390x844', () => {
  // All API requests are mocked; these captures run without Docker.
  test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 } })
  for (const [id, path, state] of scenarios) {
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
          return route.fulfill({ json: { ...profile, locale: state === 'english' ? 'en' : 'es', authorization: state === 'active' || (path === 'account' && state === 'offline') ? profile.authorization : null } })
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
        if (state === 'invalid') return fail('validation_failed', 422, path === 'sign-in'
          ? { email: ['email'], password: ['required'] } : path === 'recover-password'
            ? { email: ['email'] } : { password: ['min'], password_confirmation: ['confirmed'] })
        if (state === 'offline') return route.abort('internetdisconnected')
        if (endpoint.endsWith('/email')) return route.fulfill({ json: { status: 'received' } })
        return route.fulfill({ status: 204 })
      })
      await page.goto(`/${path}${path === 'reset-password' ? '?token=token&email=maria.rodriguez%40upr.edu' : ''}`)
      if (path.startsWith('account') && !['loading', 'replaced', 'server'].includes(state)) {
        await expect(page.getByRole('heading', { name: path === 'account' ? 'Mi cuenta' : path === 'account/settings' ? state === 'english' ? 'Settings' : 'Ajustes' : 'Eliminar cuenta', exact: true })).toBeVisible()
      }
      if (path === 'account/settings') {
        await expect(page.getByRole('link', { name: state === 'english' ? 'Back to My account' : 'Volver a Mi cuenta' })).toHaveAttribute('href', '/account')
        await expect(page.getByRole('button', { name: 'Español', exact: true })).toHaveAttribute('lang', 'es')
        await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('lang', 'en')
      }
      if (path === 'account/delete') {
        await expect(page.getByRole('link', { name: 'Volver a Ajustes' }).first()).toHaveAttribute('href', '/account/settings')
        if (state === 'normal') await expect(page.getByText('Si necesitas ayuda para eliminar tu cuenta, contacta al Staff del gimnasio.')).toBeVisible()
      }
      if (path === 'account' && state === 'normal') {
        await expect(page.getByText('Sin autorización activa', { exact: true })).toBeVisible()
        await expect(page.getByText('Miembro', { exact: true })).toBeVisible()
      }
      if (path === 'welcome') {
        await expect(page.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
        await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
        await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
        await expect(page.locator('.user-app')).toHaveCSS('background-color', 'rgb(32, 78, 42)')
      }
      if (state === 'saved') {
        await page.getByRole('button', { name: 'Español', exact: true }).click()
        await expect(page.getByRole('status')).toContainText('Idioma guardado')
      }
      if (['busy', 'wrong', 'wait', 'received', 'invalid'].includes(state) || (['offline', 'server'].includes(state) && !path.startsWith('account'))) {
        await fillAccess(page, path, state === 'invalid')
        await page.getByRole('button', { name: path === 'sign-in' ? 'Iniciar sesión' : path === 'recover-password' ? 'Enviar enlace' : 'Guardar contraseña', exact: true }).click()
      }
      if (state === 'confirm') {
        await page.getByRole('button', { name: 'Eliminar mi cuenta', exact: true }).click()
        await expect(page.getByRole('dialog', { name: '¿Eliminar tu cuenta?' })).toBeVisible()
      }
      if (state === 'offline' && path.startsWith('account')) {
        await page.evaluate("window.dispatchEvent(new Event('offline'))")
      }
      const ready = state === 'busy' ? path === 'sign-in' ? 'Iniciando sesión…' : 'Enviando enlace…'
        : state === 'wrong' ? 'No pudimos iniciar sesión' : state === 'wait' ? 'Espera antes de intentar de nuevo'
        : state === 'replaced' ? 'Iniciaste sesión en otro dispositivo' : state === 'received' ? 'Solicitud recibida'
        : state === 'expired' ? 'El enlace ya no es válido' : state === 'validating' ? 'Estamos verificando el enlace…'
        : state === 'invalid' ? path === 'reset-password' ? 'Las contraseñas deben coincidir.' : 'Escribe un correo electrónico válido.'
        : state === 'offline' ? 'Sin conexión · Datos no actualizados' : state === 'confirm' ? '¿Eliminar tu cuenta?'
        : state === 'server' ? path === 'account' ? 'No pudimos cargar tu cuenta' : 'No pudimos enviar la solicitud' : null
      if (ready) await expect(page.getByText(ready, { exact: true })).toBeVisible()
      if (state === 'offline' && path === 'account/delete') {
        await expect(page.getByText('Las copias de respaldo pueden conservar los datos hasta 4 semanas.', { exact: true })).toBeVisible()
        await expect(page.getByText('Si necesitas ayuda para eliminar tu cuenta, contacta al Staff del gimnasio.')).toHaveCount(0)
      }
      if (state === 'loading') {
        // Figma 4099:800 draws no loading text, so it is read by screen readers only.
        await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible()
        const hidden = page.locator('.user-account-loading .visually-hidden')
        await expect(hidden).toContainText('Cargando tu cuenta…')
        await expect(hidden).toHaveCSS('width', '1px')
      }
      // One cream for every User screen.
      await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(247, 245, 237)')
      // Figma 4099:2377 and 4099:2335 draw these results in the compact layout, without the form.
      const result = state === 'expired' || state === 'received'
      if (result) {
        await expect(page.locator('.user-app')).not.toHaveClass(/user-app--large/)
        await expect(page.locator('.field__input')).toHaveCount(0)
        await expect(page.locator('.user-header')).toHaveCSS('height', '112px')
        await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '22px')
      }
      if (path !== 'welcome' && !result && (!path.startsWith('account') || state === 'replaced')) {
        await expect(page.locator('.user-app')).toHaveClass(/user-app--large/)
        await expect(page.locator('html')).toHaveAttribute('lang', 'es')
        await expect(page.locator('.user-header')).toHaveCSS('height', '96px')
        await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '32px')
        if (path === 'sign-in' || state === 'replaced') {
          await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible()
          await expect(page.getByText('¿Primera vez aquí?', { exact: true })).toBeVisible()
          await expect(page.getByText('Comenzar', { exact: true })).toBeVisible()
        }
        const inputs = page.locator('.field__input')
        for (const input of await inputs.all()) {
          await expect(input).toHaveCSS('height', '52px')
          await expect(input).toHaveCSS('background-color', 'rgb(255, 253, 248)')
          if (state !== 'invalid') await expect(input).toHaveCSS('border-color', 'rgb(217, 220, 203)')
        }
        const toggles = page.getByRole('button', { name: 'Mostrar contraseña', exact: true })
        await expect(toggles).toHaveCount(path === 'recover-password' ? 0 : path === 'reset-password' ? 2 : 1)
        for (const toggle of await toggles.all()) await expect(toggle).toBeVisible()
      }
      for (const notice of await page.locator('.user-notice .notice').all()) {
        await expect(notice).toHaveCSS('background-color', 'rgb(255, 253, 248)')
      }
      if (state === 'invalid' && path !== 'reset-password') {
        const email = page.getByLabel('Correo electrónico')
        await expect(email).toBeFocused()
        await expect(email).toHaveAccessibleDescription('Escribe un correo electrónico válido.')
        await expect(email).toHaveCSS('border-color', 'rgb(142, 52, 44)')
        await expect(page.getByRole('alert')).toHaveCount(0)
        if (path === 'sign-in') {
          await expect(page.getByText('Este campo es obligatorio.', { exact: true })).toBeVisible()
          const password = page.getByLabel('Contraseña', { exact: true })
          await expect(password).toHaveAccessibleDescription('Este campo es obligatorio.')
          await expect(password).toHaveCSS('border-color', 'rgb(142, 52, 44)')
        }
      }
      if (state === 'replaced') await fillAccess(page, 'sign-in')
      if (path === 'reset-password' && state === 'normal') await expect(page.getByRole('button', { name: 'Guardar contraseña', exact: true })).toBeEnabled()
      await page.evaluate('document.fonts.ready')
      // Keyboard focus is verified separately; the visual target has no focus ring.
      await page.evaluate('document.activeElement && document.activeElement.blur()')
      if (SHOTS) {
        await mkdir(SHOTS, { recursive: true })
        const screenshot = join(SHOTS, `${id}${testInfo.project.name === 'chromium' ? '' : `-${testInfo.project.name}`}.png`)
        await page.screenshot({ path: screenshot })
      }
      await expectNoViolations(page)
      if (state === 'confirm') {
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
        const deleteButton = page.getByRole('button', { name: 'Eliminar mi cuenta', exact: true })
        await expect(deleteButton).toBeFocused()
        await deleteButton.click()
        await page.evaluate("window.dispatchEvent(new Event('offline'))")
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(deleteButton).toBeDisabled()
      }
      if (finish) await finish()
    })
  }
})
