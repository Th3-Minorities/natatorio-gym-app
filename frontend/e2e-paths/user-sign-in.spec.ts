import { expect, test, devices, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { api, fakeLocation, holdToCheckIn, INSIDE, signInUser, STAFF } from '../e2e/flows/flow.ts'
import { lastEmailTo, linkIn } from '../e2e/mail.ts'
import { countRequests, createMember, dropMarkedSlots, flushCache, rawApi, resetSchedule, sessionCount, signInApi, tinkerJson } from './setup.ts'
import { ageResetToken, clearLockWaits, createUser, expireSession, mailCount, softDelete, unique } from './setup-sign-in.ts'

// #152 path tests for flow 3, User sign in. One test per row of the path inventory (SI-01 to SI-53; SI-54 is not built and
// SI-55 is manual). Every test makes its own users: the seeded sin-autorizacion@example.com is never used because the flow
// spec rewrites its password. The lockout rows (SI-14 to SI-18 and SI-40) lock the whole IP, so they run last.

test.setTimeout(120_000)

test.beforeAll(() => {
  flushCache()
  resetSchedule()
})
test.beforeEach(() => flushCache())
test.afterAll(() => {
  flushCache()
  dropMarkedSlots()
})

const ABBREVIATION: Record<string, string> = { desktop: 'D', android: 'A', iphone: 'I' }
/** Limits a row to the devices the inventory lists (D desktop, A Android, I iPhone; the inventory's E is Edge, not a project). */
function only(devicesListed: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devicesListed.includes(device), `the inventory lists ${devicesListed} for this path`)
}

const SEEDED_USER = { email: process.env.E2E_USER_EMAIL ?? 'user@example.com', password: process.env.E2E_USER_PASSWORD ?? 'test-user-password-129' }

// ------------------------------------------------------------------------------------------------------- helpers

const emailField = (page: Page) => page.getByLabel('Correo electrónico')
const passwordField = (page: Page) => page.getByLabel('Contraseña', { exact: true })
const signInButton = (page: Page) => page.getByRole('button', { name: 'Iniciar sesión', exact: true })
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })

const WRONG_TITLE = 'No pudimos iniciar sesión'
const WRONG_TEXT = 'Revisa el correo y la contraseña e intenta de nuevo.'
const REPLACED_TITLE = 'Iniciaste sesión en otro dispositivo'
const REPLACED_TEXT = 'Vuelve a iniciar sesión para usar tu cuenta aquí.'
const WAIT_TITLE = 'Espera antes de intentar de nuevo'
const REQUIRED = 'Este campo es obligatorio.'
const INVALID_EMAIL = 'Escribe un correo electrónico válido.'

async function openSignIn(page: Page) {
  await page.goto('/sign-in')
  await expect(heading(page, 'Iniciar sesión')).toBeVisible()
}

/** Opens the form, fills it and presses the button (no wait for the result). */
async function attempt(page: Page, email: string, password: string) {
  await openSignIn(page)
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await signInButton(page).click()
}

