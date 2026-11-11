import { expect, test, type Page } from '@playwright/test'
import { flushCache, rawApi, resetSchedule, dropMarkedSlots, signInApi } from './setup.ts'
import { release, setOccupancy, ensurePhotoFile } from './setup-occupancy.ts'
import {
  auditCount, createNamed, deskApi, deskPage, dialog, findBox, hold, listTitle, message, onlyDesktop, phoneFor, POLL_WAIT, rowOf, staffCount, token, visit,
  visitsOf,
} from './setup-sessions.ts'

// #152 cross-device path tests: the phone (Pixel 7 profile, second browser context, location faked at the gym) and the front desk
// dashboard (desktop Chrome) on the same stack (SS-X-01 to SS-X-13).

test.setTimeout(180_000)

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

const lead = (page: Page) => page.locator('.check-in-lead')
const gymCount = (page: Page) => page.locator('.gym-occupancy__count strong')
const LATER = 'Tu entrada está registrada'
const READY = '¿Listo para entrenar?'
const REGISTERED = '¡Tu entrada quedó registrada!'
const ENDED = 'Tu visita ha terminado'
const DESK_REASON = 'Tu salida fue registrada por el personal.'
const phoneTimes = (page: Page) => page.locator('.check-in-id__time')
const flat = (text: string | null) => (text ?? '').replace(/[  ]/g, ' ').trim()

async function withOccupancy<T>(n: number, body: () => Promise<T>): Promise<T> {
  const state = setOccupancy(n)
  try { return await body() } finally { release(state) }
}

/** A phone signed in as the member, on Check In. */
async function phoneOf(browser: Parameters<typeof phoneFor>[0], baseURL: string | undefined, member: Parameters<typeof signInApi>[2]) {
  const phone = await phoneFor(browser, baseURL)
  await signInApi(phone.page.request, baseURL!, member)
  await phone.page.goto('/check-in')
  return phone
}

/** The member holds the button on the phone until the Gym ID shows. */
async function phoneCheckIn(page: Page) {
  await expect(lead(page)).toHaveText(READY)
  await hold(page)
  await expect(lead(page)).toHaveText(REGISTERED)
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
}

async function deskRow(page: Page, name: string) {
  await expect(rowOf(page, name)).toBeVisible({ timeout: POLL_WAIT })
}

test('SS-X-01 a Check In on the phone appears in S-01 at the next poll, and the count goes up on the desk and on the phone', async ({ page, browser, baseURL }) => {
  await withOccupancy(3, async () => {
    const member = createNamed(`Prueba SSX01 ${token()}`)
    await deskPage(page, baseURL)
    await expect(staffCount(page)).toHaveText('3')
    const phone = await phoneOf(browser, baseURL, member)
    try {
      await phoneCheckIn(phone.page)
      await deskRow(page, member.name)
      await expect(staffCount(page)).toHaveText('4', { timeout: POLL_WAIT })
      await expect(rowOf(page, member.name).getByRole('cell').nth(3)).toHaveText('Socio estudiante')
      await phone.page.goto('/gym')
      await expect(gymCount(phone.page)).toHaveText('4')
    } finally { await phone.context.close() }
  })
})

test('SS-X-02 the same number on the phone (Gimnasio) and on the desk (S-01) with the same level and bar', async ({ page, browser, baseURL }) => {
  await withOccupancy(14, async () => {
    const member = createNamed(`Prueba SSX02 ${token()}`)
    const phone = await phoneOf(browser, baseURL, member)
    try {
      await phoneCheckIn(phone.page)
      await phone.page.goto('/gym')
      await deskPage(page, baseURL)
      await expect(gymCount(phone.page)).toHaveText('15')
      await expect(staffCount(page)).toHaveText('15')
      await expect(phone.page.locator('.gym-occupancy__count')).toContainText('Moderada')
      await expect(page.locator('.staff-occupancy__level')).toHaveText('Moderada')
      await expect(listTitle(page)).toHaveText('15 sesiones activas')
    } finally { await phone.context.close() }
  })
})

test('SS-X-03 a check-out from the S-01 list ends the visit on the phone and drops both counts', async ({ page, browser, baseURL }) => {
  await withOccupancy(2, async () => {
    const member = createNamed(`Prueba SSX03 ${token()}`)
    const phone = await phoneOf(browser, baseURL, member)
    try {
      await phoneCheckIn(phone.page)
      await deskPage(page, baseURL)
      await deskRow(page, member.name)
      await expect(staffCount(page)).toHaveText('3')
      await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
      await dialog(page).getByRole('button', { name: 'Sí, marcar salida' }).click()
      await expect(message(page)).toHaveText(`Se marcó la salida de ${member.name}.`)
      await expect(staffCount(page)).toHaveText('2')
      await expect(lead(phone.page)).toHaveText(ENDED, { timeout: POLL_WAIT })
      await expect(phone.page.locator('.check-in-caption')).toHaveText(DESK_REASON)
      await expect(phone.page.getByText('Sesión activa', { exact: true })).toHaveCount(0)
      await phone.page.goto('/gym')
      await expect(gymCount(phone.page)).toHaveText('2')
    } finally { await phone.context.close() }
  })
})

