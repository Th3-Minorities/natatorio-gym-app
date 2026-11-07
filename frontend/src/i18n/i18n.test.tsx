/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
function phpFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? phpFiles(path) : path.endsWith('.php') ? [path] : []
  })
}

function backendCodes(): string[] {
  const root = resolve(process.cwd(), '../backend')
  const codes = ['app', 'routes', 'bootstrap'].flatMap((folder) =>
    phpFiles(join(root, folder)).flatMap((path) => {
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '')
      return [...source.matchAll(/\bnew\s+(?:\\?\w+\\)*ApiException\s*\(\s*(?:errorCode\s*:\s*)?(['"])([^'"]+)\1/g)]
        .map((match) => match[2])
    }),
  )
  const renderer = readFileSync(join(root, 'app/Exceptions/ApiErrorRenderer.php'), 'utf8')
  const list = renderer.match(/public const HTTP_CODES\s*=\s*\[([\s\S]*?)\];/)
  expect(list, 'ApiErrorRenderer must expose HTTP_CODES').not.toBeNull()
  return [...codes, ...[...list![1].matchAll(/=>\s*'([^']+)'/g)].map((match) => match[1])]
}

afterEach(() => {
  document.documentElement.lang = ''
  document.title = ''
})

describe('translation files', () => {
  it('have the same texts in Spanish and English', () => {
    expect(shape(en).sort()).toEqual(shape(es).sort())
  })

  it('have no empty text', () => {
    expect([...strings(es), ...strings(en)].filter((text) => text.trim() === '')).toEqual([])
  })

  it('translate every error code the backend sends', () => {
    const codes = backendCodes()
    expect(codes).toContain('not_found')
    expect(codes).toContain('server_error')
    expect(codes).toContain('database_unavailable')

    for (const code of codes) {
      expect(Object.keys(es.errors), `es has no text for "${code}"`).toContain(code)
      expect(Object.keys(en.errors), `en has no text for "${code}"`).toContain(code)
    }
  })

  it('translates the supported validation rules and the general fallback', () => {
    for (const rule of ['required', 'email', 'min', 'max', 'string', 'in', 'unique', 'confirmed', 'invalid']) {
      expect(es).toHaveProperty(`validation.${rule}`)
      expect(en).toHaveProperty(`validation.${rule}`)
    }
  })
})

describe('errorMessage', () => {
  it('shows the text for a known code', () => {
    expect(errorMessage(es, 'not_found', 404)).toBe(es.errors.not_found)
    expect(errorMessage(en, 'not_found', 404)).toBe(en.errors.not_found)
  })

  it('never shows a raw code: unknown codes get the general text', () => {
    expect(errorMessage(es, 'check_in_something_new', 422)).toBe(es.errors.bad_request)
    expect(errorMessage(es, 'printer_on_fire', 503)).toBe(es.errors.server_error)
    expect(errorMessage(en, 'toString', 400)).toBe(en.errors.bad_request)
    expect(errorMessage(en, '__proto__', 500)).toBe(en.errors.server_error)
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
    expect(document.title).toBe(es.dashboard.brandName)
  })

  it("follows the account language and the page language follows it (REQ-NF-33)", () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText(en.health.connected)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe(en.dashboard.brandName)
  })

  it('falls back to Spanish for a language the app does not have', () => {
    render(
      <I18nProvider locale="fr">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText(es.health.connected)).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(document.title).toBe(es.dashboard.brandName)
  })

  it('updates the page title when the account language changes', () => {
    const { rerender } = render(<I18nProvider><Probe /></I18nProvider>)
    expect(document.title).toBe(es.dashboard.brandName)
    rerender(<I18nProvider locale="en"><Probe /></I18nProvider>)
    expect(document.title).toBe(en.dashboard.brandName)
  })
})
