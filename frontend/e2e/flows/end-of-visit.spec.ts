import { expect, test } from '@playwright/test'
import { api, fakeLocation, frontDeskCheckOut, holdToCheckIn, INSIDE, memberWithoutOpenVisit, openCheckIn, unlessClosed } from './flow.ts'

// #152 flow 6, end of a visit: an active session to "Tu visita ha terminado". The front desk check-out screen is not on
// main yet, so the desk's step goes through its API. The 2-hour close and the end of the term need the server clock moved
// forward, which a browser test cannot do; the backend tests cover them.

test.setTimeout(240_000)

test('a front desk check-out ends the visit on the member phone', async ({ page, request, baseURL }) => {
  // 1. Active session
  await fakeLocation(page, INSIDE)
  await memberWithoutOpenVisit(page, request, baseURL!)
  await openCheckIn(page)
  await holdToCheckIn(page)
  await unlessClosed(page, page.getByText('Sesión activa', { exact: true }))

  // 2. Check-out at the front desk
  const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
  await frontDeskCheckOut(request, baseURL!, body.session.id)

  // 3. Visit ended on the phone
  await page.reload()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
  await expect(page.getByText('Sesión finalizada', { exact: true })).toBeVisible()
  await expect(page.getByText('Duración total', { exact: true })).toBeVisible()
  await expect(page.getByText('Salida', { exact: true })).toBeVisible()
  await expect(page.getByText('Tu salida fue registrada por el personal.', { exact: true })).toBeVisible()

  // 4. Continuar: ready for the next visit
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('¿Listo para entrenar?', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()
})
