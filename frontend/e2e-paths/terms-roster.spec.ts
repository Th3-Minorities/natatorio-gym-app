import { expect, test, type Browser, type Page } from '@playwright/test'
import { ADMIN, api, fakeLocation, INSIDE, STAFF } from '../e2e/flows/flow.ts'
import { countRequests, createMember, flushCache, rawApi, resetSchedule, signInApi, dropMarkedSlots, type MemberOptions } from './setup.ts'
import { deskCheckOut } from './setup-end-of-visit.ts'
import { occupancyNow } from './setup-occupancy.ts'
import { createAthlete } from './setup-athlete.ts'
import {
  addDays, addSecondAuthorization, chipLabel, CURRENT, dropRoster, dropTermsNamed, insertRoster, insertTerm, NEXT, reinstate, removedSeedNumber,
  renameTerm, restoreTerms, setTerms, snapshotTerms, startVisitLastNight, todayPR, tryReactivate, withdraw, type TermRow,
} from './setup-terms.ts'

// #152 path tests for flow 9, Terms and athlete roster. One test per built row of the path inventory (TR-01 to TR-21).
// The Administrator screens for terms and the roster are not built, so a row that needs the dashboard's Retirar, Reinstalar or term
// buttons uses tinker as a stand-in. Term rows move the dates of the current term for the whole stack: this file runs alone on its
// own stack, and every change is restored in finally (and again after the last test).

test.setTimeout(150_000)

let original: TermRow[] = []

test.beforeAll(() => {
  flushCache()
  resetSchedule()
  original = snapshotTerms()
  const today = todayPR()
  const current = original.find((term) => term.name === CURRENT)!
  if (!(current.starts_on <= today && today <= current.ends_on)) throw new Error(`"${CURRENT}" does not contain today (${today}): reseed the stack`)
})
test.afterAll(() => {
  if (original.length > 0) restoreTerms(original)
  dropMarkedSlots()
})

const ABBREVIATION: Record<string, string> = { desktop: 'D', 'desktop-firefox': 'D', 'desktop-webkit': 'D', android: 'A', iphone: 'I' }
/** Limits a row to the devices the inventory lists (D desktop, A Android, I iPhone, T terminal: run once, on desktop). */
function only(devices: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devices.includes(device), `the inventory lists ${devices} for this path`)
}

const HOLD = '.check-in-hold'
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })

/** Runs `body` with the terms shifted and always gives them their dates back. */
async function withTerms<T>(patch: Partial<Record<string, Partial<TermRow>>>, body: (saved: TermRow[], changed: TermRow[]) => Promise<T>): Promise<T> {
  const saved = snapshotTerms()
  const changed = saved.filter((term) => patch[term.name]).map((term) => ({ ...term, ...patch[term.name] }))
  try {
    setTerms(changed)
    return await body(saved, changed)
  } finally {
    restoreTerms(saved)
  }
}

const find = (rows: TermRow[], name: string) => rows.find((term) => term.name === name)!

// ------------------------------------------------------------------------------------------------------- the dashboard

async function staffIn(page: Page, baseURL: string | undefined, who: { email: string; password: string }) {
  await api(page.request, 'post', '/api/staff/sign-in', baseURL!, { email: who.email, password: who.password })
}

async function openTeam(page: Page, baseURL: string | undefined) {
  await staffIn(page, baseURL, ADMIN)
  await page.goto('/staff/equipo')
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas del staff' })).toBeVisible()
}

/** The dashboard on a desktop screen, next to the phone: an Administrator signed in on A-15. */
async function dashboard(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  await openTeam(page, baseURL)
  return { context, page }
}

const chip = (page: Page) => page.locator('.team-term .team-chip')

async function expectChip(page: Page, term: Pick<TermRow, 'starts_on' | 'ends_on'>) {
  await expect(chip(page)).toHaveText(chipLabel(term))
  await expect(page.getByText('Acceso del equipo', { exact: true })).toBeVisible()
  await expect(page.getByText('Sin término activo', { exact: true })).toHaveCount(0)
}

async function expectNoTermBanner(page: Page) {
  await expect(page.locator('.team-chip').filter({ hasText: 'Sin término activo' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'No hay un término activo hoy' })).toBeVisible()
  await expect(page.getByText('Configura las fechas en Términos. No se pueden crear autorizaciones nuevas.', { exact: true })).toBeVisible()
  await expect(chip(page)).toHaveCount(0)
}

// ------------------------------------------------------------------------------------------------------------ the phone

async function signedInPhone(page: Page, baseURL: string | undefined, member: { email: string; password: string }) {
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
}

