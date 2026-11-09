import { readFileSync } from 'node:fs'
import { expect, test, devices, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { MEMBER, signInUser } from '../e2e/flows/flow.ts'
import { clearSessions, createOrder, createUser, fixtures, flushLimiter, jpegInfo, setStoreUrl, setTermEnd, termEnd, type OrderOptions } from './setup-registration.ts'

// #152 path tests for paid member registration (docs inventory: paid-registration.md, ids PR-xx). Each test creates its own
// orders with tinker on the test stack (KIM_PROJECT), so rows are independent and can run in any order, on every device.
// Failed lookups count against the IP (10 per 15 minutes): every row that fails on purpose flushes the limiter first.

test.setTimeout(180_000)

const A = 'android'
const I = 'iphone'
const PASSWORD = 'una frase larga para el registro de prueba'
const UNAVAILABLE = 'No pudimos validar este número. Revisa tu recibo o llama al 265-3866.'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const photo = (name = 'foto.png', buffer = PNG, mimeType = 'image/png') => ({ name, mimeType, buffer })

function onlyOn(info: TestInfo, ...devices: string[]) {
  test.skip(!devices.includes(info.project.name), `Row is for ${devices.join(', ')}`)
}

const next = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true })
const create = (page: Page) => page.getByRole('button', { name: 'Crear cuenta' })
const numberField = (page: Page) => page.getByLabel(/Número de (estudiante o transacción|autorización)/)
const previewImage = (page: Page) => page.getByRole('img', { name: 'Vista previa de la foto elegida' })

async function openPrivacy(page: Page) {
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
}

async function openIdentify(page: Page) {
  await openPrivacy(page)
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(numberField(page)).toBeVisible()
}

async function lookup(page: Page, number: string) {
  await numberField(page).fill(number)
  await next(page).click()
}

async function expectUnavailable(page: Page) {
  await expect(numberField(page)).toHaveAccessibleDescription(UNAVAILABLE)
  await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toBeVisible()
}

