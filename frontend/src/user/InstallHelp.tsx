import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Compass, Info, Share, Smartphone, SquarePlus } from 'lucide-react'
import { Button } from '../components'
import { useMessages } from '../i18n'
import { AccountHeading, UserPage } from './ui'
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
  const messages = useMessages()
  const t = messages.install
  const { prompt, installed: accepted } = useSyncExternalStore(subscribe, installState)
  const [standalone] = useState(isInstalled)
  const installed = standalone || accepted
  const [platform, setPlatform] = useState<Platform>(() => /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iphone' : 'android')
  const tabs = useRef<Record<Platform, HTMLButtonElement | null>>({ iphone: null, android: null })
  // Right after registration (E-165) every exit leads to Check In; from Mi cuenta it returns there.
  const [done] = useState(() => new URLSearchParams(window.location.search).has('registered') ? '/check-in' : '/account')

  // Figma C.03 (4453:2494): from Mi cuenta the screen is the account layout with no link at the bottom.
  const fromAccount = done === '/account'
  const shell = (children: ReactNode) => fromAccount ? <UserPage header={false} className="user-app--install">{children}</UserPage>
    : <UserPage large back={done}>{children}</UserPage>
  const heading = <AccountHeading title={messages.user.installApp} back="/account" backLabel={messages.user.returnToAccount} />
  const Title = fromAccount ? 'h2' : 'h1'

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

  if (installed) return shell(<>
    {fromAccount && heading}
    <div className="install-done">
      <span className="install-done__check"><Check aria-hidden="true" /></span>
      <Title tabIndex={-1}>{t.installedTitle}</Title><p>{t.installedText}</p><p>{t.installedHelp}</p>
      <a href={done} className="button button--primary user-action">{t.continue}</a>
    </div>
  </>)

  const steps = [
    { Icon: Compass, text: t.safari }, { Icon: Share, text: t.share, detail: t.shareDetail },
    { Icon: SquarePlus, text: t.addHome }, { Icon: Check, text: t.confirmAdd },
  ]
  return shell(<div className="install">
    <div className="install-intro">{fromAccount ? heading : <h1 tabIndex={-1}>{t.title}</h1>}<p>{t.description}</p></div>
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
    {!fromAccount && <a href={done} className="install-skip">{platform === 'iphone' ? t.continue : t.notNow}</a>}
  </div>)
}
