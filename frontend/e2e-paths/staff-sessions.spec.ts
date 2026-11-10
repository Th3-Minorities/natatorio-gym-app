import { expect, test, type Page } from '@playwright/test'
import { MEMBER } from '../e2e/flows/flow.ts'
import { addClosure, addPeriod, createMember, deleteSlot, dropMarkedSlots, flushCache, rawApi, resetSchedule, setPhotoPending, signInApi } from './setup.ts'
import { ageUserVisit, closeDue, endUserVisit, release, setOccupancy, ensurePhotoFile } from './setup-occupancy.ts'
import { deskCheckOut } from './setup-end-of-visit.ts'
import {
  auditCount, createNamed, dropPhoto, deskApi, deskPage, dialog, endVisitEarlier, findBox, heading1, level, listTitle, memberInside, message, onlyDesktop,
  openVisitId, pendingAt, POLL_WAIT, revokeAuthorization, rowOf, searchBox, staffCount, staffLevel, studentNumber, TIME, token, unclaimedRoster,
  visit, visitsOf,
} from './setup-sessions.ts'

// #152 path tests for the Staff sessions and people screens: S-01 active sessions, S-02 person and session, S-03 find a person and
// the assisted Check In (paths/staff-sessions.md, SS-01 to SS-92). Dashboard paths run on desktop Chrome only (E-171).
// The schedule rows (closure, athletes-only period) end other visits, so they sit at the end of the file.

test.setTimeout(150_000)

test.beforeAll(() => {
  if (test.info().project.name !== 'desktop') return
  flushCache()
  resetSchedule()
  ensurePhotoFile()
})
test.afterAll(() => {
  if (test.info().project.name === 'desktop') dropMarkedSlots()
})
test.beforeEach(() => onlyDesktop())

// ------------------------------------------------------------------------------------------------------ helpers

const listReady = (page: Page) => expect(listTitle(page)).toHaveText(/^\d+ sesi(ón|ones) activas?$/)
const confirmButton = (page: Page, name: string | RegExp) => dialog(page).getByRole('button', { name })
const noRow = (page: Page, text: string) => expect(rowOf(page, text)).toHaveCount(0)
const personName = (page: Page) => page.locator('.person-card__name')
const search = async (page: Page, text: string) => {
  await findBox(page).fill(text)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
}
const openS03 = (page: Page, baseURL: string | undefined, who: 'staff' | 'admin' = 'staff') => deskPage(page, baseURL, who, '/staff/buscar')
const openS02 = async (page: Page, baseURL: string | undefined, id: number, who: 'staff' | 'admin' = 'staff') => {
  await deskPage(page, baseURL, who, `/staff/sesiones/${id}`)
  await expect(page.getByRole('heading', { level: 2, name: /^Sesión (actual|registrada)$/ })).toBeVisible()
}
async function withOccupancy<T>(n: number, body: () => Promise<T>): Promise<T> {
  const state = setOccupancy(n)
  try { return await body() } finally { release(state) }
}

// ======================================================================================================== S-01

test('SS-01 Staff lands on S-01 with the chip, the occupancy card, the search and the table', async ({ page, baseURL, playwright }) => {
  const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS01 ${token()}`)
  await deskPage(page, baseURL)
  await expect(page).toHaveURL(/\/staff$/)
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
  await expect(page.getByText('Gimnasio abierto', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Personas dentro ahora' })).toBeVisible()
  await expect(staffCount(page)).toHaveText(/^\d+$/)
  await expect(page.getByText('Las sesiones se cierran automáticamente 2 horas después del Check In.')).toBeVisible()
  await expect(searchBox(page)).toBeVisible()
  for (const name of ['Persona', 'Check In', 'Tiempo dentro', 'Autorización', 'Acción']) await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
  await expect(rowOf(page, member.name)).toBeVisible()
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  for (const name of ['Sesiones activas', 'Buscar persona', 'Roster de atletas']) await expect(menu.getByRole('link', { name })).toBeVisible()
  await expect(menu.getByText('Administración', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Staff', { exact: true }).first()).toBeVisible()
})

test('SS-02 an Administrator lands on the same S-01 with the Administrator items in the menu', async ({ page, baseURL }) => {
  await deskPage(page, baseURL, 'admin')
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
  await expect(page.getByText('Administradora de prueba · Administrador')).toBeVisible()
  const menu = page.getByRole('navigation', { name: 'Menú del dashboard' })
  await expect(menu.getByText('Administración', { exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Cuentas del staff' })).toBeVisible()
  await expect(staffCount(page)).toHaveText(/^\d+$/)
})

test('SS-03 signed out: every sessions and people route answers 401 and the screens show the sign-in', async ({ page, playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  try {
    for (const path of ['/api/staff/sessions', '/api/staff/sessions/1', '/api/staff/sessions/1/photo', '/api/staff/people?search=ana', '/api/staff/people/1/photo', '/api/staff/occupancy']) {
      expect((await rawApi(anonymous, 'get', path, baseURL!)).status, `GET ${path}`).toBe(401)
    }
    for (const path of ['/api/staff/sessions/1/check-out', '/api/staff/sessions/1/end-early', '/api/staff/sessions/1/void', '/api/staff/people/1/photo-pending', '/api/staff/check-in']) {
      expect((await rawApi(anonymous, 'post', path, baseURL!, { user_id: 1 })).status, `POST ${path}`).toBe(401)
    }
  } finally { await anonymous.dispose() }
  for (const path of ['/staff', '/staff/sesiones/1', '/staff/buscar']) {
    await page.goto(path)
    await expect(heading1(page, 'Iniciar sesión')).toBeVisible()
  }
})

test('SS-04 a User (phone) account is refused on every staff sessions and people route', async ({ playwright, baseURL }) => {
  const phone = await playwright.request.newContext({ baseURL })
  try {
    await signInApi(phone, baseURL!, MEMBER)
    expect((await rawApi(phone, 'get', '/api/staff/sessions', baseURL!)).status).toBe(401)
    expect((await rawApi(phone, 'get', '/api/staff/people?search=ana', baseURL!)).status).toBe(401)
    expect((await rawApi(phone, 'post', '/api/staff/check-in', baseURL!, { user_id: 1 })).status).toBe(401)
    expect((await rawApi(phone, 'post', '/api/staff/sessions/1/check-out', baseURL!)).status).toBe(401)
  } finally { await phone.dispose() }
})

test('SS-05 the row of a paid student shows name, Check In time, time inside, chip and the Marcar salida button', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS05 ${token()}`)
  await deskPage(page, baseURL)
  const row = rowOf(page, member.name)
  await expect(row).toBeVisible()
  await expect(row.getByRole('link', { name: `Ver ${member.name}` })).toHaveAttribute('href', `/staff/sesiones/${id}`)
  await expect(row.getByRole('cell').nth(1)).toHaveText(TIME)
  await expect(row.getByRole('cell').nth(2)).toHaveText(/^[01] min$/)
  await expect(row.getByRole('cell').nth(3)).toHaveText('Socio estudiante')
  await expect(row.getByRole('button', { name: `Marcar salida, ${member.name}` })).toBeVisible()
  await expect(page.getByText('Selecciona una persona para ver su foto, autorización y sesión.')).toBeVisible()
})

