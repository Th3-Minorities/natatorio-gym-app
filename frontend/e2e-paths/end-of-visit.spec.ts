import { expect, test, type APIRequest, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { api, fakeLocation, INSIDE, signInUser } from '../e2e/flows/flow.ts'
import {
  addClosure, addPeriod, backdateOpenVisit, createMember, deleteSlot, dropMarkedSlots, flushCache, rawApi, resetSchedule, sessionCount, signInApi,
  type MemberOptions,
} from './setup.ts'
import { ageVisit, closeDue, endUserVisit, release, setOccupancy } from './setup-occupancy.ts'
import {
  addClosureAt, auditEntries, checkInApi, checkOutRaw, closureEffective, createStaffAccount, deskCheckOut, deskSignIn, minutesOfDay,
  moveVisitToPastTermEnd, phoneTime, sessionRow, startPeriodNow,
} from './setup-end-of-visit.ts'

// #152 path tests for flow 6, End of a visit. One test per built row of the path inventory (EV-01 to EV-47). The staff screen is
// not built, so the desk is the API. The closure rows end other users' visits and sit at the end of the file.

test.setTimeout(150_000)

test.beforeAll(() => {
  flushCache()
  resetSchedule()
})
test.afterAll(() => dropMarkedSlots())

const ABBREVIATION: Record<string, string> = { desktop: 'D', android: 'A', iphone: 'I' }
/** Limits a row to the devices the inventory lists (D desktop, A Android, I iPhone). API rows run once, on desktop. */
function only(devices: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devices.includes(device), `the inventory lists ${devices} for this path`)
}

const HOLD = '.check-in-hold'
const READY = '¿Listo para entrenar?'
const POLL_WAIT = 40_000
const DESK_REASON = 'Tu salida fue registrada por el personal.'
const AUTO_REASON = 'La sesión se cerró automáticamente.'
const CLOSED_REASON = 'La sesión terminó por cierre del gimnasio.'
const PHONE_TIME = /^\d{1,2}:\d{2} [ap]\. m\.$/
const HOUR = 3_600_000

const lead = (page: Page) => page.locator('.check-in-lead')
const times = (page: Page) => page.locator('.check-in-id__time')
const duration = (page: Page) => page.locator('.check-in-duration__value')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' })
const gymCount = (page: Page) => page.locator('.gym-occupancy__count strong')
const active = (page: Page) => page.getByText('Sesión activa', { exact: true })
const continuar = (page: Page) => page.getByRole('button', { name: 'Continuar' })

// ------------------------------------------------------------------------------------------------------ helpers

/** The ended view of a visit ("Tu visita ha terminado"). */
async function expectEnded(page: Page, { reason = DESK_REASON, athlete = false }: { reason?: string; athlete?: boolean } = {}) {
  await expect(page.getByRole('heading', { level: 1, name: 'Check-in' })).toBeVisible()
  await expect(lead(page)).toHaveText('Tu visita ha terminado')
  await expect(page.getByText('Sesión finalizada', { exact: true })).toBeVisible()
  await expect(page.getByText('Entrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Salida', { exact: true })).toBeVisible()
  await expect(times(page)).toHaveCount(2)
  await expect(times(page).nth(0)).toHaveText(PHONE_TIME)
  await expect(times(page).nth(1)).toHaveText(PHONE_TIME)
  await expect(page.getByText('Duración total', { exact: true })).toBeVisible()
  await expect(duration(page)).toHaveText(/^\d{2}:\d{2}:\d{2}$/)
  await expect(page.locator('.check-in-caption')).toHaveText(reason)
  await expect(continuar(page)).toBeVisible()
  await expect(page.locator('.check-in-id__category')).toHaveText(athlete ? 'Atleta' : 'Miembro')
  await expect(active(page)).toHaveCount(0)
}

