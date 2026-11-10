import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Screenshots of the demo flows for the test plan evidence (#81, docs/testing/test-plan.md). It runs on a fresh seed
// through the proxy, never in CI. A screen that is not on this branch yet is skipped with its reason.

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = fileURLToPath(new URL('../../docs/testing/evidence/screenshots/', import.meta.url))
const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 1024 }
// The gym's coordinates, the default Check In boundary (backend/app/Support/GymBoundary.php).
const GYM = { latitude: 18.211, longitude: -67.141 }

test.setTimeout(120_000)

/** Runs PHP in the app container and returns what it printed. Only for seeded, fake data. */
function tinker(code: string): string {
  return execFileSync('docker', ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'tinker', '--execute', code], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
}

/** A seeded paid member who may Check In now and has no open visit. Every seeded password is "password". */
function memberEmail(): string {
  return tinker(`
    $sessions = app(App\\Services\\FacilitySessions::class);
    $user = App\\Models\\User::query()->whereNull('deleted_at')->get()->first(function ($user) use ($sessions) {
        $authorization = $user->currentAuthorization();
        return $authorization && $authorization->type === 'paid' && $authorization->photo_path && ! $authorization->photo_pending_at
            && ! $sessions->activeFor($user);
    });
    echo $user?->email;
  `)
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true })
}

async function xsrf(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies()).find((item) => item.name === 'XSRF-TOKEN')
  return cookie ? decodeURIComponent(cookie.value) : ''
}

async function staffSignIn(page: Page) {
  await page.setViewportSize(DESK)
  await page.goto('/staff')
  await page.getByLabel('Correo electrónico').fill('admin@example.com')
  await page.getByLabel('Contraseña').fill('password')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('navigation', { name: 'Menú del dashboard' })).toBeVisible()
}

/** Opens a Staff screen from the menu, or skips when this branch does not have it yet. */
async function openStaffScreen(page: Page, link: string, title: string) {
  const item = page.getByRole('link', { name: link })
  test.skip((await item.count()) === 0, `"${link}" is not a screen on this branch yet`)
  await item.click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test.describe('User app, phone size', () => {
  test.use({ viewport: PHONE })

  test('welcome, registration and sign in', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, '01-welcome')

    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, '02-registro')

    await page.goto('/sign-in')
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    await shot(page, '03-iniciar-sesion')
  })

  test('Check In, Gym ID and occupancy', async ({ page, context }) => {
    const email = memberEmail()
    test.skip(!email, 'the seed has no paid member free to Check In; run migrate:fresh --seed first')
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...GYM, accuracy: 10 })

    await page.goto('/sign-in')
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill('password')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto('/check-in')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot(page, '04-check-in')

    // The visit through the real API, sent from the page itself as the hold button sends it, so it is the same
    // signed-in device and the Gym ID then shows the active session.
    const answer = await page.evaluate(
      async ({ token, body }) => {
        const response = await fetch('/api/user/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify(body),
        })
        return { status: response.status, text: await response.text() }
      },
      { token: await xsrf(context), body: { ...GYM, accuracy: 10 } },
    )
    test.skip(answer.status === 409, `Check In refused now (${answer.text}); run it during gym hours`)
    expect(answer.status < 300, answer.text).toBe(true)
    await page.goto('/check-in')
    await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
    await shot(page, '05-gym-id')

    await page.goto('/gym')
    // Wait for the count, not the loading placeholder.
    await expect(page.getByText(/^Actualizado a las/)).toBeVisible()
    await shot(page, '06-gimnasio-ocupacion')
  })
})

test.describe('Staff dashboard, desktop', () => {
  test('S-01 active sessions with the occupancy and the list', async ({ page }) => {
    await staffSignIn(page)
    const home = page.getByRole('heading', { level: 1, name: 'Sesiones activas' })
    test.skip((await home.count()) === 0, 'S-01 is not on this branch yet (#144)')
    await expect(page.getByText('Personas dentro ahora')).toBeVisible()
    await shot(page, '07-s01-sesiones-activas')
  })

  test('S-02 person and session', async ({ page }) => {
    await staffSignIn(page)
    const person = page.locator('.sessions-person__name').first()
    test.skip((await person.count()) === 0, 'S-02 is not on this branch yet, or nobody is inside')
    await person.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Persona y sesión' })).toBeVisible()
    await shot(page, '08-s02-persona-y-sesion')
  })

  test('S-03 find a person', async ({ page }) => {
    await staffSignIn(page)
    await openStaffScreen(page, 'Buscar persona', 'Buscar persona y Check in asistido')
    await page.getByLabel('Nombre del socio o número de estudiante').fill('de prueba')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByRole('heading', { name: 'Selecciona a la persona' })).toBeVisible()
    await shot(page, '09-s03-buscar-persona')
  })

  test('A-04 terms and A-05 roster', async ({ page }) => {
    await staffSignIn(page)
    await openStaffScreen(page, 'Términos', 'Términos')
    await shot(page, '10-a04-terminos')
    await openStaffScreen(page, 'Gestionar atletas', 'Roster de atletas')
    await shot(page, '11-a05-roster')
  })

  test('A-15 staff accounts', async ({ page }) => {
    await staffSignIn(page)
    await openStaffScreen(page, 'Cuentas del staff', 'Cuentas del staff')
    await shot(page, '12-a15-cuentas-staff')
  })
})
