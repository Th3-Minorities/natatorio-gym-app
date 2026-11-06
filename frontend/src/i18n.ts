import { es } from './locales/es'
import { en } from './locales/en'

export type Locale = 'es' | 'en'
export type TextKey = keyof typeof es
export const messages = { es, en }

const errorCodes = [
  'bad_request', 'unauthenticated', 'forbidden', 'not_found', 'method_not_allowed',
  'conflict', 'payload_too_large', 'session_expired', 'validation_failed', 'too_many_requests',
  'service_unavailable', 'server_error', 'database_unavailable',
]

export function errorText(code: string, locale: Locale): string {
  const catalog = messages[locale]
  return errorCodes.includes(code)
    ? catalog[code as TextKey] : catalog.server_error
}
