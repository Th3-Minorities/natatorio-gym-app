import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowRight, ArrowUp, ChevronDown, ChevronRight, Download, Heart, History, Settings, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { Button, LoadingState } from '../components'
import { useDateFormat } from '../format/dateTime'
import { I18nProvider, useLocale, useMessages, type Locale } from '../i18n'
import { InstallHelp } from './InstallHelp'
import { CheckIn } from './CheckIn'
import { Gym } from './Gym'
import { UserAccess } from './UserAccess'
import { Registration } from './Registration'
import { AccountHeading, OfflineBanner, UserLoading, UserNotice, UserPage } from './ui'
import { PrivacyNoticeCard } from './PrivacyNoticeCard'
import { storedPrivacy, storePrivacy, type Privacy } from './privacyNotice'
import { useConnection } from './useConnection'
import { storedLocale, storeLocale } from './deviceLocale'
import welcomeIllustration from './assets/welcome-illustration.svg'
import './user.css'

export type UserProfile = {
  name: string | null; email: string; locale: Locale;
  account_type: AccountType | null; authorization: { type: AccountType; term: string } | null;
  updated_at: string
}

type AccountType = 'paid' | 'athlete' | 'manual'

type RouteContext = {
  path: string
  navigate: (path: string) => void
  ended: (error: unknown) => boolean
  profile: UserProfile | null
  replaced: boolean
  deviceLocale: Locale
  chooseLocale: (locale: Locale) => void
  onSignedIn: (account: UserProfile) => void
  account: ReactNode
}
type Route = { protected?: true; render: (context: RouteContext) => ReactNode }

const access = (mode: 'sign-in' | 'recover' | 'reset'): Route => ({
  render: (c) => <UserAccess key={c.path} mode={mode} replaced={c.replaced} navigate={c.navigate} onSignedIn={c.onSignedIn} />,
})
const account: Route = { protected: true, render: (c) => c.account }
const register: Route = { render: (c) => <Registration path={c.path} navigate={c.navigate} /> }

// One line per User path, sorted by path. A new screen adds its own line here and nothing else in the routing.
const USER_ROUTES: Record<string, Route> = {
  '/account': account,
  '/account/delete': account,
  '/account/privacy': account,
  '/account/settings': account,
  '/check-in': { protected: true, render: (c) => <CheckIn profile={c.profile} ended={c.ended} /> },
  '/gym': { protected: true, render: (c) => <Gym ended={c.ended} /> },
  '/install': { render: () => <InstallHelp /> },
  '/privacy': register,
  '/recover-password': access('recover'),
  '/register': register,
  '/register/athlete': register,
  '/register/contact': register,
  '/register/identify': register,
  '/register/password': register,
  '/register/photo': register,
  '/register/waiver': register,
  '/reset-password': access('reset'),
  '/sign-in': access('sign-in'),
  '/welcome': { render: (c) => <Welcome locale={c.deviceLocale} chooseLocale={c.chooseLocale} /> },
}

function RouteScreen({ route, context }: { route: Route; context: RouteContext }) { return route.render(context) }

const isUserPath = (path: string) => Object.hasOwn(USER_ROUTES, path)

export function UserEntry({ children }: { children: ReactNode }) {
  return isUserPath(window.location.pathname) ? <UserApp /> : children
}

