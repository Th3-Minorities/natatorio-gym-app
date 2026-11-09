import { expect, test, type Page } from '@playwright/test'
import { api, fakeLocation, frontDeskCheckOut, holdToCheckIn, INSIDE, memberWithoutOpenVisit, openCheckIn, unlessClosed } from './flow.ts'

// #152 flow 5, Gym ID and occupancy: the Gym ID, offline and back, then Gimnasio, whose count follows a Check In and a
// check-out. Other visits in the seed only change the count if one reaches its 2-hour close during the test.

test.setTimeout(240_000)

/** The count and level Gimnasio shows; the level is a third of GYM_OCCUPANCY_MAX each (40 in .env.example). */
async function gym(page: Page) {
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Gimnasio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gimnasio' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Ocupación estimada' })).toBeVisible()
  const count = Number(await page.locator('.gym-occupancy__count strong').textContent())
  await expect(page.locator('.gym-occupancy__badge')).toHaveText(count < 40 / 3 ? 'Baja' : count <= 80 / 3 ? 'Moderada' : 'Alta')
  await expect(page.getByText(/^Actualizado a las /)).toBeVisible()
  return count
}

test('the Gym ID stays on screen offline and Gimnasio counts the visit', async ({ page, context, request, baseURL }) => {
  // 1. Gimnasio before the visit
  await fakeLocation(page, INSIDE)
  await memberWithoutOpenVisit(page, request, baseURL!)
  const before = await gym(page)

  // 2. Check In from inside: the Gym ID with an active session
  await openCheckIn(page)
  await holdToCheckIn(page)
  await unlessClosed(page, page.getByText('Sesión activa', { exact: true }))
  await expect(page.getByText('Entrada registrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Muestra esta tarjeta al personal.', { exact: true })).toBeVisible()
  await expect(page.getByText('Duración', { exact: true })).toBeVisible()

  // 3. Gym ID offline: the card stays but says it is not valid now, and comes back with the connection
  await context.setOffline(true)
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible()
  await expect(page.getByText('Restablece la conexión para validar tu tarjeta.', { exact: true })).toBeVisible()
  await expect(page.getByText('Conéctate para mostrar una tarjeta vigente.', { exact: true })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()

  // 4. Gimnasio after the Check In: one more person
  expect(await gym(page)).toBe(before + 1)

  // 5. Gimnasio after the front desk check-out: back to the count before
  const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
  await frontDeskCheckOut(request, baseURL!, body.session.id)
  await page.reload()
  await expect(page.locator('.gym-occupancy__count strong')).toHaveText(String(before))
})
