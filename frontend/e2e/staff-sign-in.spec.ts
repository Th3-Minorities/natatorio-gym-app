import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// #16: the staff sign-in at /staff, through the proxy and the real API, like the desk computer.
// Uses the fake accounts of the database seeder (password "password"), never real people.

// On Windows each API request can take seconds (README, "Slow on Windows"), and this flow makes several.
test.setTimeout(180_000)

const ADMIN = { email: 'admin@example.com', name: 'Administradora de prueba' }
const STAFF = { email: 'staff@example.com', name: 'Recepción de prueba' }

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

async function openSignIn(page: Page) {
  await page.goto('/staff')
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
}

test('an Administrator signs in, stays signed in after a reload, and signs out', async ({ page }) => {
  await openSignIn(page)

  await signIn(page, ADMIN.email, 'wrong-password')
  await expect(page.getByRole('alert')).toContainText('No pudimos iniciar sesión')

  await signIn(page, ADMIN.email, 'password')
  await expect(page.getByText(`${ADMIN.name} · Administración`)).toBeVisible()
  await expect(page.getByText('Administración', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText(`${ADMIN.name} · Administración`)).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Staff do not see the Administration items', async ({ page }) => {
  await openSignIn(page)

  await signIn(page, STAFF.email, 'password')

  await expect(page.getByText(`${STAFF.name} · Staff`)).toBeVisible()
  await expect(page.getByText('Sesiones activas')).toBeVisible()
  await expect(page.getByText('Registro de auditoría')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
})

test('the sign-in works with the keyboard alone', async ({ page }) => {
  await openSignIn(page)

  // An empty submit sends focus to the first field with an error, so a screen reader reads it.
  await page.getByRole('button', { name: 'Iniciar sesión' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Correo electrónico')).toBeFocused()

  // Start again from a fresh page to check the Tab order from the top.
  await openSignIn(page)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Correo electrónico')).toBeFocused()
  await page.keyboard.type(ADMIN.email)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña')).toBeFocused()
  await page.keyboard.type('password')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeFocused()

  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Enter')
  // While it signs in, the busy button keeps focus instead of dropping it to the page.
  await expect(page.getByRole('button', { name: 'Iniciando sesión…' })).toBeFocused()
  await expect(page.getByText(`${ADMIN.name} · Administración`)).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
})

test('N-11 and the signed-in dashboard have no automated WCAG 2.2 AA violations', async ({ page }) => {
  const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
  await openSignIn(page)

  expect((await new AxeBuilder({ page }).withTags(wcag).analyze()).violations).toEqual([])

  await signIn(page, ADMIN.email, 'password')
  await expect(page.getByText(`${ADMIN.name} · Administración`)).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(wcag).analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
})