async function expectReady(page: Page) {
  await expect(lead(page)).toHaveText(READY)
  await expect(page.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeVisible()
}

async function expectGymId(page: Page) {
  await expect(lead(page)).toHaveText('¡Tu entrada quedó registrada!')
  await expect(active(page)).toBeVisible()
}

/** Presses the hold button with the pointer for `ms` milliseconds (the mouse path works on the three devices). */
async function hold(page: Page, ms = 1100) {
  const button = page.locator(HOLD)
  await expect(button).toBeVisible()
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

/** A new member whose phone (the page) is signed in with a faked location inside the gym and an open visit. */
async function startVisit(page: Page, baseURL: string | undefined, options: MemberOptions = {}) {
  const member = createMember(options)
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
  const id = await checkInApi(page.request, baseURL)
  return { member, id }
}

/** A member with an open visit that lives in its own API context (another person's phone, or no phone at all). */
async function apiVisit(request: APIRequest, baseURL: string | undefined, options: MemberOptions = {}) {
  const member = createMember(options)
  const context = await request.newContext({ baseURL })
  await signInApi(context, baseURL!, member)
  const id = await checkInApi(context, baseURL)
  return { member, id, context }
}

async function openCard(page: Page) {
  await page.goto('/check-in')
  await expect(active(page)).toBeVisible()
}

/** Visit open, desk check-out, phone reloaded on the ended view. */
async function endedByDesk(page: Page, baseURL: string | undefined, request: APIRequest, options: MemberOptions = {}) {
  const visit = await startVisit(page, baseURL, options)
  await page.goto('/check-in')
  await expect(active(page)).toBeVisible()
  await deskCheckOut(request, baseURL, visit.id)
  await page.reload()
  await expectEnded(page, { athlete: options.kind === 'athlete' })
  return visit
}

/** A second phone: another browser context of the same device type. */
async function secondPhone(browser: Browser, baseURL: string | undefined) {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = test.info().project.use
  const context = await browser.newContext({ baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor })
  return { context, page: await context.newPage() }
}

const visibilityPoll = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

/** Runs `body` with the occupancy set to exactly `n` and always gives the voided visits back. */
async function withOccupancy<T>(n: number, body: () => Promise<T>): Promise<T> {
  const state = setOccupancy(n)
  try { return await body() } finally { release(state) }
}

/** The open visit of the signed-in member, as the API reports it. */
async function openVisitId(page: Page, baseURL: string | undefined): Promise<number | null> {
  const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL!)
  return body.session?.id ?? null
}

// ------------------------------------------------------------------------------- desk check-out reaches the phone

test('EV-01 a desk check-out ends the visit on the phone after a reload', async ({ page, baseURL, playwright }) => {
  const { id } = await startVisit(page, baseURL)
  await openCard(page)
  const entry = (await times(page).first().textContent())!
  await deskCheckOut(playwright.request, baseURL, id)
  await page.reload()
  await expectEnded(page)
  await expect(times(page).first()).toHaveText(entry)
  await expect(duration(page)).toHaveText(/^00:0\d:\d{2}$/)
})

test('EV-02 the open card turns into the ended view on its own, with no tap', async ({ page, baseURL, playwright }) => {
  const { id } = await startVisit(page, baseURL)
  await openCard(page)
  await deskCheckOut(playwright.request, baseURL, id)
  await expect(lead(page)).toHaveText('Tu visita ha terminado', { timeout: POLL_WAIT })
  await expectEnded(page)
})

test('EV-03 a tab that becomes visible shows the ended view at once', async ({ page, baseURL, playwright }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  await openCard(page)
  const setHidden = (hidden: boolean) => page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
  await setHidden(true)
  await deskCheckOut(playwright.request, baseURL, id)
  await page.waitForTimeout(1000)
  await expect(active(page)).toBeVisible()
  await setHidden(false)
  await expect(lead(page)).toHaveText('Tu visita ha terminado', { timeout: 5000 })
  await expectEnded(page)
})

test('EV-04 a check-out during an offline phone shows the ended view after reconnecting, never an active card', async ({ page, baseURL, playwright, context }) => {
  const { id } = await startVisit(page, baseURL)
  await openCard(page)
  await context.setOffline(true)
  await expect(page.getByText('No válida ahora', { exact: true })).toBeVisible()
  await deskCheckOut(playwright.request, baseURL, id)
  await context.setOffline(false)
  await expect(lead(page)).toHaveText('Tu visita ha terminado')
  await expectEnded(page)
  await expect(page.getByText('No válida ahora', { exact: true })).toHaveCount(0)
})

test('EV-05 on Gimnasio the count falls after a check-out and the Check-in tab shows the ended view', async ({ page, baseURL, playwright }) => {
  await withOccupancy(2, async () => {
    const { id } = await startVisit(page, baseURL)
    await page.goto('/gym')
    await expect(gymCount(page)).toHaveText('3')
    await deskCheckOut(playwright.request, baseURL, id)
    await expect(gymCount(page)).toHaveText('2', { timeout: POLL_WAIT })
    await nav(page).getByRole('link', { name: 'Check-in' }).click()
    await expectEnded(page)
  })
})

test('EV-06 a visit that ends while the person is on Mi cuenta shows as ended from the Check-in tab', async ({ page, baseURL, playwright }) => {
  const { id } = await startVisit(page, baseURL)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  await deskCheckOut(playwright.request, baseURL, id)
  await nav(page).getByRole('link', { name: 'Check-in' }).click()
  await expectEnded(page)
})

test('EV-07 a phone that was closed and reopened shows the ended view', async ({ page, baseURL, playwright, context }) => {
  const { id } = await startVisit(page, baseURL)
  await openCard(page)
  await page.close()
  await deskCheckOut(playwright.request, baseURL, id)
  const reopened = await context.newPage()
  await reopened.goto('/check-in')
  await expectEnded(reopened)
})

test('EV-08 an athlete sees the ended view with the Atleta tag and the sport', async ({ page, baseURL, playwright }) => {
  await endedByDesk(page, baseURL, playwright.request, { kind: 'athlete', sport: 'Voleibol' })
  await expect(page.getByText('Voleibol', { exact: true })).toBeVisible()
  await expect(page.locator('.check-in--athlete')).toBeVisible()
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
})

test('EV-09 an employee sees the ended view tagged Miembro with no group line', async ({ page, baseURL, playwright }) => {
  only('D')
  await endedByDesk(page, baseURL, playwright.request, { group: 'employee' })
  await expect(page.getByText('Estudiante', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Empleado/)).toHaveCount(0)
})

// ------------------------------------------------------------------------------------------------ Continuar

test('EV-10 Continuar returns to the ready screen with the hold button', async ({ page, baseURL, playwright }) => {
  await endedByDesk(page, baseURL, playwright.request)
  await continuar(page).click()
  await expectReady(page)
})

test('EV-11 after Continuar a reload still shows the ready screen', async ({ page, baseURL, playwright }) => {
  await endedByDesk(page, baseURL, playwright.request)
  await continuar(page).click()
  await expectReady(page)
  await page.reload()
  await expectReady(page)
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toHaveCount(0)
})

test('EV-12 another browser of the same person still shows the ended view', async ({ page, baseURL, playwright, browser }) => {
  const { member } = await endedByDesk(page, baseURL, playwright.request)
  await continuar(page).click()
  await expectReady(page)
  const other = await secondPhone(browser, baseURL)
  try {
    await signInApi(other.page.request, baseURL!, member)
    await other.page.goto('/check-in')
    await expectEnded(other.page)
  } finally { await other.context.close() }
})

test('EV-13 with storage blocked Continuar works but the ended view returns after a reload', async ({ page, baseURL, playwright }) => {
  only('D')
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError') } })
  })
  await endedByDesk(page, baseURL, playwright.request)
  await continuar(page).click()
  await expectReady(page)
  await page.reload()
  await expectEnded(page)
})