export function UserApp() {
  const [path, setPath] = useState(window.location.pathname)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [networkFailed, setNetworkFailed] = useState(false)
  const [replaced, setReplaced] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [refused, setRefused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localeSaved, setLocaleSaved] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const [deviceLocale, setDeviceLocale] = useState(storedLocale)
  const online = useConnection()
  const epoch = useRef(0)
  const offline = !online || networkFailed
  const route = USER_ROUTES[path] ?? USER_ROUTES['/sign-in']
  const protectedPath = route.protected === true

  const navigate = useCallback((next: string) => {
    window.history.pushState({}, '', next)
    setPath(new URL(next, window.location.origin).pathname)
    setConfirmation(false)
    setRefused(false)
    setActionFailed(false)
    requestAnimationFrame(() => document.querySelector<HTMLHeadingElement>('main h1')?.focus())
  }, [])

  useEffect(() => {
    const back = () => { setPath(window.location.pathname); setConfirmation(false) }
    const disconnect = () => setConfirmation(false)
    window.addEventListener('popstate', back)
    window.addEventListener('offline', disconnect)
    return () => {
      window.removeEventListener('popstate', back)
      window.removeEventListener('offline', disconnect)
    }
  }, [])

  const ended = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      epoch.current += 1
      setProfile(null)
      setReplaced(error.code === 'user_session_replaced')
      navigate('/sign-in')
      return true
    }
    return false
  }, [navigate])

  const load = useCallback((background = false) => {
    const started = epoch.current
    return apiRequest<UserProfile>('/user/me', { autoRefresh: background }).then((account) => {
      if (epoch.current !== started) return
      setProfile(account)
      setNetworkFailed(false)
      setFailed(false)
    }).catch((error: unknown) => {
      if (epoch.current !== started || ended(error)) return
      if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
      else if (!background) setFailed(true)
    }).finally(() => { if (epoch.current === started) setLoading(false) })
  }, [ended])

  useEffect(() => { if (protectedPath) void load() }, [protectedPath, load])
  useEffect(() => {
    if (!protectedPath) return
    const check = () => { if (navigator.onLine) void load(true) }
    const timer = setInterval(check, 60_000)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    return () => { clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('online', check) }
  }, [protectedPath, load])

  function intercept(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest('a')
    if (!link || link.target || link.origin !== window.location.origin || !isUserPath(link.pathname)) return
    event.preventDefault()
    navigate(link.pathname + link.search)
  }

  function signedIn(account: UserProfile) {
    epoch.current += 1; setProfile(account); setLoading(false); setFailed(false); setNetworkFailed(false); setReplaced(false); navigate('/account')
  }

  async function signOut() {
    if (busy || offline) return
    setBusy(true)
    setActionFailed(false)
    try {
      await apiRequest('/user/sign-out', { method: 'POST' })
      epoch.current += 1
      setProfile(null)
      setReplaced(false)
      navigate('/sign-in')
    } catch (error) { if (!ended(error)) actionError(error) }
    finally { setBusy(false) }
  }

  async function deleteAccount() {
    if (busy || offline) return
    setBusy(true)
    setActionFailed(false)
    try {
      await apiRequest('/user/account', { method: 'DELETE' })
      epoch.current += 1
      setProfile(null)
      navigate('/welcome')
    } catch (error) {
      if (ended(error)) return
      if (error instanceof ApiError && error.code === 'user_authorization_active') setRefused(true)
      else if (error instanceof ApiError && error.code === 'offline') { setNetworkFailed(true); setConfirmation(false) }
      else setActionFailed(true)
    } finally { setBusy(false) }
  }

  async function changeLocale(locale: Locale) {
    if (busy || offline) return
    setBusy(true)
    setActionFailed(false)
    setLocaleSaved(false)
    const started = epoch.current
    try {
      const account = await apiRequest<UserProfile>('/user/locale', { method: 'PATCH', body: { locale } })
      if (epoch.current === started) { setProfile(account); setLocaleSaved(true) }
    } catch (error) { if (!ended(error)) actionError(error) }
    finally { setBusy(false) }
  }

  function actionError(error: unknown) {
    if (error instanceof ApiError && error.code === 'offline') setNetworkFailed(true)
    else setActionFailed(true)
  }

  function chooseLocale(locale: Locale) {
    setDeviceLocale(locale)
    storeLocale(locale)
  }

  // The anchors inside handle the keyboard; this only turns their clicks into in-app navigation.
  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
  return <I18nProvider locale={profile?.locale ?? deviceLocale}><div onClick={intercept}>
    <RouteScreen route={route} context={{
      path,
      navigate,
      ended,
      profile,
      replaced,
      deviceLocale,
      chooseLocale,
      onSignedIn: signedIn,
      account: <AccountView path={path} profile={profile} loading={loading} failed={failed} offline={offline} disconnected={!online}
        retry={() => { setFailed(false); setLoading(true); void load() }} busy={busy} signOut={signOut} changeLocale={changeLocale} localeSaved={localeSaved}
        confirmation={confirmation} confirm={() => setConfirmation(true)} cancelConfirmation={() => { setConfirmation(false); setActionFailed(false) }}
        refused={refused} deleteAccount={deleteAccount} actionFailed={actionFailed} />,
    }} />
  </div></I18nProvider>
}