for (const [id, label, options, chip] of [
  ['SS-06', 'an athlete', { kind: 'athlete' as const }, 'Atleta'],
  ['SS-07', 'an employee member', { group: 'employee' as const }, 'Socio empleado'],
  ['SS-08', 'a manual access', { kind: 'manual' as const }, 'Acceso manual'],
] as const) {
  test(`${id} the row of ${label} carries the chip "${chip}"`, async ({ page, baseURL, playwright }) => {
    const { member } = await memberInside(playwright.request, baseURL, options, `Prueba ${id} ${token()}`)
    await deskPage(page, baseURL)
    await expect(rowOf(page, member.name).getByRole('cell').nth(3)).toHaveText(chip)
  })
}

for (const [id, interval, shown] of [
  ['SS-09', '5 minutes', '5 min'],
  ['SS-10', '59 minutes', '59 min'],
  ['SS-11', '60 minutes', '1 h 0 min'],
  ['SS-12', '119 minutes', '1 h 59 min'],
] as const) {
  test(`${id} boundary: a visit that began ${interval} ago shows "${shown}" inside`, async ({ page, baseURL, playwright }) => {
    const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba ${id} ${token()}`)
    ageUserVisit(member.id, interval)
    await deskPage(page, baseURL)
    await expect(rowOf(page, member.name).getByRole('cell').nth(2)).toHaveText(shown)
  })
}

test('SS-13 one visit: the list says "1 sesión activa" and the card counts 1', async ({ page, baseURL }) => {
  await withOccupancy(1, async () => {
    await deskPage(page, baseURL)
    await expect(listTitle(page)).toHaveText('1 sesión activa')
    await expect(staffCount(page)).toHaveText('1')
  })
})

test('SS-14 two visits: the list says "2 sesiones activas" and the card counts 2', async ({ page, baseURL }) => {
  await withOccupancy(2, async () => {
    await deskPage(page, baseURL)
    await expect(listTitle(page)).toHaveText('2 sesiones activas')
    await expect(staffCount(page)).toHaveText('2')
  })
})

test('SS-15 empty gym: "Sin sesiones activas", 0 sesiones, count 0 "Baja" and an empty bar', async ({ page, baseURL }) => {
  await withOccupancy(0, async () => {
    await deskPage(page, baseURL)
    await expect(page.getByRole('heading', { level: 3, name: 'Sin sesiones activas' })).toBeVisible()
    await expect(page.getByText('No hay sesiones activas. Los nuevos Check Ins aparecerán aquí.')).toBeVisible()
    await expect(listTitle(page)).toHaveText('0 sesiones activas')
    await expect(staffCount(page)).toHaveText('0')
    await expect(staffLevel(page)).toHaveText('Baja')
    await expect(page.locator('.staff-occupancy__bar > div')).toHaveCSS('width', '0px')
  })
})

for (const [id, count] of [['SS-16', 13], ['SS-17', 14], ['SS-18', 26], ['SS-19', 27], ['SS-20', 40], ['SS-21', 41]] as const) {
  test(`${id} boundary: ${count} people inside show "${level(count)}" on the card and in the list title`, async ({ page, baseURL }) => {
    await withOccupancy(count, async () => {
      await deskPage(page, baseURL)
      await expect(staffCount(page)).toHaveText(String(count))
      await expect(staffLevel(page)).toHaveText(level(count))
      await expect(listTitle(page)).toHaveText(`${count} sesiones activas`)
      const bar = page.locator('.staff-occupancy__bar')
      const width = await bar.locator('div').evaluate((element, track) => element.getBoundingClientRect().width / (track as HTMLElement).getBoundingClientRect().width, await bar.elementHandle())
      expect(width).toBeCloseTo(Math.min(1, count / 40), 1)
    })
  })
}

test('SS-22 search by part of a name, any letter case, shows only the matches', async ({ page, baseURL, playwright }) => {
  const t = token()
  const a = await memberInside(playwright.request, baseURL, {}, `Zurita ${t}`)
  const b = await memberInside(playwright.request, baseURL, {}, `Zeta ${t}`)
  await deskPage(page, baseURL)
  await searchBox(page).fill(`URITA ${t.toUpperCase()}`)
  await expect(rowOf(page, a.member.name)).toBeVisible()
  await noRow(page, b.member.name)
  await expect(listTitle(page)).toHaveText('1 sesión activa')
  await searchBox(page).fill(`z`)
  await expect(rowOf(page, b.member.name)).toBeVisible()
  await expect(rowOf(page, a.member.name)).toBeVisible()
})

test('SS-23 search with no match: "Sin coincidencias" with the text, and "Limpiar búsqueda" brings the list back', async ({ page, baseURL, playwright }) => {
  const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS23 ${token()}`)
  await deskPage(page, baseURL)
  await searchBox(page).fill('nadie se llama asi')
  await expect(page.getByRole('heading', { level: 3, name: 'Sin coincidencias' })).toBeVisible()
  await expect(page.getByText('No hay sesiones activas que coincidan con “nadie se llama asi”.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click()
  await expect(searchBox(page)).toHaveValue('')
  await expect(searchBox(page)).toBeFocused()
  await expect(rowOf(page, member.name)).toBeVisible()
})

test('SS-24 boundary: a search of only spaces does not filter', async ({ page, baseURL, playwright }) => {
  await memberInside(playwright.request, baseURL, {}, `Prueba SS24 ${token()}`)
  await deskPage(page, baseURL)
  await listReady(page)
  const before = await listTitle(page).textContent()
  await searchBox(page).fill('   ')
  await page.waitForTimeout(900)
  await expect(listTitle(page)).toHaveText(before!)
  await expect(page.getByRole('heading', { level: 3, name: 'Sin coincidencias' })).toHaveCount(0)
})

test('SS-25 search characters % and _ are literal, not wildcards', async ({ page, baseURL, playwright }) => {
  await memberInside(playwright.request, baseURL, {}, `Prueba SS25 ${token()}`)
  await deskPage(page, baseURL)
  for (const text of ['%', '_', 'Prueba%SS25']) {
    await searchBox(page).fill(text)
    await expect(page.getByRole('heading', { level: 3, name: 'Sin coincidencias' })).toBeVisible()
  }
})

test('SS-26 S-01 searches by name only: an athlete student number finds nothing', async ({ page, baseURL, playwright }) => {
  const { member } = await memberInside(playwright.request, baseURL, { kind: 'athlete' }, `Prueba SS26 ${token()}`)
  await deskPage(page, baseURL)
  await searchBox(page).fill(studentNumber(member))
  await expect(page.getByRole('heading', { level: 3, name: 'Sin coincidencias' })).toBeVisible()
})

test('SS-27 boundary: a search of 255 characters is accepted and 256 is refused (422)', async ({ playwright, baseURL }) => {
  const desk = await deskApi(playwright.request, baseURL)
  try {
    expect((await rawApi(desk, 'get', `/api/staff/sessions?search=${'a'.repeat(255)}`, baseURL!)).status).toBe(200)
    expect((await rawApi(desk, 'get', `/api/staff/sessions?search=${'a'.repeat(256)}`, baseURL!)).status).toBe(422)
  } finally { await desk.dispose() }
})

test('SS-28 ended visits never show: checked out, ended early, void and past the 2 hours', async ({ page, baseURL, playwright }) => {
  const t = token()
  const out = await memberInside(playwright.request, baseURL, {}, `Salio ${t}`)
  const early = await memberInside(playwright.request, baseURL, {}, `Antes ${t}`)
  const voided = await memberInside(playwright.request, baseURL, {}, `Anulo ${t}`)
  const old = await memberInside(playwright.request, baseURL, {}, `Viejo ${t}`)
  const inside = await memberInside(playwright.request, baseURL, {}, `Sigue ${t}`)
  await deskCheckOut(playwright.request, baseURL, out.id)
  endUserVisit(early.member.id, 'ended_early')
  endUserVisit(voided.member.id, 'void')
  ageUserVisit(old.member.id, '3 hours')
  await deskPage(page, baseURL)
  await searchBox(page).fill(t)
  await expect(rowOf(page, inside.member.name)).toBeVisible()
  await expect(listTitle(page)).toHaveText('1 sesión activa')
  for (const name of ['Salio', 'Antes', 'Anulo', 'Viejo']) await noRow(page, `${name} ${t}`)
})

test('SS-29 a Check In made after the list opened appears at the next poll, and the count goes up, with no reload', async ({ page, baseURL, playwright }) => {
  await withOccupancy(2, async () => {
    await deskPage(page, baseURL)
    await expect(staffCount(page)).toHaveText('2')
    const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS29 ${token()}`)
    await expect(rowOf(page, member.name)).toBeVisible({ timeout: POLL_WAIT })
    await expect(staffCount(page)).toHaveText('3', { timeout: POLL_WAIT })
  })
})

test('SS-30 a visit ended at another desk leaves the list at the next poll', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS30 ${token()}`)
  await deskPage(page, baseURL)
  await expect(rowOf(page, member.name)).toBeVisible()
  await deskCheckOut(playwright.request, baseURL, id)
  await expect(rowOf(page, member.name)).toHaveCount(0, { timeout: POLL_WAIT })
})

test('SS-31 no connection: the number is hidden with "Datos no actuales", and Marcar salida is disabled', async ({ page, baseURL, playwright, context }) => {
  const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS31 ${token()}`)
  await deskPage(page, baseURL)
  await expect(rowOf(page, member.name)).toBeVisible()
  await expect(staffCount(page)).toBeVisible()
  await context.setOffline(true)
  await expect(page.locator('.staff-occupancy__problem')).toContainText('Sin conexión')
  await expect(page.getByText('Datos no actuales', { exact: true })).toBeVisible()
  await expect(page.getByText('Sin internet no podemos actualizar la ocupación.')).toBeVisible()
  await expect(staffCount(page)).toHaveCount(0)
  await expect(rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ })).toHaveAttribute('aria-disabled', 'true')
  await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click({ force: true })
  await expect(dialog(page)).toHaveCount(0)
  await context.setOffline(false)
  await expect(staffCount(page)).toBeVisible({ timeout: POLL_WAIT })
})

test('SS-32 the list fails to load: "No actualizado" with Reintentar, which loads it', async ({ page, baseURL, playwright }) => {
  const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS32 ${token()}`)
  const broken = (url: URL) => url.pathname === '/api/staff/sessions'
  await page.route(broken, (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }))
  await deskPage(page, baseURL)
  await expect(page.getByRole('heading', { name: 'No actualizado' })).toBeVisible()
  await expect(page.getByText('No pudimos cargar las sesiones activas. Inténtalo de nuevo.')).toBeVisible()
  await page.unroute(broken)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(rowOf(page, member.name)).toBeVisible()
})

test('SS-33 while the list loads it says "Cargando sesiones"', async ({ page, baseURL }) => {
  await page.route((url) => url.pathname === '/api/staff/sessions', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await route.continue()
  })
  await deskPage(page, baseURL)
  await expect(page.getByText('Cargando sesiones', { exact: true })).toBeVisible()
  await expect(page.getByText('Cargando ocupación y sesiones activas…')).toBeVisible()
  await listReady(page)
})

