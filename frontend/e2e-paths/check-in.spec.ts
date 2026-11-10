import { expect, test, type Page } from '@playwright/test'
import { ADMIN, api, COARSE, DENIED, fakeLocation, frontDeskCheckOut, INSIDE, moveTo, OUTSIDE, signInUser, STAFF } from '../e2e/flows/flow.ts'
import {
  addClosure, addPeriod, countRequests, createMember, deleteSlot, dropMarkedSlots, endSlot, flushCache, rawApi, resetSchedule, restoreCurrentTermEnd,
  restoreHours, sessionCount, setCurrentTermEnd, setHoursEndingIn, setPhotoPending, signInApi, tinkerJson, type Member, type MemberOptions,
} from './setup.ts'

// #152 path tests for flow 4, Check In. One test per row of the path inventory (CI-01 to CI-83), each on its own fresh users.

test.setTimeout(120_000)

test.beforeAll(() => {
  flushCache()
  resetSchedule()
})
test.afterAll(() => dropMarkedSlots())

const ABBREVIATION: Record<string, string> = { desktop: 'D', 'desktop-firefox': 'D', 'desktop-webkit': 'D', android: 'A', iphone: 'I' }
/** Limits a row to the devices the inventory lists (D desktop, A Android, I iPhone). */
function only(devices: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devices.includes(device), `the inventory lists ${devices} for this path`)
}

const NORTH_INSIDE = { latitude: 18.211449, longitude: -67.141, accuracy: 12 }
const NORTH_OUTSIDE = { latitude: 18.21145, longitude: -67.141, accuracy: 12 }
const EAST_INSIDE = { latitude: 18.211, longitude: -67.140527, accuracy: 12 }
const EAST_OUTSIDE = { latitude: 18.211, longitude: -67.140526, accuracy: 12 }
const UNAVAILABLE = 2 as typeof DENIED
const TIMEOUT = 3 as typeof DENIED

const HOLD = '.check-in-hold'
const READY = '¿Listo para entrenar?'

/** Creates the member, signs in through the API and opens Check In ready to hold, with the faked location. */
async function begin(page: Page, baseURL: string | undefined, options: MemberOptions = {}, where: Parameters<typeof fakeLocation>[1] | null = INSIDE) {
  const member = createMember(options)
  await open(page, baseURL, member, where)
  return member
}

async function open(page: Page, baseURL: string | undefined, member: Member, where: Parameters<typeof fakeLocation>[1] | null = INSIDE) {
  if (where !== null) await fakeLocation(page, where)
  await signInApi(page.request, baseURL!, member)
  await page.goto('/check-in')
  await expect(page.locator(HOLD)).toBeVisible()
}

/** Presses the hold button with the pointer for `ms` milliseconds. */
async function hold(page: Page, ms = 1100) {
  const button = page.locator(HOLD)
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

async function expectGymId(page: Page) {
  await expect(page.locator('.check-in-lead')).toHaveText('¡Tu entrada quedó registrada!')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
}

async function expectRefusal(page: Page, title: string, text?: string, action?: string) {
  await expect(heading(page, title)).toBeVisible()
  if (text) await expect(page.getByText(text, { exact: true })).toBeVisible()
  if (action) await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible()
}

const entryTime = (page: Page) => page.locator('.check-in-id__time').first().textContent()

async function openVisitId(page: Page, baseURL: string | undefined): Promise<number> {
  const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
  return body.session.id
}

/** A second phone: another browser context of the same device type. */
async function secondPhone(browser: import('@playwright/test').Browser, baseURL: string | undefined) {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = test.info().project.use
  const context = await browser.newContext({ baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor })
  return { context, page: await context.newPage() }
}

const visibilityPoll = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

// ------------------------------------------------------------------------------------------ valid check ins

test('CI-01 paid student inside the gym gets the Gym ID', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  await expect(page.getByText('Estudiante', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-id__time').first()).toHaveText(/\d{1,2}:\d{2}/)
})

test('CI-02 athlete gets the Gym ID with the sport and no student line', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'athlete', sport: 'Voleibol' })
  await hold(page)
  await expectGymId(page)
  await expect(page.locator('.check-in-id__category')).toHaveText('Atleta')
  await expect(page.getByText('Voleibol', { exact: true })).toBeVisible()
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
})

test('CI-03 paid employee gets the Gym ID tagged Miembro with no group line', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { group: 'employee' })
  await hold(page)
  await expectGymId(page)
  await expect(page.locator('.check-in-id__category')).toHaveText('Miembro')
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
})

