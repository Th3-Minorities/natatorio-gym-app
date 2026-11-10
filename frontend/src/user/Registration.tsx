import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ExternalLink, GraduationCap, ReceiptText, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { Button, TextField } from '../components'
import { useDateFormat } from '../format/dateTime'
import { errorText, I18nProvider, useLocale, useMessages, type Locale } from '../i18n'
import { PasswordField, UserLoading, UserNotice, UserPage } from './ui'
import { PrivacyNoticeCard } from './PrivacyNoticeCard'
import type { Privacy } from './privacyNotice'
import { useConnection } from './useConnection'
import './registration.css'

type Lookup = { state: 'ready'; name: string; masked_email: string } | { state: 'renewal'; masked_email: string }
  | { state: 'athlete'; masked_email: string; resend_in: number }
type StudentResult = { claimed: boolean; phone: string }
// The page the athlete's email link opens: N05-01 checking, N05-02 expired, N05-02b invalid (unknown, garbled or
// removed from the roster), N05-03 used, N05-04 replaced, N05-05 claimed, N05-06 offline and N05-07 error.
type LinkState = 'checking' | 'expired' | 'invalid' | 'used' | 'replaced' | 'claimed' | 'offline' | 'error'
const LINK_STATES: Record<string, LinkState> = {
  athlete_link_invalid: 'invalid', athlete_link_expired: 'expired', athlete_link_used: 'used',
  athlete_link_replaced: 'replaced', roster_record_claimed: 'claimed',
}
type Unavailable = { phone: string }
type Waiver = { version: string; text: string }
type PhotoError = 'failed' | 'format' | 'size'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function Registration(props: { path: string; navigate: (path: string, options?: { replace?: boolean }) => void }) {
  const parentLocale = useLocale()
  const parentTitle = useMessages().dashboard.brandName
  const [locale, setLocale] = useState<Locale>(parentLocale)
  useEffect(() => () => {
    document.documentElement.lang = parentLocale
    document.title = parentTitle
  }, [parentLocale, parentTitle])
  return <I18nProvider locale={locale}><RegistrationFlow {...props} setLocale={setLocale} accountLocale={parentLocale} /></I18nProvider>
}