test('SS-34 Marcar salida asks first; Cancelar closes the question and the visit stays open', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS34 ${token()}`)
  await deskPage(page, baseURL)
  await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Confirmar salida' })).toBeVisible()
  await expect(dialog(page).getByText(`¿Marcar la salida de ${member.name}?`)).toBeVisible()
  await expect(dialog(page).getByText('La sesión terminará con la hora actual de salida.')).toBeVisible()
  await confirmButton(page, 'Cancelar').click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(rowOf(page, member.name)).toBeVisible()
  expect(visit(id).status).toBe('active')
})

test('SS-35 confirming Marcar salida says so, removes the row, and records the visit as checked out by this Staff account', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS35 ${token()}`)
  await deskPage(page, baseURL)
  await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(message(page)).toHaveText(`Se marcó la salida de ${member.name}.`)
  await expect(rowOf(page, member.name)).toHaveCount(0)
  await expect(listTitle(page)).toBeFocused()
  const row = visit(id)
  expect(row.status).toBe('checked_out')
  expect(row.by).not.toBeNull()
})

test('SS-36 an Administrator can check a person out from S-01', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS36 ${token()}`)
  await deskPage(page, baseURL, 'admin')
  await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(message(page)).toHaveText(`Se marcó la salida de ${member.name}.`)
  expect(visit(id).status).toBe('checked_out')
})

test('SS-37 state transition: the visit already ended elsewhere when the question is confirmed; the list refreshes and no exit is claimed', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS37 ${token()}`)
  await deskPage(page, baseURL)
  await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
  await expect(dialog(page)).toBeVisible()
  await deskCheckOut(playwright.request, baseURL, id)
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(rowOf(page, member.name)).toHaveCount(0)
  await expect(message(page)).toHaveCount(0)
  expect(visit(id).status).toBe('checked_out')
})

