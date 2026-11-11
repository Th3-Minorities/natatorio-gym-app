import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { signInApi, createMember, type Member, type MemberOptions } from './setup.ts'

// Helpers for the #152 app base path tests (e2e-paths/app-base.spec.ts): install help, installed app, offline.

const ABBREVIATION: Record<string, string> = { desktop: 'D', 'desktop-firefox': 'D', 'desktop-webkit': 'D', android: 'A', iphone: 'I' }

/** Limits a row to the devices listed (D desktop, A Android, I iPhone). */
export function only(devices: string) {
  const device = ABBREVIATION[test.info().project.name]
  test.skip(!devices.includes(device), `this path runs on ${devices}`)
}

/** The tab the install help preselects for this project: the iPhone user agent opens the iPhone tab, everything else Android. */
export const defaultTab = () => (test.info().project.name === 'iphone' ? 'iPhone' : 'Android')

export type PromptOutcome = 'accepted' | 'dismissed' | 'refused'

/**
 * Dispatches a synthetic `beforeinstallprompt` on a loaded page, as Chrome does. `refused` makes prompt() reject.
 * Returns whether the app prevented the default of the event.
 */
export function firePrompt(page: Page, outcome: PromptOutcome): Promise<boolean> {
  return page.evaluate((outcome) => {
    const state = window as unknown as { e2ePrompts: number }
    state.e2ePrompts = 0
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => {
        state.e2ePrompts += 1
        return outcome === 'refused' ? Promise.reject(new DOMException('refused', 'NotAllowedError')) : Promise.resolve()
      },
      userChoice: Promise.resolve({ outcome: outcome === 'accepted' ? 'accepted' : 'dismissed' }),
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, outcome)
}

export const promptCalls = (page: Page) => page.evaluate(() => (window as unknown as { e2ePrompts: number }).e2ePrompts)

/** Makes the page look like the installed app: Android's display-mode query and iOS's navigator.standalone. Call before goto. */
export async function asInstalled(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => query.includes('display-mode: standalone')
      ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : original(query)
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  })
}

/** A fresh member, signed in through the API, ready to open any screen. */
export async function memberSignedIn(page: Page, baseURL: string | undefined, options: MemberOptions = {}): Promise<Member> {
  const member = createMember(options)
  await signInApi(page.request, baseURL!, member)
  return member
}

/** Waits until the real service worker controls the page. The base config blocks workers: the test needs `serviceWorkers: 'allow'`. */
export async function workerControls(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
}

/** Cuts the connection. WebKit sets navigator.onLine to false without firing the `offline` event, so the page is told with it. */
export async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

/** Restores the connection and tells the app with the `online` event, which it listens to. */
export async function goOnline(context: BrowserContext, page: Page) {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

export const heading = (page: Page, name: string, level?: number) => page.getByRole('heading', { name, exact: true, ...(level ? { level } : {}) })
export const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true })

export async function expectTab(page: Page, name: string) {
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

export const IPHONE_STEPS = ['Abre esta página en Safari.', 'Toca Compartir.', 'Selecciona Agregar a Inicio.', 'Confirma con Agregar.']
export const ANDROID_STEPS = ['1. Abre el menú ⋮.', '2. Toca Instalar y crear acceso directo.', '3. Elige Instalar y confirma.']

export async function expectTexts(page: Page, texts: string[]) {
  for (const text of texts) await expect(page.getByText(text, { exact: true })).toBeVisible()
}

export async function expectNoTexts(page: Page, texts: string[]) {
  for (const text of texts) await expect(page.getByText(text, { exact: true })).toHaveCount(0)
}
