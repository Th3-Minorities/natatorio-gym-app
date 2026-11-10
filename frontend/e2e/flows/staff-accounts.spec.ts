import { expect, test, type Page } from '@playwright/test'
import { lastEmailTo, linkIn } from '../mail.ts'
import { ADMIN } from './flow.ts'

// #152 flow 8, staff accounts: Staff sign in to the dashboard, through invite, first sign-in, forgotten password,
// change role and deactivate. Each run invites a new fake address (e2e-flow-...@example.com).

test.setTimeout(240_000)

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/staff')
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
}

async function setPassword(page: Page, button: string, password: string) {
  await page.getByLabel('Nueva contraseña').fill(password)
  await page.getByLabel('Confirmar contraseña').fill(password)
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByRole('alert')).toContainText('Contraseña guardada')
}

test('an Administrator invites a person who signs in, recovers the password, changes role and is deactivated', async ({ page }) => {
  const run = Date.now()
  const email = `e2e-flow-${run}@example.com`
  const name = `Prueba Flujo ${run}`
  const row = page.getByRole('row', { name: new RegExp(email) })

  // 1. Sign in and out
  await signIn(page, ADMIN.email, 'wrong-password')
  await expect(page.getByRole('alert')).toContainText('No pudimos iniciar sesión')
  await signIn(page, ADMIN.email, ADMIN.password)
  await expect(page.getByText(`${ADMIN.name} · Administrador`)).toBeVisible()
  await signOut(page)

  // 2. Invite
  await signIn(page, ADMIN.email, ADMIN.password)
  await page.getByRole('link', { name: 'Cuentas del staff' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas del staff' })).toBeVisible()
  await page.getByRole('button', { name: 'Invitar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invitar al equipo' })
  await dialog.getByLabel('Nombre completo').fill(name)
  await dialog.getByLabel('Correo electrónico').fill(email)
  await dialog.getByLabel('Staff').check()
  await dialog.getByRole('button', { name: 'Enviar invitación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Invitación enviada' })).toBeVisible()
  await expect(row).toContainText('Invitado')
  await signOut(page)

  // 3. First sign-in from the invitation email
  await page.goto(linkIn(await lastEmailTo(page, email, '/staff/invitacion'), '/staff/invitacion'))
  await expect(page.getByRole('heading', { level: 1, name: 'Crear tu contraseña' })).toBeVisible()
  await setPassword(page, 'Crear contraseña', 'la primera frase larga del flujo')
  await signIn(page, email, 'la primera frase larga del flujo')
  await expect(page.getByText(`${name} · Staff`)).toBeVisible()
  await expect(page.getByText('Cuentas del staff')).toHaveCount(0)
  await signOut(page)

  // 4. Forgotten password
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Recuperar contraseña' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
  await page.goto(linkIn(await lastEmailTo(page, email, '/staff/restablecer'), '/staff/restablecer'))
  await expect(page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' })).toBeVisible()
  await setPassword(page, 'Guardar contraseña', 'la segunda frase larga del flujo')
  await signIn(page, email, 'la segunda frase larga del flujo')
  await expect(page.getByText(`${name} · Staff`)).toBeVisible()
  await signOut(page)

  // 5. Change role to Administrator
  await signIn(page, ADMIN.email, ADMIN.password)
  await page.getByRole('link', { name: 'Cuentas del staff' }).click()
  await page.getByRole('button', { name: `Cambiar rol, ${name}` }).click()
  const role = page.getByRole('dialog', { name: 'Cambiar rol' })
  await expect(role.getByText('Rol actual: Staff')).toBeVisible()
  await role.getByLabel('Administrador').check()
  await role.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Rol cambiado' })).toBeVisible()
  await expect(row).toContainText('Administrador')

  // 6. Deactivate: the account can no longer sign in
  await page.getByRole('button', { name: `Desactivar, ${name}` }).click()
  await page.getByRole('dialog', { name: `¿Desactivar a ${name}?` }).getByRole('button', { name: 'Desactivar cuenta' }).click()
  await expect(row).toContainText('Desactivado')
  await signOut(page)
  await signIn(page, email, 'la segunda frase larga del flujo')
  await expect(page.getByRole('alert')).toContainText('Cuenta desactivada')
})