test('SS-38 after a check-out the occupancy card asks again at once, without waiting for the poll', async ({ page, baseURL, playwright }) => {
  await withOccupancy(3, async () => {
    const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS38 ${token()}`)
    await deskPage(page, baseURL)
    await expect(staffCount(page)).toHaveText('4', { timeout: POLL_WAIT })
    await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
    await confirmButton(page, 'Sí, marcar salida').click()
    await expect(staffCount(page)).toHaveText('3', { timeout: 8_000 })
    await expect(listTitle(page)).toHaveText('3 sesiones activas')
  })
})

test('SS-39 a check-out leaves the other people inside untouched', async ({ page, baseURL, playwright }) => {
  const t = token()
  const a = await memberInside(playwright.request, baseURL, {}, `Uno ${t}`)
  const b = await memberInside(playwright.request, baseURL, {}, `Dos ${t}`)
  await deskPage(page, baseURL)
  await rowOf(page, a.member.name).getByRole('button', { name: /^Marcar salida/ }).click()
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(message(page)).toBeVisible()
  await expect(rowOf(page, b.member.name)).toBeVisible()
  expect(visit(b.id).status).toBe('active')
})

// ======================================================================================================== S-02

test('SS-40 S-02 of a paid student: identity, authorization, term, waiver, emergency contact, the visit and its actions', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS40 ${token()}`)
  await deskPage(page, baseURL)
  await rowOf(page, member.name).getByRole('link', { name: `Ver ${member.name}` }).click()
  await expect(page).toHaveURL(new RegExp(`/staff/sesiones/${id}$`))
  await expect(heading1(page, 'Persona y sesión')).toBeVisible()
  await expect(personName(page)).toHaveText(member.name)
  await expect(page.locator('.person-card')).toContainText('Socio estudiante')
  await expect(page.locator('.person-card')).toContainText('Autorización activa')
  await expect(page.locator('.person-card')).toContainText('Término: Término actual')
  await expect(page.locator('.person-card')).toContainText(/Waiver aceptado el .+ · Versión /)
  await expect(page.getByText('Contacto de emergencia', { exact: true })).toBeVisible()
  await expect(page.locator('.person-card__line').filter({ hasText: /787-555-\d{4}/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Sesión actual' })).toBeVisible()
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Activa')
  await expect(page.getByText('Tiempo dentro', { exact: true })).toBeVisible()
  for (const name of ['Marcar salida', 'Terminar antes', 'Anular']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  await expect(page.getByText('¿La foto no corresponde a la persona?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar foto pendiente' })).toBeVisible()
  await expect(page.getByAltText('Foto de identificación')).toBeVisible()
})

test('SS-41 S-02 of an athlete shows the student number in full, the sport and the athlete chip', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, { kind: 'athlete', sport: 'Voleibol' }, `Prueba SS41 ${token()}`)
  await openS02(page, baseURL, id)
  const number = studentNumber(member)
  expect(number).toMatch(/^\d{9}$/)
  await expect(page.locator('.person-card')).toContainText(`Núm. estudiante: ${number}`)
  await expect(page.locator('.person-card')).toContainText('Atleta')
  await expect(page.locator('.person-card')).toContainText('Voleibol · Autorización activa')
})

test('SS-42 Staff see only what REQ-NF-19 allows: the API sends no email, no phone of the person and no PIN', async ({ playwright, baseURL }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, { kind: 'athlete' }, `Prueba SS42 ${token()}`)
  const desk = await deskApi(playwright.request, baseURL)
  try {
    const detail = await rawApi(desk, 'get', `/api/staff/sessions/${id}`, baseURL!)
    const found = await rawApi(desk, 'get', `/api/staff/people?search=${encodeURIComponent(member.name)}`, baseURL!)
    const text = JSON.stringify([detail.body, found.body])
    expect(text).not.toContain(member.email)
    expect(Object.keys(detail.body.person).sort()).toEqual(['active_session', 'authorization', 'emergency_contact', 'has_photo', 'name', 'photo_pending', 'sport', 'student_number', 'type', 'user_id', 'waiver'])
    expect(found.body.people[0].masked_email).toMatch(/^p\*\*\*.@example\.com$/)
  } finally { await desk.dispose() }
})

test('SS-43 Marcar salida on S-02: the question names the person and the number, and the page shows the visit as registered', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, { kind: 'athlete' }, `Prueba SS43 ${token()}`)
  await openS02(page, baseURL, id)
  await page.getByRole('button', { name: 'Marcar salida', exact: true }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Confirmar salida' })).toBeVisible()
  await expect(dialog(page).getByText(`¿Marcar la salida de ${member.name}?`)).toBeVisible()
  await expect(dialog(page).getByText(`Núm. estudiante: ${studentNumber(member)}`)).toBeVisible()
  await expect(dialog(page).getByText('La sesión dejará de contar como activa. La visita se conserva.')).toBeVisible()
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(message(page)).toHaveText('Se marcó la salida.')
  await expect(page.getByRole('heading', { level: 2, name: 'Sesión registrada' })).toBeFocused()
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Salida marcada')
  await expect(page.getByText('Salida', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminar antes' })).toHaveCount(0)
  expect(visit(id).status).toBe('checked_out')
})

test('SS-44 Terminar antes: the visit ends now, is kept, and the audit log gets an entry', async ({ page, baseURL, playwright }) => {
  const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS44 ${token()}`)
  const before = auditCount('session.end_early')
  await openS02(page, baseURL, id)
  await page.getByRole('button', { name: 'Terminar antes' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Confirmar fin anticipado' })).toBeVisible()
  await expect(dialog(page).getByText('La sesión termina ahora y la visita se conserva con su duración real.')).toBeVisible()
  await confirmButton(page, 'Sí, terminar antes').click()
  await expect(message(page)).toHaveText('La sesión terminó antes.')
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Terminada antes')
  expect(visit(id).status).toBe('ended_early')
  expect(auditCount('session.end_early')).toBe(before + 1)
})

test('SS-45 Anular: the visit stops counting, is kept as void, and the audit log gets an entry', async ({ page, baseURL, playwright }) => {
  await withOccupancy(2, async () => {
    const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS45 ${token()}`)
    const before = auditCount('session.void')
    await openS02(page, baseURL, id)
    await page.getByRole('button', { name: 'Anular', exact: true }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Confirmar anulación' })).toBeVisible()
    await expect(dialog(page).getByText('Úsalo para corregir un Check In equivocado. La sesión no contará en la ocupación ni en las visitas.')).toBeVisible()
    await confirmButton(page, 'Sí, anular sesión').click()
    await expect(message(page)).toHaveText('La sesión se anuló.')
    await expect(page.locator('.session-card__head .team-chip')).toHaveText('Anulada')
    expect(visit(id).status).toBe('void')
    expect(auditCount('session.void')).toBe(before + 1)
    await page.goto('/staff')
    await expect(staffCount(page)).toHaveText('2')
  })
})

