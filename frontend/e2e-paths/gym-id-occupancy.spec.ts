import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { api, fakeLocation, frontDeskCheckOut, INSIDE, STAFF } from '../e2e/flows/flow.ts'
import {
  addClosure, addPeriod, countRequests, createMember, deleteSlot, dropMarkedSlots, flushCache, rawApi, resetSchedule, signInApi, tinkerJson,
  type Member, type MemberOptions,
} from './setup.ts'
import {
  addVisit, ageUserVisit, ageVisit, closeDue, createWaiverlessVisitor, dropUser, dropVisit, endUserVisit, ensurePhotoFile, release, setOccupancy,
} from './setup-occupancy.ts'

// #152 path tests for flow 5, Gym ID and occupancy. One test per built row of the path inventory (GI-01 to GI-58).
// Occupancy is global: a test that needs an exact count makes it with setOccupancy() and gives the visits back in finally.

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

const HOLD = '.check-in-hold'
const READY = '¿Listo para entrenar?'
const POLL_WAIT = 40_000

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' })
const gymCount = (page: Page) => page.locator('.gym-occupancy__count strong')
const gymBadge = (page: Page) => page.locator('.gym-occupancy__badge')
const gymBar = (page: Page) => page.locator('.gym-occupancy__bar > div')
const gymProblem = (page: Page) => page.locator('.gym-occupancy__problem')
const gymCaption = (page: Page) => page.locator('.gym-caption')
const duration = (page: Page) => page.locator('.check-in-duration__value')
const entry = (page: Page) => page.locator('.check-in-id__time').first()

/** Creates a member, fakes the location, signs in through the API. The page has not been opened yet. */
async function fresh(page: Page, baseURL: string | undefined, options: MemberOptions = {}) {
  const member = createMember(options)
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
  return member
}

/** A member who already has an open visit (Check In through the API). */
async function withVisit(page: Page, baseURL: string | undefined, options: MemberOptions = {}) {
  const member = await fresh(page, baseURL, options)
  await api(page.request, 'post', '/api/user/check-in', baseURL!, INSIDE)
  return member
}

async function openCard(page: Page) {
  await page.goto('/check-in')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
}

async function openGym(page: Page) {
  await page.goto('/gym')
  await expect(page.getByRole('heading', { level: 1, name: 'Gimnasio' })).toBeVisible()
}