test('SS-X-04 a check-out from S-02 ends the visit on the phone', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX04 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await phoneCheckIn(phone.page)
    const id = visitsOf(member)[0].id
    await deskPage(page, baseURL, 'staff', `/staff/sesiones/${id}`)
    await page.getByRole('button', { name: 'Marcar salida', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Sí, marcar salida' }).click()
    await expect(message(page)).toHaveText('Se marcó la salida.')
    await expect(lead(phone.page)).toHaveText(ENDED, { timeout: POLL_WAIT })
    await expect(phone.page.locator('.check-in-caption')).toHaveText(DESK_REASON)
    await expect(phone.page.getByText('Duración total', { exact: true })).toBeVisible()
  } finally { await phone.context.close() }
})

test('SS-X-05 "Terminar antes" on S-02 reaches the phone as the same ended view (Staff ending early means a check-out for the person)', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX05 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await phoneCheckIn(phone.page)
    await deskPage(page, baseURL, 'staff', `/staff/sesiones/${visitsOf(member)[0].id}`)
    await page.getByRole('button', { name: 'Terminar antes' }).click()
    await dialog(page).getByRole('button', { name: 'Sí, terminar antes' }).click()
    await expect(message(page)).toHaveText('La sesión terminó antes.')
    await expect(lead(phone.page)).toHaveText(ENDED, { timeout: POLL_WAIT })
    await expect(phone.page.locator('.check-in-caption')).toHaveText(DESK_REASON)
  } finally { await phone.context.close() }
})

test('SS-X-06 "Anular" on S-02 takes the visit off the phone: no ended view for a voided visit, the ready screen returns, the count drops', async ({ page, browser, baseURL }) => {
  await withOccupancy(2, async () => {
    const member = createNamed(`Prueba SSX06 ${token()}`)
    const phone = await phoneOf(browser, baseURL, member)
    try {
      await phoneCheckIn(phone.page)
      await deskPage(page, baseURL, 'staff', `/staff/sesiones/${visitsOf(member)[0].id}`)
      await page.getByRole('button', { name: 'Anular', exact: true }).click()
      await dialog(page).getByRole('button', { name: 'Sí, anular sesión' }).click()
      await expect(message(page)).toHaveText('La sesión se anuló.')
      await expect(lead(phone.page)).toHaveText(READY, { timeout: POLL_WAIT })
      await phone.page.goto('/gym')
      await expect(gymCount(phone.page)).toHaveText('2')
    } finally { await phone.context.close() }
  })
})

test('SS-X-07 an assisted Check In on S-03 shows the open visit on the phone of that member, with the entry time of S-01', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX07 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await expect(lead(phone.page)).toHaveText(READY)
    await deskPage(page, baseURL, 'staff', '/staff/buscar')
    await findBox(page).fill(member.name)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
    await dialog(page).getByRole('button', { name: 'Confirmar Check in' }).click()
    await expect(rowOf(page, member.name)).toBeVisible()
    await expect(lead(phone.page)).toHaveText(LATER, { timeout: POLL_WAIT })
    await expect(phone.page.getByText('Sesión activa', { exact: true })).toBeVisible()
    expect(flat(await phoneTimes(phone.page).first().textContent())).toBe(flat(await rowOf(page, member.name).getByRole('cell').nth(1).textContent()))
    expect(visitsOf(member)[0].assisted).toBe(true)
  } finally { await phone.context.close() }
})

