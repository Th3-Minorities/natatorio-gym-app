import { expect, test } from '@playwright/test'

// Run against the Laravel proxy with a disposable User account supplied by the test operator.
// The regular test configuration reads E2E_BASE_URL.
test('User signs in, opens settings, signs out and cannot reopen the account', async ({ page }) => {
  test.setTimeout(120_000)
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for a disposable User account.')
  await page.goto('/sign-in')
  await page.getByLabel('Correo electrónico').fill(email!)
  await page.getByLabel('Contraseña', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { name: /^(Mi cuenta|My account)$/ })).toBeVisible()
  await page.getByRole('link', { name: /^(Ajustes|Settings)/ }).click()
  await page.getByRole('button', { name: /^(Cerrar sesión|Sign out)$/ }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('a second browser replaces the first User session', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  test.skip(!email || !password, 'Set credentials for a disposable User account.')
  const first = await browser.newContext({ baseURL })
  const second = await browser.newContext({ baseURL })
  try {
    const firstPage = await first.newPage()
    const secondPage = await second.newPage()
    for (const page of [firstPage, secondPage]) {
      await page.goto('/sign-in')
      await page.getByLabel('Correo electrónico').fill(email!)
      await page.getByLabel('Contraseña', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
      await expect(page).toHaveURL(/\/account$/)
    }
    await firstPage.reload()
    await expect(firstPage.getByText(/^(Iniciaste sesión en otro dispositivo|You signed in on another device)$/)).toBeVisible()
    await expect(secondPage.getByRole('heading', { name: /^(Mi cuenta|My account)$/ })).toBeVisible()
  } finally { await first.close(); await second.close() }
})
