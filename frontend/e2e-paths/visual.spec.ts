import { expect, test, type Page } from '@playwright/test'
import { fakeLocation, INSIDE } from '../e2e/flows/flow.ts'
import { createMember, signInApi, tinker, type Member } from './setup.ts'
import { createUser } from './setup-sign-in.ts'
import { lastEmailTo, linkIn } from '../e2e/mail.ts'
import { checkInApi, deskCheckOut } from './setup-end-of-visit.ts'

// #152 visual reproductions on the credential card (V-01 to V-03). Numbers are measured in the browser, never read from a screenshot.

test.setTimeout(120_000)

const ABBREVIATION: Record<string, string> = { desktop: 'D', 'desktop-firefox': 'D', 'desktop-webkit': 'D', android: 'A', iphone: 'I' }
function only(devices: string) {
  test.skip(!devices.includes(ABBREVIATION[test.info().project.name]), `checked on ${devices} only`)
}

const SHORT_NAME = 'Ana Lee'
const LONG_NAME = 'Prueba mw944hv034w3w Rodríguez Colón'

/** Member with an open visit, the phone signed in and Check In open on the active card. */
async function activeCard(page: Page, baseURL: string | undefined, name?: string) {
  const member = createMember()
  if (name) rename(member, name)
  await fakeLocation(page, INSIDE)
  await signInApi(page.request, baseURL!, member)
  const id = await checkInApi(page.request, baseURL)
  await page.goto('/check-in')
  await expect(page.getByText('Sesión activa', { exact: true })).toBeVisible()
  return { member, id }
}

async function endedCard(page: Page, baseURL: string | undefined, request: Parameters<typeof deskCheckOut>[0]) {
  const { id } = await activeCard(page, baseURL)
  await deskCheckOut(request, baseURL, id)
  await page.reload()
  await expect(page.getByText('Sesión finalizada', { exact: true })).toBeVisible()
}

function rename(member: Member, name: string) {
  tinker(`\\App\\Models\\WaiverAcceptance::where('user_id', ${member.id})->update(['full_name' => '${name}']);`)
}

/** Gaps between the pill border and its icon (left) and its text (right), plus overflow, in CSS px. */
function pillMetrics(page: Page) {
  return page.locator('.check-in-id__category').evaluate((pill) => {
    const style = getComputedStyle(pill)
    const box = pill.getBoundingClientRect()
    const icon = pill.querySelector('svg')!.getBoundingClientRect()
    const textNode = pill.querySelector('span')!
    const range = document.createRange()
    range.selectNodeContents(textNode)
    const text = range.getBoundingClientRect()
    const left = icon.left - (box.left + parseFloat(style.borderLeftWidth))
    const right = box.right - parseFloat(style.borderRightWidth) - text.right
    return { paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight), left, right, scrollWidth: pill.scrollWidth, clientWidth: pill.clientWidth, width: box.width, textWidth: text.width }
  })
}

test('V-01 the Miembro pill keeps equal space left of the icon and right of the text (active card)', async ({ page, baseURL }) => {
  only('AI')
  await activeCard(page, baseURL)
  const m = await pillMetrics(page)
  console.log('V-01 active', JSON.stringify(m))
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth)
  expect(m.right).toBeGreaterThanOrEqual(m.left - 2)
})

test('V-01 the Miembro pill keeps equal space left of the icon and right of the text (ended card)', async ({ page, baseURL, playwright }) => {
  only('AI')
  await endedCard(page, baseURL, playwright.request)
  const m = await pillMetrics(page)
  console.log('V-01 ended', JSON.stringify(m))
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth)
  expect(m.right).toBeGreaterThanOrEqual(m.left - 2)
})

// No minimum inset test: Figma 4104:648 draws the pill 82px wide with no horizontal padding (icon 14 + gap 6 + text 62), as the app builds it.

/** Horizontal distance from the end of the name's last line to the badge. */
function badgeGap(page: Page) {
  return page.locator('.check-in-id__name').evaluate((name) => {
    const span = name.querySelector('span:not(.check-in-badge)')!
    const range = document.createRange()
    range.selectNodeContents(span)
    const lines = Array.from(range.getClientRects())
    const lastLine = lines.reduce((a, b) => (b.bottom > a.bottom + 1 || (Math.abs(b.bottom - a.bottom) <= 1 && b.right > a.right) ? b : a))
    const badge = name.querySelector('.check-in-badge')!.getBoundingClientRect()
    return { lines: new Set(lines.map((r) => Math.round(r.top))).size, lastLineRight: lastLine.right, badgeLeft: badge.left, gap: badge.left - lastLine.right, card: name.parentElement!.getBoundingClientRect().width }
  })
}

