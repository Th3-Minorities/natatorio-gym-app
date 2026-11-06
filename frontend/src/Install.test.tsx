import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Install } from './Install'
import { es } from './locales/es'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('without a browser prompt the install button stays hidden and iPhone steps are available', () => {
  render(<Install locale="es" help />)
  expect(screen.queryByRole('button', { name: es.install })).not.toBeInTheDocument()
  expect(screen.getByText(es.iphoneShare)).toBeInTheDocument()
  expect(screen.getByText(es.iphoneAdd)).toBeInTheDocument()
})

test('Chromium prompt is deferred, can be dismissed and is used only once', async () => {
  render(<Install locale="es" help />)
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }),
  })
  act(() => { window.dispatchEvent(event) })
  expect(event.defaultPrevented).toBe(true)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: es.install })) })
  expect(prompt).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: es.install })).not.toBeInTheDocument()
  expect(screen.queryByText(es.installed)).not.toBeInTheDocument()
})

test('accepted prompt and appinstalled show the installed state', async () => {
  render(<Install locale="es" help />)
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
  act(() => { window.dispatchEvent(event) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: es.install })) })
  expect(screen.getByText(es.installed)).toBeInTheDocument()
  act(() => { window.dispatchEvent(new Event('appinstalled')) })
  expect(screen.queryByRole('button', { name: es.install })).not.toBeInTheDocument()
})

test('an already installed iOS app does not show install steps', () => {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  try {
    render(<Install locale="es" help />)
    expect(screen.getByText(es.installed)).toBeInTheDocument()
    expect(screen.queryByText(es.iphoneShare)).not.toBeInTheDocument()
  } finally {
    Reflect.deleteProperty(navigator, 'standalone')
  }
})