test('SS-46 Cancelar on each of the three S-02 questions leaves the visit active', async ({ page, baseURL, playwright }) => {
  const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS46 ${token()}`)
  await openS02(page, baseURL, id)
  for (const action of ['Marcar salida', 'Terminar antes', 'Anular']) {
    await page.getByRole('button', { name: action, exact: true }).click()
    await expect(dialog(page)).toBeVisible()
    await confirmButton(page, 'Cancelar').click()
    await expect(dialog(page)).toHaveCount(0)
  }
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Activa')
  expect(visit(id).status).toBe('active')
})

test('SS-47 an ended visit opened by its address shows "Sesión registrada", its exit and no session actions', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS47 ${token()}`)
  await deskCheckOut(playwright.request, baseURL, id)
  await deskPage(page, baseURL, 'staff', `/staff/sesiones/${id}`)
  await expect(personName(page)).toHaveText(member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Sesión registrada' })).toBeVisible()
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Salida marcada')
  await expect(page.locator('.session-card__facts').getByText('Salida', { exact: true })).toBeVisible()
  for (const name of ['Marcar salida', 'Terminar antes', 'Anular']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
})

test('SS-48 a visit that does not exist: "No se pudo cargar la información" with Reintentar and Volver a sesiones', async ({ page, baseURL }) => {
  await deskPage(page, baseURL, 'staff', '/staff/sesiones/999999999')
  await expect(page.getByRole('heading', { level: 2, name: 'No se pudo cargar la información' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver a sesiones' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
})

test('SS-49 state transition: the visit ends at another desk while S-02 is open; the action is not applied and "La sesión cambió" shows', async ({ page, baseURL, playwright }) => {
  const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS49 ${token()}`)
  await openS02(page, baseURL, id)
  await deskCheckOut(playwright.request, baseURL, id)
  await page.getByRole('button', { name: 'Anular', exact: true }).click()
  await confirmButton(page, 'Sí, anular sesión').click()
  await expect(page.getByRole('heading', { name: 'La sesión cambió' })).toBeVisible()
  await expect(page.getByText('Esta sesión ya terminó o cambió desde otra computadora.')).toBeVisible()
  await expect(page.getByText('Actualiza los datos antes de continuar. No se aplicó tu acción.')).toBeVisible()
  expect(visit(id).status).toBe('checked_out')
  await page.getByRole('button', { name: 'Actualizar datos' }).click()
  await expect(page.locator('.session-card__head .team-chip')).toHaveText('Salida marcada')
})

test('SS-50 Marcar foto pendiente on S-02: confirmation, the mark shows, the open visit stays open, the audit log gets an entry', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS50 ${token()}`)
  const before = auditCount('photo.pending')
  await openS02(page, baseURL, id)
  await page.getByRole('button', { name: 'Marcar foto pendiente' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Confirmar foto pendiente' })).toBeVisible()
  await expect(dialog(page).getByText(`¿Marcar como pendiente la foto de ${member.name}?`)).toBeVisible()
  await expect(dialog(page).getByText('Esta marca no termina su sesión actual.')).toBeVisible()
  await confirmButton(page, 'Sí, marcar foto pendiente').click()
  await expect(message(page)).toHaveText('La foto quedó marcada como pendiente.')
  await expect(page.getByRole('heading', { level: 2, name: 'Foto pendiente' })).toBeFocused()
  await expect(page.getByText('Debe subir una foto nueva desde su teléfono. No puede hacer Check In ni Check In asistido.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar foto pendiente' })).toHaveCount(0)
  expect(pendingAt(member)).not.toBeNull()
  expect(visit(id).status).toBe('active')
  expect(auditCount('photo.pending')).toBe(before + 1)
})

test('SS-51 a person whose authorization was revoked while inside: "Sin autorización vigente" and no photo question', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS51 ${token()}`)
  revokeAuthorization(member)
  await openS02(page, baseURL, id)
  await expect(page.locator('.person-card')).toContainText('Sin autorización vigente')
  await expect(page.getByRole('button', { name: 'Marcar foto pendiente' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Marcar salida', exact: true })).toBeVisible()
})

test('SS-52 the ID photo comes from the backend for an open visit (never cached) and is gone once the visit ended', async ({ page, baseURL, playwright }) => {
  const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS52 ${token()}`)
  const desk = await deskApi(playwright.request, baseURL)
  try {
    const open = await rawApi(desk, 'get', `/api/staff/sessions/${id}/photo`, baseURL!)
    expect(open.status).toBe(200)
    expect(open.headers['content-type']).toContain('image')
    expect(open.headers['cache-control']).toContain('no-store')
    await openS02(page, baseURL, id)
    await expect(page.getByAltText('Foto de identificación')).toBeVisible()
    await deskCheckOut(playwright.request, baseURL, id)
    expect((await rawApi(desk, 'get', `/api/staff/sessions/${id}/photo`, baseURL!)).status).toBe(404)
    await page.reload()
    await expect(page.getByRole('heading', { level: 2, name: 'Sesión registrada' })).toBeVisible()
    await expect(page.getByAltText('Foto de identificación')).toHaveCount(0)
    await expect(page.locator('.person-photo__initials').first()).toBeVisible()
  } finally { await desk.dispose() }
})

test('SS-53 a person without a term photo shows initials, not a broken image', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS53 ${token()}`)
  dropPhoto(member)
  await openS02(page, baseURL, id)
  await expect(page.locator('.person-photo__initials').first()).toHaveText('PS')
  await expect(page.getByAltText('Foto de identificación')).toHaveCount(0)
  expect(member.id).toBeGreaterThan(0)
})

test('SS-54 Back from S-02 returns to S-01 with the list', async ({ page, baseURL, playwright }) => {
  const { member } = await memberInside(playwright.request, baseURL, {}, `Prueba SS54 ${token()}`)
  await deskPage(page, baseURL)
  await rowOf(page, member.name).getByRole('link', { name: `Ver ${member.name}` }).click()
  await expect(heading1(page, 'Persona y sesión')).toBeVisible()
  await page.goBack()
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
  await expect(rowOf(page, member.name)).toBeVisible()
})

test('SS-55 an Administrator can check out, end early and void from S-02', async ({ page, baseURL, playwright }) => {
  const a = await memberInside(playwright.request, baseURL, {}, `Prueba SS55a ${token()}`)
  const b = await memberInside(playwright.request, baseURL, {}, `Prueba SS55b ${token()}`)
  await openS02(page, baseURL, a.id, 'admin')
  await page.getByRole('button', { name: 'Terminar antes' }).click()
  await confirmButton(page, 'Sí, terminar antes').click()
  await expect(message(page)).toHaveText('La sesión terminó antes.')
  await openS02(page, baseURL, b.id, 'admin')
  await page.getByRole('button', { name: 'Marcar salida', exact: true }).click()
  await confirmButton(page, 'Sí, marcar salida').click()
  await expect(message(page)).toHaveText('Se marcó la salida.')
  expect([visit(a.id).status, visit(b.id).status]).toEqual(['ended_early', 'checked_out'])
})

test('SS-56 S-02 without a connection: the actions are disabled and the page says when the data was updated', async ({ page, baseURL, playwright, context }) => {
  const { id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS56 ${token()}`)
  await openS02(page, baseURL, id)
  await context.setOffline(true)
  await expect(page.getByText(/^Sin conexión\. Datos actualizados a las /)).toBeVisible()
  for (const name of ['Marcar salida', 'Terminar antes', 'Anular', 'Marcar foto pendiente']) {
    await page.getByRole('button', { name, exact: true }).click({ force: true })
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-disabled', 'true')
  }
  await expect(dialog(page)).toHaveCount(0)
  await context.setOffline(false)
})