async function expectWrong(page: Page) {
  await expect(page.getByText(WRONG_TITLE, { exact: true })).toBeVisible()
  await expect(page.getByText(WRONG_TEXT, { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function expectReplaced(page: Page) {
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText(REPLACED_TITLE, { exact: true })).toBeVisible()
  await expect(page.getByText(REPLACED_TEXT, { exact: true })).toBeVisible()
}

async function expectAccount(page: Page) {
  await expect(page).toHaveURL(/\/account$/)
  await expect(heading(page, 'Mi cuenta')).toBeVisible()
}

const minutesOfDay = (hour: number, minute: number) => hour * 60 + minute

/** The wait notice names a Puerto Rico clock time about `seconds` from now. */
async function expectWait(page: Page, seconds = 60) {
  await expect(page.getByText(WAIT_TITLE, { exact: true })).toBeVisible()
  const text = (await page.getByText(/^Intenta de nuevo a las /).textContent()) ?? ''
  const match = text.match(/a las (\d{1,2}):(\d{2})\s*([ap])\.?\s*m/i)
  expect(match, `wait text: ${text}`).not.toBeNull()
  let hour = Number(match![1]) % 12
  if (match![3].toLowerCase() === 'p') hour += 12
  const shown = minutesOfDay(hour, Number(match![2]))
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Puerto_Rico', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date())
  const now = minutesOfDay(Number(parts.find((p) => p.type === 'hour')!.value) % 24, Number(parts.find((p) => p.type === 'minute')!.value))
  const ahead = (shown - now + 1440) % 1440
  const expected = Math.round(seconds / 60)
  expect(ahead, `shown ${text}, now ${now}`).toBeGreaterThanOrEqual(expected - 1)
  expect(ahead, `shown ${text}, now ${now}`).toBeLessThanOrEqual(expected + 2)
}

/** Sends `times` wrong passwords through the API (each counts as one failed attempt for the email and for the IP). */
async function fail(page: Page, baseURL: string | undefined, email: string, times: number) {
  for (let i = 0; i < times; i++) {
    const { status } = await rawApi(page.request, 'post', '/api/user/sign-in', baseURL!, { email, password: 'incorrecta-' + i })
    expect(status).toBe(422)
  }
}

/** A second phone: another browser context of the same device type. */
async function secondPhone(browser: Browser, baseURL: string | undefined) {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = test.info().project.use
  const context = await browser.newContext({ baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor })
  return { context, page: await context.newPage() }
}

async function closeAll(...contexts: BrowserContext[]) {
  for (const context of contexts) await context.close()
}

/** Requests a reset link for the address through the screens and returns the path and query from the email. */
async function requestLink(page: Page, email: string): Promise<string> {
  await page.goto('/recover-password')
  await expect(heading(page, 'Recuperar contraseña')).toBeVisible()
  await emailField(page).fill(email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  return linkIn(await lastEmailTo(page, email, '/reset-password'), '/reset-password')
}

async function saveNewPassword(page: Page, password: string, confirmation = password) {
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña').fill(confirmation)
  await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click()
}

async function expectExpiredLink(page: Page) {
  await expect(heading(page, 'El enlace ya no es válido')).toBeVisible()
  await expect(page.getByText('Solicita un nuevo enlace', { exact: true })).toBeVisible()
  await expect(page.getByText('Este enlace venció o ya se utilizó.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/recover-password')
  await expect(page.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/sign-in')
}

async function expectResetForm(page: Page) {
  await expect(heading(page, 'Nueva contraseña')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar contraseña', exact: true })).toBeEnabled()
}

const serverError = { status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'server_error' } }) }

function longEmail(total: number): string {
  const domain = total - 65
  return `${'a'.repeat(64)}@${['x'.repeat(63), 'x'.repeat(63), 'x'.repeat(domain - 2 - 126)].join('.')}`
}

// ---------------------------------------------------------------------------------------------- valid sign in

test('SI-01 a User signs in with the right password and reaches Check In with one tap', async ({ page }) => {
  await signInUser(page, SEEDED_USER.email, SEEDED_USER.password)
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Check-in' }).click()
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(heading(page, 'Check-in')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()
})

test('SI-02 Mi cuenta shows the badge and access line of each account type', async ({ page }) => {
  only('D')
  const athlete = tinkerJson<string>(`echo json_encode(\\App\\Models\\RosterRecord::where('student_number', '802000002')->value('institutional_email'));`)
  const current = 'Acceso vigente · Término actual'
  const none = 'Sin autorización activa'
  const rows: { email: string; password: string; badge: string | null; access: string; athleteRow: boolean }[] = [
    { email: 'pago-activo@example.com', password: 'password', badge: 'Miembro', access: current, athleteRow: false },
    { email: athlete, password: 'password', badge: 'Atleta', access: current, athleteRow: false },
    { email: 'concedido-manual@example.com', password: 'password', badge: 'Acceso manual', access: current, athleteRow: false },
    { email: 'pago-vencido@example.com', password: 'password', badge: 'Miembro', access: none, athleteRow: true },
    { email: 'atleta-removido@example.com', password: 'password', badge: 'Atleta', access: none, athleteRow: true },
    { email: 'orden-cancelada@example.com', password: 'password', badge: 'Miembro', access: none, athleteRow: true },
    { ...SEEDED_USER, badge: null, access: none, athleteRow: true },
  ]
  for (const row of rows) {
    await page.context().clearCookies()
    await signInUser(page, row.email, row.password)
    await expect(page.getByText(row.access, { exact: true }), row.email).toBeVisible()
    const badge = page.locator('.user-profile__badge')
    if (row.badge) await expect(badge, row.email).toHaveText(row.badge)
    else await expect(badge, row.email).toHaveCount(0)
    await expect(page.getByText('Soy atleta', { exact: true }), row.email).toHaveCount(row.athleteRow ? 1 : 0)
  }
})

// -------------------------------------------------------------------------------------------- refused sign in

test('SI-03 a wrong password shows the notice, keeps the email and stays on Sign in', async ({ page }) => {
  const user = createUser()
  await attempt(page, user.email, 'no-es-la-contraseña')
  await expectWrong(page)
  await expect(emailField(page)).toHaveValue(user.email)
})

test('SI-04 an unknown email gets the same notice', async ({ page }) => {
  only('D')
  await attempt(page, `nadie-${unique()}@example.com`, 'cualquier contraseña')
  await expectWrong(page)
})

test('SI-05 staff credentials do not sign in as a User', async ({ page }) => {
  only('D')
  await attempt(page, 'admin@example.com', 'password')
  await expectWrong(page)
})

test('SI-06 the email is case insensitive and trimmed', async ({ page }) => {
  only('D')
  const user = createUser()
  await attempt(page, user.email.toUpperCase().replace('@EXAMPLE.COM', '@Example.COM'), user.password)
  await expectAccount(page)
  await page.context().clearCookies()
  await attempt(page, ` ${user.email} `, user.password)
  await expectAccount(page)
})

test('SI-07 the password is case sensitive and never trimmed', async ({ page }) => {
  only('D')
  const user = createUser({ password: 'Una Frase Larga 07' })
  await attempt(page, user.email, user.password.toUpperCase())
  await expectWrong(page)
  await attempt(page, user.email, `${user.password} `)
  await expectWrong(page)
})

// ----------------------------------------------------------------------------------------------- field checks

test('SI-08 empty fields are answered by the server under each missing field and focus the first', async ({ page }) => {
  only('DAI')
  const user = createUser()
  await openSignIn(page)
  await signInButton(page).click()
  await expect(page.getByText(REQUIRED, { exact: true })).toHaveCount(2)
  await expect(emailField(page)).toBeFocused()
  await emailField(page).fill(user.email)
  await signInButton(page).click()
  await expect(page.getByText(REQUIRED, { exact: true })).toHaveCount(1)
  await expect(passwordField(page)).toBeFocused()
  await emailField(page).fill('')
  await passwordField(page).fill('algo')
  await signInButton(page).click()
  await expect(page.getByText(REQUIRED, { exact: true })).toHaveCount(1)
  await expect(emailField(page)).toBeFocused()
})

test('SI-09 email format: nombre@ and nombre are invalid, a@b passes the format', async ({ page }) => {
  only('D')
  await attempt(page, 'nombre@', 'cualquier contraseña')
  await expect(page.getByText(INVALID_EMAIL, { exact: true })).toBeVisible()
  await attempt(page, 'nombre', 'cualquier contraseña')
  await expect(page.getByText(INVALID_EMAIL, { exact: true })).toBeVisible()
  await attempt(page, 'a@b', 'cualquier contraseña')
  await expectWrong(page)
  await attempt(page, 'nombre@ejemplo', 'cualquier contraseña')
  await expectWrong(page)
})

test('SI-10 email length: the field stops at 255 and the server refuses a 255 and a 256 character address', async ({ page, baseURL }) => {
  only('D')
  // The inventory expected the 255 character address to reach the account lookup; the server's email rule refuses it first
  // (addresses much shorter than 255 characters already fail that rule), so the notice is the invalid email one.
  const email = longEmail(255)
  expect(email).toHaveLength(255)
  await openSignIn(page)
  await emailField(page).fill(email)
  await emailField(page).pressSequentially('z')
  expect((await emailField(page).inputValue()).length).toBe(255)
  await passwordField(page).fill('cualquier contraseña')
  await signInButton(page).click()
  await expect(page.getByText(INVALID_EMAIL, { exact: true })).toBeVisible()
  await expect(page.getByText('Algo salió mal de nuestro lado. Intenta más tarde.')).toHaveCount(0)
  const tooLong = longEmail(256)
  expect(tooLong).toHaveLength(256)
  const { status, body } = await rawApi(page.request, 'post', '/api/user/sign-in', baseURL!, { email: tooLong, password: 'cualquier contraseña' })
  expect(status).toBe(422)
  expect(body.error.code).toBe('validation_failed')
  expect(body.error.details.email).toContain('max')
})

test('SI-11 password length: 255 characters sign in, the 256th is refused', async ({ page, baseURL }) => {
  only('D')
  const user = createUser({ password: 'p'.repeat(255) })
  await openSignIn(page)
  await emailField(page).fill(user.email)
  await passwordField(page).fill(user.password)
  await passwordField(page).pressSequentially('q')
  expect((await passwordField(page).inputValue()).length).toBe(255)
  await signInButton(page).click()
  await expectAccount(page)
  const { status, body } = await rawApi(page.request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: 'p'.repeat(256) })
  expect(status).toBe(422)
  expect(body.error.details.password).toContain('max')
})

test('SI-12 a non-ASCII password signs in', async ({ page }) => {
  only('DAI')
  const user = createUser({ password: 'contraseña-ñandú-🙂-123' })
  await attempt(page, user.email, user.password)
  await expectAccount(page)
})

test('SI-13 hostile input is shown as text, runs no script and never makes a 500', async ({ page }) => {
  only('D')
  const dialogs: string[] = []
  const statuses: number[] = []
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
  page.on('response', (response) => { if (response.url().endsWith('/api/user/sign-in')) statuses.push(response.status()) })
  await attempt(page, "'; DROP TABLE users;--@x.com", "'; DROP TABLE users;--")
  await expect(page.getByText(INVALID_EMAIL, { exact: true }).or(page.getByText(WRONG_TITLE, { exact: true }))).toBeVisible()
  await attempt(page, '<script>alert(1)</script>', '<script>alert(1)</script>')
  await expect(page.getByText(INVALID_EMAIL, { exact: true }).or(page.getByText(WRONG_TITLE, { exact: true }))).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(dialogs).toEqual([])
  expect(statuses.length).toBeGreaterThan(0)
  expect(statuses.every((status) => status < 500), `statuses ${statuses}`).toBe(true)
  const user = createUser()
  await attempt(page, user.email, user.password)
  await expectAccount(page)
})

// ------------------------------------------------------------------------------------- the one active session

test('SI-19 a second phone replaces the first one', async ({ page, browser, baseURL }) => {
  const user = createUser()
  await signInUser(page, user.email, user.password)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, user.email, user.password)
    await page.reload()
    await expectReplaced(page)
    await expectAccount(second.page)
  } finally { await closeAll(second.context) }
})

test('SI-20 the replaced phone finds out by itself when it regains focus', async ({ page, browser, baseURL }) => {
  only('DAI')
  const user = createUser()
  await signInUser(page, user.email, user.password)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, user.email, user.password)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expectReplaced(page)
  } finally { await closeAll(second.context) }
})