test('CI-04 manual employee with a photo gets the Gym ID tagged Miembro', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'manual', group: 'employee' })
  await hold(page)
  await expectGymId(page)
  await expect(page.locator('.check-in-id__category')).toHaveText('Miembro')
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
})

// -------------------------------------------------------------------------------------- accuracy and radius

test('CI-05 accuracy exactly 50 m is accepted', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, { ...INSIDE, accuracy: 50 })
  await hold(page)
  await expectGymId(page)
})

test('CI-06 accuracy 50.01 m is refused as too coarse', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, { ...INSIDE, accuracy: 50.01 })
  await hold(page)
  await expectRefusal(page, 'Necesitamos mayor precisión', 'La ubicación recibida no tiene suficiente precisión para confirmar tu llegada.', 'Intentar de nuevo')
})

test('CI-07 accuracy exactly 0 m is accepted', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, { ...INSIDE, accuracy: 0 })
  await hold(page)
  await expectGymId(page)
})

test('CI-08 accuracy 500 m is refused as too coarse', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, COARSE)
  await hold(page)
  await expectRefusal(page, 'Necesitamos mayor precisión')
})

test('CI-09 49.93 m north of the center is inside the radius', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, NORTH_INSIDE)
  await hold(page)
  await expectGymId(page)
})

test('CI-10 50.04 m north of the center is outside the radius', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, NORTH_OUTSIDE)
  await hold(page)
  await expectRefusal(page, 'Acércate al gimnasio', 'Debes estar dentro del área del gimnasio para registrar tu entrada.', 'Intentar de nuevo')
})

test('CI-11 49.96 m east of the center is inside the radius', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, EAST_INSIDE)
  await hold(page)
  await expectGymId(page)
})

test('CI-12 50.07 m east of the center is outside the radius', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, EAST_OUTSIDE)
  await hold(page)
  await expectRefusal(page, 'Acércate al gimnasio')
})

test('CI-13 one kilometer away is refused as outside', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, OUTSIDE)
  await hold(page)
  await expectRefusal(page, 'Acércate al gimnasio')
})

test('CI-14 outside, then inside: Intentar de nuevo opens the Gym ID with one visit', async ({ page, baseURL }) => {
  only('AI')
  const member = await begin(page, baseURL, {}, OUTSIDE)
  await hold(page)
  await expectRefusal(page, 'Acércate al gimnasio')
  await moveTo(page, INSIDE)
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click()
  await expectGymId(page)
  expect(sessionCount(member)).toBe(1)
})

test('CI-15 poor accuracy is reported before the distance', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, { ...OUTSIDE, accuracy: 500 })
  await hold(page)
  await expectRefusal(page, 'Necesitamos mayor precisión')
  await expect(heading(page, 'Acércate al gimnasio')).toHaveCount(0)
})

// ------------------------------------------------------------------------------------ location permission

test('CI-16 denied location shows the permission screen and sends nothing', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, DENIED)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  await hold(page)
  await expectRefusal(page, 'Activa el permiso de ubicación',
    'Activa el permiso de ubicación en los ajustes del navegador. Luego pulsa Reintentar para continuar con tu Check-in.')
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver cómo activar ubicación' })).toBeVisible()
  await expect(page.getByText('En la PWA, abre los ajustes del sitio desde el navegador.')).toBeVisible()
  expect(posts).toHaveLength(0)
})

test('CI-17 the real browser permission denial shows the same screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, null)
  await hold(page)
  await expectRefusal(page, 'Activa el permiso de ubicación')
})

test('CI-18 the location help dialog opens, closes and returns focus', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, DENIED)
  await hold(page)
  const opener = page.getByRole('button', { name: 'Ver cómo activar ubicación' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Activa tu ubicación' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'iPhone · Safari' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Android · Chrome' })).toBeVisible()
  await expect(dialog.getByText('Activa también la ubicación del dispositivo.', { exact: false })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar ayuda' }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  await opener.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('CI-19 denied, then granted: Reintentar asks the API and registers', async ({ page, baseURL }) => {
  only('AI')
  const webkit = test.info().project.name === 'iphone'
  // WebKit keeps a denied geolocation permission for the page, so on the iPhone project the grant is faked.
  if (webkit) test.info().annotations.push({ type: 'note', description: 'WebKit cannot regrant geolocation after a denial: the grant is faked with a location mock' })
  await begin(page, baseURL, {}, webkit ? DENIED : null)
  await hold(page)
  await expectRefusal(page, 'Activa el permiso de ubicación')
  if (webkit) await moveTo(page, INSIDE)
  else {
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: INSIDE.latitude, longitude: INSIDE.longitude, accuracy: INSIDE.accuracy })
  }
  const calls: string[] = []
  page.on('request', (request) => { if (request.url().includes('/api/user/check-in')) calls.push(request.method()) })
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expectGymId(page)
  expect(calls).toEqual(['GET', 'POST'])
})