/** Presses the hold button with the pointer for `ms` milliseconds (the mouse path works on the three devices). */
async function hold(page: Page, ms = 1100) {
  const button = page.locator(HOLD)
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

/** From a signed-in member with no visit: opens Check In and holds until the Gym ID shows. */
async function checkInByHold(page: Page) {
  await page.goto('/check-in')
  await expect(page.locator(HOLD)).toBeVisible()
  await hold(page)
  await expect(page.locator('.check-in-lead')).toHaveText('¡Tu entrada quedó registrada!')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
}

async function secondPhone(browser: Browser, baseURL: string | undefined) {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = test.info().project.use
  const context = await browser.newContext({ baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor })
  return { context, page: await context.newPage() }
}

/** An API-only client signed in as `member`, to act as someone else's phone or as the athlete who checks in. */
async function remote(playwright: { request: import('@playwright/test').APIRequest }, baseURL: string | undefined, member: Member) {
  const context = await playwright.request.newContext({ baseURL })
  await signInApi(context, baseURL!, member)
  return context
}
const apiCheckIn = (context: APIRequestContext, baseURL: string | undefined) => api(context, 'post', '/api/user/check-in', baseURL!, INSIDE)

const visibilityPoll = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
const seconds = (text: string) => text.split(':').reduce((total, part) => total * 60 + Number(part), 0)
const level = (count: number) => (count < 40 / 3 ? 'Baja' : count <= 80 / 3 ? 'Moderada' : 'Alta')

/** Runs `body` with the occupancy set to exactly `n` and always gives the voided visits back. */
async function withOccupancy<T>(n: number, body: (visits: ReturnType<typeof setOccupancy>) => Promise<T>): Promise<T> {
  const state = setOccupancy(n)
  try { return await body(state) } finally { release(state) }
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
}

// ------------------------------------------------------------------------------------------------- the Gym ID

test('GI-01 a student member sees the full Gym ID after Check In', async ({ page, baseURL }) => {
  only('AI')
  const member = await fresh(page, baseURL)
  await checkInByHold(page)
  await expect(page.locator('.check-in-id__name')).toContainText(member.name)
  await expect(page.locator('.check-in-id__small').filter({ hasText: member.email })).toBeVisible()
  await expect(page.locator('.check-in-id__category')).toHaveText('Miembro')
  await expect(page.getByText('Estudiante', { exact: true })).toBeVisible()
  await expect(page.getByText('Entrada registrada', { exact: true })).toBeVisible()
  await expect(entry(page)).toHaveText(/\d{1,2}:\d{2}/)
  await expect(page.getByText('Duración', { exact: true })).toBeVisible()
  await expect(duration(page)).toHaveText(/^\d{2}:\d{2}:\d{2}$/)
  await expect(page.getByText('Muestra esta tarjeta al personal.', { exact: true })).toBeVisible()
  await expect(page.getByText('El personal registra tu salida.', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Autorización activa' })).toBeVisible()
})

test('GI-02 an athlete sees the Atleta tag and the sport, not Estudiante', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL, { kind: 'athlete', sport: 'Voleibol' })
  await checkInByHold(page)
  await expect(page.locator('.check-in-id__category')).toHaveText('Atleta')
  await expect(page.getByText('Voleibol', { exact: true })).toBeVisible()
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
  await expect(page.locator('.check-in--athlete')).toBeVisible()
})

test('GI-03 an employee sees Miembro and no group line', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL, { group: 'employee' })
  await checkInByHold(page)
  await expect(page.locator('.check-in-id__category')).toHaveText('Miembro')
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Empleado/)).toHaveCount(0)
  await expect(page.locator('.check-in-id__small')).toHaveCount(2)
})

test('GI-04 an account with no waiver name shows the email as the name and no authorization mark', async ({ page, baseURL }) => {
  only('AI')
  const visitor = createWaiverlessVisitor()
  try {
    await signInApi(page.request, baseURL!, visitor)
    await page.goto('/check-in')
    await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
    await expect(page.locator('.check-in-id__name')).toContainText(visitor.email)
    await expect(page.locator('.check-in-id__small').filter({ hasText: visitor.email })).toHaveCount(0)
    await expect(page.locator('.check-in-badge')).toHaveCount(0)
  } finally { dropUser(visitor.id) }
})

test('GI-05 the member photo is shown from /api/user/photo', async ({ page, baseURL }) => {
  only('AI')
  ensurePhotoFile()
  await withVisit(page, baseURL)
  const photo = page.waitForResponse((response) => response.url().endsWith('/api/user/photo'))
  await openCard(page)
  expect((await photo).status()).toBe(200)
  const image = page.locator('.check-in-photo--large img')
  await expect(image).toHaveAttribute('src', '/api/user/photo')
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

test('GI-06 a photo that fails to load is replaced by the person icon', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await page.route('**/api/user/photo', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"not_found"}}' }))
  await openCard(page)
  await expect(page.locator('.check-in-photo--large svg')).toBeVisible()
  await expect(page.locator('.check-in-photo--large img')).toHaveCount(0)
})

test('GI-07 the duration starts near zero and advances once per second', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  await checkInByHold(page)
  await expect(duration(page)).toHaveText(/^00:00:0\d$/)
  const first = seconds((await duration(page).textContent())!)
  const seen = new Set<number>([first])
  await expect.poll(async () => {
    const value = seconds((await duration(page).textContent())!)
    seen.add(value)
    return value
  }, { timeout: 10_000, intervals: [250] }).toBeGreaterThanOrEqual(first + 3)
  const values = [...seen].sort((a, b) => a - b)
  for (let index = 1; index < values.length; index++) expect(values[index] - values[index - 1], `steps ${values}`).toBe(1)
})

