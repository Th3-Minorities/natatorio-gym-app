import { expect, test, type Browser, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ADMIN, api, fakeLocation, INSIDE, STAFF } from '../e2e/flows/flow.ts'
import { countRequests, createMember, flushCache, rawApi, tinkerJson, resetSchedule, signInApi, dropMarkedSlots, type MemberOptions } from './setup.ts'
import { deskCheckOut } from './setup-end-of-visit.ts'
import { occupancyNow } from './setup-occupancy.ts'
import { claim, createAthlete } from './setup-athlete.ts'
import { unique } from './setup-sign-in.ts'
import {
  addAthleteAuthorization, authorizationsOf, addBulkRoster, allRoster, auditOf, authorizationStatus, call, docxTexts, dropAuthorizationsIn, dropBulkRoster, dropRosterNamed, freeNumber, grantInTerm,
  pdfPages, rosterById, rosterByNumber, rosterCounts, rosterOf, termIdOf,
  addDays, addSecondAuthorization, chipLabel, CURRENT, PAST, dropRoster, dropTermsNamed, insertRoster, insertTerm, NEXT, reinstate, removedSeedNumber,
  renameTerm, restoreTerms, setTerms, snapshotTerms, startVisitLastNight, todayPR, tryReactivate, withdraw, type TermRow,
} from './setup-terms.ts'

// #152 path tests for flow 9, Terms and athlete roster. One test per path: TR-01 to TR-21 from the seed and
// the phone, TR-Nxx for the Administrator and Staff screens A-04, A-05 and S-05. Phone and mixed rows live in
// cross-device-roster.spec.ts (TR-Xxx). Term rows move the dates of the current term for the whole stack: this file runs alone on its
// own stack with one worker, and every change is restored in finally (and again after the last test).

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
/** Limits a row to the devices listed (D desktop, A Android, I iPhone, T terminal: run once, on desktop). */
function only(devices: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devices.includes(device), `this path runs on ${devices}`)
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

