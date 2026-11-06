import { createContext, useContext } from 'react'
import { en } from './en'
import { es, type Messages } from './es'

// One language per account, Spanish by default, no language button (E-64, E-114).
export type Locale = 'es' | 'en'

export const messages: Record<Locale, Messages> = { es, en }

export function supportedLocale(locale: string | undefined): Locale {
  return locale === 'en' ? 'en' : 'es'
}

export const MessagesContext = createContext<Messages>(es)

export const LocaleContext = createContext<Locale>('es')

export function useMessages(): Messages {
  return useContext(MessagesContext)
}

/** The account language, for things the texts alone cannot do, like formatting dates. */
export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export { errorText as errorMessage } from './apiError'