test('CI-20 an unanswered permission prompt keeps the locating state', async ({ page, baseURL }) => {
  only('AI')
  const member = createMember()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition() { /* never answers */ } } })
  })
  await signInApi(page.request, baseURL!, member)
  await page.goto('/check-in')
  await hold(page)
  await expect(heading(page, 'Obteniendo ubicación')).toBeVisible()
  await expect(page.getByText('Estamos procesando tu Check-in', { exact: true })).toBeVisible()
  await expect(page.locator(HOLD)).toHaveText('Obteniendo ubicación…')
  await expect(page.getByText('Permite la ubicación si el navegador lo solicita.')).toBeVisible()
  await page.waitForTimeout(2000)
  await expect(heading(page, 'Obteniendo ubicación')).toBeVisible()
})

const unavailable = (page: Page) => expectRefusal(page, 'No pudimos obtener tu ubicación', 'Espera un momento y vuelve a intentarlo desde el gimnasio.', 'Intentar de nuevo')

test('CI-21 position unavailable (code 2) shows the unavailable screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, UNAVAILABLE)
  await hold(page)
  await unavailable(page)
})

test('CI-22 position timeout (code 3) shows the unavailable screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, TIMEOUT)
  await hold(page)
  await unavailable(page)
})

test('CI-23 a browser with no geolocation shows the unavailable screen', async ({ page, baseURL }) => {
  only('AI')
  const member = createMember()
  await page.addInitScript(() => { delete (Navigator.prototype as unknown as Record<string, unknown>).geolocation })
  await signInApi(page.request, baseURL!, member)
  await page.goto('/check-in')
  await expect(page.locator(HOLD)).toBeVisible()
  await hold(page)
  await unavailable(page)
})

test('CI-24 unavailable, then inside: Intentar de nuevo opens the Gym ID', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, UNAVAILABLE)
  await hold(page)
  await unavailable(page)
  await moveTo(page, INSIDE)
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click()
  await expectGymId(page)
})

// ------------------------------------------------------------------------------------------ hold gesture

test('CI-25 releasing at 900 ms cancels: no request, no refusal', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  // WebKit delivers the release 100 ms or more late, and more under parallel load, so the press is shortened there to keep it under one second at the page.
  await hold(page, test.info().project.name === 'iphone' ? 600 : 900)
  await page.waitForTimeout(1500)
  expect(posts).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()
  await expect(page.locator('.check-in-message')).toHaveCount(0)
})

test('CI-26 holding 1100 ms sends one request and opens the Gym ID', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  await hold(page, 1100)
  await expectGymId(page)
  expect(posts).toHaveLength(1)
})

test('CI-27 moving focus away before one second cancels the hold', async ({ page, baseURL }) => {
  only('AI') // moved to phones 2026-11-09 (keyboard row, was desktop only)
  await begin(page, baseURL)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  await page.locator(HOLD).focus()
  await page.keyboard.down(' ')
  await page.waitForTimeout(300)
  await page.keyboard.press('Tab')
  await page.keyboard.up(' ')
  await page.waitForTimeout(1500)
  expect(posts).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()
})

test('CI-28 holding Enter with auto-repeat sends one request', async ({ page, baseURL }) => {
  only('AI') // moved to phones 2026-11-09 (keyboard row, was desktop only)
  await begin(page, baseURL)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  await page.locator(HOLD).focus()
  for (let index = 0; index < 4; index++) {
    await page.keyboard.down('Enter')
    await page.waitForTimeout(300)
  }
  await page.keyboard.up('Enter')
  await expectGymId(page)
  expect(posts).toHaveLength(1)
})

test('CI-29 a click with no pointer press (screen reader) registers at once', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await page.locator(HOLD).evaluate((element) => (element as HTMLElement).click())
  await expectGymId(page)
})