test('GI-08 a wrong device clock does not change the duration', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await page.clock.setSystemTime(new Date(Date.now() + 3 * 3_600_000))
  await openCard(page)
  await expect(duration(page)).toHaveText(/^00:0\d:\d{2}$/)
})

test('GI-09 a reload keeps the entry time and the duration keeps counting', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  await checkInByHold(page)
  const time = await entry(page).textContent()
  const before = seconds((await duration(page).textContent())!)
  await page.reload()
  await expect(page.locator('.check-in-lead')).toHaveText('Tu entrada está registrada')
  await expect(entry(page)).toHaveText(time!)
  await expect.poll(async () => seconds((await duration(page).textContent())!)).toBeGreaterThan(before)
})

test('GI-10 the card polls /api/user/check-in every 25 seconds and stays the same', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  const polls = countRequests(page, 'GET', '/api/user/check-in')
  await openCard(page)
  const time = await entry(page).textContent()
  const loaded = polls.length
  await expect.poll(() => polls.length, { timeout: POLL_WAIT }).toBe(loaded + 1)
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(entry(page)).toHaveText(time!)
})

test('GI-11 a hidden tab sends no poll and refreshes once when it is shown again', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  const polls = countRequests(page, 'GET', '/api/user/check-in')
  await openCard(page)
  const loaded = polls.length
  const setHidden = (hidden: boolean) => page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
  await setHidden(true)
  await page.waitForTimeout(27_000) // longer than one poll period, to prove the poll stays quiet
  expect(polls.length).toBe(loaded)
  await setHidden(false)
  await expect.poll(() => polls.length).toBe(loaded + 1)
})

test('GI-12 offline, the Gym ID is marked not valid now', async ({ page, baseURL, context }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openCard(page)
  await context.setOffline(true)
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-lead')).toHaveText('Restablece la conexión para validar tu tarjeta.')
  await expect(page.getByText('Conéctate para mostrar una tarjeta vigente.', { exact: true })).toBeVisible()
  await expect(page.getByText('Duración · Sin actualizar', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-caption')).toHaveText(/^Última actualización: .+, .+/)
  await expect(page.locator('.user-offline')).toBeVisible()
  await expect(page.locator('.check-in-waves')).toHaveCount(0)
  await expect(page.locator('.check-in-notice')).toHaveCount(0)
})

test('GI-13 back online, the Gym ID is valid again and the duration resumes', async ({ page, baseURL, context }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openCard(page)
  await context.setOffline(true)
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-lead')).toHaveText('Tu entrada está registrada')
  await expect(page.locator('.user-offline')).toBeHidden()
  const after = seconds((await duration(page).textContent())!)
  await expect.poll(async () => seconds((await duration(page).textContent())!)).toBeGreaterThan(after)
})

test.describe('GI-14 cold open offline', () => {
  // The base config blocks service workers; the offline shell needs the real one.
  test.use({ serviceWorkers: 'allow' })
  test('GI-14 opened offline, the app shows the connection screen and never a stored Gym ID', async ({ page, baseURL, context }) => {
    only('AI')
    await withVisit(page, baseURL)
    await openCard(page)
    await waitForServiceWorker(page)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Check-in' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Necesitas conexión', exact: true })).toBeVisible()
    await expect(page.getByText('Conéctate a internet para verificar y registrar tu entrada.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reintentar conexión', exact: true })).toBeVisible()
    await expect(page.getByText('Sesión activa', { exact: true })).toHaveCount(0)
  })
})

test('GI-15 a failed poll with the browser online marks the Gym ID stale', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openCard(page)
  await page.route('**/api/user/check-in', (route) => route.request().method() === 'GET' ? route.abort('connectionfailed') : route.fallback())
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible({ timeout: POLL_WAIT })
  await expect(page.getByText('Duración · Sin actualizar', { exact: true })).toBeVisible()
})

