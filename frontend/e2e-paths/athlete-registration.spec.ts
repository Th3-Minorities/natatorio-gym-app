import { expect, test, devices, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { api, MEMBER, signInUser, STAFF } from '../e2e/flows/flow.ts'
import { flushCache, rawApi } from './setup.ts'
import { clearSessions, createOrder, setTermEnd, termEnd } from './setup-registration.ts'
import {
  ageLinks, athleteLink, claim, createAccountFor, createAthlete, createLink, linkRows, linkToken, mailsTo, removeRecord, service,
  setLinkAge, setLinkExpiry, tokenOf, usersWith, waitForMails, type Athlete, type AthleteOptions, type LinkOptions,
} from './setup-athlete.ts'

// #152 path tests for athlete registration (docs inventory: athlete-registration.md, ids AR-xx). Each row makes its own roster
// record with tinker on the test stack (TEST_PROJECT), because a student number gets one link per 300 s and 5 a day. Rows that
// only need a link page make the link in the database; AR-01 to AR-03, AR-12 to AR-16, AR-18 to AR-20, AR-25 and AR-27 use the
// real email. Failed lookups count against the IP (10 per 15 minutes): rows that fail on purpose flush the limiter first.
// Not run: AR-51 and AR-52 (not built), AR-53 (real phones). Edge (E) is not a project of the path test config.

test.setTimeout(240_000)

const A = 'android'
const I = 'iphone'
const PASSWORD = 'una frase larga para el registro de prueba'
const UNAVAILABLE = 'No pudimos validar este número. Revisa tu recibo o llama al 265-3866.'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const photo = (name = 'foto.png', buffer = PNG, mimeType = 'image/png') => ({ name, mimeType, buffer })

function onlyOn(info: TestInfo, ...list: string[]) {
  test.skip(!list.includes(info.project.name), `Row is for ${list.join(', ')}`)
}

const next = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true })
const create = (page: Page) => page.getByRole('button', { name: 'Crear cuenta' })
const numberField = (page: Page) => page.getByLabel(/Número de (estudiante o autorización|estudiante|autorización)/)
const previewImage = (page: Page) => page.getByRole('img', { name: 'Vista previa de la foto elegida' })
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })

// ------------------------------------------------------------------------------------------------------- number step