function AccountView({ path, profile, loading, failed, offline, disconnected, retry, busy, signOut, changeLocale, localeSaved, confirmation, confirm, cancelConfirmation, refused, deleteAccount, actionFailed }: {
  path: string; profile: UserProfile | null; loading: boolean; failed: boolean; offline: boolean; disconnected: boolean; retry: () => void;
  busy: boolean; signOut: () => void; changeLocale: (locale: Locale) => void; localeSaved: boolean;
  confirmation: boolean; confirm: () => void; cancelConfirmation: () => void; refused: boolean; deleteAccount: () => void; actionFailed: boolean
}) {
  const t = useMessages().user
  const errors = useMessages().errors
  const locale = useLocale()
  const showDeleteConfirmation = path === '/account/delete' && profile && !profile.authorization && !refused && confirmation
  let content
  let overview = false
  if (loading && !profile) content = <AccountLoading />
  else if (path === '/account/privacy' && (profile || offline)) content = <AccountPrivacy />
  else if (offline && !profile) content = <div className="user-account-overview user-account-empty">
    <h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <div className="user-profile user-profile--empty"><ProfileWaves /></div>
    <UserNotice title={t.noSavedData}>{t.noSavedDataDetail}</UserNotice>
    <Button className="user-action" disabled={disconnected} onClick={retry}>{t.retry}</Button>
  </div>
  else if (failed || !profile) content = <><h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <UserNotice title={t.accountError}>{t.accountErrorText}</UserNotice><Button className="user-action" onClick={retry}>{t.retry}</Button></>
  else if (path === '/account/delete') content = refused || profile.authorization ? <>
    <AccountHeading title={t.deleteAccount} back="/account/settings" backLabel={t.returnToSettings} />
    <UserNotice title={t.activeTitle}>{t.activeText}</UserNotice>
    <a href="/account/settings" className="button button--primary user-action">{t.returnToSettings}</a>
  </> : <>
    <AccountHeading title={t.deleteAccount} back="/account/settings" backLabel={t.returnToSettings} />
    <p>{t.deleteDescription}</p>
    <UserNotice title={t.removedTitle} informational>{t.removedText}</UserNotice><UserNotice title={t.retainedTitle} informational>{t.retainedText}</UserNotice>
    {offline ? <p className="user-caption">{t.backups}</p> : <p>{t.deleteHelp}</p>}
    <Button className="user-action user-danger" disabled={busy || offline} onClick={(event) => {
      // Safari does not focus a clicked button, so the dialog would have no button to return focus to on close.
      event.currentTarget.focus()
      confirm()
    }}>{t.deleteOwn}</Button>
    <a className="button button--secondary user-action" href="/account/settings">{t.cancel}</a>
    {offline && <p className="user-caption">{t.offlineDelete}</p>}
  </>
  else if (path === '/account/settings') content = <>
    <AccountHeading title={t.settings} back="/account" backLabel={t.returnToAccount} />
    <h2 className="user-label">{t.language}</h2>
    <Button className="user-action" lang="es" variant={locale === 'es' ? 'primary' : 'secondary'} disabled={busy || offline} aria-pressed={locale === 'es'} onClick={() => changeLocale('es')}>{t.spanish}</Button>
    <Button className="user-action" lang="en" variant={locale === 'en' ? 'primary' : 'secondary'} disabled={busy || offline} aria-pressed={locale === 'en'} onClick={() => changeLocale('en')}>{t.english}</Button>
    <p className="user-caption">{t.languageDetail}</p>
    {offline && <p className="user-caption">{t.offlineLanguage}</p>}
    {localeSaved && <UserNotice title={t.languageSaved} success>{t.languageSavedDetail}</UserNotice>}
    <Button className="user-action" variant="secondary" disabled={busy || offline} onClick={signOut}>{t.signOut}</Button>
    {offline ? <span className="button button--secondary user-action user-danger-outline" role="link" aria-disabled="true">{t.deleteAccount}</span>
      : <a className="button button--secondary user-action user-danger-outline" href="/account/delete">{t.deleteAccount}</a>}
  </>
  else { content = <AccountOverview profile={profile} offline={offline} />; overview = true }
  return <UserPage header={false} offline={offline && path !== '/account/privacy'} offlineText={offline && !profile ? t.offlineBanner : undefined} className={overview ? 'user-app--overview' : path === '/account/privacy' ? 'user-app--privacy' : ''}>{content}
    {showDeleteConfirmation && <DeleteConfirmation busy={busy} offline={offline} failed={actionFailed} onConfirm={deleteAccount} onCancel={cancelConfirmation} />}
    {actionFailed && !showDeleteConfirmation && <p className="user-caption" role="alert">{errors.server_error}</p>}
  </UserPage>
}

