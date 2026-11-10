import { expect, test, type Locator, type Page } from '@playwright/test'
import { es } from '../src/i18n/es.ts'
import { createMember, flushCache, resetSchedule, signInApi } from './setup.ts'
import { checkInApi, deskCheckOut } from './setup-end-of-visit.ts'
import { ensurePhotoFile } from './setup-occupancy.ts'
import { deskPage, findBox, rowOf } from './setup-sessions.ts'

test.setTimeout(150_000)

async function findPerson(page: Page, name: string) {
  await findBox(page).fill(name)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.locator('.person-card__name')).toHaveText(name)
}

test('RG-01 assisted Check In announces its confirmation after navigating to S-01', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'the staff dashboard runs on desktop')
  flushCache()
  resetSchedule()
  ensurePhotoFile()
  const member = createMember({ authorization: 'current', photo: true })
  await deskPage(page, baseURL, 'staff', '/staff/buscar')
  await findPerson(page, member.name)
  await page.getByRole('button', { name: 'La foto coincide · Continuar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Check in', exact: true }).click()
  await expect(page).toHaveURL(/\/staff(?:\?registrado=\d+)?$/)
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Sesiones activas', exact: true })).toBeVisible()
  await expect(rowOf(page, member.name)).toBeVisible()
  await expect(page.locator('[role="status"], [aria-live="polite"], [aria-live="assertive"]')
    .getByText(es.activeSessions.checkedInTitle, { exact: true })).toBeVisible()
})

test('RG-02 S-03 explains that the identification photo is still loading', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'the staff dashboard runs on desktop')
  flushCache()
  ensurePhotoFile()
  const member = createMember({ authorization: 'current', photo: true })
  const photoPath = `/api/staff/people/${member.id}/photo`
  let releasePhoto!: () => void
  const delayed = new Promise<void>((resolve) => { releasePhoto = resolve })
  await page.route(`**${photoPath}`, async (route) => {
    await delayed
    await route.continue()
  })
  try {
    await deskPage(page, baseURL, 'staff', '/staff/buscar')
    await Promise.all([
      page.waitForRequest((request) => new URL(request.url()).pathname === photoPath),
      findPerson(page, member.name),
    ])
    // The supplied Figma node 4288:1135 shows a search error; use the two specified Spanish strings.
    await expect.soft(page.getByText(es.findPerson.photoLoadingTitle, { exact: true })).toBeVisible()
    await expect.soft(page.getByText(es.findPerson.photoLoadingText, { exact: true })).toBeVisible()
  } finally {
    try { await page.screenshot({ path: info.outputPath('photo-loading.png') }) }
    finally { releasePhoto() }
  }
})

test('RG-03 focused controls stay above the bottom navigation on a short phone', async ({ page, baseURL, playwright }, info) => {
  test.skip(!['android', 'iphone'].includes(info.project.name), 'short phone viewport regression')
  await page.setViewportSize({ width: 320, height: 568 })
  flushCache()
  resetSchedule()
  const member = createMember()
  await signInApi(page.request, baseURL!, member)
  const visit = await checkInApi(page.request, baseURL)
  await deskCheckOut(playwright.request, baseURL, visit)

  const assertUnobscured = async (control: Locator, name: string) => {
    await test.step(name, async () => {
      await expect(control).toBeVisible()
      const bar = page.locator('.user-navigation')
      await expect(bar).toBeVisible()
      // Native focus is deliberate: WebKit does not Tab to links. Do not scroll the control manually.
      await control.focus()
      await expect(control).toBeFocused()
      await expect.soft.poll(async () => {
        const box = await control.boundingBox()
        const navigation = await bar.boundingBox()
        if (!box || !navigation) return Number.POSITIVE_INFINITY
        return box.y + box.height - navigation.y
      }, { message: `${name}: focused control bottom must be <= bottom navigation top`, timeout: 5000 }).toBeLessThanOrEqual(0)
      await page.screenshot({ path: info.outputPath(`focus-${name}.png`) })
    })
  }

  await page.goto('/check-in')
  await expect(page.getByText('Tu visita ha terminado', { exact: true })).toBeVisible()
  await assertUnobscured(page.getByRole('button', { name: 'Continuar', exact: true }), 'continue')
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
  await assertUnobscured(page.getByRole('link', { name: /^Privacidad/ }), 'privacy')
  await assertUnobscured(page.getByRole('link', { name: /^Ajustes/ }), 'settings')
})
