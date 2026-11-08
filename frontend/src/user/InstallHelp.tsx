import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Check, Compass, Info, Share, Smartphone, SquarePlus } from 'lucide-react'
import { Button } from '../components'
import { useMessages } from '../i18n'
import { UserPage } from './ui'
import { installState, promptUsed, subscribe } from './installPrompt'
import dumbbell from './assets/install-dumbbell.svg'
import './install.css'

type Platform = 'iphone' | 'android'

const PLATFORMS: Platform[] = ['iphone', 'android']

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** N-09, Figma 4078:792 (iPhone), 4078:869 (Android) and 4078:919 (already installed). */
export function InstallHelp() {
  const t = useMessages().install
  const { prompt, installed: accepted } = useSyncExternalStore(subscribe, installState)
  const [standalone] = useState(isInstalled)
  const installed = standalone || accepted
  const [platform, setPlatform] = useState<Platform>(() => /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iphone' : 'android')
  const tabs = useRef<Record<Platform, HTMLButtonElement | null>>({ iphone: null, android: null })

  async function install() {
    if (!prompt) return
    promptUsed(false)
    try {
      await prompt.prompt()
      if ((await prompt.userChoice).outcome === 'accepted') promptUsed(true)
    } catch { /* The browser refused the prompt; the Chrome steps stay on screen. */ }
  }

  function arrows(event: KeyboardEvent) {
    const index = PLATFORMS.indexOf(platform)
    const next = { ArrowLeft: PLATFORMS[(index - 1 + PLATFORMS.length) % PLATFORMS.length], ArrowRight: PLATFORMS[(index + 1) % PLATFORMS.length],
      Home: PLATFORMS[0], End: PLATFORMS[PLATFORMS.length - 1] }[event.key]
    if (!next) return
    event.preventDefault()
    setPlatform(next)
    tabs.current[next]?.focus()
  }

  if (installed) return <UserPage large back="/account">
    <div className="install-done">
      <span className="install-done__check"><Check aria-hidden="true" /></span>
      <h1 tabIndex={-1}>{t.installedTitle}</h1><p>{t.installedText}</p><p>{t.installedHelp}</p>
      <a href="/account" className="button button--primary user-action">{t.continue}</a>
    </div>
  </UserPage>

  const steps = [
    { Icon: Compass, text: t.safari }, { Icon: Share, text: t.share, detail: t.shareDetail },
    { Icon: SquarePlus, text: t.addHome }, { Icon: Check, text: t.confirmAdd },
  ]
  return <UserPage large back="/account"><div className="install">
    <div className="install-intro"><h1 tabIndex={-1}>{t.title}</h1><p>{t.description}</p></div>
    <div className="install-identity"><span className="install-icon"><img src={dumbbell} alt="" width="32" height="32" /></span><strong>{t.appName}</strong></div>
    <div className="install-tabs" role="tablist" aria-label={t.platform}>
      {PLATFORMS.map((name) => <button key={name} type="button" role="tab" id={`install-tab-${name}`} aria-controls="install-panel"
        aria-selected={platform === name} tabIndex={platform === name ? 0 : -1} ref={(node) => { tabs.current[name] = node }}
        onClick={() => setPlatform(name)} onKeyDown={arrows}>{t[name]}</button>)}
    </div>
    <div id="install-panel" role="tabpanel" tabIndex={0} aria-labelledby={`install-tab-${platform}`} className="install-panel">
      {platform === 'iphone' ? <>
        <ol className="install-steps">{steps.map(({ Icon, text, detail }, index) => <li key={text}>
          <span className="install-steps__number" aria-hidden="true">{index + 1}</span><Icon aria-hidden="true" />
          <div><strong>{text}</strong>{detail && <p>{detail}</p>}</div>
        </li>)}</ol>
        <div className="install-note"><Info aria-hidden="true" /><p>{t.openAsApp}</p></div>
      </> : <>
        <div className="install-handy"><Smartphone aria-hidden="true" /><strong>{t.handy}</strong></div>
        {prompt && <Button className="user-action" onClick={() => void install()}>{t.install}</Button>}
        <div className="install-chrome"><strong>{t.chromeTitle}</strong><div>{t.chromeSteps.map((step) => <p key={step}>{step}</p>)}</div></div>
      </>}
    </div>
    <a href="/account" className="install-skip">{platform === 'iphone' ? t.continue : t.notNow}</a>
  </div></UserPage>
}
