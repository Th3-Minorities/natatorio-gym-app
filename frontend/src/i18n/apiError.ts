import type { Messages } from './es'

/** Resolve API codes in the account language, with a general text for unknown codes (E-154). */
export function errorText(texts: Messages, code: string, status: number): string {
  return Object.hasOwn(texts.errors, code)
    ? texts.errors[code as keyof Messages['errors']]
    : status >= 500 ? texts.errors.server_error : texts.errors.bad_request
}

export function fieldErrorText(texts: Messages, rule: string): string {
  return Object.hasOwn(texts.validation, rule)
    ? texts.validation[rule as keyof Messages['validation']]
    : texts.validation.invalid
}
