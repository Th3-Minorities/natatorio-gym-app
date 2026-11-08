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

function show(agent = androidAgent) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent)
  return render(<InstallHelp />)
}

function installEvent(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome }) })
  act(() => { window.dispatchEvent(event) })
  return { event, prompt }
}

beforeEach(() => { resetInstall(); window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia })
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(navigator, 'standalone') })

test('iPhone opens on the Safari steps (4078:792)', () => {
  show(iPhoneAgent)
  expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: t.iphone })).toHaveAttribute('aria-selected', 'true')
  for (const step of [t.safari, t.share, t.addHome, t.confirmAdd]) expect(screen.getByText(step)).toBeInTheDocument()
  expect(screen.getByText(t.openAsApp)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: t.continue })).toHaveAttribute('href', '/account')
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
  expect(screen.getByRole('link', { name: t.notNow })).toHaveAttribute('href', '/account')
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
  expect(screen.getByRole('heading', { level: 1, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: t.continue })).toHaveAttribute('href', '/account')
})

test('opened as the installed app it shows the installed state', () => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  show(iPhoneAgent)
  expect(screen.getByRole('heading', { level: 1, name: t.installedTitle })).toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
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

test('English texts come from the account language', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(androidAgent)
  render(<I18nProvider locale="en"><InstallHelp /></I18nProvider>)
  expect(screen.getByRole('heading', { level: 1, name: en.install.title })).toBeInTheDocument()
})
