import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { Button } from '../components'
import { useDateFormat } from '../format/dateTime'
import { I18nProvider, useLocale, useMessages, type Locale } from '../i18n'
import { InstallHelp } from './InstallHelp'
import { UserAccess } from './UserAccess'
import { UserLoading, UserNotice, UserPage } from './ui'
import { useConnection } from './useConnection'
import { isUserPath } from './paths'
import './user.css'

export type UserProfile = {
  name: string | null; email: string; locale: Locale;
  authorization: { type: 'paid' | 'athlete' | 'manual'; term: string } | null;
  updated_at: string
}

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
  const [deleted, setDeleted] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [refused, setRefused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localeSaved, setLocaleSaved] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const online = useConnection()
  const epoch = useRef(0)
  const offline = !online || networkFailed
  const protectedPath = path.startsWith('/account')

  const navigate = useCallback((next: string) => {
    window.history.pushState({}, '', next)
    setPath(new URL(next, window.location.origin).pathname)
    setConfirmation(false)
    setRefused(false)
    setActionFailed(false)
    requestAnimationFrame(() => document.querySelector<HTMLHeadingElement>('.user-content h1')?.focus())
  }, [])

  useEffect(() => {
    const back = () => { setPath(window.location.pathname); setConfirmation(false) }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
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
      setDeleted(true)
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

  return <I18nProvider locale={profile?.locale}><div onClick={intercept}>
    {path === '/install' ? <InstallHelp /> : !protectedPath ? path === '/welcome' ? <Welcome deleted={deleted} /> : <UserAccess
      key={path} mode={path === '/recover-password' ? 'recover' : path === '/reset-password' ? 'reset' : 'sign-in'}
      replaced={replaced} navigate={navigate} onSignedIn={(account) => {
        epoch.current += 1; setProfile(account); setLoading(false); setFailed(false); setNetworkFailed(false); setReplaced(false); setDeleted(false); navigate('/account')
      }} /> : <AccountView path={path} profile={profile} loading={loading} failed={failed} offline={offline}
      retry={() => { setFailed(false); setLoading(true); void load() }} busy={busy} signOut={signOut} changeLocale={changeLocale} localeSaved={localeSaved}
      confirmation={confirmation} confirm={() => setConfirmation(true)} refused={refused} deleteAccount={deleteAccount} actionFailed={actionFailed} />}
  </div></I18nProvider>
}

function AccountView({ path, profile, loading, failed, offline, retry, busy, signOut, changeLocale, localeSaved, confirmation, confirm, refused, deleteAccount, actionFailed }: {
  path: string; profile: UserProfile | null; loading: boolean; failed: boolean; offline: boolean; retry: () => void;
  busy: boolean; signOut: () => void; changeLocale: (locale: Locale) => void; localeSaved: boolean;
  confirmation: boolean; confirm: () => void; refused: boolean; deleteAccount: () => void; actionFailed: boolean
}) {
  const t = useMessages().user
  const errors = useMessages().errors
  const locale = useLocale()
  const dates = useDateFormat()
  let content
  if (loading && !profile) content = <><h1 className="user-account-title" tabIndex={-1}>{t.account}</h1><UserLoading detail={t.loadingAccount} /></>
  else if (failed || !profile) content = <><h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <UserNotice title={t.accountError}>{t.accountErrorText}</UserNotice><Button className="user-action" onClick={retry}>{t.retry}</Button></>
  else if (path === '/account/delete') content = refused || profile.authorization ? <>
    <h1 tabIndex={-1}>{t.cannotDelete}</h1><UserNotice title={t.activeTitle}>{t.activeText}</UserNotice>
    <a href="/account/settings" className="button button--primary user-action">{t.returnToSettings}</a>
  </> : confirmation ? <>
    <h1 tabIndex={-1}>{t.confirmDelete}</h1><UserNotice title={t.permanent} informational>{t.permanentText}</UserNotice>
    <p>{t.retainedConfirmation}</p><Button className="user-action user-danger" disabled={busy || offline} onClick={deleteAccount}>{t.yesDelete}</Button>
    <a className="button button--secondary user-action" href="/account/settings">{t.cancel}</a>
  </> : <>
    <h1 tabIndex={-1}>{t.deleteAccount}</h1><p>{t.deleteDescription}</p>
    <UserNotice title={t.removedTitle} informational>{t.removedText}</UserNotice><UserNotice title={t.retainedTitle} informational>{t.retainedText}</UserNotice>
    <p className="user-caption">{t.backups}</p><Button className="user-action user-danger" disabled={busy || offline} onClick={confirm}>{t.deleteOwn}</Button>
    <a className="button button--secondary user-action" href="/account/settings">{t.cancel}</a>
    {offline && <p className="user-caption">{t.offlineDelete}</p>}
  </>
  else if (path === '/account/settings') content = <>
    <h1 tabIndex={-1}>{t.settings}</h1><h2 className="user-label">{t.language}</h2>
    <Button className="user-action" variant={locale === 'es' ? 'primary' : 'secondary'} disabled={busy || offline} aria-pressed={locale === 'es'} onClick={() => changeLocale('es')}>{t.spanish}</Button>
    <Button className="user-action" variant={locale === 'en' ? 'primary' : 'secondary'} disabled={busy || offline} aria-pressed={locale === 'en'} onClick={() => changeLocale('en')}>{t.english}</Button>
    <p className="user-caption">{t.languageDetail}</p>
    {offline && <p className="user-caption">{t.offlineLanguage}</p>}
    {localeSaved && <UserNotice title={t.languageSaved} success>{t.languageSavedDetail}</UserNotice>}
    <Button className="user-action" variant="secondary" disabled={busy || offline} onClick={signOut}>{t.signOut}</Button>
    {offline ? <span className="button button--secondary user-action user-danger-outline" role="link" aria-disabled="true">{t.deleteAccount}</span>
      : <a className="button button--secondary user-action user-danger-outline" href="/account/delete">{t.deleteAccount}</a>}
  </>
  else content = <>
    <h1 className="user-account-title" tabIndex={-1}>{t.account}</h1>
    <div className="user-profile"><span className="user-avatar"><UserRound aria-hidden="true" /></span><div>
      {profile.name && <h2>{profile.name}</h2>}<p>{profile.email}</p></div></div>
    {offline && <p className="user-caption">{t.stale(dates.time(profile.updated_at))}</p>}
    <AccountRow title={profile.authorization ? t.activeAuthorization : t.noAuthorization}
      detail={profile.authorization ? t.authorization(profile.authorization.type === 'athlete' ? t.athlete : profile.authorization.type === 'manual' ? t.manual : t.membership, profile.authorization.term) : t.accountAvailable} />
    <AccountRow title={t.emergency} detail={t.emergencyDetail} />
    <AccountRow title={t.visits} detail={t.visitsDetail} />
    <a className="user-account-row" href="/account/settings"><strong>{t.settings}</strong><span>{t.settingsDetail}</span></a>
    {!profile.authorization && <span className="button button--secondary user-action">{t.iAmAthlete}</span>}
  </>
  return <UserPage header={false} offline={offline && Boolean(profile)}>{content}
    {actionFailed && <p className="user-caption" role="alert">{errors.server_error}</p>}
  </UserPage>
}

function AccountRow({ title, detail }: { title: string; detail: string }) {
  return <div className="user-account-row"><strong>{title}</strong><span>{detail}</span></div>
}

function Welcome({ deleted }: { deleted: boolean }) {
  const t = useMessages().user
  return <UserPage><h1 tabIndex={-1}>{t.welcome}</h1>
    {deleted && <UserNotice title={t.deleted} success>{t.deletedDetail}</UserNotice>}
    <div className="user-welcome-actions">
      <a className="button button--primary user-action" href="/sign-in">{t.signIn}</a>
      <span className="button button--secondary user-action">{t.register}</span><p className="user-caption">{t.membershipHelp}</p>
    </div>
    <div className="user-welcome-actions"><span className="button button--primary user-action">{t.install}</span>
      <p className="user-caption">{t.helpPrivacy}</p><p className="user-caption">{t.languages}</p></div>
  </UserPage>
}
