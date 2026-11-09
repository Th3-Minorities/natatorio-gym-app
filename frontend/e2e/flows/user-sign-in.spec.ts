import { expect, test } from '@playwright/test'
import { lastEmailTo, linkIn } from '../mail.ts'
import { signInUser } from './flow.ts'

// #152 flow 3, User sign in: Sign in to Check In. The seeded browser test User (E2E_USER_*) and, for the forgotten
// password, the seeded sin-autorizacion@example.com, which gets a new password on every run.

test.setTimeout(240_000)

const USER = { email: process.env.E2E_USER_EMAIL ?? 'user@example.com', password: process.env.E2E_USER_PASSWORD ?? 'test-user-password-129' }

test('a User signs in, reaches Check In, is replaced by a second phone and recovers a forgotten password', async ({ page, browser, baseURL }) => {
  // 1. Wrong password
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(USER.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByText('No pudimos iniciar sesión', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)

  // 2. Right password, then Check In from the navigation
  await signInUser(page, USER.email, USER.password)
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Check-in' }).click()
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Check-in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()

  // 3. Sign in on a second phone: the first one is signed out
  const second = await browser.newContext({ baseURL })
  try {
    const phone = await second.newPage()
    await signInUser(phone, USER.email, USER.password)
    await page.reload()
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await second.close() }

  // 4. Forgotten password: email link, new password, sign in with it
  const email = 'sin-autorizacion@example.com'
  const password = `una frase nueva de prueba ${Date.now()}`
  // The address is reused across runs: drop its older emails so the wait below finds this run's link.
  await page.request.delete(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  await page.goto('/sign-in')
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page).toHaveURL(/\/recover-password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Recuperar contraseña' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  await page.goto(linkIn(await lastEmailTo(page, email, '/reset-password'), '/reset-password'))
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña').fill(password)
  await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await signInUser(page, email, password)
  await expect(page.getByText('Sin autorización activa', { exact: true })).toBeVisible()
})