test('EV-14 offline, Continuar is disabled and the offline banner shows', async ({ page, baseURL, playwright, context }) => {
  await endedByDesk(page, baseURL, playwright.request)
  await context.setOffline(true)
  await expect(page.locator('.user-offline')).toBeVisible()
  await expect(continuar(page)).toBeDisabled()
  await expect(lead(page)).toHaveText('Tu visita ha terminado')
})

test('EV-15 Continuar after a Check In on another phone sends the first phone to sign in', async ({ page, baseURL, playwright, browser }) => {
  const { member } = await endedByDesk(page, baseURL, playwright.request)
  const other = await secondPhone(browser, baseURL)
  try {
    await signInApi(other.page.request, baseURL!, member)
    await checkInApi(other.page.request, baseURL)
    await continuar(page).click()
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await other.context.close() }
})

test('EV-16 after Continuar a new hold starts a second visit and the count rises again', async ({ page, baseURL, playwright }) => {
  await withOccupancy(2, async () => {
    const { member, id } = await endedByDesk(page, baseURL, playwright.request)
    await continuar(page).click()
    await expectReady(page)
    await hold(page)
    await expectGymId(page)
    const next = await openVisitId(page, baseURL)
    expect(next).not.toBeNull()
    expect(next).not.toBe(id)
    expect(sessionCount(member)).toBe(2)
    await nav(page).getByRole('link', { name: 'Gimnasio' }).click()
    await expect(gymCount(page)).toHaveText('3')
  })
})