function RegistrationFlow({ path, navigate, setLocale, accountLocale }: {
  path: string; navigate: (path: string, options?: { replace?: boolean }) => void; setLocale: (locale: Locale) => void; accountLocale: Locale
}) {
  const texts = useMessages()
  const t = texts.registration
  const u = texts.user
  const dates = useDateFormat()
  const locale = useLocale()
  const online = useConnection()
  const [privacy, setPrivacy] = useState<Privacy | null>(null)
  const [failed, setFailed] = useState(false)
  const [networkFailed, setNetworkFailed] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [number, setNumber] = useState('')
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null)
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [lookupMessage, setLookupMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordErrors, setPasswordErrors] = useState(false)
  const [waitUntil, setWaitUntil] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [camera, setCamera] = useState<'ready' | 'denied' | 'missing'>('ready')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [photoError, setPhotoError] = useState<PhotoError | null>(null)
  const [pickTooBig, setPickTooBig] = useState(false)
  const [waiver, setWaiver] = useState<Waiver | null>(null)
  const [waiverFailed, setWaiverFailed] = useState(false)
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [acceptError, setAcceptError] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactErrors, setContactErrors] = useState<{ name?: boolean; phone?: boolean }>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  // The link token stays in page memory; the account is created only at the final step (REQ-F-15).
  const [linkToken, setLinkToken] = useState(() => path === '/register/athlete' ? new URLSearchParams(window.location.search).get('token') : null)
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [linkPhone, setLinkPhone] = useState('')
  const [linkSent, setLinkSent] = useState<{ email: string; resendAt: number } | null>(null)
  const [linkLimit, setLinkLimit] = useState(false)
  const [now, setNow] = useState(Date.now)
  const cameraInput = useRef<HTMLInputElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const contactForm = useRef<HTMLFormElement>(null)
  const focusInvalid = useRef(false)
  const lookupGeneration = useRef(0)
  const offline = !online || networkFailed
  const privacyPage = !accepted || path === '/register' || path === '/privacy'
  const passwordPage = path === '/register/password' && lookup?.state === 'ready'
  // Later steps keep everything in page memory only; the account is created at the last one (REG-8).
  const ready = lookup?.state === 'ready' && password.length >= 10 && confirmation === password
  const photoPage = path === '/register/photo' && ready
  const contactPage = path === '/register/contact' && ready && photo !== null
  const waiverPage = path === '/register/waiver' && ready && photo !== null && waiver !== null
  const [previousPrivacyPage, setPreviousPrivacyPage] = useState(privacyPage)
  if (privacyPage !== previousPrivacyPage) {
    setPreviousPrivacyPage(privacyPage)
    setLookupMessage('')
    setStudentResult(null)
    setUnavailable(null)
    if (lookup?.state === 'renewal') setLookup(null)
  }

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
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (path !== '/register/athlete') void loadPrivacy() }, [])
  // Check the link on first load; terminal failures set their own state before navigating back here.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (path === '/register/athlete' && linkState === 'checking') void checkLink() }, [path])
  useEffect(() => {
    if (!linkSent || now >= linkSent.resendAt) return
    const timer = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(timer)
  }, [linkSent, now])
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
  useEffect(() => {
    if (!privacyPage) return () => { lookupGeneration.current += 1 }
  }, [privacyPage])
  useEffect(() => {
    // E-175: without a camera, or with its permission denied, the step offers only "Subir foto".
    let live = true
    void (async () => {
      const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) ?? []
      if (!devices.some((device) => device.kind === 'videoinput')) { if (live) setCamera('missing'); return }
      const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName }).catch(() => null)
      if (live && permission?.state === 'denied') setCamera('denied')
    })()
    return () => { live = false }
  }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    if (!contactPage || waiver || waiverFailed || offline) return
    let live = true
    apiRequest<Waiver>(`/user/registration/waiver?locale=${locale}`).then((loaded) => { if (live) setWaiver(loaded) })
      .catch((error: unknown) => {
        if (!live) return
        if (error instanceof ApiError && error.code === 'registration_privacy_required') { setAccepted(false); navigate('/register') }
        else setWaiverFailed(true)
      })
    return () => { live = false }
  }, [contactPage, waiver, waiverFailed, offline, locale, navigate])
  useEffect(() => {
    if (saving || saveFailed || waiverFailed) document.querySelector<HTMLHeadingElement>('main h1')?.focus()
  }, [saving, saveFailed, waiverFailed])
  // N03-02 and N03-03 replace the whole step: put the focus on the new title, and again when it is dismissed.
  const lookupState = studentResult ?? unavailable ?? linkSent ?? (linkLimit || null)
  const shownLookupState = useRef(lookupState)
  useEffect(() => {
    if (shownLookupState.current === lookupState) return
    shownLookupState.current = lookupState
    const frame = requestAnimationFrame(() => document.querySelector<HTMLHeadingElement>('main h1')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [lookupState])
  useEffect(() => {
    if (saving || !focusInvalid.current) return
    focusInvalid.current = false
    contactForm.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
  }, [saving, contactErrors])

  // Runs from event handlers only, never during render.
  function startWaiting(seconds: number) {
    setWaitUntil(Date.now() + seconds * 1000)
    setWaiting(true)
  }

  async function continuePrivacy() {
    if (!privacy || offline || pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await apiRequest('/user/registration/privacy', { method: 'POST', body: { version: privacy.version } })
      setAccepted(true)
      const toPassword = Boolean(linkToken) && lookup?.state === 'ready'
      // The link check already replaced the link page with this path; pushing it again would need two Backs.
      navigate(toPassword ? '/register/password' : '/register/identify', { replace: toPassword && path === '/register/password' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
      else setFailed(true)
    } finally { pending.current = false; setBusy(false) }
  }

  async function findMembership(event?: FormEvent) {
    event?.preventDefault()
    if (offline || waiting || pending.current || !number.trim()) return
    setLookupMessage('')
    const generation = lookupGeneration.current
    pending.current = true
    setBusy(true)
    try {
      const result = await apiRequest<Lookup>('/user/registration/lookup', { method: 'POST', body: { authorization_number: number, locale: accountLocale } })
      if (generation !== lookupGeneration.current) return
      setUnavailable(null)
      setLinkLimit(false)
      // N03-09: the link went to the roster email; the account is created on the page the link opens.
      if (result.state === 'athlete') { setNow(Date.now()); setLinkSent({ email: result.masked_email, resendAt: Date.now() + result.resend_in * 1000 }); return }
      setLookup(result)
      // A number typed here replaces an earlier athlete link on this page.
      setLinkToken(null)
      if (result.state === 'ready') { setPassword(''); setConfirmation(''); setPasswordErrors(false); navigate('/register/password') }
    } catch (error) {
      if (generation !== lookupGeneration.current) return
      const failure = error instanceof ApiError ? error : new ApiError('server_error', 500)
      setUnavailable(null)
      if (failure.code === 'offline') {
        setNetworkFailed(true)
      } else if (failure.status === 429) {
        if (failure.code === 'athlete_link_limit') { setLinkSent(null); setLinkLimit(true) }
        if (failure.retryAfter) startWaiting(failure.retryAfter)
        else setLookupMessage(u.waitTitle)
      } else {
        const code = failure.status >= 500 ? 'server_error' : failure.code
        const phone = failure.details?.contact_number?.[0]
        if (failure.status === 422 && phone && (failure.code === 'student_not_on_roster' || failure.code === 'roster_record_claimed')) {
          const claimed = failure.code === 'roster_record_claimed'
          setStudentResult({ claimed, phone })
          setLookupMessage(claimed ? t.student.claimed : t.student.notOnRoster(phone))
          return
        }
        if (failure.status === 422 && failure.code === 'registration_number_unavailable' && phone) {
          setUnavailable({ phone })
          setLookupMessage(t.numberUnavailable(phone))
          return
        }
        setLookupMessage(errorText(texts, code, failure.status))
      }
    } finally { pending.current = false; setBusy(false) }
  }

  function clearStudentResult() {
    setStudentResult(null)
    setLinkSent(null)
    setLinkLimit(false)
    setLookupMessage('')
  }

  async function checkLink() {
    if (!linkToken) { setLinkState('invalid'); void loadPrivacy(); return }
    setLinkState('checking')
    try {
      const { name } = await apiRequest<{ name: string }>('/user/registration/athlete/validate', { method: 'POST', body: { token: linkToken } })
      // The POST establishes the CSRF session before the notice records that it was shown.
      await loadPrivacy()
      setLookup({ state: 'ready', name, masked_email: '' })
      setPassword('')
      setConfirmation('')
      setPasswordErrors(false)
      navigate('/register/password', { replace: true })
    } catch (error) {
      await loadPrivacy()
      const failure = error instanceof ApiError ? error : new ApiError('server_error', 500)
      if (failure.code === 'validation_failed') { setLinkState('invalid'); return }
      if (!showLinkFailure(failure)) {
        if (failure.code === 'offline') setNetworkFailed(true)
        setLinkState(failure.code === 'offline' ? 'offline' : 'error')
      }
    }
  }

  /** A link that stopped working while the form was open goes back to the N05 screen for its state. */
  function showLinkFailure(failure: ApiError) {
    const state = LINK_STATES[failure.code]
    if (!linkToken || !state) return false
    setLinkState(state)
    setLinkPhone(failure.details?.contact_number?.[0] ?? '')
    if (path !== '/register/athlete') navigate('/register/athlete')
    return true
  }

  // The receipt example is the box on the identification step; there is no separate screen for it.
  function showReceiptExample() {
    setTimeout(() => document.querySelector('.registration-receipt')?.scrollIntoView?.({ block: 'center' }))
  }

  function keepPassword(event: FormEvent) {
    event.preventDefault()
    setPasswordErrors(true)
    if (password.length >= 10 && confirmation === password) navigate('/register/photo')
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setPhoto(null)
      setPreview('')
      setPickTooBig(true)
      return
    }
    setPickTooBig(false)
    if (!waiver) setPhotoError(null)
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  async function createAccount() {
    if (offline || waiting || pending.current || !photo || !waiver) return
    if (!waiverAccepted || !contactName.trim() || !contactPhone.trim()) { navigate('/register/contact'); return }
    pending.current = true
    setSaving(true)
    setSaveFailed(false)
    setLookupMessage('')
    setPhotoError(null)
    const form = new FormData()
    if (linkToken) form.append('token', linkToken)
    else form.append('authorization_number', number)
    form.append('password', password)
    form.append('password_confirmation', confirmation)
    form.append('photo', photo)
    form.append('waiver_accepted', '1')
    form.append('waiver_version', waiver.version)
    form.append('emergency_contact_name', contactName)
    form.append('emergency_contact_phone', contactPhone)
    form.append('locale', accountLocale)
    try {
      const result = await apiRequest<{ state?: string; masked_email?: string }>(linkToken ? '/user/registration/athlete/complete' : '/user/registration/complete', { method: 'POST', body: form })
      if (result?.state === 'renewal' && result.masked_email) {
        setLookup({ state: 'renewal', masked_email: result.masked_email })
        navigate('/register/identify')
      } else navigate('/install?registered')
    } catch (error) {
      const failure = error instanceof ApiError ? error : new ApiError('server_error', 500)
      const fields = failure.details ?? {}
      const photoRules = fields.photo ?? []
      if (showLinkFailure(failure)) return
      if (failure.status === 413 || photoRules.includes('max') || photoRules.includes('uploaded')) showPhotoError('size')
      else if (failure.code === 'offline') setSaveFailed(true)
      else if (failure.code === 'registration_privacy_required') { setAccepted(false); navigate('/register') }
      else if (failure.status === 429) {
        if (failure.retryAfter) startWaiting(failure.retryAfter)
        else setLookupMessage(u.waitTitle)
        showContact()
      } else if (failure.status === 403 && failure.code === 'forbidden') {
        // A retry after a lost response: the account may already exist and be signed in.
        const created = await apiRequest('/user/me').then(() => true, () => false)
        if (created) navigate('/install?registered')
        else setSaveFailed(true)
      } else if (photoRules.includes('mimetypes')) showPhotoError('format')
      else if (photoRules.length || failure.code === 'registration_photo_invalid' || failure.code === 'registration_photo_failed') showPhotoError('failed')
      else if (fields.password) {
        if (fields.password.includes('password')) { setPasswordError(t.compromised); navigate('/register/password') }
        else setSaveFailed(true)
      } else if (fields.emergency_contact_name || fields.emergency_contact_phone) {
        focusInvalid.current = true
        setContactErrors({ name: !!fields.emergency_contact_name, phone: !!fields.emergency_contact_phone })
        showContact()
      } else if (fields.waiver_accepted) {
        focusInvalid.current = true
        setAcceptError(true)
        showContact()
      } else if (fields.waiver_version) {
        setWaiver(null)
        showContact()
      } else if (failure.code === 'registration_number_unavailable') {
        const phone = failure.details?.contact_number?.[0]
        setLookupMessage(phone ? t.numberUnavailable(phone) : errorText(texts, failure.code, failure.status))
        if (phone) setUnavailable({ phone })
        navigate('/register/identify')
      } else setSaveFailed(true)
    } finally { pending.current = false; setSaving(false) }
  }

  function submitContact() {
    const missing = { accept: !waiverAccepted, name: !contactName.trim(), phone: !contactPhone.trim() }
    if (missing.accept || missing.name || missing.phone) {
      focusInvalid.current = true
      setAcceptError(missing.accept)
      setContactErrors({ name: missing.name, phone: missing.phone })
      return
    }
    void createAccount()
  }

  function showContact() {
    if (path !== '/register/contact') navigate('/register/contact')
  }

  function showPhotoError(kind: PhotoError) {
    setPhotoError(kind)
    navigate('/register/photo')
  }

  const languages = <div className="registration-languages">
    <a href="/privacy?lang=es" lang="es" onClick={(event) => { event.preventDefault(); setLocale('es'); setWaiver(null) }}>{u.spanish}</a>
    {' / '}<a href="/privacy?lang=en" lang="en" onClick={(event) => { event.preventDefault(); setLocale('en'); setWaiver(null) }}>{u.english}</a>
  </div>
  const existing = <div className="registration-existing"><span>{t.existing}</span><a href="/sign-in">{t.signIn}</a></div>
  const storeLine = privacy?.store_url
    ? <div className="registration-existing registration-existing--store"><span>{t.noMembership}</span>
      <a href={privacy.store_url} target="_blank" rel="noopener noreferrer">{t.buy}<ExternalLink aria-hidden="true" /></a></div>
    : null
  const lookupStatus = <div className="registration-status" role="status">
    {waiting ? u.waitText(dates.time(new Date(waitUntil)))
      : lookupMessage || (offline && !passwordPage && !studentResult && !unavailable ? t.numberOfflineIntro : '')}
  </div>

  const a = t.athlete
  const phone = linkPhone || privacy?.contact_number || ''
  const help = (className: string) => phone ? <a href={`tel:${phone}`} className={`button ${className} user-action`}>{t.unavailable.help(phone)}</a> : null
  const linkStatus = (back: string, title: string, intro: string, children: ReactNode, offlineText?: string) =>
    <div className="registration registration--step registration--status">
      <UserPage large back={back} offline={offline} offlineText={offlineText}>
        <div className="registration-intro"><h1 tabIndex={-1}>{title}</h1><p>{intro}</p></div>{children}
      </UserPage>
    </div>
  if (path === '/register/athlete') {
    const newLink = <a href="/register" className="button button--primary user-action">{a.newLink}</a>
    const signIn = (variant: string) => <a href="/sign-in" className={`button button--${variant} user-action`}>{t.student.signIn}</a>
    if (linkState === 'expired') return linkStatus('/register', a.expiredTitle, a.expiredIntro, <>
      <UserNotice title={a.expiredNotice} danger>{a.expiredDetail}</UserNotice>{newLink}{help('button--link')}</>)
    if (linkState === 'invalid') return linkStatus('/register', a.invalidTitle, a.expiredIntro, <>{newLink}{help('button--link')}</>)
    if (linkState === 'used') return linkStatus('/register', a.usedTitle, a.usedIntro, <>
      {signIn('primary')}<a href="/register" className="button button--secondary user-action">{t.backToRegistration}</a></>)
    if (linkState === 'replaced') return linkStatus('/register', a.replacedTitle, a.replacedIntro, <>
      <UserNotice title={a.replacedNotice}>{a.replacedDetail}</UserNotice>{newLink}</>)
    if (linkState === 'claimed') return linkStatus('/register', a.claimedTitle, a.claimedIntro, <>
      {phone && <UserNotice title={a.claimedNotice} danger>{a.claimedDetail(phone)}</UserNotice>}{help('button--primary')}{signIn('secondary')}</>)
    if (linkState === 'offline') return linkStatus('/register', a.offlineTitle, a.offlineIntro, <>
      <UserNotice title={a.offlineNotice}>{a.offlineDetail}</UserNotice>
      <Button className="user-action" disabled={offline} onClick={() => void checkLink()}>{u.retry}</Button></>, u.offlineBanner)
    if (linkState === 'error') return linkStatus('/register', a.errorTitle, a.errorIntro, <>
      <UserNotice title={a.errorNotice} danger>{a.errorDetail}</UserNotice>
      <Button className="user-action" onClick={() => void checkLink()}>{u.retry}</Button></>)
    return linkStatus('/register', a.verifyingTitle, a.verifyingIntro, <>
      <UserNotice title={a.verifyingNotice}>{a.verifyingDetail}</UserNotice>
      <Button className="user-action" disabled>{a.verifying}</Button></>)
  }

  if (privacyPage) {
    const compact = offline || failed || !privacy || locale !== accountLocale || path === '/privacy'
    return <div className={`registration ${compact ? 'registration--compact' : 'registration--privacy'}`}>
      <UserPage large={!compact} offline={offline} back="/welcome">
        {compact ? <>
          <h1 tabIndex={-1}>{t.privacy}</h1>
          {offline || (!failed && privacy) ? <>
            {languages}<UserNotice title={t.draftTitle} informational>{t.placeholder}</UserNotice>
            <p>{t.noticeBody}</p><div className="registration-sections">{t.noticeSections.map((section) => <p key={section}>{section}</p>)}</div>
            {offline && <p className="user-caption">{t.offlineAvailable}</p>}
            <Button className="user-action" variant="secondary" onClick={() => {
              if (locale !== accountLocale || path === '/privacy') { setLocale(accountLocale); setWaiver(null); navigate('/register') }
              else navigate('/welcome')
            }}>{u.back}</Button>
          </> : failed ? <>
            <UserNotice title={t.errorTitle} danger>{t.errorDetail}</UserNotice>
            <Button className="user-action" onClick={() => { setFailed(false); setPrivacy(null); void loadPrivacy() }}>{u.retry}</Button>
            <a href="/welcome" className="button button--secondary user-action">{u.back}</a>
          </> : <UserLoading detail={t.loading} />}
        </> : <>
          <div className="registration-intro"><ShieldCheck className="registration-shield" aria-hidden="true" />
            <h1 tabIndex={-1}>{t.before}</h1><p>{t.privacyIntro}</p></div>
          <PrivacyNoticeCard draft={privacy.draft} linked />
          <div className="registration-bottom registration-privacy-actions">
            <Button className="user-action" disabled={busy} onClick={() => void continuePrivacy()}>{t.continueRegistration}</Button>
          </div>
        </>}
      </UserPage>
    </div>
  }

  // Figma B.02, B.03, B.08 and B.09: saving (4445:7162), final save failed (REG-13), photo (4445:6805,
  // REG-06 to REG-10, 4445:7223), waiver and contact (4445:6948, REG-11, REG-12, 4445:7287),
  // full waiver (REG-14) and waiver not available (REG-15).
  const step = (className: string, back: string, children: ReactNode, offlineText?: string) =>
    <div className={`registration registration--step ${className}`}>
      <UserPage large back={back} offline={offline} offlineText={offlineText}>{children}</UserPage>
    </div>
  if ((photoPage || contactPage) && saving) return step('registration--status', '/register/contact', <>
    <div className="registration-intro"><h1 tabIndex={-1}>{t.saving}</h1><p>{t.savingIntro}</p></div>
    <div className="registration-form"><p>{t.savingDetail}</p><p className="registration-caption">{t.savingWarning}</p>
      <Button className="user-action" disabled>{t.savingButton}</Button></div>
  </>)
  if ((photoPage || contactPage) && saveFailed) return step('registration--status', '/register/contact', <>
    <div className="registration-intro"><h1 tabIndex={-1}>{t.saveFailed}</h1><p>{t.saveFailedIntro}</p></div>
    <UserNotice title={t.notCompleted} danger>{t.notCompletedText}</UserNotice><p>{t.keepOpen}</p>
    <Button className="user-action" onClick={() => { setSaveFailed(false); navigate('/register/photo') }}>{t.backToPhoto}</Button>
  </>)
  if (photoPage) {
    const shownError = pickTooBig ? 'size' : photoError
    const [errorTitle, errorDetail] = shownError ? t.photoErrors[shownError] : ['', '']
    return step('registration--photo', '/register/password', <>
      <div className="registration-intro"><h1 tabIndex={-1}>{photoError ? t.photoCheck : t.photoTitle}</h1>
        <p>{photoError ? t.photoSaveFailed : offline && photo ? t.photoKept
          : camera === 'denied' ? t.cameraDenied : camera === 'missing' ? t.cameraMissing : t.photoIntro}</p></div>
      <div className="registration-form">
        {shownError && <div className="registration-alert" role="alert">
          <p className="registration-alert__title"><TriangleAlert aria-hidden="true" />{errorTitle}</p><p>{errorDetail}</p></div>}
        <div className="registration-photo">
          <span className="user-avatar">{preview ? <img src={preview} alt={t.photoPreview} /> : <UserRound size={36} absoluteStrokeWidth aria-hidden="true" />}</span>
          <p className="registration-caption">{photo ? t.photoPreview : t.noPhoto}</p>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="user" hidden onChange={choosePhoto} data-testid="camera-input" />
        <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/heic,image/heif" hidden onChange={choosePhoto} data-testid="upload-input" />
        {camera === 'ready' && <Button className="user-action" onClick={() => cameraInput.current?.click()}>{t.takePhoto}</Button>}
        <Button className="user-action" variant="secondary" onClick={() => uploadInput.current?.click()}>{t.uploadPhoto}</Button>
        <p className="registration-caption">{t.photoFormats}</p>
        <p className="registration-caption">{t.photoFinal}</p>
        {photoError && waiver
          ? <Button className="user-action" disabled={offline || waiting || !photo} onClick={() => void createAccount()}>{u.retry}</Button>
          : <Button className="user-action" disabled={!photo || offline} onClick={() => navigate('/register/contact')}>{t.continue}</Button>}
      </div>
    </>)
  }
  if (contactPage && waiverFailed) return step('registration--status', '/register/photo', <>
    <div className="registration-intro"><h1 tabIndex={-1}>{t.waiverFailed}</h1><p>{t.waiverFailedIntro}</p></div>
    <UserNotice title={t.dataKept}>{t.waiverRequired}</UserNotice>
    <Button className="user-action" disabled={offline} onClick={() => setWaiverFailed(false)}>{u.retry}</Button>
  </>)
  if (waiverPage) return step('registration--status', '/register/contact', <>
    <h1 tabIndex={-1}>{t.waiverFull}</h1><p>{t.waiverDraft(waiver.version)}</p>
    <p className="registration-caption">{t.waiverProvisional}</p>
    {/* Scrolls inside the page; tabIndex lets the keyboard scroll it too (WCAG 2.1.1). */}
    {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="registration-document" tabIndex={0}>
      {waiver.text.split('\n\n').slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
    <p className="registration-caption">{t.waiverScroll}</p>
    <Button className="user-action" onClick={() => navigate('/register/contact')}>{t.backToRegistration}</Button>
  </>)
  if (contactPage) return step('registration--contact', '/register/photo', <>
    <div className="registration-intro"><h1 tabIndex={-1}>{t.contactTitle}</h1><p>{t.contactIntro}</p></div>
    <form ref={contactForm} className="registration-form" noValidate onSubmit={(event) => { event.preventDefault(); submitContact() }}>
      <p className="registration-label">{t.waiver}</p>
      {waiver && <div className="registration-version"><p>{t.waiverDraft(waiver.version)}</p><p>{t.waiverPending}</p></div>}
      <Button className="user-action" variant="secondary" disabled={!waiver} onClick={() => navigate('/register/waiver')}>{t.readWaiver}</Button>
      <label className="registration-check"><input type="checkbox" checked={waiverAccepted}
        aria-invalid={acceptError || undefined} aria-describedby={acceptError ? 'registration-accept-error' : undefined}
        onChange={(event) => { setWaiverAccepted(event.target.checked); setAcceptError(false) }} />{t.acceptWaiver}</label>
      {acceptError && <p id="registration-accept-error" className="registration-field-error">{t.acceptRequired}</p>}
      <p className="registration-label">{u.emergency}</p>
      <TextField label={t.contactName} placeholder={t.contactNamePlaceholder} value={contactName} maxLength={255} autoComplete="off" required
        error={contactErrors.name ? t.contactNameError : undefined}
        onChange={(event) => { setContactName(event.target.value); setContactErrors({ ...contactErrors, name: false }) }} />
      <TextField label={t.phone} placeholder={t.phonePlaceholder} value={contactPhone} maxLength={30} type="tel" autoComplete="off" required
        error={contactErrors.phone ? t.phoneError : undefined}
        onChange={(event) => { setContactPhone(event.target.value); setContactErrors({ ...contactErrors, phone: false }) }} />
      <p className="registration-caption">{t.contactLater}</p>
      {(waiting || lookupMessage) && <p className="registration-field-error" role="alert">
        {waiting ? u.waitText(dates.time(new Date(waitUntil))) : lookupMessage}</p>}
      <Button className="user-action" type="submit"
        disabled={!waiver || offline || waiting}>{t.createAccount}</Button>
    </form>
  </>, u.offlineBanner)

  // Figma N03-04 (4591:3403): the number belongs to an existing account, for athletes and paid members alike.
  if (lookup?.state === 'renewal') return linkStatus('/register', t.renewalTitle, t.renewalIntro, <>
    <UserNotice title={t.renewalEmail}>{lookup.masked_email}</UserNotice><p className="registration-body">{t.renewalNotUsed}</p>
    <a href="/sign-in" className="button button--primary user-action">{t.student.signIn}</a>
    <Button className="user-action" variant="secondary" onClick={() => setLookup(null)}>{t.backToRegistration}</Button></>)
  if (!passwordPage && linkLimit) return linkStatus('/register', a.limitTitle, a.limitIntro, <>
    <UserNotice title={a.limitRetry(dates.time(new Date(waitUntil)))}>{a.limitDetail}</UserNotice>
    <Button className="user-action" disabled={busy || offline || waiting} onClick={() => void findMembership()}>{a.request}</Button>
    {help('button--link')}</>)
  if (!passwordPage && linkSent) {
    const left = Math.max(0, Math.ceil((linkSent.resendAt - now) / 1000))
    return linkStatus('/register', a.sentTitle, a.sentIntro, <>
      <UserNotice title={linkSent.email}>{a.sentDetail}</UserNotice><p className="registration-body">{a.spam}</p>
      <Button className="user-action" variant="secondary" disabled={busy || offline || left > 0} onClick={() => void findMembership()}>
        {left > 0 ? a.resendIn(`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`) : a.request}</Button>
      <Button className="user-action" variant="link" onClick={clearStudentResult}>{t.student.fixNumber}</Button></>)
  }

  return <div className={`registration ${passwordPage ? 'registration--password' : 'registration--identification'}`}>
    {lookupStatus}
    <UserPage large back={passwordPage ? '/register/identify' : '/register'} offline={!passwordPage && offline} offlineText={u.offlineBanner}>
      {passwordPage ? <>
        <div className="registration-intro"><p className="registration-greeting">{t.hello(lookup.name)}</p>
          <h1 tabIndex={-1}>{t.createPassword}</h1><p>{t.passwordIntro}</p></div>
        <form onSubmit={keepPassword}>
          <PasswordField label={u.password} placeholder={t.passwordPlaceholder} value={password}
            onChange={(value) => { setPassword(value); setPasswordError('') }} hint={u.passwordHint}
            error={passwordErrors && password.length < 10 ? u.passwordHint : passwordError || undefined} />
          <PasswordField label={u.confirmPassword} placeholder={t.confirmPlaceholder} value={confirmation} onChange={setConfirmation}
            error={passwordErrors && confirmation !== password ? u.confirmationInvalid : undefined} />
          <Button className="user-action" type="submit">{t.continue}</Button>
        </form>
      </> : studentResult ? <>
        <div className="registration-intro"><h1 tabIndex={-1}>{studentResult.claimed ? t.student.claimedTitle : t.student.title}</h1>
          <p>{studentResult.claimed ? t.student.claimedIntro : t.student.intro}</p></div>
        <div className="registration-number"><TextField label={t.student.label} value={number} readOnly error={lookupMessage || undefined} /></div>
        <p className="registration-body">{studentResult.claimed ? t.student.claimedBody(studentResult.phone) : t.student.notOnRosterBody}</p>
        {studentResult.claimed
          ? <a href="/sign-in" className="button button--primary user-action">{t.student.signIn}</a>
          : <Button className="user-action" variant="secondary" onClick={() => { clearStudentResult(); showReceiptExample() }}>{t.student.receiptExample}</Button>}
        {studentResult.claimed
          ? <Button className="user-action" variant="secondary" onClick={clearStudentResult}>{t.student.changeNumber}</Button>
          : <Button className="user-action" onClick={clearStudentResult}>{t.student.fixNumber}</Button>}
      </> : unavailable ? <>
        <div className="registration-intro"><h1 tabIndex={-1}>{t.student.title}</h1><p>{t.unavailable.intro}</p></div>
        <form className="registration-identification-form" onSubmit={(event) => void findMembership(event)}>
          <div className="registration-number">
            <TextField label={t.unavailable.label} value={number} readOnly={busy}
              error={(waiting ? u.waitText(dates.time(new Date(waitUntil))) : lookupMessage) || undefined}
              onChange={(event) => { setNumber(event.target.value); setLookup(null); setLookupMessage('') }} autoComplete="off" required />
          </div>
          <Button type="submit" className="user-action" disabled={busy || offline || waiting}>{t.continue}</Button>
          <a href={`tel:${unavailable.phone}`} className="button button--link user-action">{t.unavailable.help(unavailable.phone)}</a>
        </form>
      </> : <>
        <div className="registration-intro"><h1 tabIndex={-1}>{t.title}</h1>
          {offline ? <><p>{t.numberOfflineIntro}</p><p>{t.numberOfflineKept}</p></> : <p>{t.identificationIntro}</p>}</div>
        <form className="registration-identification-form" onSubmit={(event) => void findMembership(event)}>
          <div className="registration-number">
            <TextField label={t.number} placeholder={t.numberPlaceholder} value={number} readOnly={busy}
              error={(waiting ? u.waitText(dates.time(new Date(waitUntil))) : lookupMessage) || undefined} onChange={(event) => {
              setNumber(event.target.value); setLookup(null); setLookupMessage('')
            }} aria-describedby="registration-number-hint" autoComplete="off" required />
            <div className="registration-hints" id="registration-number-hint">
              <div className="registration-hint"><GraduationCap aria-hidden="true" /><p>{t.studentHint}</p></div>
              <div className="registration-hint"><ReceiptText aria-hidden="true" /><p>{t.numberHint}</p></div>
            </div>
            <div className="registration-receipt"><p>{t.paymentDescription}</p><div><span>{t.receiptNumber}</span><strong>{t.exampleNumber}</strong></div></div>
            {privacy && <p className="registration-help">{t.paymentHelp(privacy.contact_number)}</p>}
            {privacy?.store_url && <a href={privacy.store_url} target="_blank" rel="noopener noreferrer" className="button button--secondary user-action registration-buy">{t.buy}</a>}
          </div>
          <div className="registration-bottom"><Button type="submit" className="user-action" disabled={busy || offline || waiting}>{t.continue}</Button>{existing}{storeLine}</div>
        </form>
      </>}
    </UserPage>
  </div>
}
