import { expect, test } from '@playwright/test'
import { api, COARSE, DENIED, fakeLocation, holdToCheckIn, INSIDE, memberWithoutOpenVisit, moveTo, openCheckIn, OUTSIDE, signInUser, unlessClosed } from './flow.ts'

// #152 flow 4, Check In: Check In to Gym ID, as the seeded paid member, with a faked location.

test.setTimeout(240_000)

test('Check In refuses each problem and opens the Gym ID from inside the gym', async ({ page, request, baseURL }) => {
  // 1. No authorization: the seeded member whose paid term ended. Checked before the hours, so it never depends on the clock.
  await fakeLocation(page, INSIDE)
  await signInUser(page, 'pago-vencido@example.com', 'password')
  await page.goto('/check-in')
  await holdToCheckIn(page)
  await expect(page.getByRole('heading', { name: 'Tu acceso no está vigente' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Revisar mi acceso' })).toHaveAttribute('href', '/account')

  // 2. Location denied: the browser refuses before anything is sent
  await memberWithoutOpenVisit(page, request, baseURL!)
  await openCheckIn(page)
  await moveTo(page, DENIED)
  await holdToCheckIn(page)
  await expect(page.getByRole('heading', { name: 'Activa el permiso de ubicación' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver cómo activar ubicación' }).click()
  await expect(page.getByRole('heading', { name: 'Activa tu ubicación' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar ayuda' }).click()

  // 3. Poor location accuracy (the first attempt the API sees: outside the seeded hours it stops here)
  await moveTo(page, COARSE)
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await unlessClosed(page, page.getByRole('heading', { name: 'Necesitamos mayor precisión' }))

  // 4. Outside the gym
  await moveTo(page, OUTSIDE)
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click()
  await expect(page.getByRole('heading', { name: 'Acércate al gimnasio' })).toBeVisible()

  // 5. Inside the gym: the Gym ID
  await moveTo(page, INSIDE)
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click()
  await expect(page.locator('.check-in-lead')).toHaveText('¡Tu entrada quedó registrada!')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(page.getByText('Estudiante', { exact: true })).toBeVisible()
  const entry = await page.locator('.check-in-id__time').textContent()

  // 6. Repeated Check In: the API answers with the same open visit, and the Gym ID keeps its entry time
  const { body: first } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
  const again = await api(page.request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  expect(again.status).toBe(200)
  expect(again.body.session.id).toBe(first.session.id)
  await page.reload()
  await expect(page.getByText('Tu entrada está registrada', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-id__time')).toHaveText(entry!)
})