test('SI-21 ping-pong: the first phone signs in again and the second becomes the replaced one', async ({ page, browser, baseURL }) => {
  only('D')
  const user = createUser()
  await signInUser(page, user.email, user.password)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, user.email, user.password)
    await page.reload()
    await expectReplaced(page)
    await signInUser(page, user.email, user.password)
    await second.page.reload()
    await expectReplaced(second.page)
    await expectAccount(page)
  } finally { await closeAll(second.context) }
})

test('SI-22 the open visit belongs to the account, so the second phone shows it', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name === 'iphone', 'the inventory lists D + A or I')
  const member = createMember()
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
  await page.goto('/check-in')
  await expect(page.locator('.check-in-hold')).toBeVisible()
  await holdToCheckIn(page)
  await expect(page.locator('.check-in-lead')).toHaveText('¡Tu entrada quedó registrada!')
  expect(sessionCount(member, true)).toBe(1)

  const second = await browser.newContext({ baseURL, ...(info.project.name === 'desktop' ? devices['Pixel 7'] : devices['Desktop Chrome']) })
  try {
    const phone = await second.newPage()
    await fakeLocation(phone, INSIDE)
    await signInUser(phone, member.email, member.password)
    await page.reload()
    await expectReplaced(page)
    await phone.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Check-in' }).click()
    await expect(phone.getByText('Sesión activa', { exact: true })).toBeVisible()
    expect(sessionCount(member, true)).toBe(1)
  } finally { await closeAll(second) }
})