test('GI-16 a 500 on the poll marks the card stale and a good answer makes it current', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openCard(page)
  const fail = (route: import('@playwright/test').Route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"server_error"}}' }) : route.fallback()
  await page.route('**/api/user/check-in', fail)
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible({ timeout: POLL_WAIT })
  await page.unroute('**/api/user/check-in', fail)
  await visibilityPoll(page)
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(page.getByText('No válida ahora', { exact: true })).toHaveCount(0)
})

test('GI-17 a replaced session goes to sign-in on the next poll of the Gym ID', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = await withVisit(page, baseURL)
  await openCard(page)
  const second = await secondPhone(browser, baseURL)
  try {
    await signInApi(second.page.request, baseURL!, member)
    await visibilityPoll(page)
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await second.context.close() }
})

test('GI-18 an athletes-only period inside the visit shows the upcoming notice', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  const period = addPeriod(30, 150)
  try {
    await openCard(page)
    const notice = page.locator('.check-in-notice')
    await expect(notice).toContainText('Próximo horario exclusivo de atletas')
    await expect(notice).toContainText(' · ')
  } finally { deleteSlot(period) }
})

test('GI-19 a period already active does not cut the visit and the notice says exclusive', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  const period = addPeriod(-5, 60)
  try {
    await openCard(page)
    await expect(page.locator('.check-in-notice')).toHaveText(/^Horario exclusivo de atletas/)
  } finally { deleteSlot(period) }
})

test('GI-20 a period starting before the visit ends is shown, one starting after is not', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  const inside = addPeriod(119, 239)
  try {
    await openCard(page)
    await expect(page.locator('.check-in-notice')).toContainText('Próximo horario exclusivo de atletas')
  } finally { deleteSlot(inside) }
  const outside = addPeriod(121, 241)
  try {
    await page.reload()
    await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
    await expect(page.locator('.check-in-notice')).toHaveCount(0)
  } finally { deleteSlot(outside) }
})

test('GI-21 Gimnasio and back keeps the entry time and the counting duration', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openCard(page)
  const time = await entry(page).textContent()
  const before = seconds((await duration(page).textContent())!)
  await nav(page).getByRole('link', { name: 'Gimnasio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gimnasio' })).toBeVisible()
  await nav(page).getByRole('link', { name: 'Check-in' }).click()
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(entry(page)).toHaveText(time!)
  await expect.poll(async () => seconds((await duration(page).textContent())!)).toBeGreaterThan(before)
})

test('GI-22 Back from the Gym ID opens Gimnasio and Forward returns the card', async ({ page, baseURL }) => {
  only('AI')
  await withVisit(page, baseURL)
  await openGym(page)
  await nav(page).getByRole('link', { name: 'Check-in' }).click()
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  const time = await entry(page).textContent()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Gimnasio' })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await expect(entry(page)).toHaveText(time!)
})

test('GI-23 an English account sees the English Gym ID and Gimnasio', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL, { locale: 'en' })
  await page.goto('/check-in')
  await expect(page.getByRole('button', { name: 'Press and hold to enter' })).toBeVisible()
  await hold(page)
  await expect(page.locator('.check-in-lead')).toHaveText('Your entry is registered!')
  await expect(page.getByText('Active session', { exact: true })).toBeVisible()
  await expect(page.getByText('Entry registered', { exact: true })).toBeVisible()
  await expect(page.getByText('Duration', { exact: true })).toBeVisible()
  await expect(page.getByText('Show this card to the staff.', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-id__category')).toHaveText('Member')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Gym' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gym' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Estimated occupancy' })).toBeVisible()
  await expect(page.getByText(/^Updated at /)).toBeVisible()
})

test('GI-24 a staff correction that ended the visit early shows the ended summary', async ({ page, baseURL }) => {
  only('AI')
  const member = await withVisit(page, baseURL)
  await openCard(page)
  endUserVisit(member.id, 'ended_early')
  await page.reload()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
  await expect(page.getByText('Tu salida fue registrada por el personal.', { exact: true })).toBeVisible()
})

test('GI-25 a voided visit disappears from the phone', async ({ page, baseURL }) => {
  only('AI')
  const member = await withVisit(page, baseURL)
  await openCard(page)
  endUserVisit(member.id, 'void')
  await page.reload()
  await expect(page.getByText(READY, { exact: true })).toBeVisible()
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toHaveCount(0)
})

