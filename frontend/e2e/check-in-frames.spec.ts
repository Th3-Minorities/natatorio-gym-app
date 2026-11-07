import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// U-01 Check In frames of the Figma page "#41 Gym ID and Check in", rendered with a mocked API.
const SHOTS = process.env.CHECK_IN_SCREENSHOT_DIR ?? ''
const NOW = new Date('2026-11-07T17:07:24Z')
const people = {
  member: { name: 'Daniel Rivera', email: 'daniel@email.com', locale: 'es', authorization: { type: 'paid', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z' },
  athlete: { name: 'Valeria Ramos', email: 'valeria@upr.edu', locale: 'es', authorization: { type: 'athlete', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z' },
}
const period = { starts_at: '2026-11-07T18:00:00Z', ends_at: '2026-11-07T20:00:00Z' }
const session = { id: 1, started_at: '2026-11-07T16:42:00Z', status: 'active' }

type Kind = 'member' | 'athlete'
type Frame = { id: string; kind: Kind; state: string; ready: string }
const frame = (id: string, kind: Kind, state: string, ready: string): Frame => ({ id, kind, state, ready })
const frames: Frame[] = [
  frame('4104-95', 'member', 'ready', '¿Listo para entrenar?'),
  frame('4104-173', 'athlete', 'ready', '¿Listo para entrenar?'),
  frame('4104-251', 'member', 'pressing', 'Mantén presionado…'),
  frame('4199-3308', 'athlete', 'pressing', 'Mantén presionado…'),
  frame('4104-719', 'member', 'confirmed', '¡Tu entrada quedó registrada!'),
  frame('4199-3403', 'athlete', 'confirmed', '¡Tu entrada quedó registrada!'),
  frame('4105-554', 'member', 'upcoming', 'Próximo horario exclusivo de atletas'),
  frame('4199-3509', 'athlete', 'upcoming', 'Próximo horario exclusivo de atletas'),
  frame('4105-639', 'member', 'exclusive', 'Ahora entrenan los atletas'),
  frame('4105-704', 'athlete', 'exclusive', 'Horario exclusivo de atletas'),
  frame('4106-1284', 'member', 'check_in_no_authorization', 'Tu acceso no está vigente'),
  frame('4199-4067', 'athlete', 'check_in_no_authorization', 'Tu acceso de atleta no está vigente'),
  frame('4106-1344', 'member', 'check_in_gym_closed', 'El gimnasio está cerrado'),
  frame('4199-4140', 'athlete', 'check_in_gym_closed', 'El gimnasio está cerrado'),
  frame('4106-1404', 'athlete', 'check_in_photo_required', 'Necesitamos una foto nueva'),
  frame('4106-1476', 'member', 'check_in_photo_pending', 'Tu foto necesita actualizarse'),
  frame('4199-4217', 'athlete', 'check_in_photo_pending', 'Tu foto necesita actualizarse'),
  frame('4106-1536', 'member', 'denied', 'Activa el permiso de ubicación'),
  frame('4199-4358', 'athlete', 'denied', 'Activa el permiso de ubicación'),
  frame('4106-1597', 'member', 'unavailable', 'No pudimos obtener tu ubicación'),
  frame('4199-4436', 'athlete', 'unavailable', 'No pudimos obtener tu ubicación'),
  frame('4106-1669', 'member', 'check_in_low_accuracy', 'Necesitamos mayor precisión'),
  frame('4199-4513', 'athlete', 'check_in_low_accuracy', 'Necesitamos mayor precisión'),
  frame('4106-1729', 'member', 'check_in_outside_boundary', 'Acércate al gimnasio'),
  frame('4199-4657', 'athlete', 'check_in_outside_boundary', 'Acércate al gimnasio'),
  frame('4106-1789', 'member', 'offline', 'Necesitas conexión'),
  frame('4199-4734', 'athlete', 'offline', 'Necesitas conexión'),
]

test.describe('Check In Figma frames at 390x844', () => {
  test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 } })
  for (const { id, kind, state, ready } of frames) {
    test(`${id} ${kind} ${state}`, async ({ page }, testInfo) => {
      await page.clock.setFixedTime(NOW)
      await page.addInitScript((failure) => {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition(success: (position: object) => void, error: (failure: object) => void) {
              if (failure) error({ code: failure })
              else success({ coords: { latitude: 18.2101, longitude: -67.1408, accuracy: 12 } })
            },
          },
        })
      }, state === 'denied' ? 1 : state === 'unavailable' ? 2 : 0)
      const status = {
        session: state === 'confirmed' ? session : null,
        athletes_period: state === 'upcoming' ? { state: 'upcoming', ...period } : state === 'exclusive' ? { state: 'active', ...period } : null,
        // The API sends the type of the latest authorization, current or not.
        account_type: kind,
        member_group: kind === 'member' ? 'student' : null,
        sport: kind === 'athlete' ? 'Voleibol' : null,
      }
      await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
        const endpoint = new URL(route.request().url()).pathname
        if (endpoint.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers: { 'set-cookie': 'XSRF-TOKEN=test; Path=/' } })
        if (endpoint.endsWith('/me')) return route.fulfill({ json: { ...people[kind], authorization: state === 'check_in_no_authorization' ? null : people[kind].authorization } })
        if (route.request().method() === 'GET') return route.fulfill({ json: status })
        if (state === 'offline') return route.abort('internetdisconnected')
        return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: state } }) })
      })
      await page.goto('/check-in')
      await expect(page.getByText(kind === 'athlete' ? 'Atleta' : 'Miembro', { exact: true }).or(page.getByText('Sesión activa')).first()).toBeVisible()
      await page.evaluate('document.fonts.ready')
      const hold = page.getByRole('button', { name: 'Mantén presionado para entrar' })
      if (state === 'pressing') {
        await hold.hover()
        await page.mouse.down()
        await page.waitForTimeout(580)
      } else if (!['ready', 'confirmed', 'upcoming', 'exclusive'].includes(state)) {
        await hold.focus()
        await page.keyboard.down(' ')
        await page.waitForTimeout(1100)
        await page.keyboard.up(' ')
      }
      await expect(page.getByText(ready).first()).toBeVisible()
      if (state !== 'pressing') await page.evaluate('document.activeElement && document.activeElement.blur()')
      if (SHOTS) {
        await mkdir(SHOTS, { recursive: true })
        await page.screenshot({ path: join(SHOTS, `${id}${testInfo.project.name === 'chromium' ? '' : `-${testInfo.project.name}`}.png`) })
      }
      if (state === 'pressing') await page.mouse.up()
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(accessibility.violations).toEqual([])
    })
  }
})
