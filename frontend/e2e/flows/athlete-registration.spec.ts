import { expect, test } from '@playwright/test'

// #152 flow 2, athlete registration: the student number lookup, on the seeded roster (FakeDataSeeder::FREE_STUDENT_NUMBER,
// CLAIMED_STUDENT_NUMBER). The lookups change nothing in the database, so both browsers use the same numbers. The athlete
// email link and the account that follows are not on main yet (an athlete on the roster stays on the number entry).
// The API allows 10 failed lookups per IP in 15 minutes (config/registration.php) and the paid registration test spends 4 of them
// across the two browsers, so only Chromium looks up the three numbers that fail; Edge looks up the one on the roster.

test('the student number lookup answers on the roster, not on the roster, claimed and wrong length', async ({ page }, testInfo) => {
  const failures = testInfo.project.name === 'chromium'

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

  // 3. On the roster and unclaimed: no error and no new screen
  const field = page.getByLabel('Número de estudiante o transacción')
  await field.fill('802000001')
  const [found] = await Promise.all([lookup('802000001'), next.click()])
  expect(await found.json()).toEqual({ state: 'athlete' })
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Registro', exact: true })).toBeVisible()
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')

  if (failures) {
    // 4. Wrong length: 8 digits is not a student number, so it is looked up as an Authorization Number
    await field.fill('80200000')
    await Promise.all([lookup('80200000'), next.click()])
    await expect(page.getByLabel('Número de autorización')).toHaveAccessibleDescription(
      'No pudimos validar este número. Revisa tu recibo o llama al 265-3866.')
    await expect(page).toHaveURL(/\/register\/identify$/)
  }
})