function DeleteConfirmation({ busy, offline, failed, onConfirm, onCancel }: {
  busy: boolean; offline: boolean; failed: boolean; onConfirm: () => void; onCancel: () => void
}) {
  const { user: t, errors } = useMessages()
  const title = useId()
  const description = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    if (element.showModal) element.showModal()
    else element.setAttribute('open', '')
    element.querySelector<HTMLButtonElement>('[data-cancel]')?.focus()
    return () => { element.close?.() }
  }, [])

  return <dialog ref={dialog} className="user-delete-dialog" aria-labelledby={title} aria-describedby={description} onCancel={(event) => {
    event.preventDefault()
    if (!busy) onCancel()
  }}>
    <div className="user-delete-dialog__intro">
      <h2 id={title}>{t.confirmDelete}</h2>
      <p id={description}>{t.permanentText}</p>
    </div>
    {failed && <p role="alert">{errors.server_error}</p>}
    <Button className="user-action user-danger" disabled={busy || offline} onClick={onConfirm}>{t.yesDelete}</Button>
    <Button className="user-action" variant="secondary" data-cancel disabled={busy} onClick={onCancel}>{t.cancel}</Button>
  </dialog>
}

// N-08 from My account (Figma 4468:2653). The notice texts live in the app; only the version and draft flag come from the API.
// The last answer is kept on the device so the page still opens offline, as its caption says.
function AccountPrivacy() {
  const { user: t, registration } = useMessages()
  const [notice, setNotice] = useState<Privacy | null>(storedPrivacy)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    let current = true
    const load = () => apiRequest<Privacy>('/privacy').then((fresh) => {
      if (!current) return
      storePrivacy(fresh)
      setNotice(fresh)
    }).catch(() => { /* Offline or failed: the saved notice, or the draft frame, stays. */ }).finally(() => { if (current) setSettled(true) })
    void load()
    window.addEventListener('online', load)
    return () => { current = false; window.removeEventListener('online', load) }
  }, [])

  return <>
    <div className="user-account-intro">
      <AccountHeading title={registration.privacy} back="/account" backLabel={t.returnToAccount} />
      <p>{t.privacyAccountLanguage}</p>
    </div>
    {notice || settled ? <>
      <PrivacyNoticeCard draft={notice?.draft ?? true} />
      <p className="user-caption">{t.privacyOfflineCaption}</p>
    </> : <UserLoading detail={registration.loading} />}
  </>
}

function AccountOverview({ profile, offline }: { profile: UserProfile; offline: boolean }) {
  const t = useMessages().user
  const dates = useDateFormat()
  const { authorization, account_type: type } = profile
  const badge = type && Object.hasOwn(t.accountTypes, type) ? t.accountTypes[type] : null
  const list = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  // Figma draws "Desliza para ver más" under a list that scrolls; it shows only while rows are still hidden below.
  const measure = useCallback(() => {
    const element = list.current
    if (element) setMore(element.scrollHeight - element.scrollTop - element.clientHeight > 1)
  }, [])
  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, offline, authorization])

  return <div className="user-account-overview">
    <h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <div className="user-profile">
      <ProfileWaves />
      <span className="user-avatar"><UserRound size={36} absoluteStrokeWidth aria-hidden="true" /></span>
      <div className="user-profile__details">
        <div className="user-profile__identity">
          {profile.name && <h2>{profile.name}</h2>}
          <p className="user-profile__email">{profile.email}</p>
          {badge && <span className="user-profile__badge">{badge}</span>}
        </div>
        <p className="user-caption">{authorization ? (offline ? t.savedAccess : t.currentAccess)(authorization.term) : t.noAuthorization}</p>
      </div>
    </div>
    {offline && <p className="user-caption">{t.stale(dates.time(profile.updated_at))}</p>}
    <div className="user-account-scroll" ref={list} onScroll={measure}>
      <AccountRow icon={History} title={t.visits} detail={t.visitsDetail} />
      <AccountRow icon={Heart} title={t.emergency} detail={t.emergencyDetail} />
      <AccountRow icon={Download} title={t.installApp} detail={t.installAppDetail} href="/install" />
      <AccountRow icon={ShieldCheck} title={t.privacyRow} detail={t.privacyRowDetail} href="/account/privacy" />
      <AccountRow icon={Settings} title={t.settings} detail={t.settingsDetail} href="/account/settings" />
      {!authorization && <span className="button button--secondary user-action">{t.iAmAthlete}</span>}
    </div>
    {more && <p className="user-scroll-hint" aria-hidden="true">{t.scrollForMore}<ChevronDown size={16} absoluteStrokeWidth /></p>}
  </div>
}

function ProfileWaves() {
  return <svg className="user-profile__waves" viewBox="0 0 390 154" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 42C36 30 62 48 82 83C104 122 128 140 182 140C262 140 314 116 390 119M0 48C36 36 62 54 82 89C104 128 128 146 182 146C262 146 314 122 390 125" />
  </svg>
}

