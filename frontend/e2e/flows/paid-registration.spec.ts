import { expect, test } from '@playwright/test'
import { createOrder, tinkerAvailable } from '../../e2e-paths/setup-registration.ts'

// #152 flow 1, paid member registration: Welcome to Check In, after the install help. CI claims one of the unclaimed seeded
// orders per browser (FakeDataSeeder::FREE_AUTHORIZATION_NUMBERS), so a second run needs a fresh seed. On a local test stack
// (KIM_PROJECT set, CI unset) each run creates its own order, so any number of devices and runs can register.

test.setTimeout(240_000)

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG })
// Expired, already used and unknown numbers get the same answer, so a number cannot be probed (registration_number_unavailable).
const UNAVAILABLE = /No pudimos validar este número\. Revisa tu recibo o llama al 265-3866\./

test('a paid member registers from Welcome and reaches Check In', async ({ page }, testInfo) => {
  const number = tinkerAvailable() ? createOrder('FLW').number : testInfo.project.name === 'msedge' ? 'PRUEBA2' : 'PRUEBA1'
  const password = 'una frase larga para el registro de prueba'

  // 1. Welcome
  await page.goto('/welcome')
  await expect(page.getByRole('heading', { name: 'Bienvenido', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeVisible()
  await page.getByRole('link', { name: 'Comenzar' }).click()

  // 2. Privacy notice
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Antes de comenzar' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar con el registro' }).click()

  // 3. Number entry: expired and already used numbers get the same answer, with the receipt number field and the help line
  await expect(page).toHaveURL(/\/register\/identify$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Registro', exact: true })).toBeVisible()
  const next = page.getByRole('button', { name: 'Continuar', exact: true })
  await page.getByLabel('Número de estudiante o transacción').fill('VENCIDO')
  await next.click()
  const field = page.getByLabel('Número de autorización')
  await expect(field).toHaveAccessibleDescription(UNAVAILABLE)
  await expect(page.getByRole('link', { name: 'Ayuda: 265-3866' })).toBeVisible()
  await field.fill('USADO01')
  await next.click()
  await expect(field).toHaveAccessibleDescription(UNAVAILABLE)
  await expect(page).toHaveURL(/\/register\/identify$/)

  // 4. Valid number, password
  await field.fill(number)
  await next.click()
  await expect(page).toHaveURL(/\/register\/password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Crea una contraseña' })).toBeVisible()
  await expect(page.getByText(/^¡Hola, .+!$/)).toBeVisible()
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password)
  await next.click()

  // 5. Photo taken, then replaced by an uploaded one
  await expect(page).toHaveURL(/\/register\/photo$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tu foto de identificación' })).toBeVisible()
  await expect(page.getByText('Aún no has elegido una foto')).toBeVisible()
  await expect(next).toBeDisabled()
  await page.getByTestId('camera-input').setInputFiles(photo('camara.png'))
  await expect(page.getByRole('img', { name: 'Vista previa de la foto elegida' })).toBeVisible()
  await page.getByTestId('upload-input').setInputFiles(photo('subida.png'))
  await expect(page.getByRole('img', { name: 'Vista previa de la foto elegida' })).toBeVisible()
  await next.click()

  // 6. Waiver and emergency contact: required fields, then the full waiver
  await expect(page).toHaveURL(/\/register\/contact$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Relevo y contacto de emergencia' })).toBeVisible()
  await expect(page.getByText('BORRADOR · Versión borrador-2026-11-08')).toBeVisible()
  const create = page.getByRole('button', { name: 'Crear cuenta' })
  await create.click()
  await expect(page.getByText('Acepta el relevo para crear tu cuenta.')).toBeVisible()
  await expect(page.getByText('Escribe el nombre de tu contacto.')).toBeVisible()
  await expect(page.getByText('Escribe un número de teléfono válido.')).toBeVisible()
  await page.getByRole('button', { name: 'Leer relevo completo' }).click()
  await expect(page).toHaveURL(/\/register\/waiver$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Relevo', exact: true })).toBeVisible()
  await expect(page.getByText(/Uso el Gimnasio de Pesas del Complejo Natatorio/)).toBeVisible()
  await page.getByRole('button', { name: 'Volver al registro' }).click()
  await page.getByLabel('He leído y acepto el relevo de responsabilidad.').check()
  await page.getByLabel('Nombre completo').fill('Contacto de Prueba')
  await page.getByLabel('Teléfono').fill('787-555-0100')

  // 7. Save error (the API answer is replaced once), back to the photo with the data kept
  await page.route('**/api/user/registration/complete', (route) => route.fulfill({ status: 500, json: { error: { code: 'server_error' } } }), { times: 1 })
  await create.click()
  await expect(page.getByRole('heading', { level: 1, name: 'No pudimos crear tu cuenta' })).toBeVisible()
  await expect(page.getByText('El registro no se completó')).toBeVisible()
  await page.getByRole('button', { name: 'Volver a mi foto' }).click()
  await expect(page.getByRole('img', { name: 'Vista previa de la foto elegida' })).toBeVisible()
  await next.click()
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Contacto de Prueba')
  await expect(page.getByLabel('He leído y acepto el relevo de responsabilidad.')).toBeChecked()

  // 8. Account created, install help
  await create.click()
  await expect(page).toHaveURL(/\/install\?registered$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Instala la app' })).toBeVisible()
  await page.getByRole('tab', { name: 'iPhone' }).click()
  await page.getByRole('link', { name: 'Continuar' }).click()

  // 9. Check In, signed in with the new account and its paid authorization
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Check-in' })).toBeVisible()
  await expect(page.getByText('Miembro', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Autorización activa' })).toBeVisible()
})