test('EV-17 a visit checked out in the same second shows a duration of at most two seconds', async ({ page, baseURL, playwright }) => {
  only('D')
  const desk = await deskSignIn(playwright.request, baseURL)
  try {
    const { id } = await startVisit(page, baseURL)
    const answer = await checkOutRaw(desk, id)
    expect(answer.status, JSON.stringify(answer.body)).toBe(200)
    await page.goto('/check-in')
    await expectEnded(page)
    await expect(duration(page)).toHaveText(/^00:00:0[0-2]$/)
    const entry = minutesOfDay((await times(page).nth(0).textContent())!)
    const exit = minutesOfDay((await times(page).nth(1).textContent())!)
    expect(exit).toBeGreaterThanOrEqual(entry)
  } finally { await desk.context.dispose() }
})

// ------------------------------------------------------------------------------ desk check-out at the 2-hour edge

test('EV-18 a desk check-out just inside the two hours succeeds and the phone shows the desk reason', async ({ page, baseURL, playwright }) => {
  only('D')
  const desk = await deskSignIn(playwright.request, baseURL)
  try {
    const { id } = await startVisit(page, baseURL)
    ageVisit(id, '1 hour 59 minutes 50 seconds')
    const answer = await checkOutRaw(desk, id)
    expect(answer.status, JSON.stringify(answer.body)).toBe(200)
    expect(answer.body.session.status).toBe('checked_out')
    expect(answer.body.session.end_reason).toBe('checked_out')
  } finally { await desk.context.dispose() }
  await page.goto('/check-in')
  await expectEnded(page)
})

test('EV-19 a desk check-out at exactly two hours is refused and the phone shows the automatic close', async ({ page, baseURL, playwright }) => {
  only('D')
  const desk = await deskSignIn(playwright.request, baseURL)
  try {
    const { id } = await startVisit(page, baseURL)
    ageVisit(id, '2 hours')
    const answer = await checkOutRaw(desk, id)
    expect(answer.status, JSON.stringify(answer.body)).toBe(409)
    expect(answer.body.error.code).toBe('check_out_session_not_active')
  } finally { await desk.context.dispose() }
  await page.goto('/check-in')
  await expectEnded(page, { reason: AUTO_REASON })
})

test('EV-20 a second check-out is refused and keeps the first end time and the first desk account', async ({ page, baseURL, playwright }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  const first = await deskSignIn(playwright.request, baseURL, 'staff')
  const second = await deskSignIn(playwright.request, baseURL, 'admin')
  try {
    expect((await checkOutRaw(first, id)).status).toBe(200)
    const stored = sessionRow(id)
    const answer = await checkOutRaw(second, id)
    expect(answer.status).toBe(409)
    expect(answer.body.error.code).toBe('check_out_session_not_active')
    const after = sessionRow(id)
    expect(after.by).toBe(stored.by)
    expect(after.ended).toBe(stored.ended)
    expect(after.status).toBe('checked_out')
    await page.goto('/check-in')
    await expectEnded(page)
    await expect(times(page).nth(1)).toHaveText(phoneTime(stored.ended! * 1000))
  } finally { await first.context.dispose(); await second.context.dispose() }
})

test('EV-21 Staff and Administrator can both check out and neither writes an audit entry', async ({ baseURL, playwright }) => {
  only('D')
  const first = await apiVisit(playwright.request, baseURL)
  const second = await apiVisit(playwright.request, baseURL)
  try {
    const before = auditEntries()
    await deskCheckOut(playwright.request, baseURL, first.id, 'staff')
    await deskCheckOut(playwright.request, baseURL, second.id, 'admin')
    expect(auditEntries()).toBe(before)
    expect(sessionRow(first.id).status).toBe('checked_out')
    expect(sessionRow(second.id).status).toBe('checked_out')
  } finally { await first.context.dispose(); await second.context.dispose() }
})

