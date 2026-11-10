import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// #21: the terms screen (A-04) and the athlete roster (A-05), through the proxy and the real API. Each run adds
// one fake term in a far year and one fake athlete with a new number, so the dev lists grow by one each.

test.setTimeout(240_000)

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const run = Date.now()

async function expectNoViolations(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([])
}

async function signInAsAdmin(page: Page) {
  await page.goto('/staff')
  await page.getByLabel('Correo electrónico').fill('admin@example.com')
  await page.getByLabel('Contraseña').fill('password')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('navigation', { name: 'Menú del dashboard' })).toBeVisible()
}

/** Clicks a button and fails at once, with the status, if the API refuses. */
async function sendAndExpectOk(page: Page, button: Locator, method: string, path: RegExp) {
  const answer = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === method,
  )
  await button.click()
  const response = await answer
  expect(response.ok(), `${method} ${response.url()} answered ${response.status()}: ${await response.text()}`).toBe(true)
}

test('an Administrator creates and edits a term', async ({ page }) => {
  // A year far ahead, different on each run, so the new term never overlaps one already in the dev database.
  const year = 2100 + (run % 800)
  const name = `E2E ${year}`

  await signInAsAdmin(page)
  await page.getByRole('link', { name: 'Términos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Términos' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Término actual' })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Crear término' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Crear término' })).toBeVisible()
  // Unnamed: the dialog takes the name of each view, like the order error below.
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre del término').fill(name)
  await dialog.getByLabel('Fecha de inicio').fill(`${year}-12-18`)
  await dialog.getByLabel('Fecha de fin').fill(`${year}-08-10`)
  await dialog.getByRole('button', { name: 'Guardar término' }).click()
  await expect(dialog.getByRole('heading', { name: 'Revisa el orden de las fechas' })).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByRole('button', { name: 'Corregir fechas' }).click()
  await expect(dialog.getByLabel('Fecha de inicio')).toBeFocused()
  await dialog.getByLabel('Fecha de inicio').fill(`${year}-08-10`)
  await dialog.getByLabel('Fecha de fin').fill(`${year}-12-18`)
  await sendAndExpectOk(page, dialog.getByRole('button', { name: 'Guardar término' }), 'POST', /^\/api\/staff\/terms$/)
  await expect(page.getByRole('status').filter({ hasText: `${name} se guardó.` })).toBeVisible()

  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toContainText('Próximo')
  await row.getByRole('button', { name: `Editar, ${name}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar término' })
  await expect(edit.getByLabel('Nombre del término')).toHaveValue(name)
  await edit.getByLabel('Fecha de fin').fill(`${year}-12-11`)
  await expect(edit.getByText(`Las autorizaciones terminan el 11 dic ${year}.`)).toBeVisible()
  await expectNoViolations(page)
  await sendAndExpectOk(page, edit.getByRole('button', { name: 'Guardar cambios' }), 'PATCH', /^\/api\/staff\/terms\/\d+$/)
  await expect(row).toContainText(`11 dic ${year}`)
})

test('an Administrator adds, edits, withdraws and reinstates an athlete', async ({ page }) => {
  // A new 9-digit number on each run, starting with 9 so it never meets the 802 numbers of the fake data.
  const number = `9${String(run).slice(-8)}`
  const name = `Atleta E2E ${number}`

  await signInAsAdmin(page)
  await page.getByRole('link', { name: 'Gestionar atletas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Roster de atletas' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Atletas del roster' })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Añadir atleta' }).first().click()
  const add = page.getByRole('dialog')
  await add.getByLabel('Deporte').fill('Voleibol')
  await expect(add.getByRole('heading', { name: 'Añadiendo atletas de: Voleibol' })).toBeVisible()
  await add.getByLabel('Nombre completo').fill(name)
  await add.getByLabel('Número de estudiante').fill(number)
  await add.getByLabel('Correo institucional').fill(`e2e-${number}@example.com`)
  await sendAndExpectOk(page, add.getByRole('button', { name: 'Guardar y añadir otro' }), 'POST', /^\/api\/staff\/roster$/)
  await expect(add.getByText(`${name} se guardó. Añade el próximo atleta.`)).toBeVisible()
  await expect(add.getByLabel('Deporte')).toHaveValue('Voleibol')
  await expect(add.getByLabel('Nombre completo')).toBeFocused()
  await expectNoViolations(page)

  // The same number again is refused and names the athlete who has it.
  await add.getByLabel('Nombre completo').fill('Otra persona')
  await add.getByLabel('Número de estudiante').fill(number)
  await add.getByLabel('Correo institucional').fill(`otra-${number}@example.com`)
  await add.getByRole('button', { name: 'Guardar y añadir otro' }).click()
  await expect(add.getByRole('heading', { name: 'Este número ya está en el roster' })).toBeVisible()
  await expect(add.getByText(`${number} pertenece a ${name}.`, { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(number)
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(2)

  await row.getByRole('button', { name: `Editar, ${name}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar atleta' })
  await edit.getByLabel('Deporte').fill('Natación')
  await sendAndExpectOk(page, edit.getByRole('button', { name: 'Guardar cambios' }), 'PATCH', /^\/api\/staff\/roster\/\d+$/)
  await expect(row).toContainText('Natación')

  await row.getByRole('button', { name: `Retirar, ${name}` }).click()
  const withdraw = page.getByRole('dialog', { name: `¿Retirar a ${name}?` })
  await expect(withdraw.getByText(`${number} · Natación`)).toBeVisible()
  await expectNoViolations(page)
  await sendAndExpectOk(page, withdraw.getByRole('button', { name: 'Retirar atleta' }), 'POST', /\/withdraw$/)

  // A withdrawn athlete leaves the default list; both filters on shows them with Restituir, which has focus.
  await page.getByRole('button', { name: 'Retirado' }).click()
  const reinstateButton = page.getByRole('button', { name: `Restituir, ${name}` })
  await expect(reinstateButton).toBeVisible()
  await reinstateButton.click()
  const reinstate = page.getByRole('dialog', { name: `Restituir a ${name}` })
  await reinstate.getByLabel('Motivo obligatorio').fill('Error')
  await reinstate.getByRole('button', { name: 'Restituir' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'El motivo debe tener al menos 10 caracteres' })).toBeVisible()
  await expectNoViolations(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo obligatorio').fill('Retiro por error en la prueba E2E')
  await sendAndExpectOk(page, dialog.getByRole('button', { name: 'Restituir' }), 'POST', /\/reinstate$/)
  await expect(row.getByRole('button', { name: `Retirar, ${name}` })).toBeVisible()
})

test('an Administrator downloads the whole roster as Word and as PDF', async ({ page }) => {
  await signInAsAdmin(page)
  await page.getByRole('link', { name: 'Gestionar atletas' }).click()
  await page.getByRole('button', { name: 'Descargar roster' }).click()
  const dialog = page.getByRole('dialog', { name: 'Descargar roster' })
  await expect(dialog.getByRole('button', { name: 'Word (.docx)' })).toHaveAttribute('aria-pressed', 'true')
  await expectNoViolations(page)

  const word = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Descargar' }).click()
  expect((await word).suggestedFilename()).toMatch(/^roster-atletas-\d{4}-\d{2}-\d{2}\.docx$/)
  await expect(page.getByRole('status').filter({ hasText: 'Se descargó el roster.' })).toBeVisible()

  await page.getByRole('button', { name: 'Descargar roster' }).click()
  await dialog.getByRole('button', { name: 'PDF (.pdf)' }).click()
  const pdf = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Descargar' }).click()
  expect((await pdf).suggestedFilename()).toMatch(/^roster-atletas-\d{4}-\d{2}-\d{2}\.pdf$/)
})

test('the terms and roster screens reflow at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await signInAsAdmin(page)
  for (const [link, title] of [['Términos', 'Términos'], ['Gestionar atletas', 'Roster de atletas']]) {
    await page.getByRole('link', { name: link }).click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    // Tables scroll inside their own region; the page itself does not.
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(320)
  }
})