test('SI-23 an expired short session resumes from the remember cookie unless another device signed in', async ({ page, browser, baseURL }) => {
  only('DAI')
  const user = createUser()
  await signInUser(page, user.email, user.password)
  expireSession(user)
  await page.reload()
  await expectAccount(page)
  expireSession(user)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, user.email, user.password)
    await page.reload()
    await expectReplaced(page)
  } finally { await closeAll(second.context) }
})

// ------------------------------------------------------------------------------------------------- sign out

test('SI-24 after Cerrar sesión every protected URL goes to Sign in and Back shows no account data', async ({ page }) => {
  const user = createUser()
  await signInUser(page, user.email, user.password)
  await page.getByRole('link', { name: /^Ajustes/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText(user.email, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toHaveCount(0)
  for (const path of ['/account', '/check-in', '/gym']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/sign-in$/)
    await expect(heading(page, 'Iniciar sesión')).toBeVisible()
    await expect(page.getByText(REPLACED_TITLE, { exact: true }), path).toHaveCount(0)
    await expect(page.getByText(WRONG_TITLE, { exact: true }), path).toHaveCount(0)
  }
})

test('SI-25 a signed out person opening Check In or Gym lands on a plain Sign in', async ({ page }) => {
  only('D')
  for (const path of ['/check-in', '/gym']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/sign-in$/)
    await expect(heading(page, 'Iniciar sesión')).toBeVisible()
    await expect(page.getByRole('alert'), path).toHaveCount(0)
  }
})

test('SI-26 Sign in stays reachable while signed in and Back from Mi cuenta returns to the form without signing out', async ({ page, baseURL }) => {
  only('D')
  const user = createUser()
  await signInApi(page.request, baseURL!, user)
  await openSignIn(page)
  await expect(page).toHaveURL(/\/sign-in$/)
  await attempt(page, user.email, user.password)
  await expectAccount(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(heading(page, 'Iniciar sesión')).toBeVisible()
  await page.goto('/account')
  await expectAccount(page)
})

test('SI-27 a deleted account cannot sign in and an open session ends', async ({ page, browser, baseURL }) => {
  only('D')
  const deleted = createUser({ deleted: true })
  await attempt(page, deleted.email, deleted.password)
  await expectWrong(page)
  const live = createUser()
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, live.email, live.password)
    softDelete(live)
    await second.page.reload()
    await expectReplaced(second.page)
  } finally { await closeAll(second.context) }
})