// ======================================================================================================== S-03

test('SS-60 the menu opens S-03 with the start state', async ({ page, baseURL }) => {
  await deskPage(page, baseURL)
  await page.getByRole('navigation', { name: 'Menú del dashboard' }).getByRole('link', { name: 'Buscar persona' }).click()
  await expect(page).toHaveURL(/\/staff\/buscar$/)
  await expect(heading1(page, 'Buscar persona y Check in asistido')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Busca a la persona' })).toBeVisible()
  await expect(page.getByText('Socios: busca por nombre. Atletas: usa el número de estudiante completo. Después de buscar podrás verificar su identidad.')).toBeVisible()
  await expect(findBox(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver roster' })).toHaveAttribute('href', '/staff/roster')
})

test('SS-61 search by full name finds one paid member: the card, no session, and the two verification buttons', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS61 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Verifica la identidad' })).toBeFocused()
  await expect(personName(page)).toHaveText(member.name)
  await expect(page.locator('.person-card')).toContainText('Socio estudiante')
  await expect(page.locator('.person-card')).toContainText('Autorización activa')
  await expect(page.getByText('Sin sesión activa. Revisa la foto antes de continuar.')).toBeVisible()
  await expect(page.getByText('Compara la foto con la persona que está frente a ti. Continuar todavía no registra la entrada.')).toBeVisible()
  await expect(page.getByAltText('Foto de identificación')).toBeVisible()
  await expect(page.getByRole('button', { name: 'La foto coincide · Continuar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'La foto no coincide' })).toBeVisible()
})

test('SS-62 search by the 9-digit student number finds the athlete and shows the number in full', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS62 ${token()}`, { kind: 'athlete' })
  const number = studentNumber(member)
  await openS03(page, baseURL)
  await search(page, number)
  await expect(personName(page)).toHaveText(member.name)
  await expect(page.locator('.person-card')).toContainText(`Núm. estudiante: ${number}`)
  await expect(page.locator('.person-card')).toContainText('Atleta')
})

test('SS-63 boundary: 8 and 10 digits are not a student number and find nothing', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS63 ${token()}`, { kind: 'athlete' })
  const number = studentNumber(member)
  await openS03(page, baseURL)
  for (const text of [number.slice(0, 8), `${number}0`]) {
    await search(page, text)
    await expect(page.getByRole('heading', { level: 2, name: 'No encontramos coincidencias' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver a buscar' }).click()
  }
})

test('SS-64 a 9-digit number of a roster record nobody claimed finds nothing (no account to enter with)', async ({ page, baseURL }) => {
  const number = unclaimedRoster()
  await openS03(page, baseURL)
  await search(page, number)
  await expect(page.getByRole('heading', { level: 2, name: 'No encontramos coincidencias' })).toBeVisible()
})

test('SS-65 no match: the message, "Volver a buscar" empties the box, and "Ver roster" opens S-05', async ({ page, baseURL }) => {
  await openS03(page, baseURL)
  await search(page, `Nadie ${token()}`)
  await expect(page.getByRole('heading', { level: 2, name: 'No encontramos coincidencias' })).toBeFocused()
  await expect(page.getByText('Revisa el nombre o el número de estudiante e intenta otra vez. También puedes consultar el roster.')).toBeVisible()
  await page.getByRole('button', { name: 'Volver a buscar' }).click()
  await expect(findBox(page)).toHaveValue('')
  await expect(findBox(page)).toBeFocused()
  await expect(page.getByRole('heading', { level: 2, name: 'Busca a la persona' })).toBeVisible()
  await search(page, `Nadie ${token()}`)
  await page.getByRole('link', { name: 'Ver roster' }).last().click()
  await expect(page).toHaveURL(/\/staff\/roster$/)
})

test('SS-66 an empty or all-space search does nothing', async ({ page, baseURL }) => {
  await openS03(page, baseURL)
  let sent = 0
  page.on('request', (request) => { if (request.url().includes('/api/staff/people?')) sent += 1 })
  await search(page, '')
  await search(page, '    ')
  await page.waitForTimeout(500)
  await expect(page.getByRole('heading', { level: 2, name: 'Busca a la persona' })).toBeVisible()
  expect(sent).toBe(0)
})

test('SS-67 several people with the name: "Selecciona a la persona" with masked emails, and the choice opens that person', async ({ page, baseURL }) => {
  const t = token()
  const a = createNamed(`Gemelo ${t} A`)
  const b = createNamed(`Gemelo ${t} B`)
  await openS03(page, baseURL)
  await search(page, `gemelo ${t}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Selecciona a la persona' })).toBeFocused()
  await expect(page.getByText('Hay varias cuentas con ese nombre. Comprueba cuál corresponde a la persona presente.')).toBeVisible()
  await expect(page.locator('.find-select__item')).toHaveCount(2)
  await expect(page.locator('.find-select__item').first()).toContainText(/ · p\*\*\*.@example\.com/)
  await page.getByRole('button', { name: `Seleccionar a ${b.name}` }).click()
  await expect(personName(page)).toHaveText(b.name)
  expect(a.id).not.toBe(b.id)
})

test('SS-68 boundary: 11 people match, the list shows the first 10', async ({ page, baseURL }) => {
  test.setTimeout(240_000)
  const t = token()
  for (let n = 1; n <= 11; n++) createNamed(`Racimo ${t} ${String(n).padStart(2, '0')}`)
  await openS03(page, baseURL)
  await search(page, `racimo ${t}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Selecciona a la persona' })).toBeVisible()
  await expect(page.locator('.find-select__item')).toHaveCount(10)
})

test('SS-69 an athlete can also be found by name, in any letter case', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS69 ${token()}`, { kind: 'athlete' })
  await openS03(page, baseURL)
  await search(page, member.name.toUpperCase())
  await expect(personName(page)).toHaveText(member.name)
})

test('SS-70 assisted Check In of a paid member: confirm, back on S-01 with the welcome and the highlighted row, logged as an exception', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS70 ${token()}`)
  const before = auditCount('check_in.assisted')
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Confirmar Check in' })).toBeVisible()
  await expect(dialog(page).getByText(`Confirmas que la foto corresponde a ${member.name}. ¿Registrar su entrada ahora?`)).toBeVisible()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(page).toHaveURL(/\/staff$/)
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Check in registrado' })).toBeVisible()
  await expect(page.getByText(`${member.name} ya aparece en sesiones activas.`)).toBeVisible()
  await expect(rowOf(page, member.name)).toHaveClass(/sessions-row--new/)
  const visits = visitsOf(member)
  expect(visits).toHaveLength(1)
  expect(visits[0]).toMatchObject({ status: 'active', assisted: true })
  expect(auditCount('check_in.assisted')).toBe(before + 1)
  await page.reload()
  await expect(rowOf(page, member.name)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Check in registrado' })).toHaveCount(0)
})

test('SS-71 assisted Check In of an athlete found by student number', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS71 ${token()}`, { kind: 'athlete' })
  await openS03(page, baseURL)
  await search(page, studentNumber(member))
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(rowOf(page, member.name).getByRole('cell').nth(3)).toHaveText('Atleta')
  expect(visitsOf(member)[0]).toMatchObject({ status: 'active', assisted: true })
})

test('SS-72 Cancelar on the Check In question registers nothing', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS72 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Cancelar').click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Verifica la identidad' })).toBeVisible()
  expect(visitsOf(member)).toHaveLength(0)
})

test('SS-73 "La foto no coincide": the question, then the mark; no entry, the refusal shows and the confirm button is off', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS73 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto no coincide' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Marcar foto pendiente' })).toBeVisible()
  await expect(dialog(page).getByText(`La foto no corresponde a ${member.name}. Al marcarla como pendiente, no se registra la entrada y se bloquea el Check in hasta que suba una foto nueva desde su teléfono.`)).toBeVisible()
  await confirmButton(page, 'Marcar foto pendiente').click()
  await expect(page.getByRole('heading', { level: 2, name: 'Foto pendiente de actualizar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar Check in' })).toHaveAttribute('aria-disabled', 'true')
  expect(pendingAt(member)).not.toBeNull()
  expect(visitsOf(member)).toHaveLength(0)
})

for (const [id, label, authorization, count] of [
  ['SS-74', 'a past term only', 'ended', 1],
  ['SS-75', 'a term that has not started', 'future', 1],
  ['SS-76', 'a revoked authorization', 'revoked', 1],
  ['SS-77', 'no authorization at all', 'none', 1],
] as const) {
  test(`${id} ${label}: "Sin autorización vigente", no entry and a way back to the search`, async ({ page, baseURL }) => {
    const member = createNamed(`Prueba ${id} ${token()}`, { authorization })
    await openS03(page, baseURL)
    await search(page, member.name)
    await expect(page.getByRole('heading', { level: 2, name: 'Sin autorización vigente' }).first()).toBeVisible()
    await expect(page.getByText('Esta cuenta no tiene autorización vigente para usar el gimnasio. No se registró ninguna entrada. Contacta a Administración.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'La foto coincide · Continuar' })).toHaveCount(0)
    await page.locator('.state').getByRole('button', { name: 'Volver a buscar' }).click()
    await expect(findBox(page)).toHaveValue('')
    expect(visitsOf(member)).toHaveLength(0)
    expect(count).toBe(1)
  })
}

test('SS-78 no term photo: "Falta la foto del término" with the confirm button off', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS78 ${token()}`, { photo: false })
  await openS03(page, baseURL)
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Falta la foto del término' })).toBeVisible()
  await expect(page.getByText('La persona debe subir la foto del término desde su teléfono antes de hacer Check in. Staff no toma fotos.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar Check in' })).toHaveAttribute('aria-disabled', 'true')
  expect(visitsOf(member)).toHaveLength(0)
})

test('SS-79 photo already pending: "Foto pendiente de actualizar" with the confirm button off', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS79 ${token()}`)
  setPhotoPending(member, true)
  await openS03(page, baseURL)
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Foto pendiente de actualizar' })).toBeVisible()
  await expect(page.getByText('La foto está marcada como pendiente. La persona debe subir una nueva desde su teléfono antes de hacer Check in.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar Check in' })).toHaveAttribute('aria-disabled', 'true')
})

test('SS-80 a person already inside: "Ya tiene una sesión activa" with the time, a link to S-02, and no second visit', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS80 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Ya tiene una sesión activa' })).toBeVisible()
  await expect(page.getByText(new RegExp(`^${member.name} ya tiene Check in registrado hoy a las .+\\. No se registró otra entrada\\.$`))).toBeVisible()
  await expect(page.getByRole('button', { name: 'La foto coincide · Continuar' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Volver a sesiones' })).toHaveAttribute('href', '/staff')
  await page.getByRole('link', { name: 'Ver sesión' }).click()
  await expect(page).toHaveURL(new RegExp(`/staff/sesiones/${id}$`))
  expect(visitsOf(member)).toHaveLength(1)
})

test('SS-81 the connection fails when the entry is confirmed: "No pudimos confirmar la entrada", and Actualizar datos checks again', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS81 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.route('**/api/staff/check-in', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }), { times: 1 })
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(page.getByRole('heading', { level: 2, name: 'No pudimos confirmar la entrada' })).toBeVisible()
  await expect(page.getByText('No recibimos la confirmación del Check in. Actualiza los datos para comprobar si ya existe una sesión antes de volver a intentarlo.')).toBeVisible()
  await page.getByRole('button', { name: 'Actualizar datos' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Verifica la identidad' })).toBeVisible()
  expect(visitsOf(member)).toHaveLength(0)
})

test('SS-82 a double click on the confirm button makes one visit', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS82 ${token()}`)
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').dblclick()
  await expect(rowOf(page, member.name)).toBeVisible()
  expect(visitsOf(member)).toHaveLength(1)
})

test('SS-83 no connection on S-03: searching says "Sin conexión" and the confirm button is off', async ({ page, baseURL, context }) => {
  await openS03(page, baseURL)
  await context.setOffline(true)
  await search(page, 'cualquiera')
  await expect(page.getByRole('heading', { level: 2, name: 'Sin conexión' })).toBeVisible()
  await expect(page.getByText('Conéctate a internet para buscar personas o registrar entradas. No podemos confirmar si los datos están actualizados.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar Check in' })).toHaveAttribute('aria-disabled', 'true')
  await context.setOffline(false)
})