test('TR-11 the Términos, Gestionar atletas and Roster de atletas items are links to A-04, A-05 and S-05, and their API routes answer the Administrator', async ({ page, baseURL }) => {
  only('D')
  await staffIn(page, baseURL, ADMIN)
  await page.goto('/staff')
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  const screens: [string, string, string][] = [
    ['Términos', '/staff/terminos', 'Términos'],
    ['Gestionar atletas', '/staff/atletas', 'Roster de atletas'],
    ['Roster de atletas', '/staff/roster', 'Roster de atletas'],
  ]
  for (const [item, path, title] of screens) {
    await menu.getByRole('link', { name: item, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(menu.getByRole('link', { name: item, exact: true })).toHaveAttribute('aria-current', 'page')
  }
  for (const path of ['/api/staff/terms', '/api/staff/roster']) {
    const answer = await rawApi(page.request, 'get', path, baseURL!)
    expect(answer.status, path).toBe(200)
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

  // A claimed record whose roster email has an account sends the person to sign in (E-70, #161); one whose email has none is refused.
  const email = tinkerJson<string>(`echo json_encode(\\App\\Models\\RosterRecord::where('student_number', '802000002')->value('institutional_email'));`)
  await lookup(page, '802000002')
  await expect(page.getByRole('heading', { level: 1, name: 'Ya tienes una cuenta' })).toBeVisible()
  await expect(page.getByText('Inicia sesión para añadir esta autorización a tu cuenta.', { exact: true })).toBeVisible()
  await expect(page.getByText(`${email[0]}***${email.split('@')[0].slice(-1)}@${email.split('@')[1]}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')

  const claimedElsewhere = createAthlete()
  claim(claimedElsewhere)
  await lookup(page, claimedElsewhere.number)
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


// ================================================================================================ A-04 Términos (screen)

/** The new rows run on the desktop project only: the dashboard is desktop only (E-171). */
function desktopOnly() {
  test.skip(test.info().project.name !== 'desktop', 'the dashboard is desktop only (E-171): project desktop')
}

const farYear = (n: number) => 2200 + n
const termDialog = (page: Page) => page.getByRole('dialog')
const savedCard = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text })
const termRow = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
const allTermNames = (): string[] => snapshotTerms().map((term) => term.name)

async function openTerms(page: Page, baseURL: string | undefined, who: { email: string; password: string } = ADMIN) {
  await staffIn(page, baseURL, who)
  await page.goto('/staff/terminos')
  await expect(page.getByRole('heading', { level: 1, name: 'Términos' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Corrige un término editando sus fechas' })).toBeVisible()
}

async function startTerm(page: Page) {
  await page.getByRole('button', { name: 'Crear término' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Crear término' })).toBeVisible()
}

async function typeTerm(page: Page, values: { name?: string; from?: string; to?: string }) {
  const dialog = termDialog(page)
  if (values.name !== undefined) await dialog.getByLabel('Nombre del término').fill(values.name)
  if (values.from !== undefined) await dialog.getByLabel('Fecha de inicio').fill(values.from)
  if (values.to !== undefined) await dialog.getByLabel('Fecha de fin').fill(values.to)
}

const saveNewTerm = (page: Page) => termDialog(page).getByRole('button', { name: 'Guardar término' }).click()

/** Creates a term on A-04 and waits for its confirmation. */
async function createTermOnScreen(page: Page, name: string, from: string, to: string) {
  await startTerm(page)
  await typeTerm(page, { name, from, to })
  await saveNewTerm(page)
  await expect(savedCard(page, `${name} se guardó.`)).toBeVisible()
  await expect(termDialog(page)).toHaveCount(0)
}

async function expectOverlapModal(page: Page, otherName: string) {
  const dialog = termDialog(page)
  await expect(dialog.getByRole('heading', { name: 'Las fechas coinciden con otro término' })).toBeVisible()
  await expect(dialog.getByText(`Este período se solapa con ${otherName} (`, { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(termDialog(page)).toHaveCount(0)
}

/** The audit entries of a term by name. */
function termAudit(name: string) {
  const id = termIdOf(name)
  expect(id, `term ${name} exists`).not.toBeNull()
  return auditOf('academic_terms', id!)
}

test('TR-N01 an Administrator adds a term on A-04: it appears as Próximo, a confirmation shows and one audit entry holds the dates', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(1)
  const name = `p152-n01-${unique()}`
  try {
    await openTerms(page, baseURL)
    await createTermOnScreen(page, name, `${y}-12-11`, `${y}-12-18`)
    const row = termRow(page, name)
    await expect(row).toContainText('Próximo')
    await expect(row).toContainText(`11 dic ${y}`)
    await expect(row).toContainText(`18 dic ${y}`)
    expect(termAudit(name)).toEqual([{ action: 'term.create', before: null, after: { name, starts_on: `${y}-12-11`, ends_on: `${y}-12-18` }, reason: null }])
  } finally { dropTermsNamed('p152-n01') }
})

test('TR-N02 term name boundaries: 50 characters save, a 51st cannot be typed, 51 sent to the API and an empty name are refused', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(2)
  const fifty = 'p152-n02-'.padEnd(50, 'x')
  expect(fifty).toHaveLength(50)
  try {
    await openTerms(page, baseURL)
    await startTerm(page)
    const name = termDialog(page).getByLabel('Nombre del término')
    await name.pressSequentially(`${fifty}y`)
    await expect(name).toHaveValue(fifty)
    await typeTerm(page, { from: `${y}-12-11`, to: `${y}-12-18` })
    await saveNewTerm(page)
    await expect(savedCard(page, `${fifty} se guardó.`)).toBeVisible()
    await expect(termRow(page, fifty)).toBeVisible()

    const tooLong = await call(page.request, 'post', '/api/staff/terms', baseURL!, { name: `${fifty}y`, starts_on: `${y + 1}-12-11`, ends_on: `${y + 1}-12-18` })
    expect(tooLong.status).toBe(422)
    expect(tooLong.body?.error?.code).toBe('validation_failed')
    expect(JSON.stringify(tooLong.body)).toContain('name')
    expect(allTermNames().filter((term) => term.startsWith('p152-n02-'))).toHaveLength(1)

    await startTerm(page)
    await typeTerm(page, { name: '', from: `${y + 1}-12-11`, to: `${y + 1}-12-18` })
    await saveNewTerm(page)
    await expect(termDialog(page).getByText('Este campo es obligatorio.', { exact: true })).toBeVisible()
    await expect(termDialog(page).getByLabel('Nombre del término')).toBeFocused()
    expect(allTermNames().filter((term) => term.startsWith('p152-n02-'))).toHaveLength(1)
  } finally { dropTermsNamed('p152-n02') }
})

test('TR-N03 term date boundaries: a one-day term saves, a start after the end, empty dates and 31 February are refused', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(3)
  try {
    await openTerms(page, baseURL)
    await createTermOnScreen(page, 'p152-n03-one', `${y}-12-05`, `${y}-12-05`)
    await expect(termRow(page, 'p152-n03-one')).toContainText(`5 dic ${y}`)

    await startTerm(page)
    await typeTerm(page, { name: 'p152-n03-rev', from: `${y + 1}-12-20`, to: `${y + 1}-12-10` })
    await saveNewTerm(page)
    const dialog = termDialog(page)
    await expect(dialog.getByRole('heading', { name: 'Revisa el orden de las fechas' })).toBeVisible()
    await expect(dialog.getByText('La fecha de inicio debe ser anterior a la fecha de fin.', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Corregir fechas' }).click()
    await expect(dialog.getByLabel('Fecha de inicio')).toBeFocused()
    expect(allTermNames()).not.toContain('p152-n03-rev')
    await typeTerm(page, { from: `${y + 1}-12-10`, to: `${y + 1}-12-20` })
    await saveNewTerm(page)
    await expect(savedCard(page, 'p152-n03-rev se guardó.')).toBeVisible()

    await startTerm(page)
    await typeTerm(page, { name: 'p152-n03-empty' })
    await saveNewTerm(page)
    await expect(termDialog(page).getByText('Este campo es obligatorio.', { exact: true })).toHaveCount(2)
    await page.keyboard.press('Escape')

    const impossible = await call(page.request, 'post', '/api/staff/terms', baseURL!, { name: 'p152-n03-feb', starts_on: `${y + 2}-02-31`, ends_on: `${y + 2}-03-10` })
    expect(impossible.status).toBe(422)
    expect(JSON.stringify(impossible.body)).toContain('starts_on')
    expect(allTermNames().filter((term) => term.startsWith('p152-n03-')).sort()).toEqual(['p152-n03-one', 'p152-n03-rev'])
  } finally { dropTermsNamed('p152-n03') }
})

test('TR-N04 term overlap boundaries: a one-day overlap, a term inside another and an identical one are refused with the other term named; adjacent and gap save', async ({ page, baseURL }) => {
  desktopOnly()
  const terms = snapshotTerms()
  const next = find(terms, NEXT)
  const current = find(terms, CURRENT)
  const last = terms.map((term) => term.ends_on).sort().at(-1)!
  expect(last).toBe(next.ends_on)
  try {
    await openTerms(page, baseURL)
    const attempt = async (name: string, from: string, to: string) => { await startTerm(page); await typeTerm(page, { name, from, to }); await saveNewTerm(page) }

    await attempt('p152-n04-overlap', last, addDays(last, 10))
    await expectOverlapModal(page, NEXT)
    await attempt('p152-n04-inside', addDays(current.starts_on, 10), addDays(current.starts_on, 20))
    await expectOverlapModal(page, CURRENT)
    await attempt('p152-n04-identical', next.starts_on, next.ends_on)
    await expectOverlapModal(page, NEXT)
    expect(allTermNames().filter((term) => term.startsWith('p152-n04-'))).toEqual([])

    await createTermOnScreen(page, 'p152-n04-adjacent', addDays(last, 1), addDays(last, 10))
    await createTermOnScreen(page, 'p152-n04-gap', addDays(last, 30), addDays(last, 40))
    expect(allTermNames().filter((term) => term.startsWith('p152-n04-')).sort()).toEqual(['p152-n04-adjacent', 'p152-n04-gap'])
  } finally { dropTermsNamed('p152-n04') }
})

test('TR-N05 shortening a term end is never blocked: the row and the audit entry change, and its authorizations stay active in the term', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(5)
  const name = 'p152-n05'
  const member = createMember({ authorization: 'none' })
  try {
    expect(insertTerm(name, `${y}-12-11`, `${y}-12-18`).state).toBe('saved')
    grantInTerm(member, name)
    await openTerms(page, baseURL)
    await termRow(page, name).getByRole('button', { name: `Editar, ${name}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar término' })
    await expect(dialog.getByLabel('Nombre del término')).toHaveValue(name)
    await dialog.getByLabel('Fecha de fin').fill(`${y}-12-11`)
    await expect(dialog.getByText(`Las autorizaciones terminan el 11 dic ${y}.`, { exact: false })).toBeVisible()
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(savedCard(page, `${name} se guardó.`)).toBeVisible()
    await expect(termRow(page, name)).toContainText(`11 dic ${y}`)
    expect(termAudit(name)).toEqual([{ action: 'term.update', before: { ends_on: `${y}-12-18` }, after: { ends_on: `${y}-12-11` }, reason: null }])
    expect(authorizationStatus(member)).toBe('active')
  } finally {
    dropAuthorizationsIn(name)
    dropTermsNamed('p152-n05')
  }
})

test('TR-N06 editing a term into the dates of another is refused naming the other term; the row keeps its dates', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(6)
  try {
    expect(insertTerm('p152-n06a', `${y}-12-11`, `${y}-12-18`).state).toBe('saved')
    expect(insertTerm('p152-n06b', `${y}-12-25`, `${y}-12-28`).state).toBe('saved')
    await openTerms(page, baseURL)
    await termRow(page, 'p152-n06a').getByRole('button', { name: 'Editar, p152-n06a' }).click()
    await termDialog(page).getByLabel('Fecha de fin').fill(`${y}-12-26`)
    await termDialog(page).getByRole('button', { name: 'Guardar cambios' }).click()
    await expectOverlapModal(page, 'p152-n06b')
    await expect(termRow(page, 'p152-n06a')).toContainText(`18 dic ${y}`)
    expect(snapshotTerms().find((term) => term.name === 'p152-n06a')?.ends_on).toBe(`${y}-12-18`)
    expect(termAudit('p152-n06a')).toEqual([])
  } finally { dropTermsNamed('p152-n06') }
})

test('TR-N07 terms are for Administrators: Staff get 403 forbidden on the API and no screen, a signed-out call gets 401', async ({ page, baseURL, playwright }) => {
  desktopOnly()
  const signedOut = await playwright.request.newContext({ baseURL })
  try {
    const before = allTermNames()
    expect((await call(signedOut, 'get', '/api/staff/terms', baseURL!)).status).toBe(401)
    await staffIn(page, baseURL, STAFF)
    const requests = countRequests(page, 'GET', '/api/staff/terms')
    await page.goto('/staff/terminos')
    await expect(page.getByRole('navigation', { name: 'Menú del dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Términos' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Crear término' })).toHaveCount(0)
    expect(requests).toEqual([])
    for (const [method, path, data] of [
      ['get', '/api/staff/terms'],
      ['post', '/api/staff/terms', { name: 'p152-n07', starts_on: '2290-12-11', ends_on: '2290-12-18' }],
      ['patch', `/api/staff/terms/${termIdOf(CURRENT)}`, { name: 'p152-n07', starts_on: '2290-12-11', ends_on: '2290-12-18' }],
    ] as const) {
      const answer = await call(page.request, method, path, baseURL!, data)
      expect(answer.status, `${method} ${path}`).toBe(403)
      expect(answer.body?.error?.code).toBe('forbidden')
    }
    expect(allTermNames()).toEqual(before)
  } finally { await signedOut.dispose() }
})

test('TR-N08 terms are never deleted: A-04 has no delete action and DELETE on a term is refused', async ({ page, baseURL }) => {
  desktopOnly()
  await openTerms(page, baseURL)
  await expect(page.getByRole('button', { name: /eliminar|borrar|quitar|delete/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /eliminar|borrar|quitar|delete/i })).toHaveCount(0)
  const id = termIdOf(NEXT)!
  const answer = await call(page.request, 'delete', `/api/staff/terms/${id}`, baseURL!)
  expect([404, 405], `DELETE answered ${answer.status}`).toContain(answer.status)
  expect(termIdOf(NEXT)).toBe(id)
})

test('TR-N09 with no term today A-04, A-05 and A-15 each show the Sin término activo notice with its reason', async ({ page, baseURL }) => {
  desktopOnly()
  await withTerms({ [CURRENT]: { ends_on: addDays(todayPR(), -1) } }, async () => {
    await openTerms(page, baseURL)
    const notice = page.getByRole('heading', { level: 2, name: 'No hay un término activo hoy' })
    await expect(notice).toBeVisible()
    await expect(page.getByText('No se pueden crear autorizaciones nuevas. Crea o edita un término para cubrir la fecha de hoy.', { exact: true })).toBeVisible()
    await expect(page.locator('.team-chip').filter({ hasText: 'Sin término activo' })).toBeVisible()

    await page.goto('/staff/atletas')
    await expect(page.getByRole('heading', { level: 1, name: 'Roster de atletas' })).toBeVisible()
    await expect(notice).toBeVisible()
    await expect(page.getByText('No se puede crear una autorización nueva. Revisa las fechas en Términos.', { exact: true })).toBeVisible()

    await page.goto('/staff/equipo')
    await expectNoTermBanner(page)
  })
})

test('TR-N30 the terms list marks each term Activo, Próximo or Finalizado by today, hides finished ones behind a toggle and names the active one', async ({ page, baseURL }) => {
  desktopOnly()
  await openTerms(page, baseURL)
  const terms = snapshotTerms()
  const today = todayPR()
  const label = (term: TermRow) => (term.ends_on < today ? 'Finalizado' : term.starts_on > today ? 'Próximo' : 'Activo')
  const active = terms.find((term) => label(term) === 'Activo')!
  await expect(page.locator('.terms-context')).toContainText('Término activo')
  await expect(page.locator('.terms-context')).toContainText(active.name)
  const table = page.getByRole('table', { name: 'Término actual' })
  await expect(table.getByRole('row', { name: new RegExp(CURRENT) })).toContainText('Activo')
  await expect(table.getByRole('row', { name: new RegExp(NEXT) })).toContainText('Próximo')
  await expect(page.getByRole('row', { name: new RegExp(PAST) })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver términos pasados' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Términos pasados' })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(PAST) })).toContainText('Finalizado')
  await page.getByRole('button', { name: 'Ocultar términos pasados' }).click()
  await expect(page.getByRole('row', { name: new RegExp(PAST) })).toHaveCount(0)
  const listed = (await call(page.request, 'get', '/api/staff/terms', baseURL!)).body.terms as { name: string; status: string }[]
  const code = { Activo: 'active', Próximo: 'upcoming', Finalizado: 'past' } as const
  for (const term of terms) expect(listed.find((row) => row.name === term.name)?.status, term.name).toBe(code[label(term)])
})


// ============================================================================================ A-05 and S-05 (screens)

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const athleteRow = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(escapeRe(name)) })
const rosterSearch = (page: Page) => page.getByRole('searchbox', { name: 'Buscar atleta' })

async function openRoster(page: Page, baseURL: string | undefined, who: { email: string; password: string } = ADMIN) {
  await staffIn(page, baseURL, who)
  await page.goto('/staff/atletas')
  await expect(page.getByRole('heading', { level: 1, name: 'Roster de atletas' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Números de estudiante completos' })).toBeVisible()
}

/** Types in the search and waits for the row (the search waits 300 ms after the last key). */
async function findAthlete(page: Page, text: string, name: string) {
  await rosterSearch(page).fill(text)
  await expect(athleteRow(page, name)).toBeVisible()
}

async function startAthlete(page: Page) {
  await page.getByRole('button', { name: 'Añadir atleta' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function typeAthlete(page: Page, values: { sport?: string; name?: string; number?: string; email?: string }) {
  const dialog = page.getByRole('dialog')
  if (values.sport !== undefined) await dialog.getByLabel('Deporte').fill(values.sport)
  if (values.name !== undefined) await dialog.getByLabel('Nombre completo').fill(values.name)
  if (values.number !== undefined) await dialog.getByLabel('Número de estudiante').fill(values.number)
  if (values.email !== undefined) await dialog.getByLabel('Correo institucional').fill(values.email)
}

const saveAndNext = (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Guardar y añadir otro' }).click()

function rosterAudit(id: number) { return auditOf('roster_records', id) }

/** A throwaway roster record that has no account. */
function dropByNumber(...numbers: string[]) {
  for (const number of numbers) {
    const row = rosterByNumber(number)
    if (row) dropRoster(row.id)
  }
}

/** Withdraws through the API, as the Retirar button does, for a test that starts from a withdrawn athlete. */
async function withdrawByApi(page: Page, baseURL: string | undefined, id: number) {
  await call(page.request, 'post', `/api/staff/roster/${id}/withdraw`, baseURL!)
}

test('TR-N10 the quick form keeps the sport and empties the rest after each save, shows the sport large, and writes one audit entry per athlete', async ({ page, baseURL }) => {
  desktopOnly()
  const sport = `Voleibol ${unique()}`.slice(0, 50)
  const [first, second] = [freeNumber(), freeNumber()]
  try {
    await openRoster(page, baseURL)
    await startAthlete(page)
    const dialog = page.getByRole('dialog')
    await typeAthlete(page, { sport })
    await expect(dialog.getByRole('heading', { name: `Añadiendo atletas de: ${sport}` })).toBeVisible()
    for (const [index, number] of [first, second].entries()) {
      const name = `Atleta N10 ${index}`
      await typeAthlete(page, { name, number, email: `p152-n10-${number}@upr.example` })
      await saveAndNext(page)
      await expect(dialog.getByText(`${name} se guardó. Añade el próximo atleta.`, { exact: true })).toBeVisible()
      await expect(dialog.getByText('Atleta guardado', { exact: true })).toBeVisible()
      await expect(dialog.getByLabel('Deporte')).toHaveValue(sport)
      for (const label of ['Nombre completo', 'Número de estudiante', 'Correo institucional']) await expect(dialog.getByLabel(label)).toHaveValue('')
      await expect(dialog.getByLabel('Nombre completo')).toBeFocused()
      await expect(dialog.getByRole('heading', { name: `Añadiendo atletas de: ${sport}` })).toBeVisible()
    }
    await dialog.getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    for (const [index, number] of [first, second].entries()) {
      const record = rosterByNumber(number)!
      expect(rosterAudit(record.id)).toEqual([{ action: 'roster.add', before: null, after: { name: `Atleta N10 ${index}`, sport, student_number: number, institutional_email: `p152-n10-${number}@upr.example` }, reason: null }])
    }
  } finally { dropByNumber(first, second) }
})

test('TR-N11 roster field boundaries: 9 digits save, 8 or 10 digits, letters, a bad email, empty fields and over-long text are refused', async ({ page, baseURL }) => {
  desktopOnly()
  await openRoster(page, baseURL)
  const valid = () => ({ name: 'p152n11 ok', sport: 'Voleibol', student_number: `7${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, institutional_email: `p152-n11-${unique()}@upr.example` })
  const post = (body: object) => call(page.request, 'post', '/api/staff/roster', baseURL!, body)
  const refused = async (label: string, body: object, field: string) => {
    const answer = await post(body)
    expect(answer.status, label).toBe(422)
    expect(answer.body?.error?.code, label).toBe('validation_failed')
    expect(Object.keys(answer.body?.error?.details ?? {}), label).toContain(field)
  }
  const made: string[] = []
  const accepted = async (label: string, body: { student_number: string; name?: string; sport?: string }) => {
    const answer = await post(body)
    expect(answer.status, `${label}: ${JSON.stringify(answer.body)}`).toBe(201)
    made.push(body.student_number)
  }
  try {
    await refused('8 digits', { ...valid(), student_number: '12345678' }, 'student_number')
    await refused('10 digits', { ...valid(), student_number: '1234567890' }, 'student_number')
    await refused('letters', { ...valid(), student_number: 'abcdefghi' }, 'student_number')
    await refused('8 digits and a letter', { ...valid(), student_number: '12345678a' }, 'student_number')
    await refused('email without @', { ...valid(), institutional_email: 'sin-arroba' }, 'institutional_email')
    await refused('256 character name', { ...valid(), name: `p152n11${'x'.repeat(249)}` }, 'name')
    await refused('51 character sport', { ...valid(), sport: 'x'.repeat(51) }, 'sport')
    for (const field of ['name', 'sport', 'student_number', 'institutional_email']) await refused(`empty ${field}`, { ...valid(), [field]: '' }, field)
    await accepted('9 digits', valid())
    await accepted('255 character name', { ...valid(), name: `p152n11${'x'.repeat(248)}` })
    await accepted('50 character sport', { ...valid(), sport: 'x'.repeat(50) })
    expect(made).toHaveLength(3)

    await startAthlete(page)
    const dialog = page.getByRole('dialog')
    await typeAthlete(page, { sport: 'Voleibol', name: 'p152n11 ui', number: '12345678', email: 'sin-arroba' })
    await saveAndNext(page)
    await expect(dialog.getByText('Escribe el número completo, solo con dígitos.', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Escribe un correo electrónico válido.', { exact: true })).toBeVisible()
    await typeAthlete(page, { sport: '', name: '', number: '', email: '' })
    await saveAndNext(page)
    await expect(dialog.getByText('Este campo es obligatorio.', { exact: true })).toHaveCount(4)
    await typeAthlete(page, { number: '1234567890' })
    await expect(dialog.getByLabel('Número de estudiante')).toHaveValue('123456789')
    expect(rosterByNumber('12345678')).toBeNull()
  } finally {
    dropByNumber(...made)
    dropRosterNamed('p152n11')
  }
})

test('TR-N12 a repeated student number, even one of a withdrawn athlete, is refused naming the athlete who has it', async ({ page, baseURL }) => {
  desktopOnly()
  const before = rosterCounts()
  const taken = [rosterByNumber('802000001')!, rosterByNumber(removedSeedNumber())!]
  expect(taken[1].removed).toBe(true)
  await openRoster(page, baseURL)
  await startAthlete(page)
  const dialog = page.getByRole('dialog')
  for (const owner of taken) {
    await typeAthlete(page, { sport: 'Voleibol', name: 'p152n12 otra', number: owner.student_number, email: `p152-n12-${unique()}@upr.example` })
    await saveAndNext(page)
    await expect(dialog.getByRole('heading', { name: 'Este número ya está en el roster' })).toBeVisible()
    await expect(dialog.getByText(`${owner.student_number} pertenece a ${owner.name}. Revisa el número de estudiante antes de guardar.`, { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Corregir número' }).click()
    await expect(dialog.getByLabel('Número de estudiante')).toBeFocused()
  }
  expect(rosterCounts()).toEqual(before)
})

test('TR-N13 two Administrators adding the same student number at once: one is saved, the other is refused', async ({ playwright, baseURL }) => {
  desktopOnly()
  const [one, two] = await Promise.all([1, 2].map(async () => {
    const request = await playwright.request.newContext({ baseURL })
    await api(request, 'post', '/api/staff/sign-in', baseURL!, { email: ADMIN.email, password: ADMIN.password })
    return request
  }))
  const numbers: string[] = []
  try {
    for (let round = 0; round < 3; round++) {
      const number = freeNumber()
      numbers.push(number)
      const body = (who: number) => ({ name: `p152n13 ${who}`, sport: 'Voleibol', student_number: number, institutional_email: `p152-n13-${who}-${number}@upr.example` })
      const [a, b] = await Promise.all([call(one, 'post', '/api/staff/roster', baseURL!, body(1)), call(two, 'post', '/api/staff/roster', baseURL!, body(2))])
      expect([a.status, b.status].sort(), `round ${round}`).toEqual([201, 422])
      const loser = a.status === 422 ? a : b
      expect(loser.body?.error?.code).toBe('roster_student_number_taken')
      expect(allRoster().filter((row) => row.student_number === number)).toHaveLength(1)
    }
  } finally {
    dropByNumber(...numbers)
    await one.dispose()
    await two.dispose()
  }
})

test('TR-N32 two Administrators saving overlapping terms at once: one is saved, the other is refused as an overlap', async ({ playwright, baseURL }) => {
  desktopOnly()
  const y = farYear(32)
  const [one, two] = await Promise.all([1, 2].map(async () => {
    const request = await playwright.request.newContext({ baseURL })
    await api(request, 'post', '/api/staff/sign-in', baseURL!, { email: ADMIN.email, password: ADMIN.password })
    return request
  }))
  try {
    const [a, b] = await Promise.all([
      call(one, 'post', '/api/staff/terms', baseURL!, { name: 'p152-n32-a', starts_on: `${y}-12-01`, ends_on: `${y}-12-20` }),
      call(two, 'post', '/api/staff/terms', baseURL!, { name: 'p152-n32-b', starts_on: `${y}-12-10`, ends_on: `${y}-12-30` }),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 422])
    expect((a.status === 422 ? a : b).body?.error?.code).toBe('term_overlap')
    expect(allTermNames().filter((term) => term.startsWith('p152-n32-'))).toHaveLength(1)
  } finally {
    dropTermsNamed('p152-n32')
    await one.dispose()
    await two.dispose()
  }
})

test('TR-N14 Staff see the roster read only on S-05: search by name and number, no email, no add, edit, remove or download, and 403 on every write', async ({ page, baseURL }) => {
  desktopOnly()
  const athlete = createMember({ kind: 'athlete' })
  const record = rosterOf(athlete)
  const withdrawnSeed = allRoster().find((row) => row.removed)!
  await staffIn(page, baseURL, STAFF)
  await page.goto('/staff/roster')
  await expect(page.getByRole('heading', { level: 1, name: 'Roster de atletas' })).toBeVisible()
  await expect(page.getByText('Solo lectura', { exact: true })).toBeVisible()
  await expect(page.getByText(`Un solo roster · ${rosterCounts().active} atletas`, { exact: true })).toBeVisible()
  for (const column of ['Nombre', 'Núm. de estudiante', 'Deporte', 'Acción']) await expect(page.getByRole('columnheader', { name: column })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Correo institucional' })).toHaveCount(0)

  const search = page.getByLabel('Buscar por nombre o número de estudiante')
  await search.fill(record.name.toLowerCase())
  await expect(page.getByRole('row', { name: new RegExp(escapeRe(record.name)) })).toContainText(record.student_number)
  await search.fill(record.student_number)
  await expect(page.getByRole('row', { name: new RegExp(escapeRe(record.name)) })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(record.institutional_email)
  await search.fill(withdrawnSeed.name)
  await expect(page.getByText(`No encontramos atletas para “${withdrawnSeed.name}”.`, { exact: true })).toBeVisible()
  for (const name of ['Añadir atleta', 'Editar', 'Retirar', 'Restituir', 'Descargar roster']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) }), name).toHaveCount(0)
  }
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  await expect(menu.getByText('Gestionar atletas', { exact: true })).toHaveCount(0)

  const writes = [
    ['post', '/api/staff/roster', { name: 'p152n14', sport: 'Voleibol', student_number: freeNumber(), institutional_email: 'p152-n14@upr.example' }],
    ['patch', `/api/staff/roster/${record.id}`, { name: 'p152n14', sport: 'Voleibol', student_number: record.student_number, institutional_email: record.institutional_email }],
    ['post', `/api/staff/roster/${record.id}/withdraw`, undefined],
    ['post', `/api/staff/roster/${withdrawnSeed.id}/reinstate`, { reason: 'Prueba de permisos 1' }],
    ['get', '/api/staff/roster/download?format=docx', undefined],
    ['get', '/api/staff/roster/download?format=pdf', undefined],
  ] as const
  for (const [method, path, data] of writes) {
    const answer = await call(page.request, method, path, baseURL!, data)
    expect(answer.status, `${method} ${path}`).toBe(403)
    expect(answer.body?.error?.code, `${method} ${path}`).toBe('forbidden')
  }
  expect(rosterById(record.id)).toEqual(record)
  const asked = await call(page.request, 'get', '/api/staff/roster?status=withdrawn', baseURL!)
  expect(asked.status).toBe(200)
  expect((asked.body.athletes as { status: string }[]).every((row) => row.status === 'active')).toBe(true)
  expect(JSON.stringify(asked.body)).not.toContain('institutional_email')

  await page.goto('/staff/atletas')
  await expect(page.getByRole('button', { name: 'Añadir atleta' })).toHaveCount(0)
})

test('TR-N34 the roster is for signed-in staff: a signed-out call gets 401 on the list and the download', async ({ baseURL, playwright }) => {
  desktopOnly()
  const signedOut = await playwright.request.newContext({ baseURL })
  try {
    for (const path of ['/api/staff/roster', '/api/staff/roster/download?format=docx']) {
      const answer = await call(signedOut, 'get', path, baseURL!)
      expect(answer.status, path).toBe(401)
    }
  } finally { await signedOut.dispose() }
})

test('TR-N15 an Administrator edits an athlete: the row and the audit entry hold the changes, and a repeated student number is refused', async ({ page, baseURL }) => {
  desktopOnly()
  const athlete = createAthlete()
  const before = rosterById(athlete.id)
  const email = `p152-n15-${athlete.number}@upr.example`
  try {
    await openRoster(page, baseURL)
    await findAthlete(page, athlete.number, athlete.name)
    await athleteRow(page, athlete.name).getByRole('button', { name: `Editar, ${athlete.name}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar atleta' })
    await expect(dialog.getByLabel('Nombre completo')).toHaveValue(athlete.name)
    await dialog.getByLabel('Deporte').fill('Natación p152')
    await dialog.getByLabel('Correo institucional').fill(email)
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(savedCard(page, `${athlete.name} se guardó.`)).toBeVisible()
    await expect(athleteRow(page, athlete.name)).toContainText('Natación p152')
    await expect(athleteRow(page, athlete.name)).toContainText(email)
    expect(rosterAudit(athlete.id)).toEqual([{
      action: 'roster.update', before: { sport: before.sport, institutional_email: before.institutional_email }, after: { sport: 'Natación p152', institutional_email: email }, reason: null,
    }])

    await athleteRow(page, athlete.name).getByRole('button', { name: `Editar, ${athlete.name}` }).click()
    await dialog.getByLabel('Número de estudiante').fill('802000001')
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Este número ya está en el roster' })).toBeVisible()
    expect(rosterById(athlete.id).student_number).toBe(athlete.number)
    expect(rosterAudit(athlete.id)).toHaveLength(1)
  } finally { dropRoster(athlete.id) }
})

test('TR-N16 withdrawing a record with no account: confirm text, confirmation card, hidden from the default list and from Staff, shown with Retirado, one audit entry', async ({ page, baseURL, playwright }) => {
  desktopOnly()
  const athlete = createAthlete()
  const staff = await playwright.request.newContext({ baseURL })
  try {
    await openRoster(page, baseURL)
    await findAthlete(page, athlete.number, athlete.name)
    await athleteRow(page, athlete.name).getByRole('button', { name: `Retirar, ${athlete.name}` }).click()
    const dialog = page.getByRole('dialog', { name: `¿Retirar a ${athlete.name}?` })
    await expect(dialog.getByText('El Gym ID deja de valer de inmediato. No podrá hacer nuevos Check In. Su sesión activa, si existe, permanece abierta hasta su cierre.', { exact: true })).toBeVisible()
    await expect(dialog.getByText(`${athlete.number} · ${rosterById(athlete.id).sport}`, { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Retirar atleta' }).click()
    await expect(savedCard(page, `${athlete.name} se retiró del roster.`)).toBeVisible()
    await expect(athleteRow(page, athlete.name)).toHaveCount(0)

    await page.getByRole('button', { name: 'Retirado' }).click()
    await expect(athleteRow(page, athlete.name)).toContainText('Retirado')
    await expect(athleteRow(page, athlete.name).getByRole('button', { name: `Restituir, ${athlete.name}` })).toBeVisible()
    expect(rosterById(athlete.id).removed).toBe(true)
    expect(rosterAudit(athlete.id)).toEqual([{ action: 'roster.withdraw', before: { status: 'active', authorizations: [] }, after: { status: 'withdrawn', authorizations: [] }, reason: null }])

    await api(staff, 'post', '/api/staff/sign-in', baseURL!, { email: STAFF.email, password: STAFF.password })
    const seen = await call(staff, 'get', `/api/staff/roster?search=${athlete.number}`, baseURL!)
    expect(seen.body.athletes).toEqual([])
  } finally {
    dropRoster(athlete.id)
    await staff.dispose()
  }
})

test('TR-N19 reinstate needs a reason of 10 characters: empty and 9 are refused with a counter, 10 is accepted and the audit entry holds it', async ({ page, baseURL }) => {
  desktopOnly()
  const member = createMember({ kind: 'athlete' })
  const record = rosterOf(member)
  await openRoster(page, baseURL)
  await withdrawByApi(page, baseURL, record.id)
  expect(authorizationStatus(member)).toBe('revoked')
  await page.reload()
  await page.getByRole('button', { name: 'Retirado' }).click()
  await page.getByRole('button', { name: 'Activo' }).click()
  await findAthlete(page, record.name, record.name)
  await athleteRow(page, record.name).getByRole('button', { name: `Restituir, ${record.name}` }).click()
  const dialog = page.getByRole('dialog', { name: `Restituir a ${record.name}` })
  await expect(dialog.getByText('Mínimo 10 caracteres.', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Restituir' }).click()
  const open = page.getByRole('dialog')
  const reason = open.getByLabel('Motivo obligatorio')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'El motivo debe tener al menos 10 caracteres' })).toBeVisible()
  await expect(open.getByText('0 / 10 caracteres mínimos', { exact: true })).toBeVisible()
  await reason.fill('Error 123')
  await reason.press('Enter')
  await expect(open.getByText('9 / 10 caracteres mínimos', { exact: true })).toBeVisible()
  expect(rosterById(record.id).removed).toBe(true)
  await reason.fill('Error 1234')
  await open.getByRole('button', { name: 'Restituir' }).click()
  await expect(savedCard(page, `${record.name} se restituyó.`)).toBeVisible()
  expect(rosterById(record.id).removed).toBe(false)
  expect(authorizationStatus(member)).toBe('active')
  const entries = rosterAudit(record.id)
  expect(entries.map((entry) => entry.action)).toEqual(['roster.withdraw', 'roster.reinstate'])
  expect(entries[1].reason).toBe('Error 1234')
})

test('TR-N20 reinstate is refused when the athlete already has an active authorization in the term, and the record stays withdrawn', async ({ page, baseURL }) => {
  desktopOnly()
  const member = createMember({ kind: 'athlete' })
  const record = rosterOf(member)
  await openRoster(page, baseURL)
  await withdrawByApi(page, baseURL, record.id)
  addSecondAuthorization(member)
  await page.reload()
  await page.getByRole('button', { name: 'Retirado' }).click()
  await page.getByRole('button', { name: 'Activo' }).click()
  await findAthlete(page, record.name, record.name)
  await athleteRow(page, record.name).getByRole('button', { name: `Restituir, ${record.name}` }).click()
  const dialog = page.getByRole('dialog', { name: `Restituir a ${record.name}` })
  await dialog.getByLabel('Motivo obligatorio').fill('Retiro por error en la prueba')
  await dialog.getByRole('button', { name: 'Restituir' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Ya tiene una autorización activa' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText(`${record.name} ya tiene una autorización activa en ${CURRENT}. No se puede restituir otra.`, { exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  expect(rosterById(record.id).removed).toBe(true)
  expect(rosterAudit(record.id).map((entry) => entry.action)).toEqual(['roster.withdraw'])
})

test('TR-N31 A-05 search finds by part of the name in any case or by part of the number, treats % as text, and the Activo and Retirado filters keep one on', async ({ page, baseURL }) => {
  desktopOnly()
  const rows = allRoster()
  const active = rows.find((row) => !row.removed && row.name.length > 6)!
  const withdrawn = rows.find((row) => row.removed)!
  await openRoster(page, baseURL)
  const count = rosterCounts().active
  await expect(page.getByText(`${count} ${count === 1 ? 'atleta activo' : 'atletas activos'}`, { exact: true })).toBeVisible()
  await findAthlete(page, active.name.slice(2, 6).toUpperCase(), active.name)
  await findAthlete(page, active.student_number.slice(0, 7), active.name)
  await rosterSearch(page).fill('%')
  await expect(page.getByText('No encontramos atletas para “%”.', { exact: true })).toBeVisible()
  await expect(page.getByText('Revisa el nombre o el número de estudiante.', { exact: true })).toBeVisible()
  await rosterSearch(page).fill('')

  await expect(athleteRow(page, withdrawn.name)).toHaveCount(0)
  await page.getByRole('button', { name: 'Retirado' }).click()
  await expect(athleteRow(page, withdrawn.name)).toContainText('Retirado')
  await expect(athleteRow(page, active.name)).toContainText('Activo')
  await page.getByRole('button', { name: 'Activo' }).click()
  await expect(athleteRow(page, active.name)).toHaveCount(0)
  await expect(athleteRow(page, withdrawn.name)).toBeVisible()
  await page.getByRole('button', { name: 'Retirado' }).click()
  await expect(page.getByRole('button', { name: 'Retirado' })).toHaveAttribute('aria-pressed', 'true')
  await expect(athleteRow(page, withdrawn.name)).toBeVisible()
})

test('TR-N33 A-05 and S-05 with no athletes say so, and a filter that hides every athlete says Sin resultados', async ({ page, baseURL }) => {
  desktopOnly()
  await staffIn(page, baseURL, ADMIN)
  await page.route(ROSTER_LIST, (route) => route.fulfill({ json: { athletes: [], active_count: 0, total_count: 0 } }))
  await page.goto('/staff/atletas')
  await expect(page.getByRole('heading', { level: 2, name: 'Aún no hay atletas' })).toBeVisible()
  await expect(page.getByText('Añade el primer atleta al roster.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Añadir atleta' })).toHaveCount(2)
  await page.goto('/staff/roster')
  await expect(page.getByRole('heading', { level: 2, name: 'Sin registros' })).toBeVisible()
  await expect(page.getByText('No hay registros en el roster de atletas.', { exact: true })).toBeVisible()
  await expect(page.getByText('Solo lectura', { exact: true })).toBeVisible()

  await page.unroute(ROSTER_LIST)
  await page.route(ROSTER_LIST, (route) => route.fulfill({ json: { athletes: [], active_count: 3, total_count: 3 } }))
  await page.goto('/staff/atletas')
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Aún no hay atletas' })).toHaveCount(0)
})


// ====================================================================================================== download, offline

const SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "7 nov 2026": the date of the "Generado el" line, in Puerto Rico. */
function generatedOn(): string {
  const [year, month, day] = todayPR().split('-')
  return `${Number(day)} ${SPANISH_MONTHS[Number(month) - 1]} ${year}`
}

/** Chooses the format on the download dialog, downloads and returns the saved file. */
async function downloadRoster(page: Page, format: 'docx' | 'pdf') {
  await page.getByRole('button', { name: 'Descargar roster' }).click()
  const dialog = page.getByRole('dialog', { name: 'Descargar roster' })
  await expect(dialog.getByRole('button', { name: 'Word (.docx)' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByText('Todos los atletas, activos y retirados, sin aplicar los filtros de la tabla.', { exact: false })).toBeVisible()
  if (format === 'pdf') {
    await dialog.getByRole('button', { name: 'PDF (.pdf)' }).click()
    await expect(dialog.getByRole('button', { name: 'PDF (.pdf)' })).toHaveAttribute('aria-pressed', 'true')
  }
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Descargar', exact: true }).click()])
  await expect(savedCard(page, 'Se descargó el roster.')).toBeVisible()
  expect(download.suggestedFilename()).toMatch(new RegExp(`^roster-atletas-\\d{4}-\\d{2}-\\d{2}\\.${format}$`))
  return download.path()
}

/** Every roster record appears, in the order name, sport, number, email, status. */
function expectWordRows(texts: string[], rows: ReturnType<typeof allRoster>) {
  const status = (row: { removed: boolean }) => (row.removed ? 'Retirado' : 'Activo')
  const found = new Set<string>()
  for (let i = 0; i + 4 < texts.length; i++) found.add(texts.slice(i, i + 5).join('|'))
  const missing = rows.filter((row) => !found.has([row.name, row.sport, row.student_number, row.institutional_email, status(row)].join('|')))
  expect(missing.map((row) => row.student_number), 'roster rows missing from the Word file').toEqual([])
}

test('TR-N22 the Word download holds the title, the date line, the counter and every athlete with name, sport, number, email and status, accents and symbols intact', async ({ page, baseURL }) => {
  desktopOnly()
  try {
    addBulkRoster(5)
    await openRoster(page, baseURL)
    const file = await downloadRoster(page, 'docx')
    const rows = allRoster()
    const texts = docxTexts(readFileSync(file!))
    expect(texts[0]).toBe('Roster de atletas')
    expect(texts).toContain(`Generado el ${generatedOn()}. Todos los atletas, activos y retirados. ${rows.length} atletas`)
    expect(texts.slice(texts.indexOf('Nombre'), texts.indexOf('Nombre') + 5)).toEqual(['Nombre', 'Deporte', 'Núm. estudiante', 'Correo institucional', 'Estado'])
    expectWordRows(texts, rows)
    expect(texts.some((text) => text.startsWith('Ñandú Rivera'))).toBe(true)
    expect(texts.some((text) => text.startsWith("O'Brien & Hijos"))).toBe(true)
    expect(texts).toContain('Contiene datos personales de estudiantes. No lo compartas fuera del Departamento.')
  } finally { dropBulkRoster() }
})

test('TR-N23 the PDF download holds the title, the date line and every athlete, and the API sends it as a private PDF attachment', async ({ page, baseURL }) => {
  desktopOnly()
  try {
    addBulkRoster(5)
    await openRoster(page, baseURL)
    const file = (await downloadRoster(page, 'pdf'))!
    const rows = allRoster()
    const text = pdfPages(file).join('\n')
    expect(text).toContain('Roster de atletas')
    expect(text).toContain(`Generado el ${generatedOn()}`)
    expect(text).toContain(`${rows.length} atletas`)
    for (const row of rows) expect(text, row.student_number).toContain(row.student_number)
    expect(text).toContain('Retirado')
    expect(text).toContain('Ñandú')
    expect(text).toContain('Peña')

    const raw = await page.request.get('/api/staff/roster/download?format=pdf', { headers: { Accept: 'application/json', Referer: `${baseURL}/` } })
    expect(raw.status()).toBe(200)
    expect(raw.headers()['content-type']).toContain('application/pdf')
    expect(raw.headers()['content-disposition']).toMatch(/^attachment; filename=roster-atletas-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(raw.headers()['cache-control']).toContain('no-store')
    expect((await raw.body()).subarray(0, 5).toString()).toBe('%PDF-')
    const bad = await call(page.request, 'get', '/api/staff/roster/download?format=xls', baseURL!)
    expect(bad.status).toBe(422)
  } finally { dropBulkRoster() }
})

test('TR-N24 a roster of about 100 athletes downloads complete in Word and in PDF, the PDF over several pages', async ({ page, baseURL }) => {
  desktopOnly()
  test.setTimeout(240_000)
  try {
    addBulkRoster(100)
    await openRoster(page, baseURL)
    const rows = allRoster()
    expect(rows.length).toBeGreaterThanOrEqual(100)
    expectWordRows(docxTexts(readFileSync((await downloadRoster(page, 'docx'))!)), rows)
    const pages = pdfPages((await downloadRoster(page, 'pdf'))!)
    expect(pages.length).toBeGreaterThan(1)
    const text = pages.join('\n')
    expect(text).toContain(`${rows.length} atletas`)
    const missing = rows.filter((row) => !text.includes(row.student_number)).map((row) => row.student_number)
    expect(missing, 'student numbers missing from the PDF').toEqual([])
  } finally { dropBulkRoster() }
})

test('TR-N25 the download lists withdrawn athletes as Retirado next to active ones as Activo (SRS REQ-F-100, widened by E-190)', async ({ page, baseURL }) => {
  desktopOnly()
  await staffIn(page, baseURL, ADMIN)
  const response = await page.request.get('/api/staff/roster/download?format=docx', { headers: { Accept: 'application/json', Referer: `${baseURL}/` } })
  expect(response.status()).toBe(200)
  const texts = docxTexts(await response.body())
  const rows = allRoster()
  const withdrawn = rows.find((row) => row.removed)!
  const active = rows.find((row) => !row.removed)!
  const at = (row: typeof withdrawn) => texts.indexOf(row.student_number)
  expect(texts.slice(at(withdrawn) - 2, at(withdrawn) + 3)).toEqual([withdrawn.name, withdrawn.sport, withdrawn.student_number, withdrawn.institutional_email, 'Retirado'])
  expect(texts.slice(at(active) - 2, at(active) + 3)).toEqual([active.name, active.sport, active.student_number, active.institutional_email, 'Activo'])
})

/** Goes offline for the page and tells the app, which listens for the browser's events. */
async function goOffline(page: Page) {
  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

async function goOnline(page: Page) {
  await page.context().setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

const ROSTER_LIST = /\/api\/staff\/roster(\?.*)?$/

const SERVER_ERROR = { status: 500, json: { error: { code: 'server_error' } } }

test('TR-N27 A-04 without connection or on a server error offers Reintentar, and a form open when the connection drops keeps what was typed and cannot save until it is back', async ({ page, baseURL }) => {
  desktopOnly()
  const y = farYear(27)
  await staffIn(page, baseURL, ADMIN)
  await page.route('**/api/staff/terms', (route) => route.abort('failed'))
  await page.goto('/staff/terminos')
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible()
  await page.unroute('**/api/staff/terms')
  await page.route('**/api/staff/terms', (route) => route.fulfill(SERVER_ERROR))
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { name: 'Error al cargar' })).toBeVisible()
  await page.unroute('**/api/staff/terms')
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Corrige un término editando sus fechas' })).toBeVisible()

  try {
    await startTerm(page)
    await typeTerm(page, { name: 'p152-n27', from: `${y}-12-11`, to: `${y}-12-18` })
    await goOffline(page)
    const dialog = termDialog(page)
    await expect(dialog.getByRole('heading', { name: 'Sin conexión' })).toBeVisible()
    await expect(dialog.getByText('Tus cambios siguen en el formulario. Podrás guardarlos cuando vuelva la conexión.', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Guardar término' })).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog.getByLabel('Nombre del término')).toHaveValue('p152-n27')
    const posts = countRequests(page, 'POST', '/api/staff/terms')
    await dialog.getByRole('button', { name: 'Guardar término' }).click({ force: true })
    await page.waitForTimeout(500)
    expect(posts).toEqual([])
    await goOnline(page)
    await expect(dialog.getByRole('heading', { name: 'Sin conexión' })).toHaveCount(0)
    await saveNewTerm(page)
    await expect(savedCard(page, 'p152-n27 se guardó.')).toBeVisible()
  } finally { dropTermsNamed('p152-n27') }
})

test('TR-N28 A-05 without connection or on a server error offers Reintentar, and a list on screen turns read only until the connection is back', async ({ page, baseURL }) => {
  desktopOnly()
  await staffIn(page, baseURL, ADMIN)
  await page.route(ROSTER_LIST, (route) => route.abort('failed'))
  await page.goto('/staff/atletas')
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible()
  await page.unroute(ROSTER_LIST)
  await page.route(ROSTER_LIST, (route) => route.fulfill(SERVER_ERROR))
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { name: 'Error al cargar' })).toBeVisible()
  await page.unroute(ROSTER_LIST)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Números de estudiante completos' })).toBeVisible()

  await goOffline(page)
  await expect(page.getByText('Recupera la conexión para guardar cambios.', { exact: true })).toBeVisible()
  for (const name of ['Añadir atleta', 'Descargar roster']) await expect(page.getByRole('button', { name }).first()).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('button', { name: 'Añadir atleta' }).first().click({ force: true })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await goOnline(page)
  await expect(page.getByText('Recupera la conexión para guardar cambios.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Añadir atleta' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('TR-N29 S-05 keeps the old rows marked as not current while offline, with the search and Check in disabled, and shows an error with Reintentar on a server error', async ({ page, baseURL }) => {
  desktopOnly()
  await staffIn(page, baseURL, STAFF)
  await page.route(ROSTER_LIST, (route) => route.fulfill(SERVER_ERROR))
  await page.goto('/staff/roster')
  await expect(page.getByRole('heading', { name: 'Error al cargar roster' })).toBeVisible()
  await expect(page.getByText('No pudimos cargar el roster. Inténtalo de nuevo.', { exact: true })).toBeVisible()
  await page.unroute(ROSTER_LIST)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Solo lectura', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Check in, / }).first()).toBeVisible()

  await goOffline(page)
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible()
  await expect(page.getByText('Datos no actuales', { exact: true })).toBeVisible()
  await expect(page.getByText(/^Sin conexión\. Última actualización a las /)).toBeVisible()
  await expect(page.getByPlaceholder('Buscar atleta')).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Check in, / }).first()).toHaveAttribute('aria-disabled', 'true')
  await goOnline(page)
  await expect(page.getByText('Datos no actuales', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Buscar por nombre o número de estudiante')).toBeEnabled()
})

test('TR-N35 withdrawing revokes every authorization of the athlete in the current and later terms with the reason removed from roster, and reinstating brings them all back', async ({ page, baseURL }) => {
  desktopOnly()
  const member = createMember({ kind: 'athlete' })
  const record = rosterOf(member)
  addAthleteAuthorization(member, NEXT)
  await openRoster(page, baseURL)
  const withdrawn = await call(page.request, 'post', `/api/staff/roster/${record.id}/withdraw`, baseURL!)
  expect(withdrawn.status).toBe(200)
  expect(authorizationsOf(member)).toEqual([[NEXT, 'revoked', 'removed from roster'], [CURRENT, 'revoked', 'removed from roster']])
  const [entry] = rosterAudit(record.id)
  expect(Object.keys((entry.after as { authorizations: object }).authorizations)).toHaveLength(2)
  const again = await call(page.request, 'post', `/api/staff/roster/${record.id}/withdraw`, baseURL!)
  expect(again.status).toBe(409)
  expect(again.body?.error?.code).toBe('roster_status_changed')

  const back = await call(page.request, 'post', `/api/staff/roster/${record.id}/reinstate`, baseURL!, { reason: 'Retiro por error en la prueba' })
  expect(back.status).toBe(200)
  expect(authorizationsOf(member)).toEqual([[NEXT, 'active', null], [CURRENT, 'active', null]])
  expect(rosterAudit(record.id).map((row) => row.action)).toEqual(['roster.withdraw', 'roster.reinstate'])
})

test('TR-N36 an athlete withdrawn by someone else while the list is open: Retirar answers that the athlete changed, and the list refreshes', async ({ page, baseURL, playwright }) => {
  desktopOnly()
  const athlete = createAthlete()
  const other = await playwright.request.newContext({ baseURL })
  try {
    await api(other, 'post', '/api/staff/sign-in', baseURL!, { email: ADMIN.email, password: ADMIN.password })
    await openRoster(page, baseURL)
    await findAthlete(page, athlete.number, athlete.name)
    await athleteRow(page, athlete.name).getByRole('button', { name: `Retirar, ${athlete.name}` }).click()
    expect((await call(other, 'post', `/api/staff/roster/${athlete.id}/withdraw`, baseURL!)).status).toBe(200)
    await page.getByRole('dialog').getByRole('button', { name: 'Retirar atleta' }).click()
    await expect(page.getByRole('dialog').getByText('Este atleta cambió mientras lo veías. Actualiza la lista.', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(athleteRow(page, athlete.name)).toHaveCount(0)
    expect(rosterAudit(athlete.id).map((row) => row.action)).toEqual(['roster.withdraw'])
  } finally {
    dropRoster(athlete.id)
    await other.dispose()
  }
})