test('CI-30 a touch long press registers and opens no context menu', async ({ page, baseURL }) => {
  only('AI')
  await page.addInitScript(() => {
    const state = globalThis as unknown as { menuOpened: boolean }
    state.menuOpened = false
    window.addEventListener('contextmenu', (event) => { if (!event.defaultPrevented) state.menuOpened = true })
  })
  await begin(page, baseURL)
  if (test.info().project.name === 'android') {
    const button = page.locator(HOLD)
    await button.scrollIntoViewIfNeeded()
    const box = (await button.boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await page.waitForTimeout(1100)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    // WebKit has no touch injection in Playwright: the press goes through the mouse path of the emulated iPhone.
    test.info().annotations.push({ type: 'note', description: 'iPhone long press sent as a mouse press (no touch injection in WebKit)' })
    await hold(page, 1100)
  }
  await expectGymId(page)
  expect(await page.evaluate(() => (globalThis as unknown as { menuOpened: boolean }).menuOpened)).toBe(false)
})

test('CI-31 pressing again while registering sends exactly one request', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  let posts = 0
  await page.route('**/api/user/check-in', async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return }
    posts++
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await route.continue()
  })
  await hold(page, 1100)
  await expect(page.getByRole('button', { name: 'Registrando entrada…' })).toHaveAttribute('aria-disabled', 'true')
  await hold(page, 1100)
  await expectGymId(page)
  expect(posts).toBe(1)
})

// ----------------------------------------------------------------------------------------- authorization

const authorizationRefusal = (page: Page) => expectRefusal(page, 'Tu acceso no está vigente', 'No encontramos una autorización vigente para registrar tu entrada.')

test('CI-32 a paid member whose term ended is refused', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'ended' })
  await hold(page)
  await authorizationRefusal(page)
  await expect(page.getByRole('link', { name: 'Revisar mi acceso' })).toHaveAttribute('href', '/account')
  await expect(page.locator('.check-in-identity .check-in-badge')).toHaveCount(0)
})

test('CI-33 an account with no authorization row is refused', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'none' })
  await hold(page)
  await authorizationRefusal(page)
})

test('CI-34 a revoked paid authorization is refused', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'revoked' })
  await hold(page)
  await authorizationRefusal(page)
})

test('CI-35 a removed athlete gets the athlete refusal with a text-only action', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'athlete', authorization: 'revoked' })
  await hold(page)
  await expect(heading(page, 'Tu acceso de atleta no está vigente')).toBeVisible()
  await expect(page.getByText('No encontramos una autorización de atleta vigente. Consulta con el personal para revisar tu acceso.', { exact: true })).toBeVisible()
  await expect(page.getByText('Ver información de contacto', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver información de contacto' })).toHaveCount(0)
})

test('CI-36 Revisar mi acceso opens Mi cuenta without an active authorization', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'ended' })
  await hold(page)
  await page.getByRole('link', { name: 'Revisar mi acceso' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  await expect(page.getByText('Sin autorización activa').first()).toBeVisible()
})

test('CI-37 the last day of the term still allows Check In', async ({ page, baseURL }) => {
  only('AI')
  const old = setCurrentTermEnd(0)
  try {
    await begin(page, baseURL)
    await hold(page)
    await expectGymId(page)
  } finally { restoreCurrentTermEnd(old) }
})

test('CI-38 the day after the term ended refuses Check In', async ({ page, baseURL }) => {
  only('AI')
  const old = setCurrentTermEnd(-1)
  try {
    await begin(page, baseURL)
    await hold(page)
    await authorizationRefusal(page)
  } finally { restoreCurrentTermEnd(old) }
})

test('CI-39 an authorization only in a future term is refused', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'future' })
  await hold(page)
  await authorizationRefusal(page)
})

// ---------------------------------------------------------------------------------------------------- photo

test('CI-40 a missing term photo asks for a new photo', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'manual', group: 'employee', photo: false })
  await hold(page)
  await expect(heading(page, 'Necesitamos una foto nueva')).toBeVisible()
  await expect(page.getByText('Actualiza tu foto para el nuevo término antes de registrar tu entrada.', { exact: true })).toBeVisible()
  await expect(page.getByText('Actualizar foto', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Actualizar foto' })).toHaveCount(0)
})

test('CI-41 a pending photo asks for a new photo', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { photoPending: true })
  await hold(page)
  await expect(heading(page, 'Tu foto necesita actualizarse')).toBeVisible()
  await expect(page.getByText('El personal marcó tu foto como pendiente. Carga una foto nueva desde tu teléfono.', { exact: true })).toBeVisible()
})

test('CI-42 after the pending photo is cleared, a reload and a new hold open the Gym ID', async ({ page, baseURL }) => {
  only('AI')
  const member = await begin(page, baseURL, { photoPending: true })
  await hold(page)
  await expect(heading(page, 'Tu foto necesita actualizarse')).toBeVisible()
  setPhotoPending(member, false)
  await page.reload()
  await expect(page.locator(HOLD)).toBeVisible()
  await hold(page)
  await expectGymId(page)
})

