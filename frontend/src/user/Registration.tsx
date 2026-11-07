import { useEffect, useRef, useState, type FormEvent } from 'react'
import { GraduationCap, ReceiptText, ShieldCheck } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { Button, TextField } from '../components'
import { useDateFormat } from '../format/dateTime'
import { I18nProvider, useLocale, useMessages, type Locale } from '../i18n'
import { PasswordField, UserLoading, UserNotice, UserPage } from './ui'
import { useConnection } from './useConnection'
import './registration.css'

type Privacy = { version: string; draft: boolean; store_url: string | null }
type Lookup = { state: 'ready'; name: string; masked_email: string } | { state: 'renewal'; masked_email: string }

export function Registration(props: { path: string; navigate: (path: string) => void }) {
  const parentLocale = useLocale()
  const parentTitle = useMessages().dashboard.brandName
  const [locale, setLocale] = useState<Locale>('es')
  useEffect(() => () => {
    document.documentElement.lang = parentLocale
    document.title = parentTitle
  }, [parentLocale, parentTitle])
  return <I18nProvider locale={locale}><RegistrationFlow {...props} setLocale={setLocale} /></I18nProvider>
}

function RegistrationFlow({ path, navigate, setLocale }: {
  path: string; navigate: (path: string) => void; setLocale: (locale: Locale) => void
}) {
  const t = useMessages().registration
  const u = useMessages().user
  const dates = useDateFormat()
  const locale = useLocale()
  const online = useConnection()
  const [privacy, setPrivacy] = useState<Privacy | null>(null)
  const [failed, setFailed] = useState(false)
  const [networkFailed, setNetworkFailed] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [number, setNumber] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordErrors, setPasswordErrors] = useState(false)
  const [waitUntil, setWaitUntil] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const pending = useRef(false)
  const offline = !online || networkFailed
  const privacyPage = !accepted || path === '/register' || path === '/privacy'
  const passwordPage = path === '/register/password' && lookup?.state === 'ready'

  function loadPrivacy() {
    return apiRequest<Privacy>('/user/registration/privacy').then((notice) => {
      setPrivacy(notice)
      setFailed(false)
      setNetworkFailed(false)
    }).catch((error: unknown) => {
      if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
      else setFailed(true)
    })
  }
  useEffect(() => { void loadPrivacy() }, [])
  useEffect(() => {
    const reconnect = () => { setNetworkFailed(false); void loadPrivacy() }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [])
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => setWaiting(false), Math.max(0, waitUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [waiting, waitUntil])

  async function continuePrivacy() {
    if (!privacy || offline || pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await apiRequest('/user/registration/privacy', { method: 'POST', body: { version: privacy.version } })
      setAccepted(true)
      navigate('/register/choose')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
      else setFailed(true)
    } finally { pending.current = false; setBusy(false) }
  }

  async function findMembership(event: FormEvent) {
    event.preventDefault()
    if (offline || waiting || pending.current || !number.trim()) return
    pending.current = true
    setBusy(true)
    setLookupFailed(false)
    try {
      const result = await apiRequest<Lookup>('/user/registration/lookup', { method: 'POST', body: { authorization_number: number } })
      setLookup(result)
      if (result.state === 'ready') { setPassword(''); setConfirmation(''); setPasswordErrors(false); navigate('/register/password') }
      // Renewal and masked-email presentation have no registration frame yet.
    } catch (error) {
      if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
      if (error instanceof ApiError && error.retryAfter) { setWaitUntil(Date.now() + error.retryAfter * 1000); setWaiting(true) }
      setLookupFailed(true)
    } finally { pending.current = false; setBusy(false) }
  }

  function keepPassword(event: FormEvent) {
    event.preventDefault()
    setPasswordErrors(true)
    // Photo, waiver and contact registration steps are not drawn. Keep credentials only in page memory.
    // The complete API requires all of them; this screen must never create an incomplete account.
  }

  const languages = <div className="registration-languages">
    <a href="/privacy?lang=es" lang="es" onClick={(event) => { event.preventDefault(); setLocale('es') }}>{u.spanish}</a>
    {' / '}<a href="/privacy?lang=en" lang="en" onClick={(event) => { event.preventDefault(); setLocale('en') }}>{u.english}</a>
  </div>
  const existing = <div className="registration-existing"><span>{t.existing}</span><a href="/sign-in">{t.signIn}</a></div>
  const lookupStatus = <div className="registration-status" role="status">
    {waiting ? `${t.paymentHelp} ${u.waitText(dates.time(new Date(waitUntil)))}` : lookupFailed ? t.paymentHelp : ''}
  </div>

  if (privacyPage) {
    const compact = offline || failed || !privacy || locale === 'en' || path === '/privacy'
    return <div className={`registration ${compact ? 'registration--compact' : 'registration--privacy'}`}>
      {lookupStatus}
      <UserPage large={!compact} offline={offline} back="/welcome">
        {compact ? <>
          <h1 tabIndex={-1}>{t.privacy}</h1>
          {offline || (!failed && privacy) ? <>
            {languages}<UserNotice title={t.draftTitle} informational>{t.placeholder}</UserNotice>
            <p>{t.noticeBody}</p><div className="registration-sections">{t.noticeSections.map((section) => <p key={section}>{section}</p>)}</div>
            {offline && <p className="user-caption">{t.offlineAvailable}</p>}
            <Button className="user-action" variant="secondary" onClick={() => {
              if (locale === 'en' || path === '/privacy') { setLocale('es'); navigate('/register') }
              else navigate('/welcome')
            }}>{u.back}</Button>
          </> : failed ? <>
            <UserNotice title={t.errorTitle}>{t.errorDetail}</UserNotice>
            <Button className="user-action" onClick={() => { setFailed(false); setPrivacy(null); void loadPrivacy() }}>{u.retry}</Button>
            <a href="/welcome" className="button button--secondary user-action">{u.back}</a>
          </> : <UserLoading detail={t.loading} />}
        </> : <>
          <div className="registration-intro"><ShieldCheck className="registration-shield" aria-hidden="true" />
            <h1 tabIndex={-1}>{t.before}</h1><p>{t.privacyIntro}</p></div>
          <section className="registration-notice" aria-label={t.privacy}>
            <div className="registration-notice-heading"><h2><a href="/privacy">{t.privacy}</a></h2><span>{t.draft}</span></div>
            <p>{t.provisional}</p><p>{t.pendingNotice}</p><p>{t.pendingApproval}</p>
          </section>
          <div className="registration-bottom registration-privacy-actions">
            <Button className="user-action" disabled={busy} onClick={() => void continuePrivacy()}>{t.continueRegistration}</Button>
          </div>
        </>}
      </UserPage>
    </div>
  }

  return <div className={`registration ${passwordPage ? 'registration--password' : 'registration--paid'}`}>
    {lookupStatus}
    <UserPage large back={passwordPage ? '/register/paid' : path === '/register/paid' ? '/register/choose' : '/register'}>
      {passwordPage ? <>
        <div className="registration-intro"><p className="registration-greeting">{t.hello(lookup.name)}</p>
          <h1 tabIndex={-1}>{t.createPassword}</h1><p>{t.passwordIntro}</p></div>
        <form onSubmit={keepPassword}>
          <PasswordField label={u.password} placeholder={t.passwordPlaceholder} value={password} onChange={setPassword} hint={u.passwordHint}
            error={passwordErrors && password.length < 10 ? u.passwordHint : undefined} />
          <PasswordField label={u.confirmPassword} placeholder={t.confirmPlaceholder} value={confirmation} onChange={setConfirmation}
            error={passwordErrors && confirmation !== password ? u.confirmationInvalid : undefined} />
          <Button className="user-action" type="submit">{t.continue}</Button>
        </form>
      </> : path === '/register/paid' ? <>
        <div className="registration-intro"><h1 tabIndex={-1}>{t.paidTitle}</h1><p>{t.paidIntro}</p></div>
        <form className="registration-paid-form" onSubmit={(event) => void findMembership(event)}>
          <div className="registration-number">
            <TextField label={t.number} placeholder={t.numberPlaceholder} value={number} onChange={(event) => {
              setNumber(event.target.value); setLookup(null); setLookupFailed(false)
            }} aria-describedby="registration-number-hint" autoComplete="off" required />
            <div className="registration-hint" id="registration-number-hint"><ReceiptText aria-hidden="true" /><p>{t.numberHint}</p></div>
            <div className="registration-receipt"><p>{t.paymentDescription}</p><div><span>{t.receiptNumber}</span><strong>{t.exampleNumber}</strong></div></div>
            <p className="registration-help">{t.paymentHelp}</p>
            {privacy?.store_url ? <a href={privacy.store_url} target="_blank" rel="noopener noreferrer" className="button button--secondary user-action registration-buy">{t.buy}</a>
              : <span role="link" aria-disabled="true" className="button button--secondary user-action registration-buy">{t.buy}</span>}
          </div>
          <div className="registration-bottom"><Button type="submit" className="user-action" disabled={busy || offline || waiting}>{t.continue}</Button>{existing}</div>
        </form>
      </> : <>
        <div className="registration-intro"><h1 tabIndex={-1}>{t.title}</h1><p>{t.choose}</p></div>
        <div className="registration-options"><div className="registration-option"><GraduationCap aria-hidden="true" /><span>{t.athlete}</span></div>
          <a className="registration-option" href="/register/paid"><ReceiptText aria-hidden="true" /><span>{t.paid}</span></a></div>
        <div className="registration-bottom registration-choose-actions">{existing}</div>
      </>}
    </UserPage>
  </div>
}