test('GI-26 the card switches to the ended summary after the 2-hour mark', async ({ page, baseURL }) => {
  only('AI')
  test.setTimeout(150_000)
  const member = await withVisit(page, baseURL)
  await openCard(page)
  ageUserVisit(member.id, '1 hour 59 minutes 30 seconds')
  await visibilityPoll(page)
  await expect(duration(page)).toHaveText(/^01:59:5\d$/, { timeout: 40_000 })
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('La sesión se cerró automáticamente.', { exact: true })).toBeVisible()
})

// ----------------------------------------------------------------------------------------------------- Gimnasio

test('GI-27 Gimnasio before the visit shows the count and the level', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(5, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(page.getByText('Tu espacio para entrenar', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Ocupación estimada' })).toBeVisible()
    await expect(gymCount(page)).toHaveText('5')
    await expect(page.locator('.gym-occupancy__count').getByText('personas', { exact: true })).toBeVisible()
    await expect(gymBadge(page)).toHaveText('Baja')
    await expect(page.getByText(/^Actualizado a las \d{1,2}:\d{2}:\d{2}/)).toBeVisible()
  })
})

test('GI-28 the count rises by one after a Check In', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(3, async () => {
    await fresh(page, baseURL)
    await checkInByHold(page)
    await nav(page).getByRole('link', { name: 'Gimnasio' }).click()
    await expect(gymCount(page)).toHaveText('4')
  })
})

test('GI-29 the count drops by one after a desk check-out', async ({ page, request, baseURL }) => {
  only('AI')
  await withOccupancy(3, async () => {
    await withVisit(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('4')
    const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
    await frontDeskCheckOut(request, baseURL!, body.session.id)
    await page.reload()
    await expect(gymCount(page)).toHaveText('3')
  })
})

test('GI-30 an athlete counts like a member', async ({ page, baseURL, browser }) => {
  only('AI')
  await withOccupancy(3, async () => {
    await fresh(page, baseURL, { kind: 'athlete' })
    await checkInByHold(page)
    const reader = await secondPhone(browser, baseURL)
    try {
      await signInApi(reader.page.request, baseURL!, createMember())
      await openGym(reader.page)
      await expect(gymCount(reader.page)).toHaveText('4')
    } finally { await reader.context.close() }
  })
})

test('GI-31 an empty gym shows 0 personas, Baja and an empty bar', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(0, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('0')
    await expect(gymBadge(page)).toHaveText('Baja')
    await expect(gymBar(page)).toHaveAttribute('style', /width: 0%/)
  })
})

for (const [id, count, badge] of [['GI-32', 13, 'Baja'], ['GI-33', 14, 'Moderada'], ['GI-34', 26, 'Moderada'], ['GI-35', 27, 'Alta']] as const) {
  test(`${id} a count of ${count} is ${badge}`, async ({ page, baseURL }) => {
    only('AI')
    await withOccupancy(count, async () => {
      await fresh(page, baseURL)
      await openGym(page)
      await expect(gymCount(page)).toHaveText(String(count))
      await expect(gymBadge(page)).toHaveText(badge)
      expect(level(count)).toBe(badge)
    })
  })
}

test('GI-36 the bar fills at 40 and stays full at 41 while the number grows', async ({ page, baseURL }) => {
  only('AI')
  test.setTimeout(180_000)
  await withOccupancy(40, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('40')
    await expect(gymBadge(page)).toHaveText('Alta')
    await expect(gymBar(page)).toHaveAttribute('style', /width: 100%/)
    const extra = addVisit()
    try {
      await page.reload()
      await expect(gymCount(page)).toHaveText('41')
      await expect(gymBadge(page)).toHaveText('Alta')
      await expect(gymBar(page)).toHaveAttribute('style', /width: 100%/)
    } finally { dropVisit(extra) }
  })
})

