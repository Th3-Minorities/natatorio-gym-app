import { expect, test, type Browser, type Page } from '@playwright/test'
import { ADMIN, api, STAFF } from '../e2e/flows/flow.ts'
import { createMember, flushCache, resetSchedule, signInApi, dropMarkedSlots } from './setup.ts'
import { createAthlete, createLink } from './setup-athlete.ts'
import { deskCheckOut } from './setup-end-of-visit.ts'
import { occupancyNow } from './setup-occupancy.ts'
import {
  addDays, auditOf, authorizationStatus, call, chipLabel, CURRENT, dropAuthorizationsIn, dropRoster, dropTermsNamed, grantInTerm, NEXT, openPhone, restoreTerms,
  rosterById, rosterByNumber, rosterOf, setTerms, snapshotTerms, termIdOf, todayPR, withdraw, type PhoneKind, type TermRow,
} from './setup-terms.ts'

// #152 cross-device rows of flow 9 (ids TR-Xnn): the Administrator works on the dashboard (desktop Chrome, A-04 and A-05, or S-05 for Staff)
// while a User has the phone app open (Pixel 7 in Chromium, iPhone 13 in WebKit, location at the gym). The expected results come from
// SRS REQ-F-21, REQ-F-22, REQ-F-49, REQ-F-100 and admin-flows.md diagrams 8 to 11. One worker; every term change is restored in finally.

test.setTimeout(240_000)

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

/** The dashboard is desktop only (E-171): these rows start from the desktop project and open their own phone. */
function desktopOnly() {
  test.skip(test.info().project.name !== 'desktop', 'cross-device rows start from the desktop project and open their own phone')
}

const PHONES: PhoneKind[] = ['android', 'iphone']
const HOLD = '.check-in-hold'
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ------------------------------------------------------------------------------------------------------------ dashboard

type Who = { email: string; password: string }

/** A desktop browser with a staff account signed in. */
async function dashboard(browser: Browser, baseURL: string | undefined, who: Who = ADMIN) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  await api(page.request, 'post', '/api/staff/sign-in', baseURL!, { email: who.email, password: who.password })
  return { context, page }
}

const savedCard = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text })
const athleteRow = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(escapeRe(name)) })

async function openRoster(page: Page) {
  await page.goto('/staff/atletas')
  await expect(page.getByRole('heading', { level: 2, name: 'Números de estudiante completos' })).toBeVisible()
}

async function openTerms(page: Page) {
  await page.goto('/staff/terminos')
  await expect(page.getByRole('heading', { level: 2, name: 'Corrige un término editando sus fechas' })).toBeVisible()
}

async function searchAthlete(page: Page, text: string, name: string) {
  await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(text)
  await expect(athleteRow(page, name)).toBeVisible()
}

async function withdrawOnScreen(page: Page, name: string) {
  await searchAthlete(page, name, name)
  await athleteRow(page, name).getByRole('button', { name: `Retirar, ${name}` }).click()
  await page.getByRole('dialog', { name: `¿Retirar a ${name}?` }).getByRole('button', { name: 'Retirar atleta' }).click()
  await expect(savedCard(page, `${name} se retiró del roster.`)).toBeVisible()
}

async function reinstateOnScreen(page: Page, name: string, reason = 'Retiro por error en la prueba') {
  await page.getByRole('button', { name: 'Retirado' }).click()
  await searchAthlete(page, name, name)
  await athleteRow(page, name).getByRole('button', { name: `Restituir, ${name}` }).click()
  const dialog = page.getByRole('dialog', { name: `Restituir a ${name}` })
  await dialog.getByLabel('Motivo obligatorio').fill(reason)
  await dialog.getByRole('button', { name: 'Restituir' }).click()
  await expect(savedCard(page, `${name} se restituyó.`)).toBeVisible()
}

