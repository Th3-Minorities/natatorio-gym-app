import { createContext, useContext } from 'react'
import { en } from './en'
import { es, type Messages } from './es'

// One language per account, Spanish by default, no language button (E-64, E-104).
export type Locale = 'es' | 'en'

export const messages: Record<Locale, Messages> = { es, en }

export function supportedLocale(locale: string | undefined): Locale {
  return locale === 'en' ? 'en' : 'es'
}

export const MessagesContext = createContext<Messages>(es)

export function useMessages(): Messages {
  return useContext(MessagesContext)
}

/**
 * The text for an API error code (docs/design/api-conventions.md). The screen decides by the code,
 * never by the server's message. An unknown code gets the general text, never the raw code.
 */
export function errorMessage(texts: Messages, code: string, status: number): string {
  return texts.errors[code] ?? (status >= 500 ? texts.errors.server_error : texts.errors.bad_request)
}