// Figma 4099:800 draws no loading text, so the status is read by screen readers only.
function AccountLoading() {
  const t = useMessages().user
  return <div className="user-account-overview user-account-loading">
    <h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <div className="visually-hidden"><LoadingState detail={t.loadingAccount} /></div>
    <div className="user-profile user-profile--loading" aria-hidden="true">
      <ProfileWaves />
      <span className="user-avatar" />
      <span className="user-profile__placeholders">
        <span className="user-placeholder" />
        <span className="user-placeholder" />
        <span className="user-placeholder" />
      </span>
    </div>
    {[1, 2, 3].map((row) => <div key={row} className="user-account-row user-account-row--loading" aria-hidden="true">
      <span className="user-account-row__icon" />
      <span className="user-account-row__text">
        <span className="user-placeholder" />
        <span className="user-placeholder" />
      </span>
    </div>)}
  </div>
}

function AccountRow({ icon: Icon, title, detail, href }: { icon: LucideIcon; title: string; detail: string; href?: string }) {
  const content = <>
    <span className="user-account-row__icon"><Icon size={28} absoluteStrokeWidth aria-hidden="true" /></span>
    <span className="user-account-row__text"><strong>{title}</strong><span>{detail}</span></span>
    <ChevronRight className="user-account-row__chevron" size={16} absoluteStrokeWidth aria-hidden="true" />
  </>
  return href ? <a className="user-account-row" href={href}>{content}</a> : <div className="user-account-row">{content}</div>
}

const SWIPE_UP = 30

/** N-01 starts collapsed (Figma 4078:11); a tap (on click) or a swipe up on the sheet opens it (4078:95). */
function Welcome({ locale, chooseLocale }: { locale: Locale; chooseLocale: (locale: Locale) => void }) {
  const t = useMessages().user
  const offline = !useConnection()
  const [expanded, setExpanded] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const startY = useRef<number | null>(null)
  useEffect(() => { if (expanded) heading.current?.focus() }, [expanded])
  const drag = expanded ? {} : {
    onPointerDown: (event: PointerEvent<HTMLElement>) => { if (event.button !== 0) return; startY.current = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId) },
    onPointerMove: (event: PointerEvent<HTMLElement>) => { if (startY.current !== null && startY.current - event.clientY >= SWIPE_UP) setExpanded(true) },
    onPointerUp: () => { startY.current = null },
    onPointerCancel: () => { startY.current = null },
    onClick: () => setExpanded(true),
  }
  // N-01 offline (Figma 4546:2929): the connection banner sits in the open sheet under the handle and both actions stay visible but disabled. The collapsed sheet has no actions and stays as it is.
  const unavailable = (className: string, children: ReactNode) => <span className={className} role="link" aria-disabled="true">{children}</span>
  return <div className="user-app user-welcome">
    <img className="user-welcome__illustration" src={welcomeIllustration} width={390} height={844} alt="" />
    <div className="user-welcome__brand"><strong>{t.brand}</strong><span>{t.brandName}</span><i aria-hidden="true" /></div>
    <main className={`user-welcome__sheet ${expanded ? '' : 'user-welcome__sheet--collapsed'}`} {...drag}>
      <span className="user-welcome__handle" aria-hidden="true" />
      {offline && expanded && <OfflineBanner text={t.welcomeOffline} />}
      <h1 tabIndex={-1} ref={heading}>{expanded ? t.welcome : t.welcomeShort}</h1>
      {expanded ? <>
      <p>{t.welcomeDetail}</p>
      {/* The privacy step of registration (#22) lives at /register. */}
      {offline ? unavailable('button button--primary user-welcome__start', <>{t.begin}<ArrowRight size={16} aria-hidden="true" /></>)
        : <a className="button button--primary user-welcome__start" href="/register">{t.begin}<ArrowRight size={16} aria-hidden="true" /></a>}
      <p className="user-welcome__access">{t.haveAccount}{offline ? unavailable('', t.signIn) : <a href="/sign-in">{t.signIn}</a>}</p>
      <div className="user-welcome__language">
        <button type="button" lang="es" aria-pressed={locale === 'es'} onClick={() => chooseLocale('es')}>{t.spanish}</button>
        <span aria-hidden="true">/</span>
        <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => chooseLocale('en')}>{t.english}</button>
      </div>
      </> : <button type="button" className="user-welcome__hint" onClick={() => setExpanded(true)}>{t.welcomeHint}<ArrowUp size={16} aria-hidden="true" /></button>}
    </main>
  </div>
}