// ---------------------------------------------------------------------------------------- order of checks

test('CI-43 the authorization is checked before the location', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { authorization: 'ended' }, OUTSIDE)
  await hold(page)
  await authorizationRefusal(page)
  await expect(heading(page, 'Acércate al gimnasio')).toHaveCount(0)
})

test('CI-44 the photo is checked before the location', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { photoPending: true }, OUTSIDE)
  await hold(page)
  await expect(heading(page, 'Tu foto necesita actualizarse')).toBeVisible()
})

test('CI-45 a closure is checked before the location', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, {}, OUTSIDE)
  const closure = addClosure()
  try {
    await hold(page)
    await expect(heading(page, 'El gimnasio está cerrado')).toBeVisible()
  } finally { deleteSlot(closure) }
})

// ----------------------------------------------------------------------------------------- hours and closure

test('CI-46 a closure shows the neutral closed screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const closure = addClosure()
  try {
    await hold(page)
    await expectRefusal(page, 'El gimnasio está cerrado', 'Consulta los horarios y los avisos antes de tu próxima visita.')
    await expect(page.getByText('Ver horarios', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver horarios' })).toHaveCount(0)
    await expect(page.locator('.check-in-message')).toHaveClass(/check-in-message--neutral/)
  } finally { deleteSlot(closure) }
})

test('CI-47 two minutes before closing time the gym is open', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const removed = setHoursEndingIn(2)
  test.skip(removed === null, 'needs-clock: too close to midnight for a same-day closing time')
  try {
    await hold(page)
    await expectGymId(page)
  } finally { restoreHours(removed!) }
})

test('CI-48 two minutes after closing time the gym is closed', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const removed = setHoursEndingIn(-2)
  test.skip(removed === null, 'needs-clock: too close to midnight for a same-day closing time')
  try {
    await hold(page)
    await expect(heading(page, 'El gimnasio está cerrado')).toBeVisible()
  } finally { restoreHours(removed!) }
})

// --------------------------------------------------------------------------------------- athletes only

const exclusiveView = async (page: Page) => {
  await expect(heading(page, 'Ahora entrenan los atletas')).toBeVisible()
  await expect(page.getByText(/^Horario exclusivo · .+/)).toBeVisible()
  await expect(page.getByText('Podrás registrar tu entrada', { exact: true })).toBeVisible()
  await expect(page.getByText(/^A partir de las .+/)).toBeVisible()
  await expect(page.getByText('Tu membresía sigue vigente.', { exact: true })).toBeVisible()
  await expect(page.getByText('Ver horarios', { exact: true })).toBeVisible()
  await expect(page.getByText('Check-in disponible al terminar este periodo.', { exact: true })).toBeVisible()
}

test('CI-49 a member during an athletes-only period sees the exclusive view', async ({ page, baseURL }) => {
  only('AI')
  const member = await begin(page, baseURL)
  const period = addPeriod(-10, 60)
  try {
    await hold(page)
    await exclusiveView(page)
    expect(sessionCount(member)).toBe(0)
  } finally { deleteSlot(period) }
})

test('CI-50 an athlete during an athletes-only period gets the Gym ID', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'athlete' })
  const period = addPeriod(-10, 60)
  try {
    await hold(page)
    await expectGymId(page)
    await expect(page.locator('.check-in-id__category')).toHaveText('Atleta')
  } finally { deleteSlot(period) }
})

test('CI-51 a manual member during an athletes-only period sees the exclusive view', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'manual', group: 'employee' })
  const period = addPeriod(-10, 60)
  try {
    await hold(page)
    await exclusiveView(page)
  } finally { deleteSlot(period) }
})

test('CI-52 the exclusive view returns to the hold button when the period ends', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const period = addPeriod(-10, 60)
  try {
    await hold(page)
    await exclusiveView(page)
    endSlot(period)
    await visibilityPoll(page)
    await expect(page.getByText(READY, { exact: true })).toBeVisible()
    await expect(page.locator(HOLD)).toBeVisible()
  } finally { deleteSlot(period) }
})

test('CI-53 an athletes-only period starting in 59 minutes shows the notice', async ({ page, baseURL }) => {
  only('AI')
  const period = addPeriod(59, 179)
  try {
    await begin(page, baseURL)
    const notice = page.locator('.check-in-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Próximo horario exclusivo de atletas')
    await expect(notice).toContainText(' · ')
  } finally { deleteSlot(period) }
})

