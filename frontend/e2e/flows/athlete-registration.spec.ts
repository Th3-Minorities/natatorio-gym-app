import { expect, test } from '@playwright/test'
import { createAthlete } from '../../e2e-paths/setup-athlete.ts'
import { tinkerAvailable } from '../../e2e-paths/setup-registration.ts'
import { linkIn } from '../mail.ts'

// #152 flow 2, athlete registration: the student number lookup, on the seeded roster (FakeDataSeeder::FREE_STUDENT_NUMBER,
// CLAIMED_STUDENT_NUMBER). The failed lookups change nothing in the database.
// The API allows 10 failed lookups per IP in 15 minutes (config/registration.php) and the paid registration test spends 4 of them
// across the two browsers, so only Chromium looks up the three numbers that fail; Edge looks up the one on the roster.
// Since the athlete email link (#23) the lookup of a roster number sends an email, so a local stack makes a record per run.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test.setTimeout(240_000)

test('the student number lookup answers not on the roster, claimed, wrong length and on the roster with an emailed link', async ({ page }, testInfo) => {
  const failures = testInfo.project.name === 'chromium' || testInfo.project.name === 'desktop'

  await page.goto('/welcome')
  await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
  await page.getByRole('link', { name: 'Comenzar' }).click()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(page.getByText('Estudiante: 9 dígitos.', { exact: true })).toBeVisible()
  const next = page.getByRole('button', { name: 'Continuar', exact: true })
  const lookup = (number: string) => page.waitForResponse((response) => response.url().endsWith('/api/user/registration/lookup')
    && response.request().postDataJSON().authorization_number === number)

  if (failures) {
    // 1. Not on the roster
    await page.getByLabel('Número de estudiante o transacción').fill('900000000')
    await Promise.all([lookup('900000000'), next.click()])
    await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu número' })).toBeVisible()
    await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription(
      'No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.')
    await expect(page.getByText('Si pagaste una membresía, usa el número de autorización de tu recibo.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver ejemplo del recibo' })).toBeVisible()
    await page.getByRole('button', { name: 'Corregir número' }).click()

    // 2. Already claimed
    await page.getByLabel('Número de estudiante o transacción').fill('802000002')
    await Promise.all([lookup('802000002'), next.click()])
    await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu registro' })).toBeVisible()
    await expect(page.getByLabel('Número de estudiante')).toHaveAccessibleDescription('Este registro no está disponible para crear otra cuenta.')
    await expect(page.getByText('Si ya tienes cuenta, inicia sesión. Si necesitas revisar el vínculo, llama al 265-3866.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
    await page.getByRole('button', { name: 'Cambiar número' }).click()
  }

  // 3. Wrong length: 8 digits is not a student number, so it is looked up as an Authorization Number
  const field = page.getByLabel('Número de estudiante o transacción')
  if (failures) {
    await field.fill('80200000')
    await Promise.all([lookup('80200000'), next.click()])
    await expect(page.getByLabel('Número de autorización')).toHaveAccessibleDescription(
      'No pudimos validar este número. Revisa tu recibo o llama al 265-3866.')
    await expect(page).toHaveURL(/\/register\/identify$/)
  }

  // 4. On the roster and unclaimed: the link goes to the roster email and the number step shows "Revisa tu correo" (N03-09).
  // A local stack makes a roster record per run (one link per 300 s per student number). CI uses the seeded number, whose
  // seeded link may be less than 300 s old, so there the answer is either N03-09 or the link limit (N03-10).
  const athlete = tinkerAvailable() ? createAthlete() : null
  const number = athlete?.number ?? '802000001'
  await page.getByLabel(/Número de (estudiante o transacción|autorización)/).fill(number)
  const [found] = await Promise.all([lookup(number), next.click()])
  if (found.status() === 429) {
    expect(athlete, 'a fresh roster record is never rate limited').toBeNull()
    expect((await found.json()).error.code).toBe('athlete_link_limit')
    await expect(page.getByRole('heading', { level: 1, name: 'Espera para pedir otro enlace' })).toBeVisible()
    return
  }
  expect(found.status()).toBe(200)
  expect(await found.json()).toMatchObject({ state: 'athlete', masked_email: expect.stringMatching(/^.\*\*\*.?@/), resend_in: 300 })
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeVisible()
  await expect(page.getByText('Enviamos un enlace a tu correo institucional.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reenviar en 0[45]:\d\d$/ })).toBeDisabled()

  // 5. The emailed link opens the privacy notice and the password step with the roster name
  let message = ''
  await expect(async () => {
    const query = athlete ? `to:${athlete.email}` : 'subject:"Completa tu registro de atleta"'
    const search = await (await page.request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(query)}&limit=1`)).json()
    expect(search.messages.length).toBeGreaterThan(0)
    message = (await (await page.request.get(`/mailpit/api/v1/message/${search.messages[0].ID}`)).json()).HTML
    expect(message).toContain('/register/athlete')
  }).toPass({ timeout: 60_000 })
  await page.goto(linkIn(message, '/register/athlete'))
  await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()
  await expect(page).toHaveURL(/\/register\/password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Crea una contraseña' })).toBeVisible()
  await expect(page.getByText(/^¡Hola, .+!$/)).toBeVisible()
  if (!athlete) return // CI keeps the seeded record unclaimed for the next run

  // 6. Password, photo, waiver and contact: the account is created for the roster email
  await page.getByLabel('Contraseña', { exact: true }).fill('una frase larga para el registro de prueba')
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill('una frase larga para el registro de prueba')
  await next.click()
  await expect(page).toHaveURL(/\/register\/photo$/)
  await page.getByTestId('camera-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'Vista previa de la foto elegida' })).toBeVisible()
  await next.click()
  await expect(page).toHaveURL(/\/register\/contact$/)
  await page.getByLabel('He leído y acepto el relevo de responsabilidad.').check()
  await page.getByLabel('Nombre completo').fill('Contacto de Prueba')
  await page.getByLabel('Teléfono').fill('787-555-0100')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/install\?registered$/)
})
