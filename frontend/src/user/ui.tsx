import { useId, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Dumbbell, Eye, EyeOff, RefreshCw, TriangleAlert, UserRound, WifiOff } from 'lucide-react'
import { Button, LoadingState, Notice, TextField } from '../components'
import { useMessages } from '../i18n'
import rackBar from './assets/rack-bar.svg'
import rackFrame from './assets/rack-frame.svg'
import rackPlates from './assets/rack-plates.svg'
import rackSupports from './assets/rack-supports.svg'

export function UserHeader({ back = '/sign-in' }: { back?: string }) {
  const t = useMessages().user
  return <header className="user-header">
    <a href={back} className="user-back" aria-label={t.back}><ArrowLeft aria-hidden="true" /></a>
    <div className="user-brand"><strong>{t.brand}</strong><span>{t.brandName}</span></div>
  </header>
}

export function AccountHeading({ title, back, backLabel }: { title: string; back: string; backLabel: string }) {
  return <div className="user-account-heading">
    <a href={back} className="user-back" aria-label={backLabel}><ArrowLeft aria-hidden="true" /></a>
    <h1 tabIndex={-1}>{title}</h1>
  </div>
}

export function UserNotice({ title, children, success = false, informational = false, danger = false }: { title: string; children: string; success?: boolean; informational?: boolean; danger?: boolean }) {
  const Icon = success ? Check : TriangleAlert
  return <div className={`user-notice${danger ? ' user-notice--danger' : ''}`}>{success || informational ? <div className="notice" role="status">
    <p className="notice__title">{title}</p><p className="notice__text">{children}</p>
  </div> : <Notice title={title}>{children}</Notice>}<Icon aria-hidden="true" size={18} absoluteStrokeWidth /></div>
}

export function UserLoading({ detail }: { detail: string }) {
  return <div className="user-loading">
    <LoadingState detail={detail} />
    <div className="user-skeleton" aria-hidden="true"><RefreshCw /><span /><span /><span /></div>
  </div>
}

export function OfflineBanner({ text }: { text?: string }) {
  const t = useMessages().user
  return <div className="user-offline" role="status"><WifiOff aria-hidden="true" size={18} absoluteStrokeWidth /><span>{text ?? t.offline}</span></div>
}

export function UserPage({ children, header = true, large = false, offline = false, offlineText, back, className = '', current = 'account' }: {
  children: ReactNode; header?: boolean; large?: boolean; offline?: boolean; offlineText?: string; back?: string; className?: string; current?: Destination
}) {
  return <div className={`user-app ${header ? 'user-app--access' : 'user-app--account'} ${large ? 'user-app--large' : ''} ${className}`}>
    {header ? <UserHeader back={back} /> : !offline && <div className="user-top" />}
    {offline && <OfflineBanner text={offlineText} />}
    <main className="user-content">{children}</main>
    {!header && <UserNavigation current={current} />}
  </div>
}

type Destination = 'check-in' | 'account' | 'gym'

/** Figma "gym/rack-sentadillas" (4190:575), its four layers placed as in the navigation instance (4097:106). */
function SquatRack() {
  return <span className="user-rack" aria-hidden="true">
    <img className="user-rack__frame" src={rackFrame} alt="" width="19.125" height="19.5" />
    <img className="user-rack__supports" src={rackSupports} alt="" width="14.625" height="3.375" />
    <img className="user-rack__bar" src={rackBar} alt="" width="22.125" height="1.125" />
    <img className="user-rack__plates" src={rackPlates} alt="" width="19.5" height="6.75" />
  </span>
}

export function UserNavigation({ current = 'account' }: { current?: Destination }) {
  const t = useMessages().user
  const here = (destination: Destination) => current === destination ? 'page' as const : undefined
  return <footer className="user-navigation"><nav aria-label={t.navigation}>
    <a href="/gym" className="user-navigation-item" aria-current={here('gym')}><SquatRack /><span>{t.gym}</span>{here('gym') && <i aria-hidden="true" />}</a>
    <a href="/check-in" className="user-check-in" aria-current={here('check-in')}><span className="user-check-in__circle"><Dumbbell aria-hidden="true" /></span>
      <span>{t.checkIn}</span>{here('check-in') && <i aria-hidden="true" />}</a>
    <a href="/account" className="user-navigation-account" aria-current={here('account')}><UserRound aria-hidden="true" /><span>{t.account}</span>
      {here('account') && <i aria-hidden="true" />}</a>
  </nav></footer>
}

export function PasswordField({ label, placeholder, value, onChange, error, autoComplete = 'new-password', hint, describedBy, id }: {
  label: string; placeholder: string; value: string; onChange: (value: string) => void; error?: string;
  autoComplete?: string; hint?: string; describedBy?: string; id?: string
}) {
  const t = useMessages().user
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const Icon = visible ? EyeOff : Eye
  // Figma REG-03: the grey hint sits above the red error; REG-01: an error that repeats the hint shows once.
  const showHint = !!hint && hint !== error
  const described = [hint ? (showHint ? hintId : undefined) : describedBy, error ? errorId : undefined].filter(Boolean).join(' ')
  return <div className="user-password">
    <TextField id={inputId} label={label} placeholder={placeholder} type={visible ? 'text' : 'password'} value={value}
      autoComplete={autoComplete} maxLength={255} aria-invalid={error ? true : undefined} aria-describedby={described || undefined}
      onChange={(event) => onChange(event.target.value)} required />
    <Button variant="link" className="user-password__toggle" aria-label={visible ? t.hidePassword : t.showPassword}
      aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon aria-hidden="true" size={16} absoluteStrokeWidth /></Button>
    {showHint && <p id={hintId} className="user-caption">{hint}</p>}
    {error && <p id={errorId} className="field__error">{error}</p>}
  </div>
}
