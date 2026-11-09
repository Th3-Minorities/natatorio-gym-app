import { expect, test } from '@playwright/test'

// #152 flow 7, app base: install help to the installed app, and the app opening without connection. The real install
// (Add to Home Screen, Chrome's prompt) only happens on a phone, so the installed screen uses iOS's standalone flag.

test.use({ serviceWorkers: 'allow' })
test.setTimeout(120_000)

test('the install help shows both phones, the installed app says so, and the app opens offline', async ({ page, context }) => {
  // 1. Install help, Android steps (a desktop browser is not an iPhone)
  await page.goto('/install')
  await expect(page.getByRole('heading', { level: 1, name: 'Instalar app' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Ten la app a mano', { exact: true })).toBeVisible()
  await expect(page.getByText('2. Toca Instalar y crear acceso directo.', { exact: true })).toBeVisible()

  // 2. iPhone steps
  await page.getByRole('tab', { name: 'iPhone' }).click()
  await expect(page.getByRole('tab', { name: 'iPhone' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Abre esta página en Safari.', { exact: true })).toBeVisible()
  await expect(page.getByText('Selecciona Agregar a Inicio.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver a Mi cuenta' })).toHaveAttribute('href', '/account')

  // 3. The manifest a phone installs from
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(await (await page.request.get(href!)).json()).toMatchObject({ name: 'Gym RUM', display: 'standalone', start_url: '/account' })

  // 4. Installed app
  const installed = await context.newPage()
  await installed.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  await installed.goto('/install')
  await expect(installed.getByRole('heading', { name: '¡Todo listo!' })).toBeVisible()
  await expect(installed.getByText('Ya estás usando la app instalada.', { exact: true })).toBeVisible()
  await installed.close()

  // 5. Open offline, once the service worker controls the page
  await page.goto('/welcome')
  await page.evaluate(`navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller
    || new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })))`)
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bienvenido', exact: true })).toBeVisible()
    await page.goto('/install')
    await expect(page.getByRole('heading', { level: 1, name: 'Instalar app' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