test('GI-37 a visit that reached the 2-hour mark is not counted before or after the scheduler', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(3, async ({ sessions }) => {
    ageVisit(sessions[0], '2 hours')
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('2')
    closeDue()
    await page.reload()
    await expect(gymCount(page)).toHaveText('2')
  })
})

test('GI-38 a visit one moment before the 2-hour mark is still counted', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(3, async ({ sessions }) => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('3')
    ageVisit(sessions[0], '1 hour 59 minutes 50 seconds')
    await page.reload()
    await expect(gymCount(page)).toHaveText('3', { timeout: 5_000 })
  })
})

test('GI-39 a closure drops the visits that began before it at once', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(3, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('3')
    const closure = addClosure()
    try {
      await page.reload()
      await expect(gymCount(page)).toHaveText('0')
    } finally { deleteSlot(closure) }
  })
})

test('GI-40 a visit past the end of its term is not counted', async ({ page, baseURL }) => {
  only('AI')
  const window = tinkerJson<boolean>(`
$term = \\App\\Models\\AcademicTerm::where('name', 'Término pasado')->firstOrFail();
$x = \\Illuminate\\Support\\Carbon::parse($term->ends_on->toDateString().' 23:30', 'America/Puerto_Rico');
echo json_encode(now()->between($x->copy()->addMinutes(31), $x->copy()->addHours(2)->subMinutes(5)));`)
  test.skip(!window, 'needs-clock: only testable between midnight and 01:25 Puerto Rico time on the day after the past term ended')
  await withOccupancy(3, async ({ sessions }) => {
    tinkerJson<boolean>(`
$term = \\App\\Models\\AcademicTerm::where('name', 'Término pasado')->firstOrFail();
$x = \\Illuminate\\Support\\Carbon::parse($term->ends_on->toDateString().' 23:30', 'America/Puerto_Rico');
\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->where('id', ${sessions[0]})->update(['started_at' => $x, 'ends_at' => $x->copy()->addHours(2)]);
echo json_encode(true);`)
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('2')
  })
})

test('GI-41 a staff void drops the count by one', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(3, async ({ users }) => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('3')
    endUserVisit(users[0], 'void')
    await page.reload()
    await expect(gymCount(page)).toHaveText('2')
  })
})

test('GI-42 the count follows another phone Check In at the next poll', async ({ page, baseURL, playwright }) => {
  only('AI')
  await withOccupancy(2, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('2')
    const stamp = await gymCaption(page).textContent()
    const athlete = await remote(playwright, baseURL, createMember({ kind: 'athlete' }))
    try {
      await apiCheckIn(athlete, baseURL)
      await expect(gymCount(page)).toHaveText('3', { timeout: POLL_WAIT })
      await expect(gymCaption(page)).not.toHaveText(stamp!)
    } finally { await athlete.dispose() }
  })
})

test('GI-43 a hidden tab on Gimnasio sends no poll and refreshes once when shown', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  const polls = countRequests(page, 'GET', '/api/user/occupancy')
  await openGym(page)
  await expect(gymCount(page)).toBeVisible()
  const loaded = polls.length
  const setHidden = (hidden: boolean) => page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
  await setHidden(true)
  await page.waitForTimeout(27_000) // longer than one poll period, to prove the poll stays quiet
  expect(polls.length).toBe(loaded)
  await setHidden(false)
  await expect.poll(() => polls.length).toBe(loaded + 1)
})

test('GI-44 offline, Gimnasio hides the number and says Sin conexión', async ({ page, baseURL, context }) => {
  only('AI')
  await fresh(page, baseURL)
  await openGym(page)
  await expect(gymCount(page)).toBeVisible()
  const polls = countRequests(page, 'GET', '/api/user/occupancy')
  await context.setOffline(true)
  await expect(gymProblem(page)).toHaveText('Sin conexión')
  await expect(gymCaption(page)).toHaveText(/^Dato no actualizado · Último dato a las .+/)
  await expect(page.locator('.user-offline')).toBeVisible()
  await expect(page.locator('.gym-occupancy__count')).toHaveCount(0)
  await expect(page.locator('.gym-occupancy__bar')).toHaveCount(0)
  await visibilityPoll(page)
  expect(polls).toHaveLength(0)
})