test('CI-54 an athletes-only period starting in 61 minutes shows no notice', async ({ page, baseURL }) => {
  only('AI')
  const period = addPeriod(61, 181)
  try {
    await begin(page, baseURL)
    await expect(page.locator('.check-in-notice')).toHaveCount(0)
  } finally { deleteSlot(period) }
})

test('CI-55 a closure wins over an athletes-only period', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const closure = addClosure()
  const period = addPeriod(-10, 60)
  try {
    await hold(page)
    await expect(heading(page, 'El gimnasio está cerrado')).toBeVisible()
  } finally { deleteSlot(closure); deleteSlot(period) }
})

test('CI-56 an athletes-only period outside regular hours opens the gym for athletes only', async ({ page, baseURL, playwright }) => {
  only('AI')
  await begin(page, baseURL, { kind: 'athlete' })
  const removed = setHoursEndingIn(-2)
  test.skip(removed === null, 'needs-clock: too close to midnight for a same-day closing time')
  const period = addPeriod(-10, 60)
  const other = await playwright.request.newContext({ baseURL })
  try {
    await hold(page)
    await expectGymId(page)
    const member = createMember()
    await signInApi(other, baseURL!, member)
    const answer = await rawApi(other, 'post', '/api/user/check-in', baseURL!, INSIDE)
    expect(answer.status).toBe(409)
    expect(answer.body.error.code).toBe('check_in_athletes_only')
  } finally { deleteSlot(period); restoreHours(removed!); await other.dispose() }
})

// ------------------------------------------------------------------------------------ repeated and several

test('CI-57 a repeated Check In through the API returns the same visit', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  const first = await api(request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  expect(first.status).toBe(201)
  const again = await api(request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  expect(again.status).toBe(200)
  expect(again.body.session.id).toBe(first.body.session.id)
  expect(again.body.session.started_at).toBe(first.body.session.started_at)
})

test('CI-58 reloading at the Gym ID keeps the entry time', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  const entry = await entryTime(page)
  await page.reload()
  await expect(page.locator('.check-in-lead')).toHaveText('Tu entrada está registrada')
  await expect(page.locator('.check-in-id__time').first()).toHaveText(entry!)
})

test('CI-59 with an open visit the API ignores bad location numbers', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  const first = await api(request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  const again = await api(request, 'post', '/api/user/check-in', baseURL!, { latitude: 999 })
  expect(again.status).toBe(200)
  expect(again.body.session.id).toBe(first.body.session.id)
})

test('CI-60 a second phone on the same account shows the same Gym ID', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  const entry = await entryTime(page)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInApi(second.page.request, baseURL!, member)
    await second.page.goto('/check-in')
    await expect(second.page.locator('.check-in-lead')).toHaveText('Tu entrada está registrada')
    await expect(second.page.locator('.check-in-id__time').first()).toHaveText(entry!)
    expect(sessionCount(member)).toBe(1)
  } finally { await second.context.close() }
})

test('CI-61 the first phone returns to sign-in after a second sign-in', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInApi(second.page.request, baseURL!, member)
    await visibilityPoll(page)
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
    await expect(page.getByText('Vuelve a iniciar sesión para usar tu cuenta aquí.', { exact: true })).toBeVisible()
  } finally { await second.context.close() }
})

test('CI-62 Back after Check In shows Mi cuenta and Forward shows the same Gym ID', async ({ page, baseURL }) => {
  only('AI')
  const member = createMember()
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Check-in' }).click()
  await expect(page).toHaveURL(/\/check-in$/)
  await hold(page)
  await expectGymId(page)
  const entry = await entryTime(page)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-id__time').first()).toHaveText(entry!)
  expect(sessionCount(member)).toBe(1)
})

test('CI-63 two simultaneous requests create one visit', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  const [one, two] = await Promise.all([
    rawApi(request, 'post', '/api/user/check-in', baseURL!, INSIDE),
    rawApi(request, 'post', '/api/user/check-in', baseURL!, INSIDE),
  ])
  expect([one.status, two.status].sort()).toEqual([200, 201])
  expect(one.body.session.id).toBe(two.body.session.id)
  expect(sessionCount(member, true)).toBe(1)
})

test('CI-64 re-entry after a desk check-out is a new visit', async ({ page, request, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  const first = await openVisitId(page, baseURL)
  await frontDeskCheckOut(request, baseURL!, first)
  await page.reload()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText(READY, { exact: true })).toBeVisible()
  await hold(page)
  await expectGymId(page)
  expect(await openVisitId(page, baseURL)).not.toBe(first)
})

// ------------------------------------------------------------------------------------------------ network

