import { expect, test, type Page } from '@playwright/test'
import {
  ANDROID_STEPS, IPHONE_STEPS, asInstalled, defaultTab, expectNoTexts, expectTab, expectTexts, firePrompt, goOffline, goOnline, heading, memberSignedIn,
  only, promptCalls, tab, workerControls,
} from './setup-app-base.ts'
import { createMember, signInApi } from './setup.ts'

// #152 path tests for flow 7, app base: install help, installed app, offline. One test per row of the path inventory (AB-01 to AB-35),
// each on its own fresh member. The real install (Add to Home Screen, Chrome's dialog) only happens on a phone: AB-33 and AB-34 are manual.

test.setTimeout(120_000)

const INSTALL_BUTTON = (page: Page) => page.getByRole('button', { name: 'Instalar app', exact: true })
const MAIN_NAV = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' })

/** Opens Mi cuenta with a fresh member and taps the row "Instalar app". */
async function installFromAccount(page: Page, baseURL: string | undefined) {
  const member = await memberSignedIn(page, baseURL)
  await page.goto('/account')
  await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
  await page.getByRole('link', { name: /Instalar app/ }).first().click()
  await expect(page).toHaveURL(/\/install$/)
  return member
}

// ------------------------------------------------------------------------------------------------ install help

test('AB-01 install help on Android opens the Android tab with the Chrome steps and no install button', async ({ page }) => {
  only('A')
  await page.goto('/install')
  await expectTab(page, 'Android')
  await expect(heading(page, 'Instalar app')).toBeVisible()
  await expectTexts(page, ['Ten la app a mano', 'También puedes hacerlo desde Chrome', ...ANDROID_STEPS])
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
})

test('AB-02 install help on iPhone opens the iPhone tab with the Safari steps and no install button', async ({ page }) => {
  only('I')
  await page.goto('/install')
  await expectTab(page, 'iPhone')
  await expectTexts(page, [...IPHONE_STEPS, 'Puede estar dentro del menú de página.', 'Si aparece “Abrir como app”, déjalo activado.'])
  expect(await page.locator('.install-steps li strong').allTextContents()).toEqual(IPHONE_STEPS)
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
})

test('AB-03 the tabs swap the panel and keep the chosen tab', async ({ page }) => {
  only('AI')
  await page.goto('/install')
  await expectTab(page, defaultTab())
  await tab(page, 'iPhone').click()
  await expectTab(page, 'iPhone')
  await expectTexts(page, IPHONE_STEPS)
  await expectNoTexts(page, ANDROID_STEPS)
  await tab(page, 'Android').click()
  await expectTab(page, 'Android')
  await expectTexts(page, ANDROID_STEPS)
  await expectNoTexts(page, IPHONE_STEPS)
  await tab(page, 'iPhone').click()
  await expectTab(page, 'iPhone')
  await expectTexts(page, IPHONE_STEPS)
  await expectNoTexts(page, ANDROID_STEPS)
})

