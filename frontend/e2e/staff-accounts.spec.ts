import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// #84: the staff accounts screen (A-15) and the N-11 email link pages, through the proxy, the real API
// and Mailpit. Each run invites a new fake address (e2e-...@example.com), so the dev list grows by one.

test.setTimeout(240_000)

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const ADMIN = { email: 'admin@example.com', name: 'Administradora de prueba' }

async function expectNoViolations(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([])
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/staff')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

async function openTeam(page: Page) {
  await signIn(page, ADMIN.email, 'password')
  await page.getByRole('link', { name: 'Cuentas del staff' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas del staff' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
}

/** Presses "Enviar invitación" and fails at once, with the status, if the API refuses, instead of waiting for a toast. */
async function sendInvitation(page: Page, dialog: Locator) {
  const answer = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/staff/accounts' && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Enviar invitación' }).click()
  const response = await answer
  expect(response.ok(), `POST /api/staff/accounts answered ${response.status()}: ${await response.text()}`).toBe(true)
}

/** The newest email Mailpit caught for an address, as plain text. */
async function lastEmailTo(page: Page, address: string): Promise<string> {
  let text = ''
  await expect(async () => {
    const found = await (await page.request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=1`)).json()
    expect(found.messages.length).toBeGreaterThan(0)
    const message = await (await page.request.get(`/mailpit/api/v1/message/${found.messages[0].ID}`)).json()
    text = message.Text
  }).toPass({ timeout: 60_000 })
  return text
}

function linkIn(text: string, path: string): string {
  const match = text.match(new RegExp(`https?://\\S+${path}\\?\\S+`))
  if (!match) throw new Error(`No ${path} link in the email`)
  return new URL(match[0]).pathname + new URL(match[0]).search
}

test('an Administrator invites a person, who creates a password and signs in', async ({ page }) => {
  const run = Date.now()
  const email = `e2e-${run}@example.com`
  const name = `Prueba Invitación ${run}`
  await openTeam(page)
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Invitar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invitar al equipo' })
  await expect(dialog).toBeVisible()
  await expectNoViolations(page)
  await dialog.getByLabel('Nombre completo').fill(name)
  await dialog.getByLabel('Correo electrónico').fill(email)
  await dialog.getByLabel('Staff').check()
  await sendInvitation(page, dialog)
  await expect(page.getByRole('status').filter({ hasText: 'Invitación enviada' })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Invitado')

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.goto(linkIn(await lastEmailTo(page, email), '/staff/invitacion'))
  await expect(page.getByRole('heading', { level: 1, name: 'Crear tu contraseña' })).toBeVisible()
  await expect(page.getByText(name)).toBeVisible()
  await expectNoViolations(page)

  const password = 'una frase larga para la prueba'
  await page.getByLabel('Nueva contraseña').fill(password)
  await page.getByLabel('Confirmar contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('Contraseña guardada')
  expect(new URL(page.url()).search).toBe('')
  await expectNoViolations(page)

  await signIn(page, email, password)
  await expect(page.getByText(`${name} · Staff`)).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()

  // The used link now opens "Enlace vencido o usado".
  await page.goto(linkIn(await lastEmailTo(page, email), '/staff/invitacion'))
  await expect(page.getByRole('heading', { level: 1, name: 'Enlace vencido o usado' })).toBeVisible()
  await expectNoViolations(page)

  // Deactivate, then reactivate, the new account.
  await openTeam(page)
  await page.getByRole('button', { name: `Desactivar, ${name}` }).click()
  const confirm = page.getByRole('dialog', { name: `¿Desactivar a ${name}?` })
  await expectNoViolations(page)
  await confirm.getByRole('button', { name: 'Desactivar cuenta' }).click()
  await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Desactivado')
  await page.getByRole('button', { name: `Reactivar, ${name}` }).click()
  await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Activo')
})

test('the invite dialog keeps focus inside, closes with Esc and gives focus back', async ({ page }) => {
  await openTeam(page)
  const invite = page.getByRole('button', { name: 'Invitar' })
  await invite.click()
  const dialog = page.getByRole('dialog', { name: 'Invitar al equipo' })
  await expect(dialog).toBeVisible()

  // Walk past every control twice: focus never lands on the page behind the dialog.
  for (let step = 0; step < 16; step += 1) {
    await page.keyboard.press('Tab')
    // A string, because the e2e files are type checked without the browser types.
    const outside = await page.evaluate(
      `(() => { const a = document.activeElement; return a !== null && a !== document.body && a.closest('dialog') === null })()`,
    )
    expect(outside, `Tab ${step + 1} left the dialog`).toBe(false)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(invite).toBeFocused()
})

test('a forgotten password: the reset email link sets a new password', async ({ page }) => {
  // Its own invited account, so the seeded accounts keep the password "password".
  const run = Date.now()
  const email = `e2e-reset-${run}@example.com`
  const name = `Prueba Restablecer ${run}`
  await openTeam(page)
  await page.getByRole('button', { name: 'Invitar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invitar al equipo' })
  await dialog.getByLabel('Nombre completo').fill(name)
  await dialog.getByLabel('Correo electrónico').fill(email)
  await sendInvitation(page, dialog)
  await expect(page.getByRole('status').filter({ hasText: 'Invitación enviada' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.goto(linkIn(await lastEmailTo(page, email), '/staff/invitacion'))
  await page.getByLabel('Nueva contraseña').fill('la primera frase larga')
  await page.getByLabel('Confirmar contraseña').fill('la primera frase larga')
  await page.getByRole('button', { name: 'Crear contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('Contraseña guardada')

  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Recuperar contraseña' })).toBeVisible()
  await expectNoViolations(page)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
  await expectNoViolations(page)

  await page.goto(linkIn(await lastEmailTo(page, email), '/staff/restablecer'))
  await expect(page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' })).toBeVisible()
  await expectNoViolations(page)
  await page.getByLabel('Nueva contraseña').fill('la segunda frase larga')
  await page.getByLabel('Confirmar contraseña').fill('la segunda frase larga')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('Contraseña guardada')

  await signIn(page, email, 'la segunda frase larga')
  await expect(page.getByText(`${name} · Staff`)).toBeVisible()
})

test('the A-15 screen and the N-11 pages reflow at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const path of ['/staff/recuperar', '/staff/invitacion']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  }
  await openTeam(page)
  // The table scrolls inside its own region; the page itself does not.
  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
})