const offlineScreen = (page: Page) => expectRefusal(page, 'Necesitas conexión', 'Conéctate a internet para verificar y registrar tu entrada.', 'Reintentar conexión')

test('CI-65 offline when pressing shows the connection screen and sends nothing', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const posts = countRequests(page, 'POST', '/api/user/check-in')
  await page.context().setOffline(true)
  await hold(page)
  await offlineScreen(page)
  await expect(page.locator('.user-offline')).toBeVisible()
  expect(posts).toHaveLength(0)
})

test.describe('CI-66 offline at page load', () => {
  // The base config blocks service workers; the offline shell needs the real one.
  test.use({ serviceWorkers: 'allow' })
  test('CI-66 offline at page load shows the connection screen', async ({ page, baseURL }) => {
    only('AI')
    await begin(page, baseURL)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
      }
    })
    await page.context().setOffline(true)
    await page.reload()
    await offlineScreen(page)
  })
})

test('CI-67 back online, the app recovers and a new hold opens the Gym ID after asking the API first', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await page.context().setOffline(true)
  await hold(page)
  await offlineScreen(page)
  const calls: string[] = []
  page.on('request', (request) => { if (request.url().includes('/api/user/check-in')) calls.push(request.method()) })
  await page.context().setOffline(false)
  await expect(page.locator('.user-offline')).toBeHidden()
  const retry = page.getByRole('button', { name: 'Reintentar conexión' })
  const holdButton = page.locator(HOLD)
  await expect(retry.or(holdButton)).toBeVisible()
  if (await retry.isVisible()) await retry.click()
  await expect(holdButton).toBeVisible()
  await hold(page)
  await expectGymId(page)
  expect(calls.indexOf('GET')).toBeLessThan(calls.indexOf('POST'))
})

test('CI-68 an aborted request shows the connection screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await page.route('**/api/user/check-in', (route) => route.request().method() === 'POST' ? route.abort('connectionfailed') : route.fallback())
  await hold(page)
  await offlineScreen(page)
})

test('CI-69 a lost response is recovered by the retry without a second visit', async ({ page, baseURL }) => {
  only('AI')
  const member = await begin(page, baseURL)
  let posts = 0
  await page.route('**/api/user/check-in', async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return }
    posts++
    await route.fetch()
    await route.abort('connectionfailed')
  })
  await hold(page)
  await offlineScreen(page)
  await page.getByRole('button', { name: 'Reintentar conexión' }).click()
  await expect(page.locator('.check-in-lead')).toHaveText('Tu entrada está registrada')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  expect(posts).toBe(1)
  expect(sessionCount(member)).toBe(1)
})

test('CI-70 a server error shows the send error screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await page.route('**/api/user/check-in', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'server_error' } }) }) : route.fallback())
  await hold(page)
  await expectRefusal(page, 'No pudimos enviar la solicitud', 'Algo salió mal de nuestro lado. Intenta más tarde.', 'Intentar de nuevo')
})

test('CI-71 an HTML proxy page (502) is treated as offline', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await page.route('**/api/user/check-in', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>Bad gateway</body></html>' }) : route.fallback())
  await hold(page)
  await offlineScreen(page)
})

// ------------------------------------------------------------------------------------------ rate limit

async function sendOutside(request: import('@playwright/test').APIRequestContext, baseURL: string | undefined, times: number) {
  const answers = []
  for (let index = 0; index < times; index++) answers.push(await rawApi(request, 'post', '/api/user/check-in', baseURL!, OUTSIDE))
  return answers
}

test('CI-72 ten requests in a minute are all answered, none throttled', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  const answers = await sendOutside(request, baseURL, 10)
  for (const answer of answers) {
    expect(answer.status).toBe(403)
    expect(answer.body.error.code).toBe('check_in_outside_boundary')
  }
})

test('CI-73 the eleventh request in a minute shows the wait screen', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await sendOutside(page.request, baseURL, 10)
  await hold(page)
  await expect(heading(page, 'Espera antes de intentar de nuevo')).toBeVisible()
  await expect(page.getByText(/^Intenta de nuevo a las .+/)).toBeVisible()
})

// ------------------------------------------------------------------------------------ sessions and access

test('CI-74 a Check In from a replaced session goes to sign-in', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = await begin(page, baseURL)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInApi(second.page.request, baseURL!, member)
    await hold(page)
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await second.context.close() }
})