async function openIdentify(page: Page) {
  await page.goto('/register')
  await expect(heading(page, 'Antes de comenzar')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(numberField(page)).toBeVisible()
}

async function lookup(page: Page, number: string) {
  await numberField(page).fill(number)
  await next(page).click()
}

/** Looks the number up and returns the link of the email that arrives. */
async function requestLink(page: Page, athlete: Athlete) {
  await openIdentify(page)
  await lookup(page, athlete.number)
  await expect(heading(page, 'Revisa tu correo')).toBeVisible()
  const mails = await waitForMails(page.request, athlete.email)
  return athleteLink(mails[0])
}

/** The same lookup straight to the API, from the page's own session (the privacy notice must have been accepted). */
async function lookupApi(page: Page, baseURL: string, number: string) {
  return rawApi(page.request, 'post', '/api/user/registration/lookup', baseURL, { authorization_number: number, locale: 'es' })
}

async function goOffline(page: Page) {
  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

async function goOnline(page: Page) {
  await page.context().setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

async function apiGet(page: Page, path: string, baseURL: string) {
  return page.request.get(path, { headers: { Accept: 'application/json', Referer: `${baseURL}/` } })
}

// ------------------------------------------------------------------------------------------------------------- link page

type Linked = { athlete: Athlete; token: string; path: string }

/** A roster record with a link made in the database; the path is what the email would hold. */
function freshLink(options: AthleteOptions & LinkOptions = {}): Linked {
  const athlete = createAthlete(options)
  const token = linkToken()
  createLink(athlete, token, options)
  return { athlete, token, path: `/register/athlete?token=${token}` }
}

const LINK_SCREENS = {
  expired: ['Tu enlace venció', 'Pide un enlace nuevo para continuar.'],
  invalid: ['Este enlace ya no es válido', 'Pide un enlace nuevo para continuar.'],
  used: ['Este enlace ya se usó', 'Si completaste tu registro, inicia sesión con tu cuenta.'],
  replaced: ['Usa tu enlace más reciente', 'Pediste otro enlace y este dejó de funcionar.'],
  claimed: ['No pudimos vincular este registro', 'El registro de atleta ya fue reclamado.'],
  offline: ['Verifica tu enlace', 'Conéctate para verificar el enlace que recibiste por correo.'],
  error: ['No pudimos verificar tu enlace', 'Ocurrió un problema al consultar tu registro.'],
} as const

async function expectLinkScreen(page: Page, kind: keyof typeof LINK_SCREENS) {
  const [title, intro] = LINK_SCREENS[kind]
  await expect(heading(page, title)).toBeVisible()
  await expect(page.getByText(intro, { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/register\/athlete/)
}

async function acceptPrivacy(page: Page) {
  await expect(heading(page, 'Antes de comenzar')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/password$/)
  await expect(heading(page, 'Crea una contraseña')).toBeVisible()
}

/**
 * A browser that already visited the app has a session cookie. The very first visit through an emailed link does not: the link
 * page asks for the privacy notice and a CSRF cookie at the same time, each starts its own session, and the privacy
 * acceptance can fail (AR-20 opens the link with no warm-up). Every other row warms the session up first.
 */
async function warmUp(page: Page) {
  await page.goto('/register')
  await expect(heading(page, 'Antes de comenzar')).toBeVisible()
}

async function openLink(page: Page, path: string) {
  await warmUp(page)
  await page.goto(path)
  await acceptPrivacy(page)
}

async function setPassword(page: Page, password = PASSWORD, confirmation = password) {
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(confirmation)
  await next(page).click()
}

async function toPhoto(page: Page, path: string, password = PASSWORD) {
  await openLink(page, path)
  await setPassword(page, password)
  await expect(page).toHaveURL(/\/register\/photo$/)
  await expect(heading(page, 'Tu foto de identificación')).toBeVisible()
}

async function choosePhoto(page: Page, file = photo()) {
  await page.getByTestId('camera-input').setInputFiles(file)
  await expect(previewImage(page)).toBeVisible()
}

async function toContact(page: Page, path: string, options: { password?: string; file?: ReturnType<typeof photo> } = {}) {
  await toPhoto(page, path, options.password)
  await choosePhoto(page, options.file)
  await next(page).click()
  await expect(page).toHaveURL(/\/register\/contact$/)
  await expect(page.getByText(/^BORRADOR · Versión /)).toBeVisible()
}

async function fillContact(page: Page, name = 'Contacto de Prueba', phone = '787-555-0100') {
  await expect(page.getByText(/^BORRADOR · Versión /)).toBeVisible()
  await page.getByLabel('He leído y acepto el relevo de responsabilidad.').check()
  await page.getByLabel('Nombre completo').fill(name)
  await page.getByLabel('Teléfono').fill(phone)
}

/** From the emailed (or made) link to the filled contact step. */
async function filledForm(page: Page, path: string, options: { password?: string; file?: ReturnType<typeof photo> } = {}) {
  await toContact(page, path, options)
  await fillContact(page)
}

async function register(page: Page, path: string, options: { password?: string; file?: ReturnType<typeof photo>; phone?: string } = {}) {
  await toContact(page, path, options)
  await fillContact(page, undefined, options.phone)
  await create(page).click()
  await expect(page).toHaveURL(/\/install\?registered$/)
}

// ------------------------------------------------------------------------------------------------------------- the paths

test.describe('athlete registration paths', () => {
  test('AR-01 an athlete on the roster registers from Welcome through the emailed link and reaches Check In', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
    await page.getByRole('link', { name: 'Comenzar' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await page.getByRole('button', { name: 'Continuar con el registro' }).click()
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    const link = athleteLink((await waitForMails(page.request, athlete.email))[0])

    await page.goto(link)
    await acceptPrivacy(page)
    await expect(page.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()
    await setPassword(page)
    await choosePhoto(page)
    await next(page).click()
    await fillContact(page)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    await expect(heading(page, 'Instala la app')).toBeVisible()
    await page.getByRole('link', { name: /^(Continuar|Ahora no)$/ }).click()
    await expect(page).toHaveURL(/\/check-in$/)
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Mi cuenta' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { level: 2, name: athlete.name })).toBeVisible()
    await expect(page.getByText(athlete.email, { exact: true })).toBeVisible()
    await expect(page.getByText('Atleta', { exact: true })).toBeVisible()
    await expect(page.getByText('Acceso vigente · Término actual')).toBeVisible()
  })

  test('AR-02 a student number on the roster shows Revisa tu correo with the masked email and the resend countdown', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    await expect(page.getByText('Enviamos un enlace a tu correo institucional.', { exact: true })).toBeVisible()
    await expect(page.getByText(athlete.masked, { exact: true })).toBeVisible()
    await expect(page.getByText('Abre el enlace en tu correo para completar contraseña, foto y relevo.', { exact: true })).toBeVisible()
    await expect(page.getByText('Revisa también la carpeta de correo no deseado.', { exact: true })).toBeVisible()
    const resend = page.getByRole('button', { name: /^Reenviar en 0[45]:\d\d$/ })
    await expect(resend).toBeDisabled()
    const first = await resend.textContent()
    await expect.poll(async () => resend.textContent(), { timeout: 10_000 }).not.toBe(first)
    await expect(page.getByRole('button', { name: 'Corregir número' })).toBeVisible()
    expect(await waitForMails(page.request, athlete.email)).toHaveLength(1)
  })

  test('AR-03 the email goes to the roster address with the subject, button, expiry text and a 64 character token', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    const [mail] = await waitForMails(page.request, athlete.email)
    expect(mail.to).toBe(athlete.email)
    expect(mail.subject).toBe('Completa tu registro de atleta')
    expect(mail.html).toContain('Completar registro')
    expect(mail.html).toContain('El enlace vence en 24 horas y solo puede usarse una vez.')
    expect(mail.html).toContain('Si no lo solicitaste, puedes ignorar este correo.')
    const link = athleteLink(mail)
    expect(link).toMatch(/^\/register\/athlete\?token=[A-Za-z0-9]{64}$/)
  })

  test('AR-04 a number not on the roster asks the person to check it and sends no email', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    await openIdentify(page)
    await lookup(page, '900000000')
    await expect(heading(page, 'Revisa tu número')).toBeVisible()
    await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription(
      'No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.')
    await expect(page.getByText('Si pagaste una membresía, usa el número de autorización de tu recibo.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver ejemplo del recibo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Corregir número' })).toBeVisible()
    expect(await mailsTo(page.request, 'ar900000000@upr.example')).toHaveLength(0)
  })

  test('AR-05 a number removed from the roster gets the same answer as one not on it', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    const athlete = createAthlete({ removed: true })
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu número')).toBeVisible()
    await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription(
      'No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.')
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(0)
  })

  test('AR-06 a number already claimed points to sign in and sends no email', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    await openIdentify(page)
    await lookup(page, '802000002')
    await expect(heading(page, 'Ya tienes una cuenta')).toBeVisible()
    await expect(page.getByText(/^[^@\s]\*{3}[^@\s]?@[^@\s]+$/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
    await expect(page.getByRole('button', { name: 'Volver al registro' })).toBeVisible()
  })

  test('AR-07 8 and 10 digits are looked up as authorization numbers and 9 digits as a student number', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    const athlete = createAthlete()
    await openIdentify(page)
    await lookup(page, athlete.number.slice(0, 8))
    await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
    await expect(page.getByLabel('Número de autorización')).toBeVisible()
    await lookup(page, `${athlete.number}1`)
    await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(0)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    expect(await waitForMails(page.request, athlete.email)).toHaveLength(1)
  })

  test('AR-08 a letter or dashes make an authorization number, spaces are trimmed, all zeros is not on the roster', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    const athlete = createAthlete()
    const n = athlete.number
    await openIdentify(page)
    await lookup(page, `${n.slice(0, 8)}a`)
    await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
    await lookup(page, `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`)
    await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(0)
    await lookup(page, '000000000')
    await expect(heading(page, 'Revisa tu número')).toBeVisible()
    await page.getByRole('button', { name: 'Corregir número' }).click()
    await lookup(page, ` ${n} `)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    expect(await waitForMails(page.request, athlete.email)).toHaveLength(1)
  })

  test('AR-09 hostile input after a valid number is data: no script, no error, no email', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushCache()
    const athlete = createAthlete()
    const dialogs: string[] = []
    page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
    await openIdentify(page)
    // 34 characters: over the 20 of the field, so the server answers validation_failed, not the unavailable text of the inventory.
    await lookup(page, `${athlete.number}<script>alert(1)</script>`)
    await expect(numberField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/register\/identify$/)
    await lookup(page, `${athlete.number}' OR '1'='1`)
    await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
    await expect(page.getByText('Algo salió mal de nuestro lado. Intenta más tarde.')).toHaveCount(0)
    expect(dialogs).toEqual([])
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(0)
  })

  test('AR-10 a roster email that already has an account asks to sign in and sends no email', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete({ account: true })
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Ya tienes una cuenta')).toBeVisible()
    await expect(page.getByText(athlete.masked, { exact: true })).toBeVisible()
    await expect(page.getByText('Todavía no hemos usado tu número ni vinculado tu registro.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(0)
    await page.getByRole('button', { name: 'Volver al registro' }).click()
    await expect(heading(page, 'Registro')).toBeVisible()
    // The number stays in the field (the inventory says empty).
    await expect(numberField(page)).toHaveValue(athlete.number)
  })

  test('AR-11 Corregir número goes back to the field with the number kept and a paid number then works', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    const order = createOrder('AR')
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    await page.getByRole('button', { name: 'Corregir número' }).click()
    await expect(heading(page, 'Registro')).toBeVisible()
    await expect(numberField(page)).toHaveValue(athlete.number)
    await lookup(page, order.number)
    await expect(page).toHaveURL(/\/register\/password$/)
    await expect(page.getByText(`¡Hola, ${order.name}!`)).toBeVisible()
  })

  test('AR-12 a second lookup is blocked before 300 s with the time to try again and sends another email after', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await requestLink(page, athlete)
    // 295 s, not 299: the round trip of the lookup takes about a second, so 299 would sometimes pass.
    setLinkAge(athlete, 295)
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Espera para pedir otro enlace')).toBeVisible()
    await expect(page.getByText('Ya alcanzaste el límite de enlaces para este número de estudiante.', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Prueba de nuevo a las \d{1,2}:\d{2}/)).toBeVisible()
    await expect(page.getByText('Si ya recibiste un enlace, revisa tu correo institucional.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Solicitar enlace' })).toBeDisabled()
    expect(await mailsTo(page.request, athlete.email)).toHaveLength(1)

    setLinkAge(athlete, 301)
    await openIdentify(page)
    await lookup(page, athlete.number)
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    expect(await waitForMails(page.request, athlete.email, 2)).toHaveLength(2)
  })

  test('AR-13 the resend button waits for the countdown, sends a second email and the first link is replaced', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await page.clock.install()
    const first = tokenOf(await requestLink(page, athlete))
    await expect(page.getByRole('button', { name: /^Reenviar en 0[45]:\d\d$/ })).toBeDisabled()
    setLinkAge(athlete, 301)
    await page.clock.fastForward(301_000)
    const resend = page.getByRole('button', { name: 'Solicitar enlace' })
    await expect(resend).toBeEnabled()
    await resend.click()
    await expect(page.getByRole('button', { name: /^Reenviar en 0[45]:\d\d$/ })).toBeDisabled()
    const mails = await waitForMails(page.request, athlete.email, 2)
    expect(mails).toHaveLength(2)
    const second = tokenOf(athleteLink(mails[0]))
    expect(second).not.toBe(first)
    const old = await rawApi(page.request, 'post', '/api/user/registration/athlete/validate', baseURL ?? '', { token: first })
    expect(old.body.error.code).toBe('athlete_link_replaced')
    const current = await rawApi(page.request, 'post', '/api/user/registration/athlete/validate', baseURL ?? '', { token: second })
    expect(current.status).toBe(200)
  })

  test('AR-14 five links a day are sent, the sixth waits until 24 h after the first, and another record is not affected', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    const other = createAthlete()
    await openIdentify(page)
    for (let sent = 1; sent <= 5; sent += 1) {
      const answer = await lookupApi(page, baseURL ?? '', athlete.number)
      expect(answer.status, `link ${sent}`).toBe(200)
      ageLinks(athlete, 301)
    }
    await lookup(page, athlete.number)
    await expect(heading(page, 'Espera para pedir otro enlace')).toBeVisible()
    await expect(page.getByText(/^Prueba de nuevo a las \d{1,2}:\d{2}/)).toBeVisible()
    const blocked = await lookupApi(page, baseURL ?? '', athlete.number)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(80_000)
    expect((await lookupApi(page, baseURL ?? '', other.number)).status).toBe(200)
    expect(linkRows(athlete).count).toBe(5)

    ageLinks(athlete, 86_401, 'oldest')
    expect((await lookupApi(page, baseURL ?? '', athlete.number)).status).toBe(200)
    expect(await waitForMails(page.request, athlete.email, 6)).toHaveLength(6)
  })

  test('AR-15 tapping Continuar twice sends one lookup and one email', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    let lookups = 0
    page.on('request', (request) => { if (request.url().endsWith('/registration/lookup')) lookups += 1 })
    await openIdentify(page)
    await numberField(page).fill(athlete.number)
    await next(page).dblclick()
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    expect(lookups).toBe(1)
    expect(await waitForMails(page.request, athlete.email)).toHaveLength(1)
  })

  test('AR-16 offline the number step shows the banner and keeps the number, and it works again online', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await openIdentify(page)
    await numberField(page).fill(athlete.number)
    await goOffline(page)
    await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
    await expect(next(page)).toBeDisabled()
    await goOnline(page)
    await expect(next(page)).toBeEnabled()
    await page.route('**/api/user/registration/lookup', (route) => route.abort('internetdisconnected'), { times: 1 })
    await next(page).click()
    await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
    await expect(page.locator('.registration-intro')).toContainText('Conéctate para consultar tu número.')
    await expect(page.locator('.registration-intro')).toContainText('Lo que escribiste se conserva mientras esta página siga abierta.')
    await expect(page.locator('.field__error')).toHaveCount(0)
    await expect(numberField(page)).toHaveValue(athlete.number)
    await goOnline(page)
    await next(page).click()
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
  })

  test('AR-17 when the email cannot be sent the person sees the server error and a retry sends at once', async ({ page }, info) => {
    onlyOn(info, A, I)
    test.setTimeout(300_000)
    const athlete = createAthlete()
    try {
      service('stop', 'mailpit')
      await openIdentify(page)
      await lookup(page, athlete.number)
      await expect(page.getByText('Algo salió mal de nuestro lado. Intenta más tarde.').first()).toBeVisible({ timeout: 120_000 })
      expect(linkRows(athlete).count).toBe(0)
    } finally {
      service('start', 'mailpit')
    }
    await expect.poll(async () => (await page.request.get('/mailpit/api/v1/info')).status(), { timeout: 60_000 }).toBe(200)
    await next(page).click()
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
    expect(await waitForMails(page.request, athlete.email)).toHaveLength(1)
  })

  test('AR-18 with English chosen on Welcome the screen and the email are in English', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('link', { name: 'Get started' }).click()
    await page.getByRole('button', { name: 'Continue registration' }).click()
    await page.getByLabel('Student or authorization number').fill(athlete.number)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Check your email', exact: true })).toBeVisible()
    await expect(page.getByText('We sent a link to your institutional email.', { exact: true })).toBeVisible()
    await expect(page.getByText('Open the link in your email to complete your password, photo and waiver.', { exact: true })).toBeVisible()
    const [mail] = await waitForMails(page.request, athlete.email)
    expect(mail.subject).toBe('Complete your athlete registration')
    expect(mail.html).toContain('Complete registration')
    expect(mail.html).toContain('If you did not request it, you can ignore this email.')
  })

  test('AR-19 the emailed link shows Verificando tu enlace, then the privacy notice and the password step with the roster name', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    const link = await requestLink(page, athlete)
    await page.route('**/api/user/registration/athlete/validate', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.continue()
    })
    await page.goto(link)
    await expect(heading(page, 'Verificando tu enlace')).toBeVisible()
    await expect(page.getByText('Espera mientras confirmamos tu registro de atleta.', { exact: true })).toBeVisible()
    await expect(page.getByText('Verificación en curso', { exact: true })).toBeVisible()
    await expect(page.getByText('Todavía no se ha creado una cuenta ni vinculado tu registro.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Verificando…' })).toBeDisabled()
    await acceptPrivacy(page)
    await expect(page.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()
    await expect(page.getByLabel('Número de estudiante o autorización')).toHaveCount(0)
  })

  test('AR-20 a link requested on the desktop opens on a phone that never saw the number step', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I) // moved to phones 2026-11-09: the first device is now a phone too
    const athlete = createAthlete()
    const link = await requestLink(page, athlete)
    const phone: BrowserContext = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'block' })
    try {
      const mobile = await phone.newPage()
      await mobile.goto(link)
      await acceptPrivacy(mobile)
      await expect(mobile.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()
    } finally { await phone.close() }
    await expect(heading(page, 'Revisa tu correo')).toBeVisible()
  })

  test('AR-21 a link page with no token or an empty token says the link is not valid', async ({ page }, info) => {
    onlyOn(info, A, I)
    for (const path of ['/register/athlete', '/register/athlete?token=']) {
      await page.goto(path)
      await expectLinkScreen(page, 'invalid')
      await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute('href', '/register')
      await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toBeVisible()
      await expect(page.getByText('Solicita otro enlace con tu número de estudiante.')).toHaveCount(0)
    }
  })

  test('AR-22 a token of 255 characters and one of 256 both show the link is not valid', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.goto(`/register/athlete?token=${'a'.repeat(255)}`)
    await expectLinkScreen(page, 'invalid')
    await page.goto(`/register/athlete?token=${'a'.repeat(256)}`)
    await expectLinkScreen(page, 'invalid')
  })

  test('AR-23 garbled and hostile tokens all show the link is not valid without errors or scripts', async ({ page }, info) => {
    onlyOn(info, A, I)
    const linked = freshLink()
    const changed = `${linked.token.slice(0, -1)}${linked.token.endsWith('a') ? 'b' : 'a'}`
    const dialogs: string[] = []
    page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
    for (const token of ['abc', '<script>alert(1)</script>', "' OR 1=1", changed]) {
      await page.goto(`/register/athlete?token=${encodeURIComponent(token)}`)
      await expectLinkScreen(page, 'invalid')
    }
    expect(dialogs).toEqual([])
    expect(linkRows(linked.athlete).used).toBe(false)
  })

  test('AR-25 a link one minute from expiring still works and one expired a second ago says Tu enlace venció', async ({ page }, info) => {
    onlyOn(info, A, I)
    const athlete = createAthlete()
    const link = await requestLink(page, athlete)
    setLinkExpiry(athlete, 60)
    await openLink(page, link)
    await expect(page.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()

    setLinkExpiry(athlete, -1)
    await page.goto(link)
    await expectLinkScreen(page, 'expired')
    await expect(page.getByText('Este enlace ya no es válido', { exact: true })).toBeVisible()
    await expect(page.getByText('Solicita otro enlace con tu número de estudiante.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toBeVisible()
  })

  test('AR-26 a link that was already used says Este enlace ya se usó with sign in and back', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink({ used: true })
    await page.goto(path)
    await expectLinkScreen(page, 'used')
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
    await expect(page.getByRole('link', { name: 'Volver al registro' })).toHaveAttribute('href', '/register')
  })

  test('AR-27 an older link says to use the newest one and the newer link still works', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path: older } = freshLink()
    const newer = linkToken()
    createLink(athlete, newer)
    await page.goto(older)
    await expectLinkScreen(page, 'replaced')
    await expect(page.getByText('Revisa tu correo institucional', { exact: true })).toBeVisible()
    await expect(page.getByText('Abre el mensaje más reciente para continuar.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toBeVisible()
    await openLink(page, `/register/athlete?token=${newer}`)
    await expect(page.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()
  })

  test('AR-28 a record claimed after the link was sent says it could not be linked and shows the gym number', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    claim(athlete)
    await page.goto(path)
    await expectLinkScreen(page, 'claimed')
    await expect(page.getByText('Contacta al gimnasio', { exact: true })).toBeVisible()
    await expect(page.getByText('Llama al 265-3866 para revisar tu acceso.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
  })

  test('AR-29 a record removed after the link was sent makes the link not valid', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    removeRecord(athlete)
    await page.goto(path)
    await expectLinkScreen(page, 'invalid')
  })

  test('AR-30 the API answers the link states in order: invalid, used, claimed, replaced, expired', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const code = async (token: string) => (await rawApi(page.request, 'post', '/api/user/registration/athlete/validate', baseURL ?? '', { token })).body?.error?.code
    await page.goto('/register')

    const usedExpired = freshLink({ used: true, expiresIn: -60 })
    expect(await code(usedExpired.token)).toBe('athlete_link_used')

    const usedClaimed = freshLink({ used: true })
    claim(usedClaimed.athlete)
    expect(await code(usedClaimed.token)).toBe('athlete_link_used')

    const claimedReplaced = freshLink()
    createLink(claimedReplaced.athlete, linkToken())
    claim(claimedReplaced.athlete)
    expect(await code(claimedReplaced.token)).toBe('roster_record_claimed')

    const replacedExpired = freshLink({ expiresIn: -60 })
    createLink(replacedExpired.athlete, linkToken())
    expect(await code(replacedExpired.token)).toBe('athlete_link_replaced')

    const expired = freshLink({ expiresIn: -60 })
    expect(await code(expired.token)).toBe('athlete_link_expired')

    const removedUsed = freshLink({ used: true })
    removeRecord(removedUsed.athlete)
    expect(await code(removedUsed.token)).toBe('athlete_link_invalid')
  })

  test('AR-31 offline the link page asks to connect, keeps Reintentar off, and checks again online', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await warmUp(page)
    await page.route('**/api/user/registration/athlete/validate', (route) => route.abort('internetdisconnected'), { times: 1 })
    await page.goto(path)
    await expectLinkScreen(page, 'offline')
    await expect(page.getByText('Tu registro no ha cambiado', { exact: true })).toBeVisible()
    await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeDisabled()
    await goOnline(page)
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await acceptPrivacy(page)
    await expect(page.getByText(`¡Hola, ${athlete.name}!`)).toBeVisible()
  })

  test('AR-32 a server error on the link check shows No pudimos verificar tu enlace and Reintentar checks again', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink()
    await warmUp(page)
    await page.route('**/api/user/registration/athlete/validate', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }))
    await page.goto(path)
    await expectLinkScreen(page, 'error')
    await expect(page.getByText('Intenta de nuevo', { exact: true })).toBeVisible()
    await expect(page.getByText('No hemos podido comprobar si el enlace sigue vigente.', { exact: true })).toBeVisible()
    await page.unroute('**/api/user/registration/athlete/validate')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await acceptPrivacy(page)
  })

  test('AR-33 a signed-in member or staff cannot use the link page and the link stays unused', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await signInUser(page, MEMBER.email, MEMBER.password)
    await page.goto(path)
    await expectLinkScreen(page, 'error')
    expect(linkRows(athlete).used).toBe(false)

    const staff: BrowserContext = await browser.newContext({ baseURL, serviceWorkers: 'block' })
    try {
      await api(staff.request, 'post', '/api/staff/sign-in', baseURL ?? '', STAFF)
      const desk = await staff.newPage()
      await desk.goto(path)
      await expectLinkScreen(desk, 'error')
    } finally { await staff.close() }
    expect(linkRows(athlete).used).toBe(false)
  })

  test('AR-34 reloading the password step asks for the link again and Back from it leaves the link page without Verificando', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink()
    await openLink(page, path)
    await page.reload()
    await expect(heading(page, 'Antes de comenzar')).toBeVisible()
    expect(page.url()).not.toContain('token=')

    await openLink(page, path)
    await expect(page).toHaveURL(/\/register\/password$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/register$/)
    await expect(heading(page, 'Verificando tu enlace')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Verificando…' })).toHaveCount(0)

    await openLink(page, path)
  })

  test('AR-35 passwords of 9 and 10 characters, a mismatch and 255 characters follow the rules', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink()
    await openLink(page, path)
    await setPassword(page, '123456789')
    await expect(page.getByText('Usa al menos 10 caracteres.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/password$/)
    await setPassword(page, PASSWORD, `${PASSWORD}x`)
    await expect(page.getByText('Las contraseñas deben coincidir.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/password$/)
    await setPassword(page, '123456789a')
    await expect(page).toHaveURL(/\/register\/photo$/)

    const long = freshLink()
    await openLink(page, long.path)
    await page.getByLabel('Contraseña', { exact: true }).fill('p'.repeat(256))
    expect((await page.getByLabel('Contraseña', { exact: true }).inputValue()).length).toBe(255)
    await setPassword(page, 'p'.repeat(255))
    await expect(page).toHaveURL(/\/register\/photo$/)
  })

  test('AR-36 photo rows: a taken or uploaded photo shows a preview and a photo error does not use up the link', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await toPhoto(page, path)
    await expect(page.getByText('Aún no has elegido una foto')).toBeVisible()
    await expect(next(page)).toBeDisabled()
    if (info.project.name === A) {
      const chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Tomar foto' }).click()
      await (await chooser).setFiles(photo('selfie.png'))
    } else await choosePhoto(page, photo('selfie.png'))
    await expect(previewImage(page)).toBeVisible()
    const first = await previewImage(page).getAttribute('src')
    await page.getByTestId('upload-input').setInputFiles(photo('segunda.png', Buffer.concat([PNG, Buffer.alloc(4)])))
    await expect.poll(() => previewImage(page).getAttribute('src')).not.toBe(first)
    await expect(next(page)).toBeEnabled()
    if (info.project.name !== A) return // moved to phones 2026-11-09 (was desktop only)

    await page.getByTestId('upload-input').setInputFiles(photo('limite.jpg', Buffer.alloc(10485760), 'image/jpeg'))
    await expect(next(page)).toBeEnabled()
    await page.getByTestId('upload-input').setInputFiles(photo('grande.jpg', Buffer.alloc(10485761), 'image/jpeg'))
    await expect(page.getByText('La foto supera 10 MB')).toBeVisible()
    await expect(next(page)).toBeDisabled()

    const wrong = [
      photo('a.jpg', Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'), 'image/jpeg'),
      photo('b.jpg', Buffer.from('%PDF-1.4 1 0 obj << /Type /Catalog >> endobj trailer << /Root 1 0 R >> %%EOF'), 'image/jpeg'),
      photo('c.jpg', Buffer.from('esto es solo texto'), 'image/jpeg'),
    ]
    await choosePhoto(page, wrong[0])
    await next(page).click()
    await fillContact(page)
    for (const [index, file] of wrong.entries()) {
      const answered = page.waitForResponse((response) => response.url().endsWith('/athlete/complete'))
      if (index === 0) await create(page).click()
      else {
        await page.getByTestId('upload-input').setInputFiles(file)
        await page.getByRole('button', { name: 'Reintentar' }).click()
      }
      expect((await answered).status(), file.name).toBe(422)
      await expect(heading(page, 'Revisa tu foto')).toBeVisible()
      await expect(page.getByRole('alert')).toContainText('Formato no permitido')
    }
    const corrupt = Buffer.concat([PNG.subarray(0, 33), Buffer.from('garbage-after-the-header-'.repeat(8))])
    await page.getByTestId('upload-input').setInputFiles(photo('rota.png', corrupt))
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('alert')).toContainText('Tu foto no se pudo procesar')
    expect(linkRows(athlete).used).toBe(false)
    expect(usersWith(athlete.email)).toBe(0)
    await page.getByTestId('upload-input').setInputFiles(photo('buena.png'))
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    expect(linkRows(athlete).used).toBe(true)
    expect((await apiGet(page, '/api/user/me', baseURL ?? '')).status()).toBe(200)
  })

  test('AR-37 with the camera denied or missing only Subir foto is offered', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.addInitScript(() => {
      const devicesList = (async () => [{ kind: 'videoinput', deviceId: 'cam', label: '', groupId: 'g' }]) as never
      if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = devicesList
      else Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: devicesList } })
      const query = async () => ({ state: 'denied' })
      if (navigator.permissions) navigator.permissions.query = query as never
      else Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } })
    })
    const { path } = freshLink()
    await toPhoto(page, path)
    await expect(page.getByText('No tenemos permiso para usar tu cámara. Puedes subir una foto de tu dispositivo.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tomar foto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Subir foto' })).toBeVisible()
    await page.getByTestId('upload-input').setInputFiles(photo())
    await expect(previewImage(page)).toBeVisible()
  })

  test('AR-38 Crear cuenta names each missing field, the full waiver opens and phone formats follow the rules', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink()
    await toContact(page, path)
    const accept = page.getByLabel('He leído y acepto el relevo de responsabilidad.')
    const acceptError = page.getByText('Acepta el relevo para crear tu cuenta.')
    const nameError = page.getByText('Escribe el nombre de tu contacto.')
    const phoneError = page.getByText('Escribe un número de teléfono válido.')
    await create(page).click()
    await expect(acceptError).toBeVisible()
    await expect(nameError).toBeVisible()
    await expect(phoneError).toBeVisible()
    await accept.check()
    await expect(acceptError).toHaveCount(0)
    await expect(nameError).toBeVisible()
    await page.getByLabel('Nombre completo').fill('Contacto')
    await expect(nameError).toHaveCount(0)
    await create(page).click()
    await expect(phoneError).toBeVisible()
    await expect(page.getByLabel('Teléfono')).toBeFocused()

    await page.getByRole('button', { name: 'Leer relevo completo' }).click()
    await expect(page).toHaveURL(/\/register\/waiver$/)
    await expect(page.getByText(/Uso el Gimnasio de Pesas del Complejo Natatorio/)).toBeVisible()
    await page.getByRole('button', { name: 'Volver al registro' }).click()
    await expect(accept).toBeChecked()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto')
    if (info.project.name !== A) return // moved to phones 2026-11-09 (was desktop only)

    await page.getByLabel('Teléfono').fill('555010')
    await create(page).click()
    await expect(phoneError).toBeVisible()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await page.getByLabel('Teléfono').fill('abc-555-0100')
    await create(page).click()
    await expect(phoneError).toBeVisible()
    await page.getByLabel('Teléfono').fill('5550100')
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)

    const long = freshLink()
    await page.context().clearCookies()
    await toContact(page, long.path)
    await fillContact(page, 'Contacto de Prueba', '7'.repeat(31))
    expect((await page.getByLabel('Teléfono').inputValue()).length).toBe(30)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('AR-39 a save error returns to the photo with the data kept and the second try creates the account', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    await page.route('**/api/user/registration/athlete/complete', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }), { times: 1 })
    await create(page).click()
    await expect(heading(page, 'No pudimos crear tu cuenta')).toBeVisible()
    await expect(page.getByText('El registro no se completó')).toBeVisible()
    expect(linkRows(athlete).used).toBe(false)
    await page.getByRole('button', { name: 'Volver a mi foto' }).click()
    await expect(previewImage(page)).toBeVisible()
    await next(page).click()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
    await expect(page.getByLabel('He leído y acepto el relevo de responsabilidad.')).toBeChecked()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    expect(linkRows(athlete).used).toBe(true)
  })

  test('AR-40 a connection that drops during the save shows the save error and the link is not used until the retry works', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    await page.route('**/api/user/registration/athlete/complete', (route) => route.abort('internetdisconnected'), { times: 1 })
    await create(page).click()
    await expect(heading(page, 'No pudimos crear tu cuenta')).toBeVisible()
    expect(linkRows(athlete).used).toBe(false)
    await page.getByRole('button', { name: 'Volver a mi foto' }).click()
    await next(page).click()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    expect(linkRows(athlete).used).toBe(true)
  })

  test('AR-41 a link that expires while the form is open returns to Tu enlace venció and creates nothing', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    setLinkExpiry(athlete, -1)
    await create(page).click()
    await expectLinkScreen(page, 'expired')
    expect(usersWith(athlete.email)).toBe(0)
    expect(linkRows(athlete).used).toBe(false)
  })

  test('AR-42 a link replaced or a record claimed while the form is open shows its screen and creates nothing', async ({ page }, info) => {
    onlyOn(info, A, I)
    const replaced = freshLink()
    await filledForm(page, replaced.path)
    createLink(replaced.athlete, linkToken())
    await create(page).click()
    await expectLinkScreen(page, 'replaced')
    expect(usersWith(replaced.athlete.email)).toBe(0)

    const claimed = freshLink()
    await filledForm(page, claimed.path)
    claim(claimed.athlete)
    await create(page).click()
    await expectLinkScreen(page, 'claimed')
    expect(usersWith(claimed.athlete.email)).toBe(0)
  })

  test('AR-43 an account created for the roster email meanwhile sends the person to the existing account screen', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    createAccountFor(athlete.email)
    await create(page).click()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(heading(page, 'Ya tienes una cuenta')).toBeVisible()
    await expect(page.getByText(athlete.masked, { exact: true })).toBeVisible()
    expect(linkRows(athlete).used).toBe(false)
  })

  test('AR-44 with no current term the save fails with No pudimos crear tu cuenta and creates no user', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    const ends = termEnd()
    try {
      await filledForm(page, path)
      setTermEnd('yesterday')
      await create(page).click()
      await expect(heading(page, 'No pudimos crear tu cuenta')).toBeVisible()
      expect(usersWith(athlete.email)).toBe(0)
      expect(linkRows(athlete).used).toBe(false)
    } finally { setTermEnd(ends) }
  })

  test('AR-45 a lost privacy acceptance returns to the privacy notice and creates nothing', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    clearSessions()
    await create(page).click()
    await expect(heading(page, 'Antes de comenzar')).toBeVisible()
    expect((await apiGet(page, '/api/user/me', baseURL ?? '')).status()).toBe(401)
    expect(usersWith(athlete.email)).toBe(0)
  })

  test('AR-46 two tabs sending the same link together create one account and the other shows the link was used', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await filledForm(page, path)
    const other: BrowserContext = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'block' })
    try {
      const second = await other.newPage()
      await filledForm(second, path, { password: 'otra frase larga para el segundo registro' })
      await Promise.all([create(page).click(), create(second).click()])
      const installed = (tab: Page) => heading(tab, 'Instala la app')
      const refused = (tab: Page) => tab.getByRole('heading', { level: 1, name: /^(Este enlace ya se usó|No pudimos vincular este registro)$/ })
      const results = await Promise.all([page, second].map(async (tab) => {
        await expect(installed(tab).or(refused(tab))).toBeVisible()
        return (await installed(tab).isVisible()) ? 'created' : 'refused'
      }))
      expect(results.sort()).toEqual(['created', 'refused'])
      expect(usersWith(athlete.email)).toBe(1)
    } finally { await other.close() }
  })

  test('AR-47 the final step allows 10 calls a minute and the 11th gets a wait time; validate allows 30', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    flushCache()
    try {
      const { path } = freshLink()
      await filledForm(page, path)
      for (let call = 1; call <= 10; call += 1) {
        const answer = await rawApi(page.request, 'post', '/api/user/registration/athlete/complete', baseURL ?? '', { token: 'x' })
        expect(answer.status, `call ${call}`).not.toBe(429)
      }
      await create(page).click()
      await expect(page).toHaveURL(/\/register\/contact$/)
      await expect(page.getByText(/^Intenta de nuevo a las \d{1,2}:\d{2}/).first()).toBeVisible()
      await expect(create(page)).toBeDisabled()

      flushCache()
      // The limit is a one-minute window, so the 31 calls go out with the headers built once: with rawApi each call costs
      // about 750 ms and a loaded machine would let the window expire before the 31st.
      const first = await rawApi(page.request, 'post', '/api/user/registration/athlete/validate', baseURL ?? '', { token: 'x' })
      expect(first.status, 'validate 1').toBe(422)
      const xsrf = decodeURIComponent((await page.request.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '')
      const headers = { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': xsrf }
      const validate = async () => (await page.request.post('/api/user/registration/athlete/validate', { headers, data: { token: 'x' } })).status()
      for (let call = 2; call <= 30; call += 1) expect(await validate(), `validate ${call}`).toBe(422)
      expect(await validate()).toBe(429)
    } finally { flushCache() }
  })

  test('AR-48 sending the final step again after success is refused and no second account is made', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await register(page, path)
    const again = await rawApi(page.request, 'post', '/api/user/registration/athlete/complete', baseURL ?? '', { token: tokenOf(path) })
    expect(again.status).toBe(403)
    expect(again.body.error.code).toBe('forbidden')
    expect(usersWith(athlete.email)).toBe(1)
    expect((await apiGet(page, '/api/user/me', baseURL ?? '')).status()).toBe(200)
  })

  test('AR-49 the install help lists the steps for the phone and Continuar or Ahora no reaches Check In', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { path } = freshLink()
    await register(page, path)
    await expect(heading(page, 'Instala la app')).toBeVisible()
    if (info.project.name === A) {
      await page.getByRole('tab', { name: 'Android' }).click()
      await expect(page.getByText('1. Abre el menú ⋮.')).toBeVisible()
      await page.getByRole('link', { name: 'Ahora no' }).click()
    } else {
      await page.getByRole('tab', { name: 'iPhone' }).click()
      for (const step of ['Abre esta página en Safari.', 'Toca Compartir.', 'Selecciona Agregar a Inicio.', 'Confirma con Agregar.']) {
        await expect(page.getByText(step)).toBeVisible()
      }
      await page.getByRole('link', { name: 'Continuar' }).click()
    }
    await expect(page).toHaveURL(/\/check-in$/)
    await expect(heading(page, 'Check-in')).toBeVisible()
  })

  test('AR-50 signing in on a second device sends the first one to the sign in screen', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I)
    const { athlete, path } = freshLink()
    await register(page, path, { password: PASSWORD })
    const second = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'block' })
    try {
      const phone = await second.newPage()
      await signInUser(phone, athlete.email, PASSWORD)
    } finally { await second.close() }
    await page.goto('/account')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  })

  // Last: it spends the IP's whole failed-lookup allowance.
  test('AR-24 the 11th failed lookup is rate limited with the time to try again', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    flushCache()
    try {
      await openIdentify(page)
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const answer = await lookupApi(page, baseURL ?? '', `90000000${attempt % 10}`)
        expect(answer.status, `failure ${attempt}`).toBe(422)
      }
      const limited = page.waitForResponse((response) => response.url().endsWith('/registration/lookup'))
      await lookup(page, '900000011')
      expect((await limited).status()).toBe(429)
      await expect(page.getByText(/^Intenta de nuevo a las \d{1,2}:\d{2}/).first()).toBeVisible()
      await expect(next(page)).toBeDisabled()
    } finally { flushCache() }
  })
})
