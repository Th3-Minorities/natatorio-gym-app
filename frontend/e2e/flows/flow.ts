import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Shared steps of the #152 flow tests. They run through the proxy against the real API and the seeded data
// (backend/database/seeders/FakeDataSeeder.php), one browser at a time (--workers=1, as CI runs them).

/** Seeded paid member with a current authorization and a photo (FakeDataSeeder::CHECK_IN_EMAIL), password "password". */
export const MEMBER = { email: 'pago-activo@example.com', password: 'password' }
export const STAFF = { email: 'staff@example.com', password: 'password' }
export const ADMIN = { email: 'admin@example.com', name: 'Administradora de prueba', password: 'password' }

// GymBoundary placeholder center (CHECK_IN_CENTER_* empty), about 1 km north of it, and a fix worse than the 50 m maximum.
export const INSIDE = { latitude: 18.211, longitude: -67.141, accuracy: 12 }
export const OUTSIDE = { latitude: 18.22, longitude: -67.141, accuracy: 12 }
export const COARSE = { latitude: 18.211, longitude: -67.141, accuracy: 500 }
export const DENIED = 1

/**
 * Waits for the answer to a Check In attempt that reached the API. The seeded hours (FakeDataSeeder::content) are Monday to
 * Friday 6:00 to 22:00 Puerto Rico time, and Saturday 8:00 to 12:00 for athletes only. Outside them the API refuses before it
 * looks at the location, so the rest of the test cannot run: it checks the refusal is right for the clock, then skips.
 */
export async function unlessClosed(page: Page, expected: Locator) {
  const closed = page.getByRole('heading', { name: 'El gimnasio está cerrado' })
  const athletes = page.getByRole('heading', { name: 'Ahora entrenan los atletas' })
  await expect(expected.or(closed).or(athletes).first()).toBeVisible()
  if (await closed.isVisible()) {
    expect(seededHoursOpen(), 'the API answered closed inside the seeded hours').toBe(false)
    test.skip(true, 'The gym is closed now (seeded hours: Monday to Friday 6:00 to 22:00, Puerto Rico time).')
  }
  test.skip(await athletes.isVisible(), 'Athletes-only period now (seeded Saturday 8:00 to 12:00): members cannot Check In.')
}

function seededHoursOpen(now = new Date()): boolean {
  const local = new Date(now.getTime() - 4 * 3_600_000)
  const day = local.getUTCDay()
  const hour = local.getUTCHours()
  return day >= 1 && day <= 5 && hour >= 6 && hour < 22
}

/** Replaces the browser's location with a fixed one, or with a permission error code, read at each Check In. */
export async function fakeLocation(page: Page, where: typeof INSIDE | typeof DENIED) {
  await page.addInitScript(() => {
    const state = globalThis as unknown as { e2eLocation: unknown }
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: (position: object) => void, error: (failure: object) => void) {
          const where = state.e2eLocation
          if (typeof where === 'number') error({ code: where })
          else success({ coords: where })
        },
      },
    })
  })
  await moveTo(page, where)
}

/** Changes the faked location for the next Check In, without reloading. */
export async function moveTo(page: Page, where: typeof INSIDE | typeof DENIED) {
  await page.addInitScript((value) => { (globalThis as unknown as { e2eLocation: unknown }).e2eLocation = value }, where)
  await page.evaluate((value) => { (globalThis as unknown as { e2eLocation: unknown }).e2eLocation = value }, where)
}

/** Holds "Mantén presionado para entrar" for the full second, with the keyboard. */
export async function holdToCheckIn(page: Page) {
  const hold = page.getByRole('button', { name: 'Mantén presionado para entrar' })
  await hold.focus()
  await page.keyboard.down(' ')
  await page.waitForTimeout(1100)
  await page.keyboard.up(' ')
}

export async function signInUser(page: Page, email: string, password: string) {
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible()
}

/** A JSON API call with a request context's own cookies, the way the app sends it (XSRF header, Referer for Sanctum). */
export async function api(request: APIRequestContext, method: 'get' | 'post', path: string, baseURL: string, data?: object) {
  if (method === 'post' && !(await request.storageState()).cookies.some((cookie) => cookie.name === 'XSRF-TOKEN')) {
    await request.get('/api/sanctum/csrf-cookie', { headers: { Referer: `${baseURL}/` } })
  }
  const token = (await request.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  const headers = { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': decodeURIComponent(token) }
  const response = await request[method](path, { headers, data })
  const text = await response.text()
  expect(response.ok(), `${method.toUpperCase()} ${path} answered ${response.status()}: ${text}`).toBe(true)
  return { status: response.status(), body: text ? JSON.parse(text) : null }
}

/** The front desk check-out. Its screen is not on main yet, so the test calls the API the desk will use, as the seeded Staff. */
export async function frontDeskCheckOut(request: APIRequestContext, baseURL: string, sessionId: number | string) {
  await api(request, 'post', '/api/staff/sign-in', baseURL, STAFF)
  await api(request, 'post', `/api/staff/sessions/${sessionId}/check-out`, baseURL)
  await api(request, 'post', '/api/staff/sign-out', baseURL)
}

/** Signs the member in and starts with no open visit: one left by the seed or by an earlier run is checked out at the desk. */
export async function memberWithoutOpenVisit(page: Page, request: APIRequestContext, baseURL: string) {
  await signInUser(page, MEMBER.email, MEMBER.password)
  const { body } = await api(page.request, 'get', '/api/user/check-in', baseURL)
  if (body.session) await frontDeskCheckOut(request, baseURL, body.session.id)
}

/** Opens Check In ready to hold. The member always has an earlier visit, so "Tu visita ha terminado" shows first. */
export async function openCheckIn(page: Page) {
  await page.goto('/check-in')
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('¿Listo para entrenar?', { exact: true })).toBeVisible()
}
