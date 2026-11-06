/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { I18nProvider, errorMessage, useMessages } from './index'

/** Every path to a text, like "health.connected", with the kind of value it holds. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => shape(inner, path ? `${path}.${key}` : key))
  }
  return [`${path}:${typeof value}`]
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings)
  return []
}

// Read with Node, not imported: Vite keeps files outside frontend/ out of the dev server on purpose.
// Tests run from frontend/, so the backend is one folder up.
function backendCodes(locale: string): string[] {
  const file = readFileSync(resolve(process.cwd(), `../backend/lang/${locale}/errors.php`), 'utf8')
  return [...file.matchAll(/^\s*'([a-z_]+)'\s*=>/gm)].map((match) => match[1])
}

afterEach(() => {
  document.documentElement.lang = ''
})

describe('translation files', () => {
  it('have the same texts in Spanish and English', () => {
    expect(shape(en).sort()).toEqual(shape(es).sort())
  })

  it('have no empty text', () => {
    expect([...strings(es), ...strings(en)].filter((text) => text.trim() === '')).toEqual([])
  })

  it('translate every error code the backend sends', () => {
    // A code added in backend/lang/*/errors.php needs a text here too.
    const codes = [...backendCodes('en'), ...backendCodes('es')]
    expect(codes).toContain('not_found')

    for (const code of codes) {
      expect(Object.keys(es.errors), `es has no text for "${code}"`).toContain(code)
      expect(Object.keys(en.errors), `en has no text for "${code}"`).toContain(code)
    }
  })
})

describe('errorMessage', () => {
  it('shows the text for a known code', () => {
    expect(errorMessage(es, 'not_found', 404)).toBe(es.errors.not_found)
    expect(errorMessage(en, 'not_found', 404)).toBe(en.errors.not_found)
  })

  it('never shows a raw code: unknown codes get the general text, as in the backend', () => {
    expect(errorMessage(es, 'check_in_something_new', 422)).toBe(es.errors.bad_request)
    expect(errorMessage(es, 'printer_on_fire', 503)).toBe(es.errors.server_error)
  })
})

function Probe() {
  return <p>{useMessages().health.connected}</p>
}

describe('I18nProvider', () => {
  it('is Spanish by default and sets the page language', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText(es.health.connected)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
  })

  it("follows the account language and the page language follows it (REQ-NF-33)", () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText(en.health.connected)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })

  it('falls back to Spanish for a language the app does not have', () => {
    render(
      <I18nProvider locale="fr">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText(es.health.connected)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
  })
})
