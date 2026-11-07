import type { Locale } from '../i18n'

// The language picked on the welcome screen stays on the device until there is an account (E-159).
const DEVICE_LOCALE = 'user-locale'

export function storedLocale(): Locale {
  try { return localStorage.getItem(DEVICE_LOCALE) === 'en' ? 'en' : 'es' } catch { return 'es' }
}

export function storeLocale(locale: Locale) {
  try { localStorage.setItem(DEVICE_LOCALE, locale) } catch { /* The choice still applies until the page reloads. */ }
}