async function editCurrentEnd(page: Page, end: string, past = false) {
  if (past) await page.getByRole('button', { name: 'Ver términos pasados' }).click()
  await page.getByRole('row', { name: new RegExp(CURRENT) }).getByRole('button', { name: `Editar, ${CURRENT}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar término' })
  await dialog.getByLabel('Fecha de fin').fill(end)
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(savedCard(page, `${CURRENT} se guardó.`)).toBeVisible()
}

// -------------------------------------------------------------------------------------------------------------- the phone

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

async function holdAndExpectPanel(page: Page, panel: typeof MEMBER_PANEL) {
  await openCheckIn(page)
  await hold(page)
  await expect(page.getByRole('heading', { name: panel.title, exact: true })).toBeVisible()
  await expect(page.getByText(panel.text, { exact: true })).toBeVisible()
  await expect(page.locator('.check-in-action').filter({ hasText: panel.action })).toBeVisible()
}

async function openAccount(page: Page) {
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

const noAccess = (page: Page) => page.getByText('Sin autorización activa', { exact: true })
const access = (page: Page) => page.getByText('Acceso vigente · Término actual', { exact: true })
/** The phone refetches its profile when the tab gets focus back (or every 60 seconds). */
const refocus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')))

const LOOKUP_FIELD = (page: Page) => page.getByLabel(/Número de (estudiante o autorización|estudiante|autorización)/)
const NOT_ON_ROSTER = 'No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.'

async function lookup(page: Page, number: string) {
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await LOOKUP_FIELD(page).fill(number)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
}

async function expectNotOnRoster(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu número' })).toBeVisible()
  await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription(NOT_ON_ROSTER)
}

// ============================================================================================ roster actions reach the phone

for (const kind of PHONES) {
  test(`TR-X01 (${kind}) withdrawing a signed-in athlete on A-05 ends the access on the phone at its next refresh, and Check In is refused`, async ({ browser, playwright, baseURL }) => {
    desktopOnly()
    const athlete = createMember({ kind: 'athlete' })
    const record = rosterOf(athlete)
    const desk = await dashboard(browser, baseURL)
    const phone = await openPhone(browser, playwright, baseURL, kind)
    try {
      await signInApi(phone.page.request, baseURL!, athlete)
      await openAccount(phone.page)
      await expect(access(phone.page)).toBeVisible()

      await openRoster(desk.page)
      await withdrawOnScreen(desk.page, record.name)
      expect(authorizationStatus(athlete)).toBe('revoked')

      await refocus(phone.page)
      await expect(noAccess(phone.page)).toBeVisible()
      await holdAndExpectPanel(phone.page, ATHLETE_PANEL)
    } finally {
      await desk.context.close()
      await phone.close()
    }
  })

  test(`TR-X02 (${kind}) reinstating a withdrawn athlete on A-05 gives the phone its access back and Check In works`, async ({ browser, playwright, baseURL }) => {
    desktopOnly()
    const athlete = createMember({ kind: 'athlete' })
    const record = rosterOf(athlete)
    const desk = await dashboard(browser, baseURL)
    const phone = await openPhone(browser, playwright, baseURL, kind)
    try {
      await signInApi(phone.page.request, baseURL!, athlete)
      await call(desk.page.request, 'post', `/api/staff/roster/${record.id}/withdraw`, baseURL!)
      await openAccount(phone.page)
      await expect(noAccess(phone.page)).toBeVisible()

      await openRoster(desk.page)
      await reinstateOnScreen(desk.page, record.name)
      expect(authorizationStatus(athlete)).toBe('active')
      expect(auditOf('roster_records', record.id).map((entry) => entry.action)).toEqual(['roster.withdraw', 'roster.reinstate'])

      await refocus(phone.page)
      await expect(access(phone.page)).toBeVisible()
      await openCheckIn(phone.page)
      await hold(phone.page)
      await expectGymId(phone.page)
    } finally {
      await desk.context.close()
      await phone.close()
    }
  })
}

test('TR-X03 (android) an athlete withdrawn during a visit keeps the open visit and the occupancy until it ends, leaves S-05, and then Check In is refused', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const athlete = createMember({ kind: 'athlete' })
  const record = rosterOf(athlete)
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    await signInApi(phone.page.request, baseURL!, athlete)
    await openCheckIn(phone.page)
    await hold(phone.page)
    await expectGymId(phone.page)
    const visit = (await api(phone.page.request, 'get', '/api/user/check-in', baseURL!)).body.session.id as number

    await openRoster(desk.page)
    await withdrawOnScreen(desk.page, record.name)
    await desk.page.goto('/staff/roster')
    await desk.page.getByLabel('Buscar por nombre o número de estudiante').fill(record.student_number)
    await expect(desk.page.getByText(`No encontramos atletas para “${record.student_number}”.`, { exact: true })).toBeVisible()
    await desk.page.goto('/staff')
    await expect(desk.page.getByRole('row', { name: new RegExp(escapeRe(athlete.name)) })).toBeVisible()

    await phone.page.goto('/check-in')
    await expect(phone.page.getByText('Sesión activa', { exact: true })).toBeVisible()
    await phone.page.goto('/gym')
    expect(occupancyNow()).toBeGreaterThanOrEqual(1)
    await expect(phone.page.locator('.gym-occupancy__count strong')).toHaveText(String(occupancyNow()))

    await deskCheckOut(playwright.request, baseURL, visit)
    await phone.page.goto('/check-in')
    await expect(phone.page.locator('.check-in-lead')).toHaveText('Tu visita ha terminado')
    await phone.page.getByRole('button', { name: 'Continuar' }).click()
    await expect(phone.page.locator(HOLD)).toBeVisible()
    await hold(phone.page)
    await expect(phone.page.getByRole('heading', { name: ATHLETE_PANEL.title, exact: true })).toBeVisible()
  } finally {
    await desk.context.close()
    await phone.close()
  }
})

test('TR-X04 (iphone) a record withdrawn on A-05 is not on the roster for the phone lookup, and it is found again once reinstated', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  flushCache()
  const athlete = createAthlete()
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'iphone')
  try {
    await openRoster(desk.page)
    await withdrawOnScreen(desk.page, athlete.name)
    await lookup(phone.page, athlete.number)
    await expectNotOnRoster(phone.page)

    await reinstateOnScreen(desk.page, athlete.name)
    expect(rosterById(athlete.id).removed).toBe(false)
    await lookup(phone.page, athlete.number)
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
    await expect(phone.page.getByText(NOT_ON_ROSTER, { exact: true })).toHaveCount(0)
  } finally {
    await desk.context.close()
    await phone.close()
  }
})

test('TR-X05 (android) an athlete added on A-05 is found by the phone lookup, which refused the number before', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  flushCache()
  const number = `7${String(Date.now()).slice(-8)}`
  const name = `Atleta X05 ${number}`
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    await lookup(phone.page, number)
    await expectNotOnRoster(phone.page)

    await openRoster(desk.page)
    await desk.page.getByRole('button', { name: 'Añadir atleta' }).first().click()
    const dialog = desk.page.getByRole('dialog')
    await dialog.getByLabel('Deporte').fill('Voleibol')
    await dialog.getByLabel('Nombre completo').fill(name)
    await dialog.getByLabel('Número de estudiante').fill(number)
    await dialog.getByLabel('Correo institucional').fill(`p152-x05-${number}@upr.example`)
    await dialog.getByRole('button', { name: 'Guardar y añadir otro' }).click()
    await expect(dialog.getByText(`${name} se guardó. Añade el próximo atleta.`, { exact: true })).toBeVisible()

    await lookup(phone.page, number)
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
  } finally {
    await desk.context.close()
    await phone.close()
    const row = rosterByNumber(number)
    if (row) dropRoster(row.id)
  }
})

test('TR-X06 (android) a registration link sent before the record is withdrawn stops working on the phone', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const athlete = createAthlete()
  const token = `x06${Date.now().toString(36)}${'a'.repeat(40)}`
  createLink(athlete, token)
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    await phone.page.goto('/register')
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
    await phone.page.goto(`/register/athlete?token=${token}`)
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()

    await openRoster(desk.page)
    await withdrawOnScreen(desk.page, athlete.name)
    await phone.page.goto(`/register/athlete?token=${token}`)
    await expect(phone.page.getByRole('heading', { name: 'Este enlace ya no es válido' })).toBeVisible()
    await expect(phone.page.getByText('Pide un enlace nuevo para continuar.', { exact: true })).toBeVisible()
  } finally {
    await desk.context.close()
    await phone.close()
  }
})

test('TR-X07 (android) changing the institutional email of a record on A-05 cancels the unused registration link sent to the old email', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const athlete = createAthlete()
  const token = `x07${Date.now().toString(36)}${'b'.repeat(40)}`
  createLink(athlete, token)
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    await phone.page.goto('/register')
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
    await phone.page.goto(`/register/athlete?token=${token}`)
    await expect(phone.page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()

    await openRoster(desk.page)
    await searchAthlete(desk.page, athlete.number, athlete.name)
    await athleteRow(desk.page, athlete.name).getByRole('button', { name: `Editar, ${athlete.name}` }).click()
    const dialog = desk.page.getByRole('dialog', { name: 'Editar atleta' })
    await dialog.getByLabel('Correo institucional').fill(`p152-x07-${athlete.number}@upr.example`)
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(savedCard(desk.page, `${athlete.name} se guardó.`)).toBeVisible()

    await phone.page.goto(`/register/athlete?token=${token}`)
    await expect(phone.page.getByRole('heading', { name: 'Este enlace ya no es válido' })).toBeVisible()
  } finally {
    await desk.context.close()
    await phone.close()
  }
})

// ====================================================================================== term actions reach the phone

for (const kind of PHONES) {
  test(`TR-X08 (${kind}) ending the current term on A-04 stops a member's access on the phone, and moving the end back gives it again`, async ({ browser, playwright, baseURL }) => {
    desktopOnly()
    const member = createMember()
    const saved = snapshotTerms()
    const currentEnd = saved.find((term) => term.name === CURRENT)!.ends_on
    const desk = await dashboard(browser, baseURL)
    const phone = await openPhone(browser, playwright, baseURL, kind)
    try {
      await signInApi(phone.page.request, baseURL!, member)
      await openAccount(phone.page)
      await expect(access(phone.page)).toBeVisible()

      await openTerms(desk.page)
      await editCurrentEnd(desk.page, addDays(todayPR(), -1))
      await expect(desk.page.getByRole('heading', { level: 2, name: 'No hay un término activo hoy' })).toBeVisible()
      await desk.page.goto('/staff/equipo')
      await expect(desk.page.locator('.team-chip').filter({ hasText: 'Sin término activo' })).toBeVisible()
      const id = termIdOf(CURRENT)!
      expect(auditOf('academic_terms', id).at(-1)).toMatchObject({ action: 'term.update', before: { ends_on: currentEnd }, after: { ends_on: addDays(todayPR(), -1) } })

      await refocus(phone.page)
      await expect(noAccess(phone.page)).toBeVisible()
      await holdAndExpectPanel(phone.page, MEMBER_PANEL)

      await openTerms(desk.page)
      await editCurrentEnd(desk.page, currentEnd, true)
      await desk.page.goto('/staff/equipo')
      await expect(desk.page.locator('.team-term .team-chip')).toHaveText(chipLabel({ starts_on: saved.find((term) => term.name === CURRENT)!.starts_on, ends_on: currentEnd }))

      await refocus(phone.page)
      await openAccount(phone.page)
      await expect(access(phone.page)).toBeVisible()
      await openCheckIn(phone.page)
      await hold(phone.page)
      await expectGymId(phone.page)
    } finally {
      restoreTerms(saved)
      await desk.context.close()
      await phone.close()
    }
  })
}