test('EV-22 a guest and a member cookie are refused as unauthenticated', async ({ baseURL, playwright }) => {
  only('D')
  const visit = await apiVisit(playwright.request, baseURL)
  const guest = await playwright.request.newContext({ baseURL })
  try {
    for (const context of [guest, visit.context]) {
      const answer = await rawApi(context, 'post', `/api/staff/sessions/${visit.id}/check-out`, baseURL!)
      expect(answer.status).toBe(401)
      expect(answer.body.error.code).toBe('unauthenticated')
    }
    expect(sessionRow(visit.id).status).toBe('active')
  } finally { await guest.dispose(); await visit.context.dispose() }
})

test('EV-23 a deactivated Staff account can no longer check out', async ({ baseURL, playwright }) => {
  only('D')
  const visit = await apiVisit(playwright.request, baseURL)
  const account = createStaffAccount()
  const desk = await deskSignIn(playwright.request, baseURL, account)
  const admin = await deskSignIn(playwright.request, baseURL, 'admin')
  try {
    const deactivate = await rawApi(admin.context, 'post', `/api/staff/accounts/${account.id}/deactivate`, baseURL!)
    expect(deactivate.status, JSON.stringify(deactivate.body)).toBe(200)
    const answer = await checkOutRaw(desk, visit.id)
    expect([401, 403]).toContain(answer.status)
    expect(sessionRow(visit.id).status).toBe('active')
  } finally { await desk.context.dispose(); await admin.context.dispose(); await visit.context.dispose() }
})

test('EV-24 invalid ids are refused before any visit changes', async ({ baseURL, playwright }) => {
  only('D')
  const visit = await apiVisit(playwright.request, baseURL)
  const desk = await deskSignIn(playwright.request, baseURL)
  try {
    const cases: [string, number, string][] = [
      ['999999999', 404, 'not_found'], ['abc', 404, 'not_found'], ['0', 422, 'validation_failed'], ['999999999999999999999', 422, 'validation_failed'],
    ]
    for (const [id, status, code] of cases) {
      const answer = await checkOutRaw(desk, id)
      expect(answer.status, id).toBe(status)
      expect(answer.body.error.code, id).toBe(code)
    }
    expect(sessionRow(visit.id).status).toBe('active')
  } finally { await desk.context.dispose(); await visit.context.dispose() }
})

test('EV-25 two simultaneous check-outs give one success and one refusal with one end time', async ({ baseURL, playwright }) => {
  only('D')
  const visit = await apiVisit(playwright.request, baseURL)
  const one = await deskSignIn(playwright.request, baseURL, 'staff')
  const two = await deskSignIn(playwright.request, baseURL, 'staff')
  try {
    const answers = await Promise.all([checkOutRaw(one, visit.id), checkOutRaw(two, visit.id)])
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409])
    const row = sessionRow(visit.id)
    expect(row.status).toBe('checked_out')
    expect(row.ended).not.toBeNull()
  } finally { await one.context.dispose(); await two.context.dispose(); await visit.context.dispose() }
})

// --------------------------------------------------------------------------------------- the 2-hour close

test('EV-26 a visit past two hours is shown as automatically closed before the scheduler runs', async ({ page, baseURL }) => {
  const { id } = await startVisit(page, baseURL)
  ageVisit(id, '2 hours 5 minutes')
  const row = sessionRow(id)
  await page.goto('/check-in')
  await expectEnded(page, { reason: AUTO_REASON })
  await expect(times(page).nth(0)).toHaveText(phoneTime(row.started * 1000))
  await expect(times(page).nth(1)).toHaveText(phoneTime(row.started * 1000 + 2 * HOUR))
  await expect(duration(page)).toHaveText('02:00:00')
})

test('EV-27 the scheduler after the close changes nothing on the phone and leaves ended_at empty', async ({ page, baseURL }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  ageVisit(id, '2 hours 5 minutes')
  await page.goto('/check-in')
  await expectEnded(page, { reason: AUTO_REASON })
  const exit = await times(page).nth(1).textContent()
  closeDue()
  await page.reload()
  await expectEnded(page, { reason: AUTO_REASON })
  await expect(times(page).nth(1)).toHaveText(exit!)
  await expect(duration(page)).toHaveText('02:00:00')
  const row = sessionRow(id)
  expect(row.status).toBe('expired')
  expect(row.ended).toBeNull()
})

