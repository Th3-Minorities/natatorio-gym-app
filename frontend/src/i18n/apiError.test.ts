import { describe, expect, it } from 'vitest'
import { errorText, fieldErrorText } from './apiError'
import { en } from './en'
import { es } from './es'

describe.each([es, en])('API error texts', (texts) => {
  it('uses the account language for known codes', () => {
    expect(errorText(texts, 'not_found', 404)).toBe(texts.errors.not_found)
    expect(fieldErrorText(texts, 'required')).toBe(texts.validation.required)
    expect(fieldErrorText(texts, 'email')).toBe(texts.validation.email)
  })

  it('falls back by HTTP status for unknown codes', () => {
    for (const code of ['new_code', '', 'toString', '__proto__']) {
      expect(errorText(texts, code, 422)).toBe(texts.errors.bad_request)
      expect(errorText(texts, code, 500)).toBe(texts.errors.server_error)
    }
  })

  it('uses the general field text for unknown validation rules', () => {
    for (const rule of ['new_rule', '', 'toString', '__proto__']) {
      expect(fieldErrorText(texts, rule)).toBe(texts.validation.invalid)
    }
  })
})
