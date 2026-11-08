import { useEffect } from 'react'
import { useMessages } from '../i18n'

/** The tab title for a staff page: "<page title> · <brand name>". The earlier title returns when the page goes, unless something else set a title meanwhile. */
export function useDocumentTitle(title: string) {
  const brandName = useMessages().dashboard.brandName
  useEffect(() => {
    const previous = document.title
    const mine = `${title} · ${brandName}`
    document.title = mine
    // Put the earlier title back only if nobody changed it since: a language change or sign-out sets its own.
    return () => {
      if (document.title === mine) document.title = previous
    }
  }, [title, brandName])
}