test('GI-45 back online, Gimnasio shows the count and level again', async ({ page, baseURL, context }) => {
  only('AI')
  await withOccupancy(5, async () => {
    await fresh(page, baseURL)
    await openGym(page)
    await expect(gymCount(page)).toHaveText('5')
    await context.setOffline(true)
    await expect(gymProblem(page)).toHaveText('Sin conexión')
    await context.setOffline(false)
    await expect(gymCount(page)).toHaveText('5')
    await expect(gymBadge(page)).toHaveText('Baja')
    await expect(page.getByText(/^Actualizado a las /)).toBeVisible()
  })
})

test.describe('GI-46 cold open offline on Gimnasio', () => {
  test.use({ serviceWorkers: 'allow' })
  test('GI-46 opened offline, Gimnasio says Sin conexión with no number and no request', async ({ page, baseURL, context }) => {
    only('AI')
    await fresh(page, baseURL)
    await openGym(page)
    await waitForServiceWorker(page)
    await context.setOffline(true)
    const polls = countRequests(page, 'GET', '/api/user/occupancy')
    await page.reload()
    await expect(gymProblem(page)).toHaveText('Sin conexión')
    await expect(gymCaption(page)).toHaveText('Dato no actualizado')
    await expect(page.locator('.gym-occupancy__count')).toHaveCount(0)
    expect(polls).toHaveLength(0)
  })
})

test('GI-47 a server error on occupancy shows the error state and no stale number', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  await page.route('**/api/user/occupancy', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"server_error"}}' }))
  await openGym(page)
  await expect(gymProblem(page)).toHaveText('No pudimos actualizar')
  await expect(gymCaption(page)).toHaveText('Dato no actualizado')
  await expect(page.locator('.gym-occupancy__count')).toHaveCount(0)
})

test('GI-48 the count returns after a good answer following a failed poll', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(4, async () => {
    await fresh(page, baseURL)
    const fail = (route: import('@playwright/test').Route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"server_error"}}' })
    await page.route('**/api/user/occupancy', fail)
    await openGym(page)
    await expect(gymProblem(page)).toHaveText('No pudimos actualizar')
    await page.unroute('**/api/user/occupancy', fail)
    await expect(gymCount(page)).toHaveText('4', { timeout: POLL_WAIT })
  })
})

test('GI-49 Gimnasio shows the loading frame until occupancy answers', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  await page.route('**/api/user/occupancy', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await route.continue()
  })
  await openGym(page)
  await expect(page.locator('.gym-occupancy__skeleton')).toBeVisible()
  await expect(page.getByText('Actualizando ocupación…', { exact: true })).toBeVisible()
  await expect(gymCount(page)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.gym-occupancy__skeleton')).toHaveCount(0)
})

test('GI-50 a replaced session goes to sign-in on the next poll of Gimnasio', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = await fresh(page, baseURL)
  await openGym(page)
  await expect(gymCount(page)).toBeVisible()
  const second = await secondPhone(browser, baseURL)
  try {
    await signInApi(second.page.request, baseURL!, member)
    await visibilityPoll(page)
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await second.context.close() }
})

test('GI-51 signed out, Gimnasio redirects to sign-in', async ({ page }) => {
  only('AI')
  await page.goto('/gym')
  await expect(page).toHaveURL(/\/sign-in/)
})

test('GI-52 a staff session is refused on the occupancy endpoint', async ({ request, baseURL }) => {
  only('A')
  await api(request, 'post', '/api/staff/sign-in', baseURL!, STAFF)
  const read = await rawApi(request, 'get', '/api/user/occupancy', baseURL!)
  expect(read.status).toBe(401)
  expect(read.body.error.code).toBe('unauthenticated')
})

test('GI-53 the occupancy endpoint answers count, max and updated_at', async ({ request, baseURL }) => {
  only('A')
  await signInApi(request, baseURL!, createMember())
  const { status, body } = await rawApi(request, 'get', '/api/user/occupancy', baseURL!)
  expect(status).toBe(200)
  expect(Number.isInteger(body.count) && body.count >= 0).toBe(true)
  expect(body.max).toBe(40)
  expect(Number.isNaN(Date.parse(body.updated_at))).toBe(false)
  expect(Math.abs(Date.now() - Date.parse(body.updated_at))).toBeLessThan(60_000)
})

