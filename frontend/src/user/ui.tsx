import { useId, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Dumbbell, Eye, EyeOff, RefreshCw, TriangleAlert, UserRound, Weight, WifiOff } from 'lucide-react'
import { Button, LoadingState, Notice, TextField } from '../components'
import { useMessages } from '../i18n'

export function UserHeader({ back = '/sign-in' }: { back?: string }) {
  const t = useMessages().user
  return <header className="user-header">
    <a href={back} className="user-back" aria-label={t.back}><ArrowLeft aria-hidden="true" /></a>
    <div className="user-brand"><strong>{t.brand}</strong><span>{t.brandName}</span></div>
  </header>
}

export function UserNotice({ title, children, success = false, informational = false }: { title: string; children: string; success?: boolean; informational?: boolean }) {
  const Icon = success ? Check : TriangleAlert
  return <div className="user-notice">{success || informational ? <div className="notice" role="status">
    <p className="notice__title">{title}</p><p className="notice__text">{children}</p>
  </div> : <Notice title={title}>{children}</Notice>}<Icon aria-hidden="true" /></div>
}

export function UserLoading({ detail }: { detail: string }) {
  return <div className="user-loading">
    <LoadingState detail={detail} />
    <div className="user-skeleton" aria-hidden="true"><RefreshCw /><span /><span /><span /></div>
  </div>
}

export function UserPage({ children, header = true, large = false, offline = false, back }: {
  children: ReactNode; header?: boolean; large?: boolean; offline?: boolean; back?: string
}) {
  const t = useMessages().user
  return <div className={`user-app ${header ? 'user-app--access' : 'user-app--account'} ${large ? 'user-app--large' : ''}`}>
    {header ? <UserHeader back={back} /> : <div className="user-top" />}
    {offline && <div className="user-offline" role="status"><WifiOff aria-hidden="true" /><span>{t.offline}</span></div>}
    <main className="user-content">{children}</main>
    {!header && <UserNavigation />}
  </div>
}

export function UserNavigation() {
  const t = useMessages().user
  // The other two destinations are supplied by the User app and Check In issues.
  return <footer className="user-navigation"><nav aria-label={t.navigation}>
    <span className="user-navigation-item"><Weight aria-hidden="true" /><span>{t.gym}</span></span>
    <span className="user-navigation-item user-check-in"><span className="user-check-in__circle"><Dumbbell aria-hidden="true" /></span><span>{t.checkIn}</span></span>
    <a href="/account" aria-current="page"><UserRound aria-hidden="true" /><span>{t.account}</span><i aria-hidden="true" /></a>
  </nav></footer>
}

export function PasswordField({ label, placeholder, value, onChange, error, autoComplete = 'new-password', hint, describedBy }: {
  label: string; placeholder: string; value: string; onChange: (value: string) => void; error?: string;
  autoComplete?: string; hint?: string; describedBy?: string
}) {
  const t = useMessages().user
  const [visible, setVisible] = useState(false)
  const hintId = useId()
  const Icon = visible ? EyeOff : Eye
  return <div className="user-password">
    <TextField label={label} placeholder={placeholder} type={visible ? 'text' : 'password'} value={value}
      autoComplete={autoComplete} maxLength={255} error={error} aria-describedby={hint && !error ? hintId : describedBy}
      onChange={(event) => onChange(event.target.value)} required />
    <Button variant="link" className="user-password__toggle" aria-label={visible ? t.hidePassword : t.showPassword}
      aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon aria-hidden="true" /></Button>
    {hint && !error && <p id={hintId} className="user-caption">{hint}</p>}
  </div>
}