test('SI-28 an account without a password cannot sign in', async ({ page }) => {
  only('D')
  const user = createUser({ password: null })
  await attempt(page, user.email, 'cualquier contraseña')
  await expectWrong(page)
})

test('SI-29 an English account opens in English and the language switch is saved on the account', async ({ page, browser, baseURL }) => {
  only('DAI')
  const user = createUser({ locale: 'en' })
  await attempt(page, user.email, user.password)
  await expect(page).toHaveURL(/\/account$/)
  await expect(heading(page, 'My account')).toBeVisible()
  await page.getByRole('link', { name: /^Settings/ }).click()
  await page.getByRole('button', { name: 'Español', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Español', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(heading(page, 'Ajustes')).toBeVisible()
  const second = await secondPhone(browser, baseURL)
  try {
    await signInUser(second.page, user.email, user.password)
  } finally { await closeAll(second.context) }
})

test('SI-30 offline the form keeps its values and waits for the connection', async ({ page, context }) => {
  only('DAI')
  const user = createUser()
  await openSignIn(page)
  await context.setOffline(true)
  await expect(page.getByText('Sin conexión · Datos no actualizados', { exact: true })).toBeVisible()
  await emailField(page).fill(user.email)
  await passwordField(page).fill(user.password)
  await expect(signInButton(page)).toBeDisabled()
  await expect(page.getByText('Conéctate para continuar. Se conservan los datos ingresados.', { exact: true })).toBeVisible()
  await context.setOffline(false)
  await expect(signInButton(page)).toBeEnabled()
  await expect(emailField(page)).toHaveValue(user.email)
  await expect(passwordField(page)).toHaveValue(user.password)
  await signInButton(page).click()
  await expectAccount(page)
})

test('SI-31 a server error on sign in tells the person something went wrong and re-enables the button', async ({ page }) => {
  only('D')
  const user = createUser()
  await page.route('**/api/user/sign-in', (route) => route.fulfill(serverError))
  await attempt(page, user.email, user.password)
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(signInButton(page)).toBeEnabled()
  await expect(emailField(page)).toHaveValue(user.email)
  await expect(page.locator('.user-notice, [role="alert"]').first(), 'the person sees a message for the 500').toBeVisible()
})

test('SI-32 an expired CSRF token is refreshed and the sign in goes through', async ({ page }) => {
  only('DAI')
  const user = createUser()
  await openSignIn(page)
  await page.context().clearCookies()
  await emailField(page).fill(user.email)
  await passwordField(page).fill(user.password)
  await signInButton(page).click()
  await expectAccount(page)
})

test('SI-33 a double tap sends one request and shows Iniciando sesión', async ({ page }) => {
  only('DAI')
  const user = createUser()
  await page.route('**/api/user/sign-in', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue() })
  const requests = countRequests(page, 'POST', '/api/user/sign-in')
  await openSignIn(page)
  await emailField(page).fill(user.email)
  await passwordField(page).fill(user.password)
  await signInButton(page).dblclick()
  const busy = page.getByRole('button', { name: 'Iniciando sesión…', exact: true })
  await expect(busy).toBeVisible()
  await expect(busy).toBeDisabled()
  await expectAccount(page)
  expect(requests).toHaveLength(1)
})

test('SI-34 the entry points: Welcome, the back arrow, Comenzar and the registration link', async ({ page }) => {
  only('DAI')
  await page.goto('/welcome')
  await page.getByRole('button', { name: /Toca o desliza para continuar/ }).click()
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByRole('link', { name: 'Volver', exact: true }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await openSignIn(page)
  await page.getByRole('link', { name: 'Comenzar', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('SI-35 the password toggle shows and hides the text', async ({ page }) => {
  only('DAI')
  await openSignIn(page)
  await passwordField(page).fill('una contraseña')
  await expect(passwordField(page)).toHaveAttribute('type', 'password')
  const show = page.getByRole('button', { name: 'Mostrar contraseña', exact: true })
  await expect(show).toHaveAttribute('aria-pressed', 'false')
  await show.click()
  await expect(passwordField(page)).toHaveAttribute('type', 'text')
  const hide = page.getByRole('button', { name: 'Ocultar contraseña', exact: true })
  await expect(hide).toHaveAttribute('aria-pressed', 'true')
  await hide.click()
  await expect(passwordField(page)).toHaveAttribute('type', 'password')
})

// ---------------------------------------------------------------------------------------- forgotten password

test('SI-36 a forgotten password is reset from the email link and the new password signs in', async ({ page }) => {
  only('DAI')
  const user = createUser()
  const newPassword = `una frase nueva ${unique()}`
  await openSignIn(page)
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page).toHaveURL(/\/recover-password$/)
  await expect(heading(page, 'Recuperar contraseña')).toBeVisible()
  await emailField(page).fill(user.email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(heading(page, 'Revisa tu correo')).toBeVisible()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  await expect(page.getByText('Revisa también la carpeta de correo no deseado.', { exact: true })).toBeVisible()
  await expect(page.getByText('Si existe una cuenta con ese correo, enviamos un enlace para restablecer la contraseña.', { exact: true })).toBeVisible()
  const link = linkIn(await lastEmailTo(page, user.email, '/reset-password'), '/reset-password')
  expect(link).toMatch(/^\/reset-password\?token=.+&email=/)
  await page.goto(link)
  await expectResetForm(page)
  await saveNewPassword(page, newPassword)
  await expect(page).toHaveURL(/\/sign-in$/)
  await signInUser(page, user.email, newPassword)
})

test('SI-37 an unknown email gets the same received screen and no email', async ({ page }) => {
  only('D')
  const address = `nadie-${unique()}@example.com`
  await page.goto('/recover-password')
  await emailField(page).fill(address)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  await page.waitForTimeout(5000)
  expect(await mailCount(page.request, address)).toBe(0)
})

test('SI-38 the recovery email field: empty, invalid and valid', async ({ page }) => {
  only('D')
  const user = createUser()
  await page.goto('/recover-password')
  const send = page.getByRole('button', { name: 'Enviar enlace', exact: true })
  await send.click()
  await expect(page.getByText(REQUIRED, { exact: true })).toBeVisible()
  await emailField(page).fill('nombre@')
  await send.click()
  await expect(page.getByText(INVALID_EMAIL, { exact: true })).toBeVisible()
  await emailField(page).fill(user.email)
  await send.click()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
})

test('SI-39 a server error on the recovery request shows the notice and keeps the email', async ({ page }) => {
  only('D')
  const user = createUser()
  await page.route('**/api/user/password/email', (route) => route.fulfill(serverError))
  await page.goto('/recover-password')
  await emailField(page).fill(user.email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByText('No pudimos enviar la solicitud', { exact: true })).toBeVisible()
  await expect(page.getByText('Intenta de nuevo en unos momentos.', { exact: true })).toBeVisible()
  await expect(emailField(page)).toHaveValue(user.email)
})

test('SI-41 the broker sends one reset email per minute and a second one after the minute', async ({ page }) => {
  only('D')
  const user = createUser()
  const send = async () => {
    await page.goto('/recover-password')
    await emailField(page).fill(user.email)
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
    await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  }
  await send()
  await expect.poll(() => mailCount(page.request, user.email), { timeout: 30_000 }).toBe(1)
  await send()
  await page.waitForTimeout(5000)
  expect(await mailCount(page.request, user.email)).toBe(1)
  ageResetToken(user.email, 61)
  await send()
  await expect.poll(() => mailCount(page.request, user.email), { timeout: 30_000 }).toBe(2)
})

test('SI-42 a reset link works at 59 minutes and has expired at 61', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  ageResetToken(user.email, 59 * 60)
  await page.goto(link)
  await expectResetForm(page)
  ageResetToken(user.email, 61 * 60)
  await page.goto(link)
  await expectExpiredLink(page)
})

test('SI-43 a used link shows the expired screen', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  await page.goto(link)
  await saveNewPassword(page, `una frase nueva ${unique()}`)
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto(link)
  await expectExpiredLink(page)
})

test('SI-44 a missing or wrong link shows the expired screen and the email case does not matter', async ({ page }) => {
  only('D')
  const user = createUser()
  const other = createUser()
  const link = await requestLink(page, user.email)
  const query = new URL(link, 'http://x').searchParams
  await page.goto('/reset-password')
  await expectExpiredLink(page)
  await page.goto('/reset-password?token=abc&email=nadie@example.com')
  await expectExpiredLink(page)
  await page.goto(`/reset-password?token=${encodeURIComponent(query.get('token')!)}&email=${encodeURIComponent(other.email)}`)
  await expectExpiredLink(page)
  await page.goto(`/reset-password?token=${encodeURIComponent(query.get('token')!)}&email=${encodeURIComponent(user.email.toUpperCase())}`)
  await expectResetForm(page)
})

test('SI-45 the link is checked first and the button waits for it', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  await page.route('**/api/user/password/validate', async (route) => { await new Promise((resolve) => setTimeout(resolve, 2000)); await route.continue() })
  await page.goto(link)
  await expect(page.getByText('Estamos verificando el enlace…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar contraseña', exact: true })).toBeDisabled()
  await expectResetForm(page)
  await expect(page.getByText('Estamos verificando el enlace…', { exact: true })).toHaveCount(0)
})

test('SI-46 the new password needs 10 characters and a matching confirmation', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  await page.goto(link)
  await expectResetForm(page)
  await saveNewPassword(page, '123456789')
  await expect(page.getByText('Usa al menos 10 caracteres y evita contraseñas comprometidas.', { exact: true })).toBeVisible()
  await saveNewPassword(page, 'una frase de diez', 'otra frase distinta')
  await expect(page.getByText('Las contraseñas deben coincidir.', { exact: true })).toBeVisible()
  await saveNewPassword(page, 'zq7wk3xm9p')
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('SI-47 a compromised new password shows the same field error', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  // Mocked: the real answer needs outbound network from the app container (Laravel falls back to accepting).
  await page.route('**/api/user/password/reset', (route) => route.fulfill({
    status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'validation_failed', details: { password: ['uncompromised'] } } }),
  }))
  await page.goto(link)
  await expectResetForm(page)
  await saveNewPassword(page, 'password12345')
  await expect(page.getByText('Usa al menos 10 caracteres y evita contraseñas comprometidas.', { exact: true })).toBeVisible()
})

