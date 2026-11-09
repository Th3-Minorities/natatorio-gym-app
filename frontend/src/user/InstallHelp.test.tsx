import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { I18nProvider } from '../i18n'
import { InstallHelp } from './InstallHelp'
import { listenForInstall, resetInstall } from './installPrompt'

listenForInstall()

const t = es.install
const iPhoneAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const androidAgent = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'

function show(agent = androidAgent, registered = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent)
  window.history.replaceState(null, '', registered ? '/install?registered' : '/install')
  return render(<InstallHelp />)
}

function installEvent(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome }) })
  act(() => { window.dispatchEvent(event) })
  return { event, prompt }
}

beforeEach(() => { resetInstall(); window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia })
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(navigator, 'standalone'); window.history.replaceState(null, '', '/') })

test('from Mi cuenta the iPhone steps have the top bar, the navigation and no link at the bottom (4453:2499)', () => {
  show(iPhoneAgent)
  expect(screen.getByRole('heading', { level: 1, name: es.user.installApp })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: t.iphone })).toHaveAttribute('aria-selected', 'true')
  for (const step of [t.safari, t.share, t.addHome, t.confirmAdd]) expect(screen.getByText(step)).toBeInTheDocument()
  expect(screen.getByText(t.openAsApp)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: t.continue })).not.toBeInTheDocument()
  expect(screen.queryByText(es.user.brand)).not.toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: es.user.navigation })).toBeInTheDocument()
})

test('right after registration the green header and the Continuar link stay (4078:792)', () => {
  show(iPhoneAgent, true)
  expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
  expect(screen.getByText(es.user.brand)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: t.continue })).toHaveAttribute('href', '/check-in')
  fireEvent.click(screen.getByRole('tab', { name: t.android }))
  expect(screen.getByRole('link', { name: t.notNow })).toHaveAttribute('href', '/check-in')
})

test('Android has no install button until the browser offers the prompt (REQ-F-66)', async () => {
  show()
  expect(screen.getByRole('tab', { name: t.android })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText(t.chromeTitle)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: t.install })).not.toBeInTheDocument()
  const { event, prompt } = installEvent()
  expect(event.defaultPrevented).toBe(true)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: t.install })) })
  expect(prompt).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: t.install })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: t.notNow })).not.toBeInTheDocument()
})

test('a prompt fired before N-09 opens still shows the install button', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(androidAgent)
  installEvent()
  render(<InstallHelp />)
  expect(screen.getByRole('button', { name: t.install })).toBeInTheDocument()
})

test('an accepted prompt or appinstalled shows the installed state (4078:919)', async () => {
  show()
  installEvent('accepted')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: t.install })) })
  expect(screen.getByRole('heading', { level: 2, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: t.continue })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: es.user.returnToAccount }).map((link) => link.getAttribute('href'))).toEqual(['/account', '/account'])
})

test('opened as the installed app from Mi cuenta it shows only the top bar, no green header (4453:2666)', () => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  show(iPhoneAgent)
  expect(screen.getByRole('heading', { level: 1, name: es.user.installApp })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.queryByText(es.user.brand)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: t.continue })).not.toBeInTheDocument()
})

test('opened as the installed app after registration it keeps the green header (4078:919)', () => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  show(iPhoneAgent, true)
  expect(screen.getByRole('heading', { level: 1, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.getByText(es.user.brand)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: t.continue })).toHaveAttribute('href', '/check-in')
})

test('tabs switch by click and by arrow keys', () => {
  show(iPhoneAgent)
  fireEvent.click(screen.getByRole('tab', { name: t.android }))
  expect(screen.getByRole('tab', { name: t.android })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText(t.chromeTitle)).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('tab', { name: t.android }), { key: 'ArrowLeft' })
  expect(screen.getByRole('tab', { name: t.iphone })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: t.iphone })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('tab', { name: t.iphone }), { key: 'End' })
  expect(screen.getByRole('tab', { name: t.android })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('tab', { name: t.android }), { key: 'Home' })
  expect(screen.getByRole('tab', { name: t.iphone })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0')
})

test('the back arrow returns to Mi cuenta in both the steps and the installed state', () => {
  const { unmount } = show()
  expect(screen.getByRole('link', { name: es.user.returnToAccount })).toHaveAttribute('href', '/account')
  unmount()
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  show()
  expect(screen.getByRole('heading', { level: 2, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: es.user.returnToAccount }).length).toBe(2)
  for (const link of screen.getAllByRole('link', { name: es.user.returnToAccount })) expect(link).toHaveAttribute('href', '/account')
})

test('English texts come from the account language', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(androidAgent)
  render(<I18nProvider locale="en"><InstallHelp /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: en.user.installApp })).toBeInTheDocument()
})

test('the installed state from Mi cuenta reads Back to My account in English', () => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  window.history.replaceState(null, '', '/install')
  render(<I18nProvider locale="en"><InstallHelp /></I18nProvider>)
  expect(screen.getAllByRole('link', { name: 'Back to My account' }).length).toBe(2)
})