test('SS-X-08 an assisted Check In of an athlete shows the athlete Gym ID on the phone', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX08 ${token()}`, { kind: 'athlete' })
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await expect(lead(phone.page)).toHaveText(READY)
    await deskPage(page, baseURL, 'staff', '/staff/buscar')
    await findBox(page).fill(member.name)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
    await dialog(page).getByRole('button', { name: 'Confirmar Check in' }).click()
    await expect(rowOf(page, member.name).getByRole('cell').nth(3)).toHaveText('Atleta')
    await expect(lead(phone.page)).toHaveText(LATER, { timeout: POLL_WAIT })
    await expect(phone.page.locator('.check-in-id__category')).toHaveText('Atleta')
  } finally { await phone.context.close() }
})

test('SS-X-09 a photo marked pending at the desk (S-03) blocks the person own Check In on the phone, with the pending-photo message', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX09 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await expect(lead(phone.page)).toHaveText(READY)
    await deskPage(page, baseURL, 'staff', '/staff/buscar')
    await findBox(page).fill(member.name)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page.getByRole('button', { name: 'La foto no coincide' }).click()
    await dialog(page).getByRole('button', { name: 'Marcar foto pendiente' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Foto pendiente de actualizar' })).toBeVisible()
    await hold(phone.page)
    await expect(phone.page.getByRole('heading', { name: 'Tu foto necesita actualizarse' })).toBeVisible()
    await expect(phone.page.getByText('El personal marcó tu foto como pendiente. Carga una foto nueva desde tu teléfono.')).toBeVisible()
    expect(visitsOf(member)).toHaveLength(0)
  } finally { await phone.context.close() }
})

test('SS-X-10 after the phone Check In, S-03 finds the person already inside and offers the visit instead of a second entry', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX10 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await phoneCheckIn(phone.page)
    await deskPage(page, baseURL, 'staff', '/staff/buscar')
    await findBox(page).fill(member.name)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Ya tiene una sesión activa' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver sesión' }).click()
    await expect(page.locator('.session-card__head .team-chip')).toHaveText('Activa')
    expect(visitsOf(member)).toHaveLength(1)
  } finally { await phone.context.close() }
})

test('SS-X-11 after an assisted Check In the phone own Check In opens the same visit and makes no second one', async ({ page, browser, baseURL }) => {
  await withOccupancy(1, async () => {
    const member = createNamed(`Prueba SSX11 ${token()}`)
    const phone = await phoneOf(browser, baseURL, member)
    try {
      await deskPage(page, baseURL, 'staff', '/staff/buscar')
      await findBox(page).fill(member.name)
      await page.getByRole('button', { name: 'Buscar', exact: true }).click()
      await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
      await dialog(page).getByRole('button', { name: 'Confirmar Check in' }).click()
      await expect(rowOf(page, member.name)).toBeVisible()
      await phone.page.reload()
      await expect(lead(phone.page)).toHaveText(LATER)
      const answer = await rawApi(phone.page.request, 'post', '/api/user/check-in', baseURL!, { latitude: 18.211, longitude: -67.141, accuracy: 12 })
      expect(answer.status).toBe(200)
      expect(visitsOf(member)).toHaveLength(1)
      await expect(staffCount(page)).toHaveText('2', { timeout: POLL_WAIT })
    } finally { await phone.context.close() }
  })
})

test('SS-X-12 two desks do the assisted Check In of the same person at once: one visit, the other desk is told the person is already inside', async ({ playwright, baseURL }) => {
  const member = createNamed(`Prueba SSX12 ${token()}`)
  const before = auditCount('check_in.assisted')
  const one = await deskApi(playwright.request, baseURL)
  const two = await deskApi(playwright.request, baseURL, 'admin')
  try {
    const body = { user_id: member.id }
    const [a, b] = await Promise.all([rawApi(one, 'post', '/api/staff/check-in', baseURL!, body), rawApi(two, 'post', '/api/staff/check-in', baseURL!, body)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const refused = a.status === 409 ? a : b
    expect(refused.body.error.code).toBe('check_in_session_active')
    expect(refused.body.error.details?.session?.id ?? refused.body.error.session?.id).toBe(visitsOf(member)[0].id)
    expect(visitsOf(member)).toHaveLength(1)
    expect(auditCount('check_in.assisted')).toBe(before + 1)
  } finally { await one.dispose(); await two.dispose() }
})

test('SS-X-13 state transition: after the desk check-out the phone can check in again and the new visit is a new S-01 row', async ({ page, browser, baseURL }) => {
  const member = createNamed(`Prueba SSX13 ${token()}`)
  const phone = await phoneOf(browser, baseURL, member)
  try {
    await phoneCheckIn(phone.page)
    await deskPage(page, baseURL)
    await deskRow(page, member.name)
    await rowOf(page, member.name).getByRole('button', { name: /^Marcar salida/ }).click()
    await dialog(page).getByRole('button', { name: 'Sí, marcar salida' }).click()
    await expect(rowOf(page, member.name)).toHaveCount(0)
    await expect(lead(phone.page)).toHaveText(ENDED, { timeout: POLL_WAIT })
    await phone.page.getByRole('button', { name: 'Continuar' }).click()
    await phoneCheckIn(phone.page)
    await deskRow(page, member.name)
    expect(visitsOf(member).map((row) => row.status)).toEqual(['checked_out', 'active'])
    expect(visit(visitsOf(member)[1].id).assisted).toBe(false)
  } finally { await phone.context.close() }
})