test('TR-X09 (android) a term added on A-04 to cover today after a gap becomes the active term on A-15, and only a member with an authorization in it can Check In', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const saved = snapshotTerms()
  const next = saved.find((term) => term.name === NEXT)!
  const today = todayPR()
  const end = [addDays(today, 9), addDays(next.starts_on, -1)].sort()[0]
  const name = 'p152-x09'
  const inOld = createMember()
  const inNew = createMember({ authorization: 'none' })
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    setTerms([{ ...saved.find((term) => term.name === CURRENT)!, ends_on: addDays(today, -1) }])
    await openTerms(desk.page)
    await desk.page.getByRole('button', { name: 'Crear término' }).first().click()
    const dialog = desk.page.getByRole('dialog', { name: 'Crear término' })
    await dialog.getByLabel('Nombre del término').fill(name)
    await dialog.getByLabel('Fecha de inicio').fill(today)
    await dialog.getByLabel('Fecha de fin').fill(end)
    await dialog.getByRole('button', { name: 'Guardar término' }).click()
    await expect(savedCard(desk.page, `${name} se guardó.`)).toBeVisible()
    await expect(desk.page.locator('.terms-context')).toContainText(name)
    await desk.page.goto('/staff/equipo')
    await expect(desk.page.locator('.team-term .team-chip')).toHaveText(chipLabel({ starts_on: today, ends_on: end }))
    grantInTerm(inNew, name)

    await signInApi(phone.page.request, baseURL!, inOld)
    await holdAndExpectPanel(phone.page, MEMBER_PANEL)
    await phone.page.context().clearCookies()
    await signInApi(phone.page.request, baseURL!, inNew)
    await openCheckIn(phone.page)
    await hold(phone.page)
    await expectGymId(phone.page)
    const visit = (await api(phone.page.request, 'get', '/api/user/check-in', baseURL!)).body.session.id as number
    await deskCheckOut(playwright.request, baseURL, visit)
  } finally {
    dropAuthorizationsIn(name)
    dropTermsNamed(name)
    restoreTerms(saved)
    await desk.context.close()
    await phone.close()
  }
})