test('SS-84 coming from S-05 with ?numero=: the box is filled and the search runs once', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS84 ${token()}`, { kind: 'athlete' })
  const number = studentNumber(member)
  let sent = 0
  page.on('request', (request) => { if (request.url().includes('/api/staff/people?')) sent += 1 })
  await deskPage(page, baseURL, 'staff', `/staff/buscar?numero=${number}`)
  await expect(findBox(page)).toHaveValue(number)
  await expect(personName(page)).toHaveText(member.name)
  expect(sent).toBe(1)
})

test('SS-85 the search itself fails: "No pudimos buscar a la persona" with Reintentar', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS85 ${token()}`)
  await openS03(page, baseURL)
  const broken = (url: URL) => url.pathname === '/api/staff/people'
  await page.route(broken, (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }))
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'No pudimos buscar a la persona' })).toBeVisible()
  await expect(page.getByText('Ocurrió un error al consultar los datos. Inténtalo de nuevo.')).toBeVisible()
  await page.unroute(broken)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(personName(page)).toHaveText(member.name)
})

test('SS-86 an Administrator can run the assisted Check In', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS86 ${token()}`)
  await openS03(page, baseURL, 'admin')
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(rowOf(page, member.name)).toBeVisible()
  expect(visitsOf(member)[0]).toMatchObject({ status: 'active', assisted: true })
})

test('SS-87 the assisted Check In API refuses a missing or unknown person (422, 404) and a photo mark on a person with no authorization (409)', async ({ playwright, baseURL }) => {
  const none = createMember({ authorization: 'none' })
  const desk = await deskApi(playwright.request, baseURL)
  try {
    expect((await rawApi(desk, 'post', '/api/staff/check-in', baseURL!, {})).status).toBe(422)
    expect((await rawApi(desk, 'post', '/api/staff/check-in', baseURL!, { user_id: 0 })).status).toBe(422)
    expect((await rawApi(desk, 'post', '/api/staff/check-in', baseURL!, { user_id: 999999999 })).status).toBe(404)
    expect((await rawApi(desk, 'post', '/api/staff/check-in', baseURL!, { user_id: none.id })).body.error.code).toBe('check_in_no_authorization')
    expect((await rawApi(desk, 'post', `/api/staff/people/${none.id}/photo-pending`, baseURL!)).status).toBe(409)
    expect((await rawApi(desk, 'get', '/api/staff/people', baseURL!)).status).toBe(422)
  } finally { await desk.dispose() }
})

test('SS-88 after a check-out the same person can be checked in again: a second visit, the first kept', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS88 ${token()}`)
  await deskCheckOut(playwright.request, baseURL, id)
  await openS03(page, baseURL)
  await search(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(rowOf(page, member.name)).toBeVisible()
  const visits = visitsOf(member)
  expect(visits.map((row) => row.status)).toEqual(['checked_out', 'active'])
  expect(visits[1].assisted).toBe(true)
})