test('GI-54 the tab bar marks the current tab and focuses the h1 from Gimnasio', async ({ page, baseURL }) => {
  only('AI')
  await fresh(page, baseURL)
  await openGym(page)
  for (const [name, url] of [['Check-in', /\/check-in$/], ['Mi cuenta', /\/account$/], ['Gimnasio', /\/gym$/]] as const) {
    await nav(page).getByRole('link', { name }).click()
    await expect(page).toHaveURL(url)
    await expect(nav(page).getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('h1')).toBeFocused()
  }
})

test('GI-55 an English account sees the English Gimnasio at a count of 14', async ({ page, baseURL }) => {
  only('AI')
  await withOccupancy(14, async () => {
    await fresh(page, baseURL, { locale: 'en' })
    await page.goto('/gym')
    await expect(page.getByRole('heading', { level: 1, name: 'Gym' })).toBeVisible()
    await expect(page.getByText('Your space to train', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Estimated occupancy' })).toBeVisible()
    await expect(gymCount(page)).toHaveText('14')
    await expect(page.locator('.gym-occupancy__count').getByText('people', { exact: true })).toBeVisible()
    await expect(gymBadge(page)).toHaveText('Moderate')
    await expect(page.getByText(/^Updated at /)).toBeVisible()
  })
})

// -------------------------------------------------------------------------------------------------- cross device

test('GI-56 two Check Ins at the same moment both count', async ({ page, baseURL, browser }) => {
  only('AI')
  await withOccupancy(2, async () => {
    await fresh(page, baseURL)
    await page.goto('/check-in')
    await expect(page.locator(HOLD)).toBeVisible()
    const other = await secondPhone(browser, baseURL)
    const reader = await secondPhone(browser, baseURL)
    try {
      await fakeLocation(other.page, INSIDE)
      await signInApi(other.page.request, baseURL!, createMember({ kind: 'athlete' }))
      await other.page.goto('/check-in')
      await expect(other.page.locator(HOLD)).toBeVisible()
      await Promise.all([hold(page), hold(other.page)])
      await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
      await expect(other.page.getByText('Sesión activa', { exact: true })).toBeVisible()
      await signInApi(reader.page.request, baseURL!, createMember())
      await openGym(reader.page)
      await expect(gymCount(reader.page)).toHaveText('4')
    } finally { await other.context.close(); await reader.context.close() }
  })
})

test('GI-57 a Check In on one phone raises the count on another phone without a reload', async ({ page, baseURL, browser }) => {
  only('AI')
  await withOccupancy(2, async () => {
    await fresh(page, baseURL)
    const other = await secondPhone(browser, baseURL)
    try {
      await signInApi(other.page.request, baseURL!, createMember({ kind: 'athlete' }))
      await openGym(other.page)
      await expect(gymCount(other.page)).toHaveText('2')
      await checkInByHold(page)
      await expect(gymCount(other.page)).toHaveText('3', { timeout: POLL_WAIT })
    } finally { await other.context.close() }
  })
})

test('GI-58 a desk check-out ends the visit on one phone and lowers the count on the other', async ({ page, request, baseURL, browser }) => {
  only('AI')
  await withOccupancy(2, async () => {
    await withVisit(page, baseURL)
    await openCard(page)
    const other = await secondPhone(browser, baseURL)
    try {
      await signInApi(other.page.request, baseURL!, createMember({ kind: 'athlete' }))
      await openGym(other.page)
      await expect(gymCount(other.page)).toHaveText('3')
      const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
      await frontDeskCheckOut(request, baseURL!, body.session.id)
      await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible({ timeout: POLL_WAIT })
      await expect(gymCount(other.page)).toHaveText('2', { timeout: POLL_WAIT })
    } finally { await other.context.close() }
  })
})