test('SI-48 a 255 character new password is saved and signs in', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  const long = 'n'.repeat(255)
  await page.goto(link)
  await expectResetForm(page)
  await saveNewPassword(page, long)
  await expect(page).toHaveURL(/\/sign-in$/)
  await signInUser(page, user.email, long)
})

test('SI-49 a reset ends the other session and only the new password works', async ({ page, browser, baseURL }) => {
  only('D')
  const user = createUser()
  await signInUser(page, user.email, user.password)
  const second = await secondPhone(browser, baseURL)
  try {
    const link = await requestLink(second.page, user.email)
    const newPassword = `una frase nueva ${unique()}`
    await second.page.goto(link)
    await saveNewPassword(second.page, newPassword)
    await expect(second.page).toHaveURL(/\/sign-in$/)
    await page.reload()
    await expectReplaced(page)
    await attempt(second.page, user.email, user.password)
    await expectWrong(second.page)
    await signInUser(second.page, user.email, newPassword)
  } finally { await closeAll(second.context) }
})

test('SI-50 the reset link opened offline keeps the values and is checked again on reconnect', async ({ page, context }) => {
  only('DAI')
  const user = createUser()
  const link = await requestLink(page, user.email)
  await openSignIn(page)
  await context.setOffline(true)
  await page.evaluate((to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')) }, link)
  await expect(page.getByText('Sin conexión · Datos no actualizados', { exact: true })).toBeVisible()
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('una frase nueva larga')
  await page.getByLabel('Confirmar contraseña').fill('una frase nueva larga')
  await expect(page.getByRole('button', { name: 'Guardar contraseña', exact: true })).toBeDisabled()
  const validations = countRequests(page, 'POST', '/api/user/password/validate')
  await context.setOffline(false)
  await expect(page.getByText('Sin conexión · Datos no actualizados', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toHaveValue('una frase nueva larga')
  await expect.poll(() => validations.length, { message: 'the link is validated again after the reconnect', timeout: 10_000 }).toBeGreaterThan(0)
})

test('SI-51 saving the new password does not sign in', async ({ page }) => {
  only('D')
  const user = createUser()
  const link = await requestLink(page, user.email)
  await page.goto(link)
  await saveNewPassword(page, `una frase nueva ${unique()}`)
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(heading(page, 'Iniciar sesión')).toBeVisible()
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in$/)
})

// -------------------------------------------------------------------------------------- other accounts and errors

test('SI-52 a staff sign in survives the User signing in and out in the same browser', async ({ page, baseURL }) => {
  only('D')
  const user = createUser()
  await api(page.request, 'post', '/api/staff/sign-in', baseURL!, STAFF)
  expect((await rawApi(page.request, 'get', '/api/staff/me', baseURL!)).status).toBe(200)
  await signInUser(page, user.email, user.password)
  expect((await rawApi(page.request, 'get', '/api/staff/me', baseURL!)).status).toBe(200)
  await page.getByRole('link', { name: /^Ajustes/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect((await rawApi(page.request, 'get', '/api/user/me', baseURL!)).status).toBe(401)
  await page.goto('/staff')
  expect((await rawApi(page.request, 'get', '/api/staff/me', baseURL!)).status).toBe(200)
})

test('SI-53 an account that fails to load offers Reintentar', async ({ page }) => {
  only('D')
  const user = createUser()
  await page.route('**/api/user/me', (route) => route.fulfill(serverError))
  await attempt(page, user.email, user.password)
  await expect(page.getByText('No pudimos cargar tu cuenta', { exact: true })).toBeVisible()
  await expect(page.getByText('Intenta de nuevo para ver tus datos.', { exact: true })).toBeVisible()
  await page.unroute('**/api/user/me')
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expectAccount(page)
  await expect(page.getByText(user.email, { exact: true })).toBeVisible()
})

// ------------------------------------------------------------------------------- lockouts (they lock the IP: last)

test.describe('lockouts, run last', () => {
  test.afterEach(() => flushCache())

  test('SI-14 nine failures still allow the right password, ten start a wait that ends', async ({ page, baseURL }) => {
    only('D')
    test.setTimeout(240_000)
    const nine = createUser()
    await fail(page, baseURL, nine.email, 9)
    await attempt(page, nine.email, nine.password)
    await expectAccount(page)

    flushCache()
    await page.context().clearCookies()
    const ten = createUser()
    await fail(page, baseURL, ten.email, 10)
    await attempt(page, ten.email, ten.password)
    await expectWait(page)
    await expect(signInButton(page)).toBeDisabled()
    await expect(signInButton(page)).toBeEnabled({ timeout: 75_000 })
  })

  test('SI-15 the wait follows the email to another browser, whatever its case', async ({ page, browser, baseURL }) => {
    only('D')
    const user = createUser()
    await fail(page, baseURL, user.email, 10)
    const second = await secondPhone(browser, baseURL)
    try {
      await attempt(second.page, user.email.toUpperCase(), user.password)
      await expectWait(second.page)
    } finally { await closeAll(second.context) }
  })

  test('SI-16 ten failures across ten emails lock the IP even for a right password', async ({ page, baseURL }) => {
    only('D')
    const user = createUser()
    for (let i = 0; i < 10; i++) await fail(page, baseURL, `nadie-${unique()}@example.com`, 1)
    await attempt(page, user.email, user.password)
    await expectWait(page)
  })

  test('SI-17 a right password clears only the account count: 4 + 4 failures never lock', async ({ page, request, baseURL }) => {
    only('D')
    const user = createUser()
    for (let i = 0; i < 4; i++) {
      const { status } = await rawApi(request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: 'incorrecta-' + i })
      expect(status).toBe(422)
    }
    expect((await rawApi(request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: user.password })).status).toBe(200)
    for (let i = 0; i < 4; i++) {
      const { status } = await rawApi(request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: 'incorrecta-' + i })
      expect(status).toBe(422)
    }
    await attempt(page, user.email, user.password)
    await expectAccount(page)
  })

  test('SI-18 each new lockout waits longer: 60, 300, 900 and 3600 seconds', async ({ request, baseURL }) => {
    only('D')
    const user = createUser()
    for (const wait of [60, 300, 900, 3600]) {
      for (let i = 0; i < 10; i++) {
        const { status } = await rawApi(request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: 'incorrecta-' + i })
        expect(status, `failure ${i + 1} before the ${wait} s wait`).toBe(422)
      }
      const locked = await rawApi(request, 'post', '/api/user/sign-in', baseURL!, { email: user.email, password: user.password })
      expect(locked.status).toBe(429)
      const retry = Number(locked.headers['retry-after'])
      expect(retry).toBeLessThanOrEqual(wait)
      expect(retry).toBeGreaterThanOrEqual(wait - 10)
      clearLockWaits()
    }
  })

  test('SI-40 the eleventh recovery request in a minute is refused with the wait notice', async ({ page, baseURL }) => {
    only('D')
    const user = createUser()
    for (let i = 0; i < 10; i++) {
      const { status } = await rawApi(page.request, 'post', '/api/user/password/email', baseURL!, { email: `nadie-${unique()}@example.com` })
      expect(status, `request ${i + 1}`).toBeLessThan(300)
    }
    await page.goto('/recover-password')
    await emailField(page).fill(user.email)
    const answer = page.waitForResponse((response) => response.url().endsWith('/api/user/password/email'))
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
    expect((await answer).status()).toBe(429)
    await expectWait(page)
  })
})
