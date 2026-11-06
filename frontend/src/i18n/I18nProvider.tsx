import { useEffect, type ReactNode } from 'react'
import { LocaleContext, MessagesContext, messages, supportedLocale } from './messages'

/** Gives the texts of the account language to the screens and sets the page language (REQ-NF-33). */
export function I18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const current = supportedLocale(locale)

  useEffect(() => {
    document.documentElement.lang = current
    document.title = messages[current].dashboard.brandName
  }, [current])

  return (
    <LocaleContext.Provider value={current}>
      <MessagesContext.Provider value={messages[current]}>{children}</MessagesContext.Provider>
    </LocaleContext.Provider>
  )
}