test('EV-28 a card open at 1:59:40 becomes the ended view within one poll after the two hours', async ({ page, baseURL }) => {
  const { id } = await startVisit(page, baseURL)
  ageVisit(id, '1 hour 59 minutes 40 seconds')
  await openCard(page)
  await expect(duration(page)).toHaveText(/^01:59:\d{2}$/)
  await expect(lead(page)).toHaveText('Tu visita ha terminado', { timeout: 60_000 })
  await expectEnded(page, { reason: AUTO_REASON })
  await expect(duration(page)).toHaveText('02:00:00')
})

test('EV-29 five seconds before the two hours the card is still active', async ({ page, baseURL }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
  ageVisit(id, '1 hour 59 minutes 55 seconds')
  await nav(page).getByRole('link', { name: 'Check-in' }).click()
  await expect(active(page)).toBeVisible()
  await expect(duration(page)).toHaveText(/^01:59:5\d$/)
})

test('EV-30 a Check In right after the two-hour close starts a new visit with no conflict', async ({ page, baseURL }) => {
  const { member, id } = await startVisit(page, baseURL)
  ageVisit(id, '2 hours 5 minutes')
  await page.goto('/check-in')
  await expectEnded(page, { reason: AUTO_REASON })
  await continuar(page).click()
  await expectReady(page)
  await hold(page)
  await expectGymId(page)
  const next = await openVisitId(page, baseURL)
  expect(next).not.toBeNull()
  expect(next).not.toBe(id)
  expect(sessionCount(member)).toBe(2)
})

// ------------------------------------------------------------------------------ closures that do not end the visit

test('EV-32 a closure scheduled for later leaves the visit active', async ({ page, baseURL }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  const closure = addClosureAt(60, 120)
  try {
    await page.goto('/check-in')
    await expect(active(page)).toBeVisible()
    expect(sessionRow(id).status).toBe('active')
  } finally { deleteSlot(closure) }
})

test('EV-33 a closure that was over before the visit began leaves it active', async ({ page, baseURL }) => {
  only('D')
  const { id } = await startVisit(page, baseURL)
  const closure = addClosureAt(-180, -120, -180)
  try {
    await page.goto('/check-in')
    await expect(active(page)).toBeVisible()
    expect(sessionRow(id).status).toBe('active')
  } finally { deleteSlot(closure) }
})

// ------------------------------------------------------------------------------------------------- end of term

test('EV-35 a visit that began on the last evening of a past term is shown as closed at midnight', async ({ page, baseURL }) => {
  const { id } = await startVisit(page, baseURL)
  moveVisitToPastTermEnd(id)
  await page.goto('/check-in')
  await expectEnded(page, { reason: CLOSED_REASON })
  await expect(times(page).nth(0)).toHaveText(/^11:30 p\. m\.$/)
  await expect(times(page).nth(1)).toHaveText(/^12:00 a\. m\.$/)
  await expect(duration(page)).toHaveText('00:30:00')
})

test('EV-36 an athlete whose visit ended with the term sees the athlete view and can still Check In', async ({ page, baseURL }) => {
  only('D')
  const { id } = await startVisit(page, baseURL, { kind: 'athlete', sport: 'Voleibol' })
  moveVisitToPastTermEnd(id)
  await page.goto('/check-in')
  await expectEnded(page, { reason: CLOSED_REASON, athlete: true })
  await expect(page.getByText('Voleibol', { exact: true })).toBeVisible()
  await continuar(page).click()
  await expectReady(page)
  await hold(page)
  await expectGymId(page)
})

// ----------------------------------------------------------------------------- corrections written by staff (DB)

test('EV-37 a visit staff ended early shows the desk reason', async ({ page, baseURL }) => {
  only('D')
  const { member } = await startVisit(page, baseURL)
  endUserVisit(member.id, 'ended_early')
  await page.goto('/check-in')
  await expectEnded(page)
})

test('EV-38 a voided visit is not shown as ended', async ({ page, baseURL }) => {
  only('D')
  const { member } = await startVisit(page, baseURL)
  endUserVisit(member.id, 'void')
  await page.goto('/check-in')
  await expectReady(page)
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toHaveCount(0)
})

// ----------------------------------------------------------------------------------------------- other effects