async function toPassword(page: Page, number: string) {
  await openIdentify(page)
  await lookup(page, number)
  await expect(page).toHaveURL(/\/register\/password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Crea una contraseña' })).toBeVisible()
}

async function setPassword(page: Page, password = PASSWORD, confirmation = password) {
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(confirmation)
  await next(page).click()
}

async function toPhoto(page: Page, number: string, password = PASSWORD) {
  await toPassword(page, number)
  await setPassword(page, password)
  await expect(page).toHaveURL(/\/register\/photo$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tu foto de identificación' })).toBeVisible()
}

async function choosePhoto(page: Page, file = photo()) {
  await page.getByTestId('camera-input').setInputFiles(file)
  await expect(previewImage(page)).toBeVisible()
}

async function toContact(page: Page, number: string, options: { password?: string; file?: ReturnType<typeof photo> } = {}) {
  await toPhoto(page, number, options.password)
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

/** Welcome to the install help, with a fresh order. Returns the order. */
async function register(page: Page, options: { order?: OrderOptions; password?: string; file?: ReturnType<typeof photo>; name?: string; phone?: string; prefix?: string } = {}) {
  const order = createOrder(options.prefix ?? 'PR', options.order)
  await toContact(page, order.number, options)
  await fillContact(page, options.name, options.phone)
  await create(page).click()
  await expect(page).toHaveURL(/\/install\?registered$/)
  return { ...order, password: options.password ?? PASSWORD }
}

async function goOffline(page: Page) {
  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

async function goOnline(page: Page) {
  await page.context().setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

/** Failed lookups sent straight to the API from the page's own session, to spend the IP's allowance. */
async function spendFailures(page: Page, count: number, baseURL: string) {
  for (let index = 0; index < count; index += 1) {
    const token = (await page.request.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const response = await page.request.post('/api/user/registration/lookup', {
      headers: { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': decodeURIComponent(token) },
      data: { authorization_number: `ZZ${Date.now().toString(36)}${index}`.slice(0, 20).toUpperCase(), locale: 'es' },
    })
    expect([422, 429]).toContain(response.status())
  }
}

/** A GET from the page's own session, with the Referer Sanctum needs to treat it as the app's own call. */
async function apiGet(page: Page, path: string, baseURL: string) {
  return page.request.get(path, { headers: { Accept: 'application/json', Referer: `${baseURL}/` } })
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

/** A second person on another phone, or after sign out: same browser, empty cookies. */
async function freshSession(page: Page) {
  await page.context().clearCookies()
}

test.describe('paid member registration paths', () => {
  test('PR-01 a paid member registers from Welcome and reaches Check In', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: 'Bienvenido', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeVisible()
    await page.getByRole('link', { name: 'Comenzar' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await page.getByRole('button', { name: 'Continuar con el registro' }).click()
    await lookup(page, order.number)
    await expect(page.getByText(`¡Hola, ${order.name}!`)).toBeVisible()
    await setPassword(page)
    await choosePhoto(page)
    await next(page).click()
    await fillContact(page)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Instala la app' })).toBeVisible()
    await page.getByRole('link', { name: /^(Continuar|Ahora no)$/ }).click()
    await expect(page).toHaveURL(/\/check-in$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Check-in' })).toBeVisible()
    await expect(page.getByText('Miembro', { exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Autorización activa' })).toBeVisible()
  })

  test('PR-02 the Welcome sheet opens with a tap or a swipe of 30 px, not with a short drag', async ({ page }, info) => {
    onlyOn(info, A, I)
    const collapsed = page.getByRole('heading', { name: 'Bienvenido', exact: true })
    const hint = page.getByText('Toca o desliza para continuar')
    const swipe = (distance: number) => page.locator('main.user-welcome__sheet').evaluate((sheet, up) => {
      const send = (type: string, y: number) => sheet.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 41, pointerType: 'touch', clientX: 100, clientY: y }))
      send('pointerdown', 600)
      send('pointermove', 600 - up)
      send('pointerup', 600 - up)
    }, distance)

    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).tap()
    await expect(page.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Comenzar' })).toBeVisible()

    await page.reload()
    await expect(hint).toBeVisible()
    await swipe(40)
    await expect(page.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeVisible()

    await page.reload()
    await expect(hint).toBeVisible()
    await swipe(20)
    await expect(collapsed).toBeVisible()
    await expect(hint).toBeVisible()
  })

  test('PR-03 the sign in and Welcome entry points lead to registration and sign in', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.goto('/sign-in')
    await page.getByRole('link', { name: 'Comenzar' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()

    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
    await page.getByRole('link', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('PR-04 the privacy gate leads to the number step and shows the draft badge', async ({ page }, info) => {
    onlyOn(info, A, I)
    await openPrivacy(page)
    // Figma N-08 (4078:334) draws only the BORRADOR badge in the notice card; the longer draft line is for the compact view.
    await expect(page.getByText('BORRADOR', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Continuar con el registro' }).click()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Registro', exact: true })).toBeVisible()
  })

  test('PR-05 the privacy notice that fails to load can be retried', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.route('**/api/user/registration/privacy', (route) => route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }) : route.continue())
    await page.goto('/register')
    await expect(page.getByText('No pudimos mostrar el aviso', { exact: true })).toBeVisible()
    await expect(page.getByText('Intenta de nuevo antes de continuar con el registro.')).toBeVisible()
    await page.unroute('**/api/user/registration/privacy')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
  })

  test('PR-06 the privacy notice is available offline and reloads when the connection returns', async ({ page }, info) => {
    onlyOn(info, A, I)
    await openPrivacy(page)
    await goOffline(page)
    await expect(page.getByText('El aviso está disponible sin conexión.')).toBeVisible()
    await goOnline(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
    await goOffline(page)
    await expect(page.getByText('El aviso está disponible sin conexión.')).toBeVisible()
    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/welcome$/)
  })

  test('PR-07 a direct URL to a later step shows the privacy notice', async ({ page }, info) => {
    onlyOn(info, A, I)
    for (const step of ['identify', 'password', 'photo', 'contact', 'waiver']) {
      await page.goto(`/register/${step}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' }), `/register/${step}`).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Crea una contraseña' })).toHaveCount(0)
    }
  })

  test('PR-08 reloading any step loses the data and starts again at the privacy notice', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPassword(page, order.number)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()

    await toPhoto(page, order.number)
    await choosePhoto(page)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()

    await toContact(page, order.number)
    await fillContact(page)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
    expect((await apiGet(page, '/api/user/me', baseURL ?? '')).status()).toBe(401)
  })

  test('PR-09 browser Back and the header arrow walk the steps backwards and keep the data', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)

    await page.goBack()
    await expect(page).toHaveURL(/\/register\/photo$/)
    await expect(previewImage(page)).toBeVisible()
    await next(page).click()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
    await expect(page.getByLabel('Teléfono')).toHaveValue('787-555-0100')
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(/\/register\/password$/)
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(PASSWORD)
    await page.goBack()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(numberField(page)).toHaveValue(order.number)

    await lookup(page, order.number)
    await expect(page).toHaveURL(/\/register\/password$/)
    await setPassword(page)
    await next(page).click()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/register\/photo$/)
    await expect(previewImage(page)).toBeVisible()
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/register\/password$/)
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(numberField(page)).toHaveValue(order.number)
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/welcome$/)
  })

  test('PR-10 the number ignores letter case and surrounding spaces', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPassword(page, order.number.toLowerCase())
    await expect(page.getByText(`¡Hola, ${order.name}!`)).toBeVisible()
    await freshSession(page)
    await toPassword(page, ` ${order.number} `)
    await expect(page.getByText(`¡Hola, ${order.name}!`)).toBeVisible()
  })

  test('PR-11 an order from an expired term gets the generic unavailable answer', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    await openIdentify(page)
    await lookup(page, 'VENCIDO')
    await expectUnavailable(page)
    await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toHaveAttribute('href', 'tel:265-3866')
  })

  test('PR-12 an order already used gets the same answer as an expired one', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    await openIdentify(page)
    await lookup(page, 'USADO01')
    await expectUnavailable(page)
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(page.getByText(/ya (se )?(usó|usado|reclam)/i)).toHaveCount(0)
  })

  test('PR-13 an unknown number gets the same answer', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    await openIdentify(page)
    await lookup(page, 'ZZZZZZ')
    await expectUnavailable(page)
  })

  test('PR-14 a cancelled order gets the same answer', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const order = createOrder('PR', { status: 'cancelled' })
    await openIdentify(page)
    await lookup(page, order.number)
    await expectUnavailable(page)
  })

  test('PR-15 an order paid at the start of the term is valid, one second earlier is not', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const valid = createOrder('PR', { paidAt: 'term-start' })
    const early = createOrder('PR', { paidAt: 'before-term-start' })
    await toPassword(page, valid.number)
    await freshSession(page)
    await openIdentify(page)
    await lookup(page, early.number)
    await expectUnavailable(page)
  })

  test('PR-16 an order is valid until the last day of the term and not the day after', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const original = termEnd()
    const order = createOrder('PR')
    try {
      setTermEnd('today')
      await toPassword(page, order.number)
      setTermEnd('yesterday')
      await freshSession(page)
      await openIdentify(page)
      await lookup(page, order.number)
      await expectUnavailable(page)
    } finally { setTermEnd(original) }
  })

  test('PR-17 an order of a term that has not started gets the generic answer', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const order = createOrder('PR', { term: 'next' })
    await openIdentify(page)
    await lookup(page, order.number)
    await expectUnavailable(page)
  })

  test('PR-18 a number of 20 characters is looked up, one of 21 is a validation error', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    await openIdentify(page)
    await lookup(page, 'A'.repeat(20))
    await expectUnavailable(page)
    await lookup(page, 'A'.repeat(21))
    await expect(page.getByText('Algunos campos necesitan corrección.').first()).toBeVisible()
    await expect(numberField(page)).toBeEditable()
    await expect(next(page)).toBeEnabled()
  })

  test('PR-19 eight and ten digit numbers are looked up as authorization numbers', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    await openIdentify(page)
    await lookup(page, '80200000')
    await expectUnavailable(page)
    await lookup(page, '8020000012')
    await expectUnavailable(page)
  })

  test('PR-20 an empty field sends nothing and hostile input is shown as text', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const requests: string[] = []
    const dialogs: string[] = []
    page.on('request', (request) => { if (request.url().endsWith('/registration/lookup')) requests.push(request.url()) })
    page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
    await openIdentify(page)
    await next(page).click()
    expect(await numberField(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true)
    expect(requests).toHaveLength(0)

    await lookup(page, '<script>x()</script>')
    await expectUnavailable(page)
    await lookup(page, "' OR 1=1 --")
    await expectUnavailable(page)
    await lookup(page, '<script>alert(1)</script>')
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(page.getByText('Algo salió mal de nuestro lado. Intenta más tarde.')).toHaveCount(0)
    expect(dialogs).toEqual([])
  })

  test('PR-21 a number whose email already has an account asks to sign in and stays unclaimed', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    createUser(order.email)
    await openIdentify(page)
    await lookup(page, order.number)
    const [local] = order.email.split('@')
    await expect(page.getByRole('heading', { level: 1, name: 'Ya tienes una cuenta' })).toBeVisible()
    await expect(page.getByText(`${local[0]}***${local.at(-1)}@example.com`, { exact: true })).toBeVisible()
    await expect(page.getByText('Todavía no hemos usado tu número ni vinculado tu registro.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver al registro' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Registro', exact: true })).toBeVisible()
  })

  test('PR-22 the store buttons show only when the store link is set', async ({ page }, info) => {
    onlyOn(info, A, I)
    try {
      setStoreUrl('https://example.com/tienda')
      await openIdentify(page)
      const links = page.getByRole('link', { name: 'Comprar membresía' })
      await expect(links).toHaveCount(2)
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('target', '_blank')
        await expect(link).toHaveAttribute('href', 'https://example.com/tienda')
      }
      await expect(page.getByText('¿No tienes membresía?')).toBeVisible()
      setStoreUrl(null)
      await openIdentify(page)
      await expect(page.getByRole('link', { name: 'Comprar membresía' })).toHaveCount(0)
      await expect(page.getByText('¿No tienes membresía?')).toHaveCount(0)
    } finally { setStoreUrl(null) }
  })

  test('PR-23 offline the number step disables Continuar and keeps the number', async ({ page }, info) => {
    onlyOn(info, A, I)
    await openIdentify(page)
    await numberField(page).fill('PR23TEST')
    await goOffline(page)
    await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
    await expect(next(page)).toBeDisabled()
    await goOnline(page)
    await expect(next(page)).toBeEnabled()
    await expect(numberField(page)).toHaveValue('PR23TEST')

    await page.route('**/api/user/registration/lookup', (route) => route.abort('internetdisconnected'), { times: 1 })
    await next(page).click()
    // The text shows twice: as the field error and in the status region that announces it.
    await expect(numberField(page)).toHaveAccessibleDescription(/Conéctate para continuar. Se conservan los datos ingresados./)
    await expect(numberField(page)).toHaveValue('PR23TEST')
  })

  test('PR-24 a server error on the lookup shows the generic message and keeps the number', async ({ page }, info) => {
    onlyOn(info, A, I)
    await openIdentify(page)
    await page.route('**/api/user/registration/lookup', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }))
    await lookup(page, 'PR24TEST')
    await expect(page.getByText('Algo salió mal de nuestro lado. Intenta más tarde.').first()).toBeVisible()
    await expect(numberField(page)).toHaveValue('PR24TEST')
  })

  test('PR-25 the 11th failed lookup is rate limited with a wait time, and works again after the limiter resets', async ({ page }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    try {
      await openIdentify(page)
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const answered = page.waitForResponse((response) => response.url().endsWith('/registration/lookup'))
        await lookup(page, `ZZ25${attempt}`)
        expect((await answered).status(), `failure ${attempt}`).toBe(422)
        await expectUnavailable(page)
      }
      const limited = page.waitForResponse((response) => response.url().endsWith('/registration/lookup'))
      await lookup(page, 'ZZ2511')
      const response = await limited
      expect(response.status()).toBe(429)
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0)
      await expect(page.getByText(/^Intenta de nuevo a las \d{1,2}:\d{2}/).first()).toBeVisible()
      await expect(next(page)).toBeDisabled()

      flushLimiter()
      const order = createOrder('PR')
      await freshSession(page)
      await toPassword(page, order.number)
    } finally { flushLimiter() }
  })

  test('PR-26 tapping Continuar twice sends one lookup', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    let lookups = 0
    page.on('request', (request) => { if (request.url().endsWith('/registration/lookup')) lookups += 1 })
    await openIdentify(page)
    await numberField(page).fill(order.number)
    await next(page).dblclick()
    await expect(page).toHaveURL(/\/register\/password$/)
    expect(lookups).toBe(1)
  })

  test('PR-27 a signed-in visitor cannot open the registration', async ({ page }, info) => {
    onlyOn(info, A, I)
    await signInUser(page, MEMBER.email, MEMBER.password)
    await page.goto('/register')
    await expect(page.getByText('No pudimos mostrar el aviso', { exact: true })).toBeVisible()
  })

  test('PR-28 a valid password moves on and the show buttons reveal both fields', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPassword(page, order.number)
    const password = page.getByLabel('Contraseña', { exact: true })
    const confirmation = page.getByLabel('Confirmar contraseña', { exact: true })
    await password.fill(PASSWORD)
    await confirmation.fill(PASSWORD)
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click()
    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click()
    await expect(password).toHaveAttribute('type', 'text')
    await expect(confirmation).toHaveAttribute('type', 'text')
    await next(page).click()
    await expect(page).toHaveURL(/\/register\/photo$/)
  })

  test('PR-29 a password of 9 characters is refused, 10 is accepted', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPassword(page, order.number)
    await setPassword(page, '123456789a'.slice(0, 9))
    await expect(page.getByText('Usa al menos 10 caracteres.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/password$/)
    await setPassword(page, '123456789a')
    await expect(page).toHaveURL(/\/register\/photo$/)
  })

  test('PR-30 a confirmation that differs is refused', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPassword(page, order.number)
    await setPassword(page, PASSWORD, `${PASSWORD}x`)
    await expect(page.getByText('Las contraseñas deben coincidir.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/password$/)
  })

  test('PR-31 a password of 255 characters is accepted and the 256th is not typed', async ({ page }, info) => {
    onlyOn(info, A, I)
    const long = 'p'.repeat(255)
    const order = createOrder('PR')
    await toPassword(page, order.number)
    await page.getByLabel('Contraseña', { exact: true }).fill('p'.repeat(256))
    expect((await page.getByLabel('Contraseña', { exact: true }).inputValue()).length).toBe(255)
    await setPassword(page, long)
    await expect(page).toHaveURL(/\/register\/photo$/)
    await choosePhoto(page)
    await next(page).click()
    await fillContact(page)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-32 a password of 5 emoji (10 UTF-16 units) goes back to the password step with the server message', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number, { password: '😀😀😀😀😀' })
    await fillContact(page)
    await create(page).click()
    await expect(page).toHaveURL(/\/register\/password$/)
    await expect(page.getByText('Usa al menos 10 caracteres.').first()).toBeVisible()
  })

  test('PR-33 a compromised password goes back to the password step and the error clears on edit', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await page.route('**/api/user/registration/complete', (route) => route.fulfill({
      status: 422, json: { error: { code: 'validation_failed', details: { password: ['password'] } } },
    }))
    await toContact(page, order.number, { password: 'password12345' })
    await fillContact(page)
    await create(page).click()
    await expect(page).toHaveURL(/\/register\/password$/)
    await expect(page.getByText('Esta contraseña apareció en una filtración. Elige otra.')).toBeVisible()
    await page.getByLabel('Contraseña', { exact: true }).fill('otra frase distinta')
    await expect(page.getByText('Esta contraseña apareció en una filtración. Elige otra.')).toHaveCount(0)
  })

  test('PR-34 a photo is taken or chosen on the camera input and shows a preview', async ({ page }, info) => {
    onlyOn(info, A)
    const order = createOrder('PR')
    await toPhoto(page, order.number)
    await expect(page.getByText('Aún no has elegido una foto')).toBeVisible()
    await expect(next(page)).toBeDisabled()
    if (info.project.name === A) {
      const chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Tomar foto' }).click()
      await (await chooser).setFiles(photo('selfie.png'))
    } else {
      await page.getByTestId('camera-input').setInputFiles(photo('selfie.png'))
    }
    await expect(previewImage(page)).toBeVisible()
    await expect(page.getByText('Aún no has elegido una foto')).toHaveCount(0)
    await expect(next(page)).toBeEnabled()
  })

  test('PR-35 an uploaded photo replaces the taken one and a cancelled picker keeps it', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPhoto(page, order.number)
    await choosePhoto(page, photo('primera.png'))
    const first = await previewImage(page).getAttribute('src')
    await page.getByTestId('upload-input').setInputFiles(photo('segunda.png', Buffer.concat([PNG, Buffer.alloc(4)])))
    await expect.poll(() => previewImage(page).getAttribute('src')).not.toBe(first)
    const second = await previewImage(page).getAttribute('src')
    await page.getByTestId('upload-input').setInputFiles([])
    await expect(previewImage(page)).toHaveAttribute('src', second ?? '')
    await expect(next(page)).toBeEnabled()
  })

  test('PR-36 with the camera permission denied only Subir foto is offered', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.addInitScript(() => {
      const devices = (async () => [{ kind: 'videoinput', deviceId: 'cam', label: '', groupId: 'g' }]) as never
      if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = devices
      else Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: devices } })
      const query = async () => ({ state: 'denied' })
      if (navigator.permissions) navigator.permissions.query = query as never
      else Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } })
    })
    const order = createOrder('PR')
    await toPhoto(page, order.number)
    await expect(page.getByText('No tenemos permiso para usar tu cámara. Puedes subir una foto de tu dispositivo.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tomar foto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Subir foto' })).toBeVisible()
    await page.getByTestId('upload-input').setInputFiles(photo())
    await expect(previewImage(page)).toBeVisible()
  })

  test('PR-37 without a camera only Subir foto is offered', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.addInitScript(() => {
      const devices = (async () => []) as never
      if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = devices
      else Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: devices } })
    })
    const order = createOrder('PR')
    await toPhoto(page, order.number)
    await expect(page.getByText('Este dispositivo o navegador no tiene una cámara disponible. Puedes subir una foto.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tomar foto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Subir foto' })).toBeVisible()
  })

  test('PR-39 JPEG and PNG photos are accepted', async ({ page }, info) => {
    onlyOn(info, A, I)
    const { smallJpeg } = fixtures()
    await register(page, { file: photo('foto.jpg', smallJpeg, 'image/jpeg') })
    await freshSession(page)
    await register(page, { file: photo('foto.png') })
  })

  test('PR-40 a photo of exactly 10 MB is accepted, one byte more is refused before sending', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toPhoto(page, order.number)
    await choosePhoto(page, photo('limite.jpg', Buffer.alloc(10485760), 'image/jpeg'))
    await expect(next(page)).toBeEnabled()
    await page.getByTestId('upload-input').setInputFiles(photo('grande.jpg', Buffer.alloc(10485761), 'image/jpeg'))
    await expect(page.getByText('La foto supera 10 MB')).toBeVisible()
    await expect(page.getByText('Elige una foto de hasta 10 MB o vuelve a tomarla. Tus otros datos se conservan.')).toBeVisible()
    await expect(next(page)).toBeDisabled()
  })

  test('PR-42 a GIF, a PDF and a text file renamed .jpg are refused as a wrong format', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    const wrong = [
      photo('a.jpg', Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'), 'image/jpeg'),
      photo('b.jpg', Buffer.from('%PDF-1.4 1 0 obj << /Type /Catalog >> endobj trailer << /Root 1 0 R >> %%EOF'), 'image/jpeg'),
      photo('c.jpg', Buffer.from('esto es solo texto'), 'image/jpeg'),
    ]
    await toContact(page, order.number, { file: wrong[0] })
    await fillContact(page)
    for (const [index, file] of wrong.entries()) {
      const answered = page.waitForResponse((response) => response.url().endsWith('/registration/complete'))
      if (index === 0) await create(page).click()
      else {
        await page.getByTestId('upload-input').setInputFiles(file)
        await page.getByRole('button', { name: 'Reintentar' }).click()
      }
      expect((await answered).status(), file.name).toBe(422)
      await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu foto' })).toBeVisible()
      await expect(page.getByRole('alert')).toContainText('Formato no permitido')
      await expect(page.getByRole('alert')).toContainText('Elige un archivo JPEG, PNG o HEIC. Tus otros datos siguen en esta página.')
    }
  })

  test('PR-43 an empty photo file is refused by the server', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number, { file: photo('a.jpg', Buffer.alloc(0), 'image/jpeg') })
    await fillContact(page)
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu foto' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(/Formato no permitido|Tu foto no se pudo procesar/)
  })

  test('PR-44 a corrupt image is refused and the number is still free for a good photo', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    const corrupt = Buffer.concat([PNG.subarray(0, 33), Buffer.from('garbage-after-the-header-'.repeat(8))])
    await toContact(page, order.number, { file: photo('rota.png', corrupt) })
    await fillContact(page)
    await create(page).click()
    await expect(page.getByRole('alert')).toContainText('Tu foto no se pudo procesar')
    await expect(page.getByRole('alert')).toContainText('Elige otra foto o vuelve a tomarla. Formatos: JPEG, PNG o HEIC (máx. 10 MB).')
    await page.getByTestId('upload-input').setInputFiles(photo('buena.png'))
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-45 a large JPEG with EXIF is stored resized, light, upright and without EXIF', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    test.setTimeout(300_000)
    const { bigJpegPath } = fixtures()
    expect(readFileSync(bigJpegPath).length).toBeLessThanOrEqual(10485760)
    await register(page, { file: { name: 'grande.jpg', mimeType: 'image/jpeg', buffer: readFileSync(bigJpegPath) } })
    const stored = await apiGet(page, '/api/user/photo', baseURL ?? '')
    expect(stored.status()).toBe(200)
    expect(stored.headers()['content-type']).toContain('image/jpeg')
    const body = await stored.body()
    const info2 = jpegInfo(body)
    expect(info2.jpeg).toBe(true)
    expect(Math.max(info2.width, info2.height)).toBeLessThanOrEqual(1200)
    expect(body.length).toBeLessThanOrEqual(512 * 1024)
    expect(info2.exif).toBe(false)
    expect(info2.height, 'upright: the original is 6000x4000 with orientation 6').toBeGreaterThan(info2.width)
  })

  test('PR-46 Crear cuenta names each missing field and each error clears when its field is edited', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    const accept = page.getByLabel('He leído y acepto el relevo de responsabilidad.')
    const acceptError = page.getByText('Acepta el relevo para crear tu cuenta.')
    const nameError = page.getByText('Escribe el nombre de tu contacto.')
    const phoneError = page.getByText('Escribe un número de teléfono válido.')

    await create(page).click()
    await expect(acceptError).toBeVisible()
    await expect(nameError).toBeVisible()
    await expect(phoneError).toBeVisible()
    await expect(accept).toBeFocused()

    await accept.check()
    await expect(acceptError).toHaveCount(0)
    await expect(nameError).toBeVisible()
    await page.getByLabel('Nombre completo').fill('Contacto')
    await expect(nameError).toHaveCount(0)
    await expect(phoneError).toBeVisible()
    await create(page).click()
    await expect(phoneError).toBeVisible()
    await expect(page.getByLabel('Teléfono')).toBeFocused()
    await page.getByLabel('Teléfono').fill('787-555-0100')
    await expect(phoneError).toHaveCount(0)

    await accept.uncheck()
    await page.getByLabel('Nombre completo').fill('')
    await create(page).click()
    await expect(acceptError).toBeVisible()
    await expect(nameError).toBeVisible()
    await expect(phoneError).toHaveCount(0)
  })

  test('PR-47 the full waiver opens, shows its text and version, and Volver keeps the form', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    await page.getByRole('button', { name: 'Leer relevo completo' }).click()
    await expect(page).toHaveURL(/\/register\/waiver$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Relevo', exact: true })).toBeVisible()
    await expect(page.getByText(/Uso el Gimnasio de Pesas del Complejo Natatorio/)).toBeVisible()
    await expect(page.getByText(/^BORRADOR · Versión borrador-2026-11-08$/)).toBeVisible()
    await page.getByRole('button', { name: 'Volver al registro' }).click()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await expect(page.getByLabel('He leído y acepto el relevo de responsabilidad.')).toBeChecked()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
    await expect(page.getByLabel('Teléfono')).toHaveValue('787-555-0100')
  })

  test('PR-48 the contact name rejects spaces, stops at 255 characters and accepts accents', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page, ' ')
    await create(page).click()
    await expect(page.getByText('Escribe el nombre de tu contacto.')).toBeVisible()
    await page.getByLabel('Nombre completo').fill('n'.repeat(256))
    expect((await page.getByLabel('Nombre completo').inputValue()).length).toBe(255)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)

    await freshSession(page)
    await register(page, { name: 'José Ñandú' })
  })

  test('PR-49 a phone with 6 digits or no digits is refused by the server, 7 digits is accepted', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page, 'Contacto de Prueba', '555010')
    await create(page).click()
    await expect(page.getByText('Escribe un número de teléfono válido.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await page.getByLabel('Teléfono').fill('(((((((')
    await create(page).click()
    await expect(page.getByText('Escribe un número de teléfono válido.')).toBeVisible()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await page.getByLabel('Teléfono').fill('5550100')
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-50 four phone formats are accepted and letters are refused', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page, 'Contacto de Prueba', 'abc-555-0100')
    await create(page).click()
    await expect(page.getByText('Escribe un número de teléfono válido.')).toBeVisible()
    await page.getByLabel('Teléfono').fill('+1 (787) 555-0100')
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    for (const phone of ['787 555 0100', '787.555.0100', '787-555-0100']) {
      await freshSession(page)
      await register(page, { phone })
    }
  })

  test('PR-51 a phone of 30 digits is accepted and the 31st is not typed', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page, 'Contacto de Prueba', '7'.repeat(31))
    expect((await page.getByLabel('Teléfono').inputValue()).length).toBe(30)
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-52 a waiver that fails to load blocks the account and can be retried', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await page.route('**/api/user/registration/waiver**', (route) => route.fulfill({ status: 503, json: { error: { code: 'server_error' } } }))
    await toPhoto(page, order.number)
    await choosePhoto(page)
    await next(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'No pudimos cargar el relevo' })).toBeVisible()
    await expect(page.getByText('Intenta de nuevo antes de crear tu cuenta.')).toBeVisible()
    await expect(page.getByText('Tus datos se conservan')).toBeVisible()
    await expect(page.getByText('No podemos guardar el registro sin mostrar el relevo y recibir tu aceptación.')).toBeVisible()
    await expect(create(page)).toHaveCount(0)
    await page.unroute('**/api/user/registration/waiver**')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Relevo y contacto de emergencia' })).toBeVisible()
    await expect(create(page)).toBeEnabled()
  })

  test('PR-53 a stale waiver version reloads the waiver and the form can be sent again', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    await page.route('**/api/user/registration/complete', (route) => route.fulfill({
      status: 422, json: { error: { code: 'validation_failed', details: { waiver_version: ['in'] } } },
    }), { times: 1 })
    const reloaded = page.waitForRequest((request) => request.url().includes('/registration/waiver') && request.method() === 'GET')
    await create(page).click()
    await reloaded
    await expect(page).toHaveURL(/\/register\/contact$/)
    await expect(create(page)).toBeEnabled()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-54 a save error returns to the photo with the data kept and the second try succeeds', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    await page.route('**/api/user/registration/complete', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }), { times: 1 })
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'No pudimos crear tu cuenta' })).toBeVisible()
    await expect(page.getByText('El registro no se completó')).toBeVisible()
    await page.getByRole('button', { name: 'Volver a mi foto' }).click()
    await expect(previewImage(page)).toBeVisible()
    await next(page).click()
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
    await expect(page.getByLabel('He leído y acepto el relevo de responsabilidad.')).toBeChecked()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-55 a connection that drops during the save shows the save error and the number stays free', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    await page.route('**/api/user/registration/complete', (route) => route.abort('internetdisconnected'), { times: 1 })
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'No pudimos crear tu cuenta' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver a mi foto' }).click()
    await next(page).click()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
  })

  test('PR-56 tapping Crear cuenta twice creates one account', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    let completes = 0
    page.on('request', (request) => { if (request.url().endsWith('/registration/complete')) completes += 1 })
    await toContact(page, order.number)
    await fillContact(page)
    await create(page).dblclick()
    await expect(page).toHaveURL(/\/install\?registered$/)
    expect(completes).toBe(1)
  })

  test('PR-57 when someone else claims the number first the second person goes back to the number step', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    const other: BrowserContext = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'block' })
    try {
      const phone = await other.newPage()
      await toContact(phone, order.number, { password: 'otra frase larga para el segundo registro' })
      await fillContact(phone, 'Otro Contacto', '787-555-0111')
      await create(phone).click()
      await expect(phone).toHaveURL(/\/install\?registered$/)
    } finally { await other.close() }
    await create(page).click()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expectUnavailable(page)
  })

  test('PR-58 an account created for the email meanwhile sends the person to the existing account screen', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    createUser(order.email)
    await create(page).click()
    await expect(page).toHaveURL(/\/register\/identify$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ya tienes una cuenta' })).toBeVisible()
  })

  test('PR-59 a lost privacy acceptance returns to the privacy notice and creates nothing', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    clearSessions()
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
    expect((await apiGet(page, '/api/user/me', baseURL ?? '')).status()).toBe(401)
  })

  test('PR-60 a rate limited save stays on the contact step with a wait time', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    flushLimiter()
    try {
      const order = createOrder('PR')
      await toContact(page, order.number)
      await fillContact(page)
      await spendFailures(page, 11, baseURL ?? '')
      await create(page).click()
      await expect(page).toHaveURL(/\/register\/contact$/)
      await expect(page.getByText(/^Intenta de nuevo a las \d{1,2}:\d{2}/).first()).toBeVisible()
      await expect(create(page)).toBeDisabled()
    } finally { flushLimiter() }
  })

  test('PR-61 a retry after a lost save response ends at the install help with one account', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    await page.route('**/api/user/registration/complete', async (route) => {
      await route.fetch()
      await route.fulfill({ status: 500, json: { error: { code: 'server_error' } } })
    }, { times: 1 })
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'No pudimos crear tu cuenta' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver a mi foto' }).click()
    await next(page).click()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    const me = await apiGet(page, '/api/user/me', baseURL ?? '')
    expect((await me.json()).email).toBe(order.email)
  })

  test('PR-62 the install help on iPhone lists the Safari steps and Continuar goes to Check In', async ({ page }, info) => {
    onlyOn(info, I)
    await register(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Instala la app' })).toBeVisible()
    await page.getByRole('tab', { name: 'iPhone' }).click()
    for (const step of ['Abre esta página en Safari.', 'Toca Compartir.', 'Selecciona Agregar a Inicio.', 'Confirma con Agregar.']) {
      await expect(page.getByText(step)).toBeVisible()
    }
    if (info.project.name === I) await expect(page.getByRole('tab', { name: 'iPhone' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('link', { name: 'Continuar' }).click()
    await expect(page).toHaveURL(/\/check-in$/)
  })

  test('PR-63 the install help on Android lists the Chrome steps, offers the browser prompt and Ahora no goes to Check In', async ({ page }, info) => {
    onlyOn(info, A)
    await register(page)
    await page.getByRole('tab', { name: 'Android' }).click()
    await expect(page.getByText('Ten la app a mano')).toBeVisible()
    await expect(page.getByText('1. Abre el menú ⋮.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Instalar app' })).toHaveCount(0)
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
      event.prompt = async () => undefined
      event.userChoice = Promise.resolve({ outcome: 'dismissed' })
      window.dispatchEvent(event)
    })
    await expect(page.getByRole('button', { name: 'Instalar app' })).toBeVisible()
    if (info.project.name === A) await expect(page.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('link', { name: 'Ahora no' }).click()
    await expect(page).toHaveURL(/\/check-in$/)
  })

  test('PR-64 an already installed app says so and continues to Check In', async ({ page }, info) => {
    onlyOn(info, A, I)
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window)
      window.matchMedia = (query: string) => query.includes('display-mode: standalone')
        ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList
        : original(query)
    })
    await page.goto('/install?registered')
    await expect(page.getByRole('heading', { level: 1, name: '¡Todo listo!' })).toBeVisible()
    await expect(page.getByText('Ya estás usando la app instalada.')).toBeVisible()
    await page.getByRole('link', { name: 'Continuar' }).click()
    await expect(page).toHaveURL(/\/check-in$/)
  })

  test('PR-65 Mi cuenta shows the name, email, Miembro badge and the current term', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = await register(page)
    await page.getByRole('link', { name: /^(Continuar|Ahora no)$/ }).click()
    await expect(page).toHaveURL(/\/check-in$/)
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Mi cuenta' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { level: 2, name: order.name })).toBeVisible()
    await expect(page.getByText(order.email, { exact: true })).toBeVisible()
    await expect(page.getByText('Miembro', { exact: true })).toBeVisible()
    await expect(page.getByText('Acceso vigente · Término actual')).toBeVisible()
    await expect(page.getByRole('link', { name: /Instalar app/ })).toBeVisible()
    await expect(page.getByText('Soy atleta')).toHaveCount(0)
  })

  test('PR-66 signing in on a second device replaces the first one', async ({ page, browser, baseURL }, info) => {
    onlyOn(info, A, I)
    const order = await register(page)
    const second = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'block' })
    try {
      const phone = await second.newPage()
      await signInUser(phone, order.email, order.password)
    } finally { await second.close() }
    await page.goto('/account')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  })

  test('PR-68 the whole registration runs in English when English is chosen on Welcome', async ({ page, baseURL }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    await page.goto('/welcome')
    await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('link', { name: 'Get started' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Before you begin' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue registration' }).click()
    await page.getByLabel('Student or transaction number').fill(order.number)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Create a password' })).toBeVisible()
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your ID photo' })).toBeVisible()
    await page.getByTestId('camera-input').setInputFiles(photo())
    await expect(page.getByRole('img', { name: 'Preview of the chosen photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Release and emergency contact' })).toBeVisible()
    await page.getByRole('button', { name: 'Read the full release' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Release', exact: true })).toBeVisible()
    await expect(page.locator('.registration-document')).not.toContainText('Uso el Gimnasio de Pesas')
    await page.getByRole('button', { name: 'Back to registration' }).click()
    await page.getByLabel('I have read and accept the release of liability.').check()
    await page.getByLabel('Full name').fill('Test Contact')
    await page.getByLabel('Phone').fill('787-555-0100')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Install the app' })).toBeVisible()
    expect((await (await apiGet(page, '/api/user/me', baseURL ?? '')).json()).locale).toBe('en')
  })

  test('PR-69 the registration fits the phone screen at every step', async ({ page }, info) => {
    onlyOn(info, A, I)
    const order = createOrder('PR')
    expect(page.viewportSize()?.width).toBe(info.project.name === A ? 412 : 390)
    await openPrivacy(page)
    await noHorizontalScroll(page)
    await page.getByRole('button', { name: 'Continuar con el registro' }).click()
    await noHorizontalScroll(page)
    await expect(next(page)).toBeInViewport()
    await lookup(page, order.number)
    await expect(page).toHaveURL(/\/register\/password$/)
    await noHorizontalScroll(page)
    await expect(next(page)).toBeInViewport()
    await setPassword(page)
    await choosePhoto(page)
    await noHorizontalScroll(page)
    await expect(next(page)).toBeInViewport()
    await next(page).click()
    await expect(page).toHaveURL(/\/register\/contact$/)
    await fillContact(page)
    await noHorizontalScroll(page)
    await create(page).scrollIntoViewIfNeeded()
    await expect(create(page)).toBeInViewport()
    await create(page).click()
    await expect(page).toHaveURL(/\/install\?registered$/)
    await noHorizontalScroll(page)
  })

  test('PR-70 on a slow 3G network the save keeps showing Guardando until the answer arrives', async ({ page, context }, info) => {
    onlyOn(info, A)
    const order = createOrder('PR')
    await toContact(page, order.number)
    await fillContact(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: 50_000, uploadThroughput: 50_000 })
    await create(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Guardando tu cuenta' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await expect(page.getByRole('heading', { level: 1, name: 'No pudimos crear tu cuenta' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/install\?registered$/, { timeout: 90_000 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  })
})