test('CI-75 signed out, Check In redirects to sign-in and sign-in lands on Mi cuenta', async ({ page }) => {
  only('AI')
  const member = createMember()
  await page.goto('/check-in')
  await expect(page).toHaveURL(/\/sign-in/)
  await signInUser(page, member.email, member.password)
  await expect(page).toHaveURL(/\/account$/)
})

test('CI-76 a staff session is refused on the user Check In endpoint', async ({ request, baseURL }) => {
  only('A')
  await api(request, 'post', '/api/staff/sign-in', baseURL!, STAFF)
  const read = await rawApi(request, 'get', '/api/user/check-in', baseURL!)
  const write = await rawApi(request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  expect(read.status).toBe(401)
  expect(read.body.error.code).toBe('unauthenticated')
  expect(write.status).toBe(401)
  expect(write.body.error.code).toBe('unauthenticated')
})

test('CI-77 out-of-range numbers are a validation error and create no visit', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  for (const body of [{ latitude: 90.0001, longitude: -67.141, accuracy: 12 }, { latitude: 18.211, longitude: -180.0001, accuracy: 12 }, { latitude: 18.211, longitude: -67.141, accuracy: -1 }]) {
    const answer = await rawApi(request, 'post', '/api/user/check-in', baseURL!, body)
    expect(answer.status, JSON.stringify(body)).toBe(422)
  }
  expect(sessionCount(member)).toBe(0)
})

test('CI-78 missing location numbers answer location_required', async ({ request, baseURL }) => {
  only('A')
  const member = createMember()
  await signInApi(request, baseURL!, member)
  const answer = await rawApi(request, 'post', '/api/user/check-in', baseURL!, {})
  expect(answer.status).toBe(422)
  expect(answer.body.error.code).toBe('location_required')
})

// ------------------------------------------------------------------------------------------ device and data

test('CI-79 an English account sees the English Check In texts', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL, { locale: 'en' }, OUTSIDE)
  await expect(page.getByRole('button', { name: 'Press and hold to enter' })).toBeVisible()
  await hold(page)
  await expect(heading(page, 'Get closer to the gym')).toBeVisible()
  await expect(page.getByText('You must be inside the gym area to register your entry.', { exact: true })).toBeVisible()
  await moveTo(page, INSIDE)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.check-in-lead')).toHaveText('Your entry is registered!')
})

test('CI-80 the tab bar opens each screen, marks the current tab and focuses the h1', async ({ page, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  const bar = page.getByRole('navigation', { name: 'Navegación principal' })
  for (const [name, url] of [['Gimnasio', /\/gym$/], ['Mi cuenta', /\/account$/], ['Check-in', /\/check-in$/]] as const) {
    await bar.getByRole('link', { name }).click()
    await expect(page).toHaveURL(url)
    await expect(bar.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('h1')).toBeFocused()
  }
})

test('CI-81 coordinates are never stored or logged', async ({ page, baseURL }) => {
  only('AI')
  const where = { latitude: 18.211003, longitude: -67.141007, accuracy: 12 }
  const member = await begin(page, baseURL, {}, where)
  await hold(page)
  await expectGymId(page)
  const columns = tinkerJson<string[]>(`echo json_encode(\\Illuminate\\Support\\Facades\\Schema::getColumnListing('facility_sessions'));`)
  expect(columns.filter((column) => /lat|lon|coord|accuracy/i.test(column))).toEqual([])
  const found = tinkerJson<string[]>(`
$hits = [];
foreach (glob(storage_path('logs/*.log')) as $file) {
  $text = file_get_contents($file);
  foreach (['18.211003', '67.141007'] as $needle) if (str_contains($text, $needle)) $hits[] = basename($file).':'.$needle;
}
$row = json_encode(\\App\\Models\\FacilitySession::where('user_id', ${member.id})->first());
foreach (['18.211003', '67.141007'] as $needle) if (str_contains($row, $needle)) $hits[] = 'row:'.$needle;
echo json_encode($hits);`)
  expect(found).toEqual([])
})

// ---------------------------------------------------------------------------------------- cross device

test('CI-82 a desk check-out ends the visit on the phone', async ({ page, request, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  await frontDeskCheckOut(request, baseURL!, await openVisitId(page, baseURL))
  await page.reload()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
})

test('CI-83 an Administrator check-out also ends the visit', async ({ page, request, baseURL }) => {
  only('AI')
  await begin(page, baseURL)
  await hold(page)
  await expectGymId(page)
  const id = await openVisitId(page, baseURL)
  await api(request, 'post', '/api/staff/sign-in', baseURL!, ADMIN)
  await api(request, 'post', `/api/staff/sessions/${id}/check-out`, baseURL!)
  await page.reload()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
})