async function fresh(page: Page, baseURL: string | undefined, options: MemberOptions = {}) {
  const member = createMember(options)
  await signedInPhone(page, baseURL, member)
  return member
}

async function hold(page: Page, ms = 1100) {
  const button = page.locator(HOLD)
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

async function openCheckIn(page: Page) {
  await page.goto('/check-in')
  await expect(page.locator(HOLD)).toBeVisible()
}

async function expectGymId(page: Page) {
  await expect(page.locator('.check-in-lead')).toHaveText('¡Tu entrada quedó registrada!')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
}

const MEMBER_PANEL = { title: 'Tu acceso no está vigente', text: 'No encontramos una autorización vigente para registrar tu entrada.', action: 'Revisar mi acceso' }
const ATHLETE_PANEL = {
  title: 'Tu acceso de atleta no está vigente',
  text: 'No encontramos una autorización de atleta vigente. Consulta con el personal para revisar tu acceso.',
  action: 'Ver información de contacto',
}

async function expectPanel(page: Page, panel: typeof MEMBER_PANEL) {
  await expect(heading(page, panel.title)).toBeVisible()
  await expect(page.getByText(panel.text, { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-action').filter({ hasText: panel.action })).toBeVisible()
}

/** From a signed-in phone: Check In, hold, and the refusal panel for an access that is not current. */
async function holdAndExpectPanel(page: Page, panel: typeof MEMBER_PANEL) {
  await openCheckIn(page)
  await hold(page)
  await expectPanel(page, panel)
}

const badge = (page: Page) => page.locator('.user-profile__badge')
const noAccess = (page: Page) => page.getByText('Sin autorización activa', { exact: true })

async function openAccount(page: Page) {
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

/** The phone refetches its profile when the tab gets focus back (or every 60 seconds). */
const refocus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')))

// ================================================================================================== the term chip (A-15)

test('TR-01 the term chip names the months and year of Término actual next to Acceso del equipo', async ({ page, baseURL }) => {
  only('D')
  await staffIn(page, baseURL, ADMIN)
  const me = (await api(page.request, 'get', '/api/staff/me', baseURL!)).body
  const term = (me.active_term ?? me.data?.active_term) as TermRow
  expect(term.name).toBe(CURRENT)
  await page.goto('/staff/equipo')
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas del staff' })).toBeVisible()
  await expectChip(page, term)
})

test('TR-02 a term that crosses a year names both years in the chip', async ({ page, baseURL }) => {
  only('D')
  const year = Number(todayPR().slice(0, 4))
  const end = `${year + 1}-02-15`
  await withTerms({
    [CURRENT]: { ends_on: end },
    [NEXT]: { starts_on: `${year + 1}-02-16`, ends_on: `${year + 1}-06-30` },
  }, async (saved) => {
    await openTeam(page, baseURL)
    const label = chipLabel({ starts_on: find(saved, CURRENT).starts_on, ends_on: end })
    expect(label).toMatch(/^\p{Lu}\p{L}+ \d{4} - \p{L}+ \d{4}$/u)
    await expect(chip(page)).toHaveText(label)
    await expect(page.getByText('Sin término activo', { exact: true })).toHaveCount(0)
  })
})

test('TR-03 with no term today the chip is replaced by the Sin término activo notice and the team list still works', async ({ page, baseURL }) => {
  only('D')
  await withTerms({ [CURRENT]: { ends_on: addDays(todayPR(), -1) } }, async () => {
    await openTeam(page, baseURL)
    await expectNoTermBanner(page)
    await expect(page.getByRole('row', { name: new RegExp(ADMIN.email) })).toBeVisible()
  })
})

// ================================================================================================ cross-device: dates

test('TR-04 when the term has ended, the dashboard shows the notice and the phone refuses the member', async ({ page, baseURL, browser }) => {
  only('AI')
  const member = createMember()
  await withTerms({ [CURRENT]: { ends_on: addDays(todayPR(), -1) } }, async () => {
    const desk = await dashboard(browser, baseURL)
    try {
      await expectNoTermBanner(desk.page)
      await signedInPhone(page, baseURL, member)
      await openAccount(page)
      await expect(noAccess(page)).toBeVisible()
      await expect(badge(page)).toHaveText('Miembro')
      await expect(page.getByText('Soy atleta', { exact: true })).toBeVisible()
      await holdAndExpectPanel(page, MEMBER_PANEL)
    } finally { await desk.context.close() }
  })
})

test('TR-05 on the last day of a term the chip and the phone still pass; one day later both flip', async ({ page, baseURL, browser }) => {
  only('AI')
  const today = todayPR()
  const first = createMember()
  const second = createMember()
  await withTerms({ [CURRENT]: { ends_on: today } }, async (saved) => {
    const desk = await dashboard(browser, baseURL)
    try {
      await expectChip(desk.page, { starts_on: find(saved, CURRENT).starts_on, ends_on: today })
      await signedInPhone(page, baseURL, first)
      await openCheckIn(page)
      await hold(page)
      await expectGymId(page)

      setTerms([{ ...find(saved, CURRENT), ends_on: addDays(today, -1) }])
      await desk.page.reload()
      await expectNoTermBanner(desk.page)
      await signInApi(page.request, baseURL!, second)
      await holdAndExpectPanel(page, MEMBER_PANEL)
    } finally { await desk.context.close() }
  })
})

test('TR-06 when a new term starts today the chip shows it and the phone member has no authorization in it', async ({ page, baseURL, browser }) => {
  only('AI')
  const today = todayPR()
  const member = createMember()
  await withTerms({ [CURRENT]: { ends_on: addDays(today, -1) }, [NEXT]: { starts_on: today } }, async (saved) => {
    const desk = await dashboard(browser, baseURL)
    try {
      await expectChip(desk.page, { starts_on: today, ends_on: find(saved, NEXT).ends_on })
      await signedInPhone(page, baseURL, member)
      await openAccount(page)
      await expect(noAccess(page)).toBeVisible()
      await expect(badge(page)).toHaveText('Miembro')
      await holdAndExpectPanel(page, MEMBER_PANEL)
    } finally { await desk.context.close() }
  })
})

test('TR-07 a 50 character term name fits the Acceso vigente caption; 51 characters are refused by the database', async ({ page, baseURL }) => {
  only('A')
  const name = 'Término de prueba de cincuenta caracteres'.padEnd(50, '.')
  expect(name).toHaveLength(50)
  const member = await fresh(page, baseURL)
  const saved = snapshotTerms()
  let renamed = false
  try {
    expect(renameTerm(CURRENT, name)).toBe('saved')
    renamed = true
    await openAccount(page)
    const caption = page.getByText(`Acceso vigente · ${name}`, { exact: true })
    await expect(caption).toBeVisible()
    const fits = await caption.evaluate((element) => {
      const card = element.closest('.user-profile')!.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      return { inside: box.left >= card.left - 1 && box.right <= card.right + 1, clipped: element.scrollWidth > element.clientWidth + 1,
        pageScroll: document.documentElement.scrollWidth > window.innerWidth }
    })
    expect(fits, `the caption of ${member.email}`).toEqual({ inside: true, clipped: false, pageScroll: false })

    expect(renameTerm(name, 'x'.repeat(51))).toBe('22001')
    expect(snapshotTerms().map((term) => term.name)).toContain(name)
  } finally {
    if (renamed) renameTerm(name, CURRENT)
    restoreTerms(saved)
  }
})

// ======================================================================================= the database rules (terminal)

test('TR-08 the database refuses overlapping terms and a start after the end, and accepts adjacent, gap and one-day terms', async () => {
  only('A')
  const terms = snapshotTerms()
  const current = find(terms, CURRENT)
  const last = terms.map((term) => term.ends_on).sort().at(-1)!
  const make = (suffix: string, from: string, to: string) => insertTerm(`p152-${suffix}`, from, to)
  try {
    expect(make('overlap', last, addDays(last, 10)).state).toBe('23P01')
    expect(make('inside', addDays(current.starts_on, 10), addDays(current.starts_on, 20)).state).toBe('23P01')
    expect(make('identical', current.starts_on, current.ends_on).state).toBe('23P01')
    expect(make('reversed', addDays(last, 70), addDays(last, 60)).state).toBe('23514')
    for (const [suffix, from, to] of [
      ['adjacent', addDays(last, 1), addDays(last, 10)],
      ['gap', addDays(last, 30), addDays(last, 40)],
      ['one-day', addDays(last, 50), addDays(last, 50)],
    ]) {
      const saved = make(suffix, from, to)
      expect(saved, suffix).toMatchObject({ state: 'saved' })
      dropTermsNamed(`p152-${suffix}`)
    }
  } finally {
    dropTermsNamed('p152-')
  }
})

test('TR-09 the database refuses a repeated student number, even a removed one, and a number over 20 characters', async () => {
  only('A')
  const made: number[] = []
  const unique = `p152${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  const insert = (number: string) => {
    const result = insertRoster(number)
    if (result.id) made.push(result.id)
    return result
  }
  try {
    expect(insert('802000001').state).toBe('23505')
    expect(insert(removedSeedNumber()).state).toBe('23505')
    expect(insert(`${unique}9`).state).toBe('22001')
    expect(unique).toHaveLength(20)
    expect(insert(unique)).toMatchObject({ state: 'saved' })
  } finally {
    made.forEach(dropRoster)
  }
})

// ==================================================================================================== permissions (menu)

test('TR-10 Staff see Roster de atletas only; an Administrator also sees Términos and Gestionar atletas', async ({ page, baseURL }) => {
  only('D')
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  await staffIn(page, baseURL, STAFF)
  await page.goto('/staff')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('list', { name: 'Staff' }).getByText('Roster de atletas', { exact: true })).toBeVisible()
  await expect(menu.getByText('Términos', { exact: true })).toHaveCount(0)
  await expect(menu.getByText('Gestionar atletas', { exact: true })).toHaveCount(0)

  await page.context().clearCookies()
  await staffIn(page, baseURL, ADMIN)
  await page.goto('/staff')
  await expect(menu.getByRole('list', { name: 'Staff' }).getByText('Roster de atletas', { exact: true })).toBeVisible()
  const admin = menu.getByRole('list', { name: 'Administración' })
  await expect(admin.getByText('Términos', { exact: true })).toBeVisible()
  await expect(admin.getByText('Gestionar atletas', { exact: true })).toBeVisible()
})

test('TR-11 the Términos, Gestionar atletas and Roster de atletas items go nowhere and their API routes answer 404', async ({ page, baseURL }) => {
  only('D')
  await staffIn(page, baseURL, ADMIN)
  await page.goto('/staff')
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  await expect(menu.getByText('Gestionar atletas', { exact: true })).toBeVisible()
  const url = page.url()
  const requests = countRequests(page, 'GET', '/api/')
  for (const item of ['Términos', 'Gestionar atletas', 'Roster de atletas']) {
    await expect(menu.getByRole('link', { name: item, exact: true })).toHaveCount(0)
    await menu.getByText(item, { exact: true }).click()
    expect(page.url(), item).toBe(url)
  }
  await page.waitForTimeout(500)
  expect(requests).toEqual([])
  for (const path of ['/api/staff/terms', '/api/staff/roster']) {
    const answer = await rawApi(page.request, 'get', path, baseURL!)
    expect(answer.status, path).toBe(404)
    expect(answer.body?.error?.code, path).toBe('not_found')
  }
})

// ============================================================================================== phone: student number lookup

const LOOKUP_FIELD = (page: Page) => page.getByLabel(/Número de (estudiante o autorización|estudiante|autorización)/)

async function openIdentify(page: Page) {
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(LOOKUP_FIELD(page)).toBeVisible()
}

async function lookup(page: Page, number: string) {
  await openIdentify(page)
  await LOOKUP_FIELD(page).fill(number)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
}

const NOT_ON_ROSTER = 'No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.'

async function expectNotOnRoster(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu número' })).toBeVisible()
  await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription(NOT_ON_ROSTER)
}

test('TR-12 the lookup answers on the roster, not on the roster, claimed and wrong length', async ({ page }) => {
  only('AI')
  flushCache()
  const free = createAthlete()

  await lookup(page, free.number)
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(page.getByText(NOT_ON_ROSTER, { exact: true })).toHaveCount(0)

  await lookup(page, '900000000')
  await expectNotOnRoster(page)

  await lookup(page, '802000003')
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu registro' })).toBeVisible()
  await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription('Este registro no está disponible para crear otra cuenta.')

  await lookup(page, '80200000')
  await expect(page.getByLabel('Número de autorización')).toHaveAccessibleDescription('No pudimos validar este número. Revisa tu recibo o llama al 265-3866.')
  await expect(page).toHaveURL(/\/register\/identify$/)
})

test('TR-13 a removed roster record answers like a number that is not on the roster', async ({ page }) => {
  only('AI')
  flushCache()
  const removed = createAthlete({ removed: true })
  await lookup(page, removed.number)
  await expectNotOnRoster(page)
})

// ==================================================================== phone: accounts whose access is not current (seed)

test('TR-14 a withdrawn athlete sees no active access and the athlete refusal on Check In', async ({ page, baseURL }) => {
  only('AI')
  await signedInPhone(page, baseURL, { email: 'atleta-removido@example.com', password: 'password' })
  await openAccount(page)
  await expect(noAccess(page)).toBeVisible()
  await expect(badge(page)).toHaveText('Atleta')
  await holdAndExpectPanel(page, ATHLETE_PANEL)
})

test('TR-15 an athlete withdrawn while signed in loses the access caption within one refetch and is refused on Check In', async ({ page, baseURL }) => {
  only('A')
  const athlete = await fresh(page, baseURL, { kind: 'athlete' })
  await openAccount(page)
  await expect(page.getByText('Acceso vigente · Término actual', { exact: true })).toBeVisible()
  withdraw(athlete)
  await refocus(page)
  await expect(noAccess(page)).toBeVisible()
  await expect(badge(page)).toHaveText('Atleta')
  await holdAndExpectPanel(page, ATHLETE_PANEL)
})

test('TR-16 a withdrawn athlete keeps the open visit until it ends, then is refused on the next Check In', async ({ page, baseURL, playwright }) => {
  only('AI')
  const athlete = await fresh(page, baseURL, { kind: 'athlete' })
  await openCheckIn(page)
  await hold(page)
  await expectGymId(page)
  const visitId = (await api(page.request, 'get', '/api/user/check-in', baseURL!)).body.session.id as number
  withdraw(athlete)

  await page.goto('/check-in')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  await page.goto('/gym')
  const count = page.locator('.gym-occupancy__count strong')
  await expect(count).toHaveText(String(occupancyNow()))
  expect(occupancyNow()).toBeGreaterThanOrEqual(1)

  await deskCheckOut(playwright.request, baseURL, visitId)
  await page.goto('/check-in')
  await expect(page.locator('.check-in-lead')).toHaveText('Tu visita ha terminado')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.locator(HOLD)).toBeVisible()
  await hold(page)
  await expectPanel(page, ATHLETE_PANEL)
})

test('TR-17 a reinstated athlete gets the access caption back and passes the authorization on Check In', async ({ page, baseURL }) => {
  only('AI')
  const athlete = await fresh(page, baseURL, { kind: 'athlete' })
  withdraw(athlete)
  await openAccount(page)
  await expect(noAccess(page)).toBeVisible()
  reinstate(athlete)
  await refocus(page)
  await expect(page.getByText('Acceso vigente · Término actual', { exact: true })).toBeVisible()
  await openCheckIn(page)
  await hold(page)
  await expectGymId(page)
})

test('TR-18 the database refuses to reactivate an authorization when the athlete has another active one in the term', async () => {
  only('A')
  const athlete = createMember({ kind: 'athlete', authorization: 'revoked' })
  addSecondAuthorization(athlete)
  expect(tryReactivate(athlete)).toBe('23505')
})

test('TR-19 an authorization of an ended term gives Sin autorización activa and the member refusal', async ({ page, baseURL }) => {
  only('AI')
  await signedInPhone(page, baseURL, { email: 'pago-vencido@example.com', password: 'password' })
  await openAccount(page)
  await expect(noAccess(page)).toBeVisible()
  await expect(badge(page)).toHaveText('Miembro')
  await holdAndExpectPanel(page, MEMBER_PANEL)
})

test('TR-20 an account that never had an authorization has no badge, the Soy atleta pill and the member refusal', async ({ page, baseURL }) => {
  only('AI')
  await signedInPhone(page, baseURL, { email: 'sin-autorizacion@example.com', password: 'password' })
  await openAccount(page)
  await expect(noAccess(page)).toBeVisible()
  await expect(badge(page)).toHaveCount(0)
  await expect(page.getByText('Soy atleta', { exact: true })).toBeVisible()
  await holdAndExpectPanel(page, MEMBER_PANEL)
})

// ================================================================================================= cross-device: term end

test('TR-21 a visit that began on the last evening of a term closes at the term end and leaves the occupancy', async ({ page, baseURL }) => {
  only('A')
  const member = await fresh(page, baseURL)
  await openCheckIn(page)
  await hold(page)
  await expectGymId(page)
  await page.goto('/gym')
  const count = page.locator('.gym-occupancy__count strong')
  const before = occupancyNow()
  expect(before).toBeGreaterThanOrEqual(1)
  await expect(count).toHaveText(String(before))

  await withTerms({ [CURRENT]: { ends_on: addDays(todayPR(), -1) } }, async () => {
    startVisitLastNight(member)
    await page.goto('/check-in')
    await expect(page.locator('.check-in-lead')).toHaveText('Tu visita ha terminado')
    await expect(page.locator('.check-in-caption')).toHaveText('La sesión terminó por cierre del gimnasio.')
    await expect(page.locator('.check-in-id__time').nth(0)).toHaveText(/^11:30 p\. m\.$/)
    await expect(page.locator('.check-in-id__time').nth(1)).toHaveText(/^12:00 a\. m\.$/)
    await page.goto('/gym')
    expect(occupancyNow()).toBe(before - 1)
    await expect(count).toHaveText(String(before - 1))
  })
})