test('TR-X10 Staff on S-05 see an athlete the Administrator withdraws leave the list, and see the entry of an athlete who checks in on the phone', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const athlete = createMember({ kind: 'athlete' })
  const record = rosterOf(athlete)
  const admin = await dashboard(browser, baseURL)
  const staff = await dashboard(browser, baseURL, STAFF)
  const phone = await openPhone(browser, playwright, baseURL, 'iphone')
  try {
    const find = async () => {
      await staff.page.goto('/staff/roster')
      await staff.page.getByLabel('Buscar por nombre o número de estudiante').fill(record.student_number)
    }
    await find()
    const row = staff.page.getByRole('row', { name: new RegExp(escapeRe(record.name)) })
    await expect(row.getByRole('link', { name: `Check in, ${record.name}` })).toHaveAttribute('href', `/staff/buscar?numero=${record.student_number}`)

    await signInApi(phone.page.request, baseURL!, athlete)
    await openCheckIn(phone.page)
    await hold(phone.page)
    await expectGymId(phone.page)
    const visit = (await api(phone.page.request, 'get', '/api/user/check-in', baseURL!)).body.session.id as number
    await find()
    await expect(row.getByText('Entrada registrada', { exact: true })).toBeVisible()
    await expect(row.getByText(/^Entrada: /)).toBeVisible()
    await expect(row.getByRole('link', { name: /^Check in, / })).toHaveCount(0)

    await deskCheckOut(playwright.request, baseURL, visit)
    await find()
    await expect(row.getByRole('link', { name: `Check in, ${record.name}` })).toBeVisible()

    await openRoster(admin.page)
    await withdrawOnScreen(admin.page, record.name)
    await find()
    await expect(staff.page.getByText(`No encontramos atletas para “${record.student_number}”.`, { exact: true })).toBeVisible()
  } finally {
    await admin.context.close()
    await staff.context.close()
    await phone.close()
  }
})