test('V-02 the verified badge sits next to a wrapped name', async ({ page, baseURL }) => {
  only('AI')
  await activeCard(page, baseURL, LONG_NAME)
  const m = await badgeGap(page)
  console.log('V-02 long', JSON.stringify(m))
  expect(m.lines).toBeGreaterThan(1)
  expect(m.gap).toBeLessThanOrEqual(16)
})

test('V-02 control: the verified badge sits next to a short name', async ({ page, baseURL }) => {
  only('AI')
  await activeCard(page, baseURL, SHORT_NAME)
  const m = await badgeGap(page)
  console.log('V-02 short', JSON.stringify(m))
  expect(m.gap).toBeLessThanOrEqual(16)
})

/** At scroll 0 the navigation's opaque band (above the floating pill) must not hide content that Figma draws behind the nav. */
async function bandState(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  return page.evaluate(() => {
    const nav = document.querySelector('.user-navigation')!
    const navBox = nav.getBoundingClientRect()
    const pillTop = nav.querySelector('nav')!.getBoundingClientRect().top + 24
    const y = (navBox.top + pillTop) / 2
    const x = innerWidth / 2
    const covered = ['.check-in-id', '.check-in-duration', '.check-in-action', '.check-in-caption'].some((selector) => {
      const r = document.querySelector(selector)?.getBoundingClientRect()
      return !!r && r.top < y && r.bottom > y
    })
    const hit = document.elementFromPoint(x, y)
    return { navTop: Math.round(navBox.top), pillTop: Math.round(pillTop), y: Math.round(y), contentUnderBand: covered, opaque: !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(getComputedStyle(nav).backgroundColor), hitIsNav: !!hit?.closest('.user-navigation'), navBackground: getComputedStyle(nav).backgroundColor }
  })
}

test('V-03 ended view at scroll 0: the navigation does not cut content with a hard edge above the pill', async ({ page, baseURL, playwright }) => {
  only('AI')
  await endedCard(page, baseURL, playwright.request)
  const s = await bandState(page)
  console.log('V-03 band ended', JSON.stringify(s))
  await page.screenshot({ path: test.info().outputPath('ended-scroll-0.png') })
  if (s.contentUnderBand) expect(s.opaque, 'the opaque navigation band hides content').toBe(false)
})

test('V-03 Gym ID active view at scroll 0: the navigation does not cut content with a hard edge above the pill', async ({ page, baseURL }) => {
  only('AI')
  await activeCard(page, baseURL)
  const s = await bandState(page)
  console.log('V-03 band active', JSON.stringify(s))
  await page.screenshot({ path: test.info().outputPath('active-scroll-0.png') })
  if (s.contentUnderBand) expect(s.opaque, 'the opaque navigation band hides content').toBe(false)
})

/** Scrolls to the bottom and reports what is visible between the Duración total card and the navigation. */
async function bottomState(page: Page, cardSelector: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  return page.evaluate((selector) => {
    const card = document.querySelector(selector)!.getBoundingClientRect()
    const nav = document.querySelector('.user-navigation')!.getBoundingClientRect()
    const root = document.documentElement
    const probes = [0.25, 0.5, 0.75, 0.95].map((f) => {
      const y = card.top + card.height * f
      const hit = document.elementFromPoint(card.left + card.width / 2, y)
      return { y: Math.round(y), hit: !!hit && !!hit.closest(selector) }
    })
    return {
      viewport: innerHeight, scrollY: Math.round(scrollY), docHeight: root.scrollHeight, cardTop: Math.round(card.top), cardBottom: Math.round(card.bottom),
      navTop: Math.round(nav.top), probes,
    }
  }, cardSelector)
}

test('V-03 ended view: the Duración total card is fully visible above the navigation after scrolling', async ({ page, baseURL, playwright }) => {
  only('AI')
  await endedCard(page, baseURL, playwright.request)
  const s = await bottomState(page, '.check-in-duration')
  console.log('V-03 ended', JSON.stringify(s))
  expect(s.cardBottom).toBeLessThanOrEqual(s.navTop)
  for (const probe of s.probes) expect(probe.hit, `card covered or cut at y=${probe.y}`).toBe(true)
  // the page must reach the bottom: nothing blank between the last content and the navigation
  expect(s.navTop - s.cardBottom).toBeLessThan(200)
})