test('AB-04 the arrow keys, Home and End move the selection and the focus', async ({ page }) => {
  only('AI') // moved to phones 2026-11-09 (keyboard row, was desktop only)
  await page.goto('/install')
  // The help opens on the tab of the device (iPhone on iPhone, Android otherwise); the order is iPhone, Android and the keys wrap.
  const shown = (await tab(page, 'iPhone').getAttribute('aria-selected')) === 'true' ? 'iPhone' : 'Android'
  const other = shown === 'iPhone' ? 'Android' : 'iPhone'
  await expectTab(page, shown)
  await tab(page, shown).focus()
  await page.keyboard.press('ArrowRight')
  await expectTab(page, other)
  await expect(tab(page, other)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expectTab(page, shown)
  await expect(tab(page, shown)).toBeFocused()
  await page.keyboard.press('Home')
  await expectTab(page, 'iPhone')
  await expect(tab(page, 'iPhone')).toBeFocused()
  await page.keyboard.press('End')
  await expectTab(page, 'Android')
  await expect(tab(page, 'Android')).toBeFocused()
})

test('AB-05 an iPad that sends a Mac user agent opens the Android tab and can still read the Safari steps', async ({ browser, baseURL }) => {
  only('I')
  const context = await browser.newContext({
    baseURL,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  })
  try {
    const page = await context.newPage()
    await page.goto('/install')
    await expectTab(page, 'Android')
    await tab(page, 'iPhone').click()
    await expectTab(page, 'iPhone')
    await expectTexts(page, IPHONE_STEPS)
  } finally {
    await context.close()
  }
})

test('AB-06 from Mi cuenta the install help keeps the bottom navigation, has no exit link and returns to Mi cuenta', async ({ page, baseURL }) => {
  only('AI')
  await installFromAccount(page, baseURL)
  await expect(heading(page, 'Instalar app')).toBeVisible()
  await expect(MAIN_NAV(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continuar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ahora no', exact: true })).toHaveCount(0)
  await expect(page.locator('.user-app--access')).toHaveCount(0)
  await page.getByRole('link', { name: 'Volver a Mi cuenta' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
})

test('AB-07 right after registration the install help has the large title, the green header and an exit to Check In per tab', async ({ page, baseURL }) => {
  only('AI')
  await memberSignedIn(page, baseURL)
  await page.goto('/install?registered')
  await expect(heading(page, 'Instala la app', 1)).toBeVisible()
  await expect(page.getByText('Accede al gimnasio desde tu pantalla de inicio.', { exact: true })).toBeVisible()
  await expect(page.locator('.user-app--access')).toContainText('RUM')
  const first = defaultTab() === 'iPhone' ? 'Continuar' : 'Ahora no'
  const second = first === 'Continuar' ? 'Ahora no' : 'Continuar'
  await expect(page.getByRole('link', { name: first, exact: true })).toHaveAttribute('href', '/check-in')
  await tab(page, first === 'Continuar' ? 'Android' : 'iPhone').click()
  await expect(page.getByRole('link', { name: second, exact: true })).toHaveAttribute('href', '/check-in')
  await page.getByRole('link', { name: second, exact: true }).click()
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(MAIN_NAV(page)).toBeVisible()
  await expect(heading(page, 'Iniciar sesión')).toHaveCount(0)
  await page.goto('/install?registered')
  await tab(page, first === 'Continuar' ? 'iPhone' : 'Android').click()
  await page.getByRole('link', { name: first, exact: true }).click()
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(heading(page, 'Iniciar sesión')).toHaveCount(0)
})

test('AB-08 leaving the install help with no session sends the person to sign in', async ({ page }) => {
  only('AI')
  await page.goto('/install?registered')
  await tab(page, 'iPhone').click()
  await page.getByRole('link', { name: 'Continuar', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(heading(page, 'Iniciar sesión', 1)).toBeVisible()
})

// ------------------------------------------------------------------------------------------- the install prompt

test('AB-09 a prompt from the browser shows the install button on the Android tab only and the app takes the event', async ({ page }) => {
  only('A')
  await page.goto('/install')
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
  expect(await firePrompt(page, 'accepted')).toBe(true)
  await expect(INSTALL_BUTTON(page)).toBeVisible()
  const button = (await INSTALL_BUTTON(page).boundingBox())!
  const steps = (await page.getByText('También puedes hacerlo desde Chrome', { exact: true }).boundingBox())!
  expect(button.y).toBeLessThan(steps.y)
  await tab(page, 'iPhone').click()
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
  await tab(page, 'Android').click()
  await expect(INSTALL_BUTTON(page)).toBeVisible()
})

test('AB-10 an accepted prompt shows the installed state', async ({ page }) => {
  only('A')
  await page.goto('/install')
  await firePrompt(page, 'accepted')
  await INSTALL_BUTTON(page).click()
  await expect(heading(page, '¡Todo listo!')).toBeVisible()
  await expectTexts(page, ['Ya estás usando la app instalada.', 'Puedes abrirla desde tu pantalla de inicio.'])
  await expect(page.getByRole('link', { name: 'Volver a Mi cuenta' }).last()).toHaveAttribute('href', '/account')
  expect(await promptCalls(page)).toBe(1)
})

test('AB-11 a dismissed prompt removes the button and keeps the Chrome steps', async ({ page }) => {
  only('A')
  await page.goto('/install')
  await firePrompt(page, 'dismissed')
  await INSTALL_BUTTON(page).click()
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
  await expectTexts(page, ANDROID_STEPS)
  await expect(heading(page, '¡Todo listo!')).toHaveCount(0)
  expect(await promptCalls(page)).toBe(1)
})

test('AB-12 a prompt the browser refuses leaves no error, no button and the Chrome steps', async ({ page }) => {
  only('A')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/install')
  await firePrompt(page, 'refused')
  await INSTALL_BUTTON(page).click()
  await expect(INSTALL_BUTTON(page)).toHaveCount(0)
  await expectTexts(page, ANDROID_STEPS)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(heading(page, '¡Todo listo!')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(await promptCalls(page)).toBe(1)
})

test('AB-13 the appinstalled event switches the page to the installed state without a reload', async ({ page }) => {
  only('A')
  await page.goto('/install')
  await expectTexts(page, ANDROID_STEPS)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(heading(page, '¡Todo listo!')).toBeVisible()
  await expect(page.getByText('Ya estás usando la app instalada.', { exact: true })).toBeVisible()
})

// ------------------------------------------------------------------------------------------- the installed app

test('AB-14 opened as the installed app from Mi cuenta, the install help says all set with the way back', async ({ page, baseURL }) => {
  only('A')
  await asInstalled(page)
  await memberSignedIn(page, baseURL)
  await page.goto('/account')
  await page.getByRole('link', { name: /Instalar app/ }).first().click()
  await expect(page).toHaveURL(/\/install$/)
  await expect(heading(page, '¡Todo listo!')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver a Mi cuenta' }).last()).toHaveAttribute('href', '/account')
  await expect(page.locator('.user-app--access')).toHaveCount(0)
})

test('AB-15 installed on iPhone right after registration, Continuar leads to Check In', async ({ page, baseURL }) => {
  only('I')
  await asInstalled(page)
  await memberSignedIn(page, baseURL)
  await page.goto('/install?registered')
  await expect(heading(page, '¡Todo listo!')).toBeVisible()
  await expect(page.locator('.user-app--access')).toBeVisible()
  const next = page.getByRole('link', { name: 'Continuar', exact: true })
  await expect(next).toHaveAttribute('href', '/check-in')
  await next.click()
  await expect(page).toHaveURL(/\/check-in$/)
  await expect(heading(page, 'Iniciar sesión')).toHaveCount(0)
})

test('AB-16 the account language English shows the install help and the installed state in English', async ({ page, baseURL }) => {
  only('AI')
  const member = createMember({ locale: 'en' })
  await signInApi(page.request, baseURL!, member)
  await page.goto('/account')
  await expect(heading(page, 'My account', 1)).toBeVisible()
  await page.getByRole('link', { name: /Install app/ }).first().click()
  await expect(page).toHaveURL(/\/install$/)
  await tab(page, 'Android').click()
  await expectTexts(page, ['Keep the app at hand', '1. Open the ⋮ menu.', '2. Tap Install and create shortcut.'])
  await tab(page, 'iPhone').click()
  await expectTexts(page, ['Open this page in Safari.', 'Choose Add to Home Screen.'])
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(heading(page, 'All set!')).toBeVisible()
  await expect(page.getByText('You are using the installed app.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to My account' }).last()).toHaveAttribute('href', '/account')
})

test('AB-17 the device language English before sign in translates the install help after registration', async ({ page }) => {
  only('AI')
  await page.goto('/welcome')
  await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.goto('/install?registered')
  await expect(heading(page, 'Install the app', 1)).toBeVisible()
  await expect(page.getByText('Reach the gym from your home screen.', { exact: true })).toBeVisible()
  await tab(page, 'iPhone').click()
  await expect(page.getByRole('link', { name: 'Continue', exact: true })).toBeVisible()
  await tab(page, 'Android').click()
  await expect(page.getByRole('link', { name: 'Not now', exact: true })).toBeVisible()
})

test.describe('AB-18 manifest and icons', () => {
  test.use({ serviceWorkers: 'allow' })
  test('AB-18 the manifest, the icons and the worker are linked and served', async ({ page }) => {
    only('A')
    await page.goto('/install')
    const href = (await page.locator('link[rel="manifest"]').getAttribute('href'))!
    const manifestResponse = await page.request.get(href)
    expect(manifestResponse.ok()).toBe(true)
    const manifest = await manifestResponse.json() as { name: string; display: string; start_url: string; icons: { sizes: string; src: string; purpose: string }[] }
    expect(manifest).toMatchObject({ name: 'Gym RUM', display: 'standalone', start_url: '/account' })
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`).sort()).toEqual(['192x192 any', '192x192 maskable', '512x512 any', '512x512 maskable'])
    expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/icon-180.png')
    for (const path of ['/icon-180.png', '/icon-192.png', '/icon-512.png', ...manifest.icons.map((icon) => icon.src)]) {
      const response = await page.request.get(path)
      expect(response.ok(), path).toBe(true)
      expect(response.headers()['content-type'], path).toBe('image/png')
    }
    expect((await page.request.get('/sw.js')).headers()['cache-control']).toBe('no-cache')
  })
})

test('AB-19 launched as the installed app and signed in, Mi cuenta shows the profile and the install row that leads to all set', async ({ page, baseURL }) => {
  only('AI')
  await asInstalled(page)
  const member = await memberSignedIn(page, baseURL)
  await page.goto('/account')
  await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
  await expect(page.getByText(member.email, { exact: true })).toBeVisible()
  const row = page.getByRole('link', { name: /Instalar app/ })
  await expect(row).toBeVisible()
  await row.click()
  await expect(heading(page, '¡Todo listo!')).toBeVisible()
})

test('AB-20 launched as the installed app with the session ended, Mi cuenta sends to sign in with no error', async ({ page }) => {
  only('AI')
  await asInstalled(page)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(heading(page, 'Iniciar sesión', 1)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('AB-21 a path outside the User routes opens the health page', async ({ page }) => {
  only('A')
  for (const path of ['/', '/no-existe']) {
    await page.goto(path)
    await expect(page.getByText('API: conectada', { exact: true })).toBeVisible()
  }
})

// ------------------------------------------------------------------------------------------------------ offline

test.describe('offline', () => {
  // The base config blocks service workers; the offline shell needs the real one.
  test.use({ serviceWorkers: 'allow' })

  test('AB-22 the worker takes control, caches the app once and never the API', async ({ page }) => {
    only('A')
    await page.goto('/welcome')
    await workerControls(page)
    expect(await page.evaluate(async () => (await fetch('/api/health')).status)).toBe(200)
    const cached = await page.evaluate(async () => {
      const entries: Record<string, string[]> = {}
      for (const name of await caches.keys()) entries[name] = (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)
      return entries
    })
    const names = Object.keys(cached)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/^natatorio-shell-/)
    const paths = cached[names[0]]
    expect(paths).toContain('/index.html')
    expect(paths).toContain('/manifest.webmanifest')
    expect(paths.some((path) => /^\/assets\/.+\.(js|css)$/.test(path))).toBe(true)
    expect(paths.some((path) => path === '/api' || path.startsWith('/api/'))).toBe(false)
  })

  test('AB-23 Welcome opens offline in its collapsed state', async ({ page, context }) => {
    only('AI')
    await page.goto('/welcome')
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.reload()
      await expect(heading(page, 'Bienvenido')).toBeVisible()
      await expect(page.getByText('Toca o desliza para continuar', { exact: true })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-24 Welcome offline disables both actions and enables them back online', async ({ page, context }) => {
    only('AI')
    await page.goto('/welcome')
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.reload()
      await page.getByRole('button', { name: 'Toca o desliza para continuar' }).click()
      await expect(heading(page, 'Bienvenido al gimnasio')).toBeVisible()
      await goOffline(context, page)
      await expect(page.getByText('Sin conexión. Conéctate para continuar.', { exact: true })).toBeVisible()
      const begin = page.getByRole('link', { name: /Comenzar/ })
      const signIn = page.getByRole('link', { name: 'Iniciar sesión', exact: true })
      await expect(begin).toHaveAttribute('aria-disabled', 'true')
      await expect(signIn).toHaveAttribute('aria-disabled', 'true')
      await expect(begin).not.toHaveAttribute('href', /.+/)
      await expect(signIn).not.toHaveAttribute('href', /.+/)
      await goOnline(context, page)
      await expect(page.getByText('Sin conexión. Conéctate para continuar.', { exact: true })).toHaveCount(0)
      await expect(begin).toHaveAttribute('href', '/register')
      await expect(signIn).toHaveAttribute('href', '/sign-in')
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-25 the install help opens offline and its tabs work', async ({ page, context }) => {
    only('AI')
    await page.goto('/welcome')
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.goto('/install')
      await expect(heading(page, 'Instalar app')).toBeVisible()
      await tab(page, 'iPhone').click()
      await expectTexts(page, IPHONE_STEPS)
      await tab(page, 'Android').click()
      await expectTexts(page, ANDROID_STEPS)
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-26 sign in offline keeps what was typed and works again online', async ({ page, context }) => {
    only('AI')
    const member = createMember()
    await page.goto('/welcome')
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.goto('/sign-in')
      await goOffline(context, page)
      await page.getByLabel('Correo electrónico').fill(member.email)
      await page.getByLabel('Contraseña', { exact: true }).fill(member.password)
      await expect(page.getByText('Sin conexión · Datos no actualizados', { exact: true })).toBeVisible()
      await expect(page.getByText('Conéctate para continuar. Se conservan los datos ingresados.', { exact: true })).toBeVisible()
      const submit = page.getByRole('button', { name: 'Iniciar sesión', exact: true })
      await expect(submit).toBeDisabled()
      await expect(page.getByLabel('Correo electrónico')).toHaveValue(member.email)
      await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(member.password)
      await goOnline(context, page)
      await expect(submit).toBeEnabled()
      await submit.click()
      await expect(page).toHaveURL(/\/account$/)
      await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-27 Mi cuenta opened cold offline says nothing is saved and loads by itself on reconnect', async ({ page, context, baseURL }) => {
    only('AI')
    const member = await memberSignedIn(page, baseURL)
    await page.goto('/account')
    await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.reload()
      await expect(page.getByText('Sin conexión', { exact: true }).first()).toBeVisible()
      await expect(heading(page, 'Mi cuenta', 1)).toBeVisible()
      await expect(page.getByText('Sin datos guardados', { exact: true })).toBeVisible()
      await expect(page.getByText('Conéctate para cargar tu cuenta.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeDisabled()
      await goOnline(context, page)
      await expect(page.getByText(member.email, { exact: true })).toBeVisible()
      await expect(page.getByText('Sin datos guardados', { exact: true })).toHaveCount(0)
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-28 Mi cuenta going offline after loading keeps the data, blocks the settings actions and recovers', async ({ page, context, baseURL }) => {
    only('AI')
    const member = await memberSignedIn(page, baseURL)
    await page.goto('/account')
    await expect(page.getByText(member.email, { exact: true })).toBeVisible()
    await goOffline(context, page)
    try {
      await expect(page.locator('.user-offline')).toContainText('Sin conexión')
      await expect(page.getByText('Acceso guardado · Término actual', { exact: true })).toBeVisible()
      await expect(page.getByText(/^No actualizado · Actualizado a las .+/)).toBeVisible()
      await page.getByRole('link', { name: /Ajustes/ }).click()
      await expect(page).toHaveURL(/\/account\/settings$/)
      await expect(page.getByRole('button', { name: 'Español', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'English', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeDisabled()
      const remove = page.getByRole('link', { name: 'Eliminar cuenta', exact: true })
      await expect(remove).toHaveAttribute('aria-disabled', 'true')
      await expect(remove).not.toHaveAttribute('href', /.+/)
      await expect(page.getByText('Conéctate para guardar el idioma.', { exact: true })).toBeVisible()
      await goOnline(context, page)
      await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Español', exact: true })).toBeEnabled()
      await expect(remove).toHaveAttribute('href', '/account/delete')
      await expect(page.getByText('Conéctate para guardar el idioma.', { exact: true })).toHaveCount(0)
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-29 the privacy notice saved before opens offline with its offline caption', async ({ page, context, baseURL }) => {
    only('AI')
    await memberSignedIn(page, baseURL)
    await page.goto('/account/privacy')
    await expect(heading(page, 'Aviso de privacidad', 1)).toBeVisible()
    await expect(page.getByText('Este aviso también está disponible sin conexión.', { exact: true })).toBeVisible()
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.reload()
      await expect(heading(page, 'Aviso de privacidad', 1)).toBeVisible()
      await expect(page.getByText('Este aviso también está disponible sin conexión.', { exact: true })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-30 the privacy notice offline with nothing saved shows the draft frame', async ({ page, context }) => {
    only('AI')
    await page.goto('/welcome')
    await workerControls(page)
    await context.setOffline(true)
    try {
      await page.goto('/account/privacy')
      await expect(heading(page, 'Aviso de privacidad', 1)).toBeVisible()
      await expect(page.getByText('BORRADOR', { exact: false }).first()).toBeVisible()
      await expect(page.getByText('Este aviso también está disponible sin conexión.', { exact: true })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-31 Gimnasio and Check In offline say there is no connection', async ({ page, context, baseURL }) => {
    only('AI')
    await memberSignedIn(page, baseURL)
    await page.goto('/gym')
    await expect(page.locator('.gym-occupancy__count')).toBeVisible()
    await workerControls(page)
    await context.setOffline(true)
    try {
      await expect(page.locator('.gym-occupancy__problem')).toHaveText('Sin conexión')
      await expect(page.locator('.user-offline')).toBeVisible()
      await page.goto('/check-in')
      await expect(heading(page, 'Necesitas conexión')).toBeVisible()
      await expect(page.getByText('Conéctate a internet para verificar y registrar tu entrada.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reintentar conexión', exact: true })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  test('AB-32 the same shell opens the dashboard sign in offline and blocks the button', async ({ page, context }) => {
    only('D')
    // Firefox does not apply context.setOffline to the requests the service worker sends: /api/staff/me reached the server (401, fromServiceWorker)
    // with navigator.onLine false, so the app has no failed call to show. Playwright limitation, see https://github.com/microsoft/playwright/issues/2311
    // and the service worker notes in https://playwright.dev/docs/api/class-browsercontext. Chromium and WebKit run the row.
    test.skip(test.info().project.name === 'desktop-firefox', 'Playwright does not cut the service worker network in Firefox')
    await page.goto('/welcome')
    await workerControls(page)
    await page.goto('/staff')
    await expect(heading(page, 'Iniciar sesión')).toBeVisible()
    await context.setOffline(true)
    try {
      await page.reload()
      await expect(heading(page, 'Iniciar sesión')).toBeVisible()
      await page.getByLabel('Correo electrónico').fill('staff@example.com')
      await page.getByLabel('Contraseña', { exact: true }).fill('password')
      const submit = page.getByRole('button', { name: 'Iniciar sesión', exact: true })
      await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible()
      await expect(page.getByText('Conéctate a internet para iniciar sesión. Conservamos lo que escribiste.', { exact: true })).toBeVisible()
      await expect(submit).toBeDisabled()
      await expect(page.getByLabel('Correo electrónico')).toHaveValue('staff@example.com')
      await goOnline(context, page)
      await expect(submit).toBeEnabled()
    } finally {
      await context.setOffline(false)
    }
  })
})

test('AB-33 a real iPhone install keeps the Safari session', () => {
  test.skip(true, 'manual only: Add to Home Screen needs a real iPhone')
})

test('AB-34 a real Android install opens offline from the home screen', () => {
  test.skip(true, 'manual only: the Chrome install dialog needs a real Android phone')
})

test('AB-35 a new build replaces the shell and removes the old cache', () => {
  test.skip(true, 'needs redeploy: two builds of the frontend behind the same proxy')
})