test('TR-X11 (android) the term and roster changes of an Administrator are the ones the phone reads: a withdrawal done by the database stand-in and by A-05 leave the same state', async ({ browser, playwright, baseURL }) => {
  desktopOnly()
  const [byScreen, byStandIn] = [createMember({ kind: 'athlete' }), createMember({ kind: 'athlete' })]
  const desk = await dashboard(browser, baseURL)
  const phone = await openPhone(browser, playwright, baseURL, 'android')
  try {
    await openRoster(desk.page)
    await withdrawOnScreen(desk.page, rosterOf(byScreen).name)
    withdraw(byStandIn)
    for (const member of [byScreen, byStandIn]) {
      await phone.page.context().clearCookies()
      await signInApi(phone.page.request, baseURL!, member)
      await openAccount(phone.page)
      await expect(noAccess(phone.page)).toBeVisible()
      await expect(phone.page.locator('.user-profile__badge')).toHaveText('Atleta')
      await holdAndExpectPanel(phone.page, ATHLETE_PANEL)
    }
    const [a, b] = [rosterOf(byScreen), rosterOf(byStandIn)]
    expect([a.removed, b.removed, authorizationStatus(byScreen), authorizationStatus(byStandIn)]).toEqual([true, true, 'revoked', 'revoked'])
  } finally {
    await desk.context.close()
    await phone.close()
  }
})