test('V-03 Gym ID active view: the Duración card is fully visible above the navigation after scrolling', async ({ page, baseURL }) => {
  only('AI')
  await activeCard(page, baseURL)
  const s = await bottomState(page, '.check-in-duration')
  console.log('V-03 active', JSON.stringify(s))
  expect(s.cardBottom).toBeLessThanOrEqual(s.navTop)
  for (const probe of s.probes) expect(probe.hit, `card covered or cut at y=${probe.y}`).toBe(true)
  expect(s.navTop - s.cardBottom).toBeLessThan(200)
})

// ------------------------------------------------------------------------------------------------- V-04 to V-06

test('V-04 N-07 while the link is being checked only the loading block shows, no form', async ({ page }) => {
  only('AI')
  const user = createUser()
  await page.goto('/recover-password')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click()
  await expect(page.getByText('Solicitud recibida', { exact: true })).toBeVisible()
  const link = linkIn(await lastEmailTo(page, user.email, '/reset-password'), '/reset-password')
  await page.route('**/api/user/password/validate', async (route) => { await new Promise((resolve) => setTimeout(resolve, 3000)); await route.continue() })
  await page.goto(link)
  await expect(page.getByText('Estamos verificando el enlace…', { exact: true })).toBeVisible()
  const shown = await page.evaluate(() => {
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    return {
      inputs: Array.from(document.querySelectorAll('input')).filter(visible).length,
      save: Array.from(document.querySelectorAll('button')).filter((b) => /Guardar contraseña/.test(b.textContent ?? '') && visible(b)).length,
    }
  })
  console.log('V-04', JSON.stringify(shown))
  await page.screenshot({ path: test.info().outputPath('checking-link.png') })
  expect(shown.inputs).toBe(0)
  expect(shown.save).toBe(0)
})

test('V-05 N-02 wrong credentials outline both fields and show the inline text under the password, with no boxed notice', async ({ page }) => {
  only('AI')
  const user = createUser()
  await page.goto('/sign-in')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('una contraseña equivocada')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByText('Correo o contraseña incorrectos.', { exact: true }).or(page.getByText('No pudimos iniciar sesión', { exact: true }))).toBeVisible()
  const state = await page.evaluate(() => ({
    emailInvalid: document.querySelector('input[type="email"]')?.getAttribute('aria-invalid'),
    passwordInvalid: document.querySelector('input[autocomplete="current-password"]')?.getAttribute('aria-invalid'),
    inline: !!document.querySelector('.field__error') && /Correo o contraseña incorrectos\./.test(document.body.innerText),
    boxed: !!document.querySelector('.user-notice'),
  }))
  console.log('V-05', JSON.stringify(state))
  await page.screenshot({ path: test.info().outputPath('wrong-credentials.png') })
  expect(state.emailInvalid).toBe('true')
  expect(state.passwordInvalid).toBe('true')
  await expect(page.getByText('Correo o contraseña incorrectos.', { exact: true })).toBeVisible()
  expect(state.boxed).toBe(false)
})

/** The Welcome barbell illustration is decoded and has a size. */
function illustration(page: Page) {
  return page.locator('img.user-welcome__illustration').evaluate((img: HTMLImageElement) => ({ complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, src: img.currentSrc }))
}

test('V-06 the Welcome illustration loads on a cold open', async ({ page }) => {
  only('AI')
  await page.goto('/welcome')
  await expect(page.locator('img.user-welcome__illustration')).toBeAttached()
  await page.waitForLoadState('load')
  const m = await illustration(page)
  console.log('V-06 online', JSON.stringify(m))
  expect(m.complete).toBe(true)
  expect(m.naturalWidth).toBeGreaterThan(0)
})

test.describe('V-06 offline', () => {
  test.use({ serviceWorkers: 'allow' })
  test('V-06 the Welcome illustration loads offline after a warm load', async ({ page }) => {
    only('AI')
    await page.goto('/welcome')
    await expect(page.locator('img.user-welcome__illustration')).toBeAttached()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    })
    await page.reload()
    await page.waitForLoadState('load')
    await page.context().setOffline(true)
    await page.reload()
    await expect(page.locator('img.user-welcome__illustration')).toBeAttached()
    await page.waitForLoadState('load')
    const m = await illustration(page)
    console.log('V-06 offline', JSON.stringify(m))
    expect(m.complete).toBe(true)
    expect(m.naturalWidth).toBeGreaterThan(0)
  })
})