test('SS-89 a visit that ran past its 2 hours is not "inside": the person can be checked in at the desk', async ({ page, baseURL, playwright }) => {
  const { member, id } = await memberInside(playwright.request, baseURL, {}, `Prueba SS89 ${token()}`)
  endVisitEarlier(id, 180, 60)
  closeDue()
  await openS03(page, baseURL)
  await search(page, member.name)
  await expect(page.getByRole('heading', { level: 2, name: 'Verifica la identidad' })).toBeVisible()
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await confirmButton(page, 'Confirmar Check in').click()
  await expect(rowOf(page, member.name)).toBeVisible()
  expect(openVisitId(member)).not.toBeNull()
})

test('SS-90 the welcome address is read once: a foreign ?registrado= shows no welcome and the address is cleaned', async ({ page, baseURL }) => {
  await deskPage(page, baseURL, 'staff', '/staff?registrado=999999999')
  await expect(heading1(page, 'Sesiones activas')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Check in registrado' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/staff$/)
})

// ----------------------------------------------------------------------- schedule rows: they end other visits, so last

test('SS-91 gym closed by a closure: the chip says it, the desk Check In is refused with "Gimnasio cerrado" and nothing is recorded', async ({ page, baseURL }) => {
  const member = createNamed(`Prueba SS91 ${token()}`)
  const closure = addClosure()
  try {
    await openS03(page, baseURL)
    await search(page, member.name)
    await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
    await confirmButton(page, 'Confirmar Check in').click()
    await expect(page.getByRole('heading', { level: 2, name: 'Gimnasio cerrado' }).first()).toBeVisible()
    await expect(page.getByText('El gimnasio está cerrado en este momento. No se puede registrar la entrada desde Staff.')).toBeVisible()
    expect(visitsOf(member)).toHaveLength(0)
    await page.goto('/staff')
    await expect(page.locator('.staff-gym')).toHaveText('Gimnasio cerrado')
  } finally { deleteSlot(closure) }
})

test('SS-92 athletes-only period: a paid member is refused at the desk, an athlete is accepted, and the chip says it', async ({ page, baseURL }) => {
  const paid = createNamed(`Prueba SS92p ${token()}`)
  const athlete = createNamed(`Prueba SS92a ${token()}`, { kind: 'athlete' })
  const period = addPeriod(-1, 60)
  try {
    await openS03(page, baseURL)
    await search(page, paid.name)
    await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
    await confirmButton(page, 'Confirmar Check in').click()
    await expect(page.getByRole('heading', { level: 2, name: 'Horario exclusivo para atletas' }).first()).toBeVisible()
    await expect(page.getByText('Durante este horario solo pueden entrar atletas autorizados. Este socio debe esperar al horario general.')).toBeVisible()
    expect(visitsOf(paid)).toHaveLength(0)
    await page.getByRole('button', { name: 'Volver a buscar' }).click()
    await search(page, athlete.name)
    await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
    await confirmButton(page, 'Confirmar Check in').click()
    await expect(rowOf(page, athlete.name)).toBeVisible()
    await expect(page.locator('.staff-gym')).toHaveText('Horario exclusivo para atletas')
  } finally { deleteSlot(period) }
})
