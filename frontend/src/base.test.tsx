import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { es } from './locales/es'
import { en } from './locales/en'
import { formatDateTime } from './date-time'
import { errorText } from './i18n'
import { Button, EmptyState, ErrorState, FormField, LoadingState } from './components'

test('every Spanish and English key exists and has text', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  for (const catalog of [es, en]) {
    for (const value of Object.values(catalog)) expect(value.trim().length).toBeGreaterThan(0)
  }
})

test('unknown API codes use a translated general error', () => {
  expect(errorText('unexpected_future_code', 'es')).toBe(es.server_error)
  expect(errorText('validation_failed', 'en')).toBe(en.validation_failed)
  expect(errorText('forbidden', 'en')).toBe(en.forbidden)
  expect(errorText('brand', 'en')).toBe(en.server_error)
})

describe('Puerto Rico date and time', () => {
  test.each([
    ['2026-10-13T19:05:00Z', '2026-10-13 3:05 PM'],
    ['2026-10-14T03:59:00Z', '2026-10-13 11:59 PM'],
    ['2026-01-01T04:00:00Z', '2026-01-01 12:00 AM'],
    ['2026-07-01T16:00:00Z', '2026-07-01 12:00 PM'],
    ['2026-10-13T15:05:00-04:00', '2026-10-13 3:05 PM'],
  ])('formats %s as %s regardless of device timezone', (input, output) => {
    expect(formatDateTime(input)).toBe(output)
    expect(formatDateTime(new Date(input))).toBe(output)
  })

  test('rejects invalid dates instead of showing Invalid Date', () => {
    expect(() => formatDateTime('invalid')).toThrow(RangeError)
  })
})

test('field has an accessible label and associates its error', () => {
  render(<FormField id="email" label={en.email} error={en.validation_failed} type="email" />)
  const input = screen.getByRole('textbox', { name: en.email })
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription(en.validation_failed)
})

test('shared button defaults to a non-submitting button and accepts keyboard focus', () => {
  render(<Button>{en.retry}</Button>)
  const button = screen.getByRole('button', { name: en.retry })
  expect(button).toHaveAttribute('type', 'button')
  button.focus()
  expect(button).toHaveFocus()
})

test('empty and loading states are live regions and errors can retry', () => {
  let retries = 0
  render(<>
    <EmptyState message={en.empty} />
    <LoadingState message={en.loading} />
    <ErrorState message={en.server_error} retryLabel={en.retry} onRetry={() => retries++} />
  </>)
  expect(screen.getAllByRole('status')).toHaveLength(2)
  expect(screen.getByRole('alert')).toHaveTextContent(en.server_error)
  fireEvent.click(screen.getByRole('button', { name: en.retry }))
  expect(retries).toBe(1)
})
