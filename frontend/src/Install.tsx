import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Button, ErrorState } from './components'
import { messages } from './i18n'
import type { Locale } from './i18n'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function Install({ locale, help = false, show = true }: { locale: Locale; help?: boolean; show?: boolean }) {
  const t = messages[locale]
  const [installed, setInstalled] = useState(isInstalled)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const finish = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', finish)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', finish)
    }
  }, [])

  async function install() {
    if (!prompt) return
    setPrompt(null)
    setFailed(false)
    try {
      await prompt.prompt()
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true)
    } catch {
      setFailed(true)
    }
  }

  if (!show) return null
  if (installed) return help ? <p role="status">{t.installed}</p> : null
  return <>
    {prompt && <Button onClick={install}><Download aria-hidden="true" />{t.install}</Button>}
    {failed && <ErrorState message={t.installError} />}
    {help && <section aria-labelledby="iphone-title">
      {!prompt && <p>{t.installUnavailable}</p>}
      <h2 id="iphone-title">{t.iphoneTitle}</h2>
      <ol><li>{t.iphoneOpen}</li><li><Share aria-hidden="true" />{t.iphoneShare}</li><li>{t.iphoneAdd}</li></ol>
    </section>}
  </>
}