test('EV-39 an athletes-only period that starts during the visit does not cut it', async ({ page, baseURL }) => {
  await startVisit(page, baseURL)
  const period = addPeriod(10, 130)
  try {
    await openCard(page)
    await expect(page.locator('.check-in-notice')).toContainText('Próximo horario exclusivo de atletas')
    startPeriodNow(period)
    await visibilityPoll(page)
    await expect(page.locator('.check-in-notice')).toContainText('Horario exclusivo de atletas')
    await expect(page.locator('.check-in-notice')).not.toContainText('Próximo')
    await expect(active(page)).toBeVisible()
  } finally { deleteSlot(period) }
})

test('EV-40 signing out and in again keeps the visit open and the desk can still end it', async ({ page, baseURL, playwright }) => {
  const { member, id } = await startVisit(page, baseURL)
  await openCard(page)
  const entry = await times(page).first().textContent()
  await page.goto('/account')
  await page.getByRole('link', { name: /^Ajustes/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await signInUser(page, member.email, member.password)
  await page.goto('/check-in')
  await expect(active(page)).toBeVisible()
  await expect(times(page).first()).toHaveText(entry!)
  await deskCheckOut(playwright.request, baseURL, id)
})

test('EV-41 with a second phone, the desk check-out ends the visit on the new phone and signs the old one out', async ({ page, baseURL, playwright, browser }) => {
  const { member, id } = await startVisit(page, baseURL)
  await openCard(page)
  const other = await secondPhone(browser, baseURL)
  try {
    await signInApi(other.page.request, baseURL!, member)
    await other.page.goto('/check-in')
    await expect(active(other.page)).toBeVisible()
    await deskCheckOut(playwright.request, baseURL, id)
    await other.page.reload()
    await expectEnded(other.page)
    await visibilityPoll(page)
    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByText('Iniciaste sesión en otro dispositivo', { exact: true })).toBeVisible()
  } finally { await other.context.close() }
})

test('EV-42 a desk check-out of one person does not touch another person inside', async ({ page, baseURL, playwright, browser }) => {
  await withOccupancy(3, async () => {
    const { id } = await startVisit(page, baseURL)
    const athlete = createMember({ kind: 'athlete' })
    const other = await secondPhone(browser, baseURL)
    try {
      await signInApi(other.page.request, baseURL!, athlete)
      await checkInApi(other.page.request, baseURL)
      await other.page.goto('/check-in')
      await expect(active(other.page)).toBeVisible()
      await page.goto('/check-in')
      await expect(active(page)).toBeVisible()
      await deskCheckOut(playwright.request, baseURL, id)
      await page.reload()
      await expectEnded(page)
      await other.page.reload()
      await expect(active(other.page)).toBeVisible()
      await other.page.goto('/gym')
      await expect(gymCount(other.page)).toHaveText('4')
    } finally { await other.context.close() }
  })
})

test('EV-43 the count on Gimnasio falls by one after a desk check-out', async ({ page, baseURL, playwright }) => {
  await withOccupancy(2, async () => {
    const { id } = await startVisit(page, baseURL)
    await page.goto('/gym')
    await expect(gymCount(page)).toHaveText('3')
    await deskCheckOut(playwright.request, baseURL, id)
    await expect(gymCount(page)).toHaveText('2', { timeout: POLL_WAIT })
  })
})

test('EV-44 a failed refresh on Continuar keeps the ended view and shows the offline state', async ({ page, baseURL, playwright }) => {
  only('D')
  await endedByDesk(page, baseURL, playwright.request)
  await page.route('**/api/user/check-in', (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"server_error"}}' }) : route.fallback())
  await continuar(page).click()
  await expect(page.locator('.user-offline')).toBeVisible()
  await expect(lead(page)).toHaveText('Tu visita ha terminado')
  expect(await page.evaluate(() => localStorage.getItem('checkIn.dismissedSession'))).toBeNull()
})

test('EV-46 the tab bar leads away and back and the ended view returns until Continuar', async ({ page, baseURL, playwright }) => {
  await endedByDesk(page, baseURL, playwright.request)
  await nav(page).getByRole('link', { name: 'Gimnasio' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gimnasio' })).toBeVisible()
  await nav(page).getByRole('link', { name: 'Check-in' }).click()
  await expectEnded(page)
  await continuar(page).click()
  await expectReady(page)
})

test('EV-47 every visit that already ended refuses a second check-out and stays as it was', async ({ baseURL, playwright }) => {
  only('D')
  const desk = await deskSignIn(playwright.request, baseURL)
  const contexts: APIRequestContext[] = []
  try {
    const rows: [string, number][] = []
    const make = async () => { const visit = await apiVisit(playwright.request, baseURL); contexts.push(visit.context); return visit }
    const expired = await make(); ageVisit(expired.id, '2 hours 5 minutes'); rows.push(['expired', expired.id])
    const checkedOut = await make(); await deskCheckOut(playwright.request, baseURL, checkedOut.id); rows.push(['checked_out', checkedOut.id])
    const closed = await make(); moveVisitToPastTermEnd(closed.id); closeDue(); rows.push(['closed', closed.id])
    const early = await make(); endUserVisit(early.member.id, 'ended_early'); rows.push(['ended_early', early.id])
    const voided = await make(); endUserVisit(voided.member.id, 'void'); rows.push(['void', voided.id])
    const before = auditEntries()
    for (const [label, id] of rows) {
      const stored = sessionRow(id)
      const answer = await checkOutRaw(desk, id)
      expect(answer.status, label).toBe(409)
      expect(answer.body.error.code, label).toBe('check_out_session_not_active')
      expect(sessionRow(id), label).toEqual(stored)
    }
    expect(auditEntries()).toBe(before)
    expect(rows.map(([label, id]) => label === 'expired' ? 'expired' : sessionRow(id).status)).toEqual(['expired', 'checked_out', 'closed', 'ended_early', 'void'])
  } finally {
    await desk.context.dispose()
    for (const context of contexts) await context.dispose()
  }
})

// ------------------------------------------------------------------------------------------------------------
// Closure rows come last: a running closure ends every other open visit that began before it.

test.describe('closures', () => {
  test('EV-31 a closure that starts during the visit ends it at the closure time', async ({ page, baseURL }) => {
    const { member } = await startVisit(page, baseURL)
    backdateOpenVisit(member, 10)
    const closure = addClosure()
    try {
      const effective = closureEffective(closure)
      await page.goto('/check-in')
      await expectEnded(page, { reason: CLOSED_REASON })
      await expect(times(page).nth(1)).toHaveText(phoneTime(effective))
      await expect(duration(page)).toHaveText(/^00:0[4-6]:\d{2}$/)
    } finally { deleteSlot(closure) }
  })

  test('EV-34 during the closure Check In says the gym is closed, and after it the Gym ID opens', async ({ page, baseURL }) => {
    only('D')
    const { member } = await startVisit(page, baseURL)
    backdateOpenVisit(member, 10)
    const closure = addClosure()
    try {
      await page.goto('/check-in')
      await expectEnded(page, { reason: CLOSED_REASON })
      // The scheduler materializes the close within a minute; without it, deleting the closure would bring the visit back.
      closeDue()
      await continuar(page).click()
      await expectReady(page)
      await hold(page)
      await expect(page.getByRole('heading', { name: 'El gimnasio está cerrado', exact: true })).toBeVisible()
    } finally { deleteSlot(closure) }
    await page.reload()
    await expectReady(page)
    await hold(page)
    await expectGymId(page)
  })

  test('EV-45 an English account sees the three end reasons in English', async ({ page, baseURL, playwright }) => {
    const english = async (reason: string) => {
      await expect(lead(page)).toHaveText('Your visit has ended')
      await expect(page.getByText('Session ended', { exact: true })).toBeVisible()
      await expect(page.getByText('Entry', { exact: true })).toBeVisible()
      await expect(page.getByText('Exit', { exact: true })).toBeVisible()
      await expect(page.getByText('Total duration', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
      await expect(page.locator('.check-in-caption')).toHaveText(reason)
    }
    const first = await startVisit(page, baseURL, { locale: 'en' })
    await deskCheckOut(playwright.request, baseURL, first.id)
    await page.goto('/check-in')
    await english('Your exit was registered by the staff.')

    const second = await startVisit(page, baseURL, { locale: 'en' })
    ageVisit(second.id, '2 hours 5 minutes')
    await page.goto('/check-in')
    await english('The session closed automatically.')

    const third = await startVisit(page, baseURL, { locale: 'en' })
    backdateOpenVisit(third.member, 10)
    const closure = addClosure()
    try {
      await page.goto('/check-in')
      await english('The session ended because the gym closed.')
    } finally { deleteSlot(closure) }
  })
})
