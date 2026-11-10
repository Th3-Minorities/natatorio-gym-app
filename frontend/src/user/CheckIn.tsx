import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEventHandler, type RefObject } from 'react'
import { Camera, Check, Clock, DoorOpen, LockKeyhole, MapPin, TriangleAlert, UserRound, WifiOff, type LucideIcon } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { useDateFormat } from '../format/dateTime'
import { errorMessage, useMessages } from '../i18n'
import type { UserProfile } from './UserApp'
import { LocationHelp } from './LocationHelp'
import { UserPage } from './ui'
import { useConnection } from './useConnection'
import athletesNotice from './assets/athletes-notice.svg'
import athletesPeriod from './assets/athletes-period.svg'
import wavesBottom from './assets/background-waves-bottom.svg'
import wavesTop from './assets/background-waves-top.svg'
import idWaves from './assets/id-waves.svg'
import endedMemberId from './assets/ended-member-id.svg'
import endedMemberTop from './assets/ended-member-top.svg'
import endedMemberBottom from './assets/ended-member-bottom.svg'
import endedAthleteId from './assets/ended-athlete-id.svg'
import endedAthleteTop from './assets/ended-athlete-top.svg'
import endedAthleteBottom from './assets/ended-athlete-bottom.svg'
import weightBench from './assets/weight-bench.svg'
import './checkIn.css'

// U-01 Check In (issue #17). Figma page "#41 Gym ID and Check in" (4085:1125).

type Period = { state: 'upcoming' | 'active'; starts_at: string; ends_at: string }
type LastSession = { id: number | string; started_at: string; ended_at: string; end_reason: 'checked_out' | 'expired' | 'closed' }
export type CheckInStatus = {
  session?: { id: number | string; started_at: string; status: 'active' } | null
  last_session?: LastSession | null
  athletes_period: Period | null
  /** The type of the latest authorization, current or not. */
  account_type: 'member' | 'athlete' | null
  member_group?: 'student' | 'employee' | null
  sport?: string | null
}
type Problem = 'authorization' | 'closed' | 'termPhoto' | 'pendingPhoto' | 'denied' | 'unavailable' | 'accuracy' | 'outside' | 'offline' | 'failed'

const REFUSALS: Record<string, Problem> = {
  check_in_no_authorization: 'authorization', check_in_gym_closed: 'closed', check_in_photo_required: 'termPhoto',
  check_in_photo_pending: 'pendingPhoto', location_required: 'unavailable', check_in_low_accuracy: 'accuracy',
  check_in_outside_boundary: 'outside', offline: 'offline',
}
const PROBLEM_ICONS: Record<Problem, LucideIcon> = {
  authorization: LockKeyhole, closed: Clock, termPhoto: Camera, pendingPhoto: Camera,
  denied: MapPin, unavailable: MapPin, accuracy: MapPin, outside: MapPin, offline: WifiOff, failed: TriangleAlert,
}
// Boards 08 to 10: these causes offer "Intentar de nuevo" or "Reintentar conexión".
const RETRYABLE: Problem[] = ['denied', 'unavailable', 'accuracy', 'outside', 'offline', 'failed']
// "La pulsación de 1 segundo confirma la intención. Soltar antes cancela." (board 01 notes)
const HOLD_MS = 1000

/** The position is only sent to the API, never stored or logged (board 10 notes). */
function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('unavailable')); return }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  })
}

const DISMISSED_KEY = 'checkIn.dismissedSession'

function elapsed(since: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  return [seconds / 3600, (seconds % 3600) / 60, seconds % 60].map((part) => String(Math.floor(part)).padStart(2, '0')).join(':')
}

export function CheckIn({ profile, reloadProfile, ended }: { profile: UserProfile | null; reloadProfile: () => Promise<void>; ended: (error: unknown) => boolean }) {
  const texts = useMessages()
  const t = texts.checkIn
  const user = texts.user
  const dates = useDateFormat()
  const [failure, setFailure] = useState<{ code: string; status: number; until?: Date }>({ code: 'server_error', status: 500 })
  const [status, setStatus] = useState<CheckInStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const profileLoadedRef = useRef(false)
  const [requestProblem, setProblem] = useState<Problem | null>(null)
  const problem: Problem | null = loaded && profileLoaded && profile && !profile.authorization ? 'authorization' : requestProblem
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState<HTMLButtonElement | null>(null)
  const [phase, setPhase] = useState<'locating' | 'registering' | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const online = useConnection()
  const [networkFailed, setNetworkFailed] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISSED_KEY) } catch { return null }
  })
  const [registration, setRegistration] = useState<{ id: number | string; announce: boolean } | null>(null)
  const registered = registration !== null && registration.id === status?.session?.id
  const [now, setNow] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(() => Date.now())
  const clockOffset = useRef(0)
  const requestId = useRef(0)
  const loadedRef = useRef(false)
  const offline = !online || networkFailed
  const updateNow = useCallback((time: number) => {
    setNow((prev) => Math.max(prev, time))
  }, [])
  const syncClock = useCallback((time: number) => {
    const offset = time - Date.now()
    if (Math.abs(offset - clockOffset.current) > 1500) clockOffset.current = offset
    setUpdatedAt(time)
    updateNow(Date.now() + clockOffset.current)
  }, [updateNow])

  const refresh = useCallback(async (background = false) => {
    const id = ++requestId.current
    try {
      let serverTime: number | undefined
      const next = await apiRequest<CheckInStatus>('/user/check-in', { autoRefresh: background, onServerTime: (time) => { serverTime = time } })
      if (id !== requestId.current || !navigator.onLine) return null
      syncClock(serverTime ?? Date.now() + clockOffset.current)
      setStatus(next)
      setRegistration((current) => current && current.id === next.session?.id ? { ...current, announce: false } : null)
      setNetworkFailed(false)
      setProblem((current) => current === 'offline' && profileLoadedRef.current ? null : current)
      return next
    } catch (error) {
      if (id !== requestId.current) return null
      if (!ended(error)) {
        setNetworkFailed(true)
        if (error instanceof ApiError && error.code === 'offline') setProblem('offline')
      }
      return null
    } finally { if (id === requestId.current) { loadedRef.current = true; setLoaded(true) } }
  }, [ended, syncClock])

  const profileFailed = useCallback((error: unknown) => {
    if (ended(error)) return
    if (error instanceof ApiError && error.code === 'offline') setProblem('offline')
    else {
      setFailure(error instanceof ApiError ? { code: error.code, status: error.status } : { code: 'server_error', status: 500 })
      setProblem('failed')
    }
  }, [ended])

  useEffect(() => {
    let current = true
    void reloadProfile().then(() => { if (current) { profileLoadedRef.current = true; setProfileLoaded(true) } }).catch((error: unknown) => { if (current) profileFailed(error) })
    return () => { current = false }
  }, [reloadProfile, profileFailed])

  useEffect(() => {
    if (!online) { if (!loadedRef.current) setProblem((current) => current ?? 'offline'); return }
    let disposed = false
    queueMicrotask(() => { if (!disposed && !document.hidden) void refresh() })
    const check = () => { if (navigator.onLine && !document.hidden) void refresh(true) }
    const timer = setInterval(check, 25_000)
    document.addEventListener('visibilitychange', check)
    return () => { disposed = true; requestId.current += 1; clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [online, refresh])

  useEffect(() => {
    const disconnect = () => { requestId.current += 1; setNetworkFailed(true) }
    window.addEventListener('offline', disconnect)
    return () => window.removeEventListener('offline', disconnect)
  }, [])

  const activeSessionId = status?.session?.id
  const activeStartedAt = status?.session?.started_at
  useEffect(() => {
    if (activeSessionId === undefined || offline) return
    const started = new Date(activeStartedAt ?? '').getTime()
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const sinceBoundary = Number.isNaN(started) ? 0 : (((Date.now() + clockOffset.current - started) % 1000) + 1000) % 1000
      timer = setTimeout(() => { updateNow(Date.now() + clockOffset.current); schedule() }, 1000 - sinceBoundary + 30)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [activeSessionId, activeStartedAt, offline, updateNow])

  async function register() {
    if (!navigator.onLine) { setProblem('offline'); return }
    let position: GeolocationPosition
    setPhase('locating')
    try { position = await locate() } catch (error) {
      setProblem((error as GeolocationPositionError).code === 1 ? 'denied' : 'unavailable')
      return
    }
    const { latitude, longitude, accuracy } = position.coords
    setPhase('registering')
    try {
      requestId.current += 1
      const next = await apiRequest<CheckInStatus>('/user/check-in', { method: 'POST', body: { latitude, longitude, accuracy }, onServerTime: syncClock })
      setStatus(next)
      setRegistration(next.session ? { id: next.session.id, announce: true } : null)
      setNetworkFailed(false)
      setProblem(null)
    } catch (error) {
      if (ended(error)) return
      if (!(error instanceof ApiError)) { setFailure({ code: 'server_error', status: 500 }); setProblem('failed'); return }
      if (error.code === 'check_in_athletes_only') {
        const period = error.details as unknown as { starts_at: string; ends_at: string }
        // Only members get this refusal, so it also stands when the first status request failed.
        setStatus((current) => ({ ...(current ?? { session: null, account_type: 'member' }), athletes_period: { state: 'active', starts_at: period.starts_at, ends_at: period.ends_at } }))
        setProblem(null)
      } else if (REFUSALS[error.code]) setProblem(REFUSALS[error.code])
      else {
        // Not drawn for Check In: the app's existing wait and server-error texts (owner decision).
        setFailure({ code: error.code, status: error.status, until: error.code === 'too_many_requests' ? new Date(Date.now() + (error.retryAfter ?? 60) * 1000) : undefined })
        setProblem('failed')
      }
    }
  }

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await action() } finally { setBusy(false); setPhase(null) }
  }

  // Board 10 notes: a retry first asks whether the session was already created.
  const retry = () => run(async () => {
    const next = await refresh()
    if (!profileLoaded) {
      try { await reloadProfile(); profileLoadedRef.current = true; setProfileLoaded(true); setProblem(null) } catch (error) { profileFailed(error) }
      return
    }
    if (next && !next.session && profile?.authorization && problem !== 'offline') await register()
  })

  const athlete = (status?.account_type ?? (profile?.authorization?.type === 'athlete' ? 'athlete' : 'member')) === 'athlete'
  const period = status?.athletes_period ?? null
  const lastSession = status?.last_session && String(status.last_session.id) !== dismissed ? status.last_session : null
  const view = status?.session ? 'confirmed' : lastSession ? 'ended' : problem ?? (!loaded || !profileLoaded || !profile ? 'loading' : period?.state === 'active' && !athlete ? 'exclusive' : 'ready')

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    heading.current?.focus()
  }, [view])

  const lead = view === 'exclusive' ? t.nextAccess : problem ? t.review : t.ready
  const message = !problem ? null : problem === 'failed' ? {
    title: failure.until ? user.waitTitle : user.sendErrorTitle,
    text: failure.until ? user.waitText(dates.time(failure.until)) : errorMessage(texts, failure.code, failure.status),
    action: t.problems.unavailable.action,
  } : problem === 'authorization' && athlete ? t.problems.athleteAuthorization : t.problems[problem]
  const progress = phase && t[phase]
  const range = period && dates.timeRange(period.starts_at, period.ends_at)
  return <UserPage header={false} current="check-in" offline={offline || view === 'offline'}
    className={`check-in ${athlete ? 'check-in--athlete' : 'check-in--member'} ${view === 'confirmed' && !offline ? 'check-in--confirmed' : ''} ${view === 'confirmed' && offline ? 'check-in--stale' : ''} ${view === 'ended' ? 'check-in--ended' : ''}`}>
    {status?.session || lastSession ? <Confirmed profile={profile} athlete={athlete} startedAt={(status?.session ?? lastSession!).started_at} heading={heading} period={status?.session && !offline ? period : null}
      now={now} offline={offline} updatedAt={updatedAt} lastSession={status?.session ? null : lastSession} registered={registered} busy={busy}
      onContinue={() => void run(async () => {
        const next = await refresh()
        if (next) {
          setDismissed(next.last_session ? String(next.last_session.id) : null)
          try { if (next.last_session) localStorage.setItem(DISMISSED_KEY, String(next.last_session.id)) } catch { /* in-memory only */ }
          setRegistration(null); setProblem(null)
        }
      })}
      detail={athlete ? status?.sport : status?.member_group === 'student' ? t.student : null} /> : <>
    <h1 ref={heading} tabIndex={-1}>{user.checkIn}</h1>
    {view !== 'loading' && <>
      <p className="check-in-lead">{progress ? t.processing : lead}</p>
      <Identity profile={profile} athlete={athlete} authorized={Boolean(profile?.authorization) && problem !== 'authorization'} />
    </>}
    {message && <>
      <div className={`check-in-message ${problem === 'closed' ? 'check-in-message--neutral' : ''}`}>
        <Icon icon={PROBLEM_ICONS[problem!]} />
        <h2>{message.title}</h2>
        <p>{message.text}</p>
      </div>
      <Action href={problem === 'authorization' && !athlete ? '/account' : undefined}
        onClick={RETRYABLE.includes(problem!) ? retry : undefined} disabled={busy}>{message.action}</Action>
      {problem === 'denied' && <>
        <Action secondary onClick={(event) => setHelp(event.currentTarget)}>{t.problems.denied.help}</Action>
        <p className="check-in-caption">{t.deniedNote}</p>
        {help && <LocationHelp returnFocusTo={help} onClose={() => setHelp(null)} />}
      </>}
    </>}
    {view === 'exclusive' && period && <>
      <div className="check-in-period">
        <img src={athletesPeriod} alt="" width="46" height="46" />
        <h2>{t.athletesTraining}</h2>
        <p className="check-in-period__small">{t.exclusiveRange(range!)}</p>
        <hr />
        <p>{t.canRegister}</p>
        <p className="check-in-period__time">{t.from(dates.time(period.ends_at))}</p>
        <p className="check-in-period__small">{t.membershipValid}</p>
        {/* Text only until the schedules screen exists; #28 makes "Ver horarios" a link. */}
        <span className="button check-in-period__action">{t.schedules}</span>
      </div>
      <Note icon={LockKeyhole}>{t.availableAfter}</Note>
    </>}
    {view === 'ready' && <>
      <div className="check-in-panel">
        <div><h2>{progress?.title ?? t.registerTitle}</h2><p>{progress?.text ?? t.registerText}</p></div>
        <div className="check-in-panel__art"><img src={weightBench} alt="" width="142.2" height="146.062" /></div>
      </div>
      {period && <PeriodNotice period={period} />}
      <HoldButton busy={busy} label={progress?.button} onConfirm={() => void run(register)} />
      <Note icon={MapPin}>{progress?.hint ?? t.locationNote}</Note>
    </>}
    </>}
    <div className="visually-hidden" role="status">{view === 'confirmed' ? registered && registration?.announce && !offline ? t.confirmed : undefined : view === 'ended' ? undefined : progress?.title ?? message?.title}</div>
  </UserPage>
}

function PeriodNotice({ period }: { period: Period }) {
  const t = useMessages().checkIn
  const dates = useDateFormat()
  return <div className="check-in-notice">
    <img src={athletesNotice} alt="" width="26" height="26" />
    <p>{period.state === 'active' ? t.exclusive : t.upcoming}<br />{t.periodTime(dates.day(period.starts_at), dates.timeRange(period.starts_at, period.ends_at))}</p>
  </div>
}

function Icon({ icon: Svg }: { icon: LucideIcon }) {
  return <Svg aria-hidden="true" />
}

function Note({ icon: Svg, children }: { icon: LucideIcon; children: string }) {
  return <p className="check-in-note"><Svg aria-hidden="true" /><span>{children}</span></p>
}

/**
 * Destinations without a screen yet stay as text, not links (approved by the owner):
 * "Ver horarios" becomes a link with #28 (schedules); "Actualizar foto" with the U-02 photo screen;
 * "Ver cómo activar ubicación" with the location help screen; "Ver información de contacto" with the gym contact screen.
 */
function Action({ href, onClick, disabled, secondary, children }: { href?: string; onClick?: MouseEventHandler<HTMLButtonElement>; disabled?: boolean; secondary?: boolean; children: string }) {
  const className = `button check-in-action ${secondary ? 'check-in-action--secondary' : ''}`
  if (href) return <a className={className} href={href}>{children}</a>
  if (onClick) return <button type="button" className={className} disabled={disabled} onClick={onClick}>{children}</button>
  return <span className={className}>{children}</span>
}

// The badge is an atomic inline, so the line could break before it; the last word and the badge stay together.
function NameWithBadge({ name, badgeLabel }: { name?: string | null; badgeLabel: string | null }) {
  const text = name ?? ''
  const cut = text.lastIndexOf(' ') + 1
  const badge = badgeLabel !== null && <span className="check-in-badge" role="img" aria-label={badgeLabel}><Check aria-hidden="true" /></span>
  return <>{text.slice(0, cut)}<span className="check-in-name-end">{text.slice(cut)}{badge}</span></>
}

function Identity({ profile, athlete, authorized }: { profile: UserProfile | null; athlete: boolean; authorized: boolean }) {
  const t = useMessages()
  return <div className="check-in-identity">
    <Photo profile={profile} />
    <div>
      <p className="check-in-identity__name"><NameWithBadge name={profile?.name ?? profile?.email} badgeLabel={authorized ? t.user.activeAuthorization : null} /></p>
      <p>{athlete ? t.checkIn.athlete : t.checkIn.member}</p>
    </div>
  </div>
}

function HoldButton({ busy, label, onConfirm }: { busy: boolean; label?: string; onConfirm: () => void }) {
  const t = useMessages().checkIn
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function start() {
    if (busy || holding) return
    setHolding(true)
    timer.current = setTimeout(() => { timer.current = undefined; setHolding(false); onConfirm() }, HOLD_MS)
  }
  function cancel() {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    setHolding(false)
  }
  const key = (event: KeyboardEvent, down: boolean) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!down) cancel()
    else if (!event.repeat) start()
  }

  return <button type="button" className={`check-in-hold ${holding ? 'check-in-hold--holding' : ''} ${busy ? 'check-in-hold--busy' : ''}`}
    aria-disabled={busy || undefined}
    onPointerDown={(event) => { if (event.button === 0) { event.currentTarget.setPointerCapture?.(event.pointerId); start() } }}
    onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    // A click with no pointer press (detail 0) comes from assistive technology, which cannot hold; the key handlers below stop the keyboard's own click.
    onClick={(event) => { if (event.detail === 0 && !busy && !holding) onConfirm() }}
    onKeyDown={(event) => key(event, true)} onKeyUp={(event) => key(event, false)} onContextMenu={(event) => event.preventDefault()}>
    {label ?? (holding ? t.holding : t.hold)}
    {holding && <span className="check-in-hold__progress" aria-hidden="true" />}
  </button>
}

function Photo({ profile, large = false }: { profile: UserProfile | null; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  return <span className={`check-in-photo ${large ? 'check-in-photo--large' : ''}`}>
    {profile && !failed ? <img src="/api/user/photo" alt="" onError={() => setFailed(true)} /> : <UserRound aria-hidden="true" />}
  </span>
}

function Confirmed({ profile, athlete, startedAt, heading, detail, period, now, offline, updatedAt, lastSession, registered, busy, onContinue }: {
  profile: UserProfile | null; athlete: boolean; startedAt: string; heading: RefObject<HTMLHeadingElement | null>; detail?: string | null; period: Period | null;
  now: number; offline: boolean; updatedAt: number; lastSession?: LastSession | null; registered: boolean; busy: boolean; onContinue: () => void
}) {
  const t = useMessages().checkIn
  const user = useMessages().user
  const dates = useDateFormat()
  return <>
    {!offline && <><img className="check-in-waves check-in-waves--top" src={lastSession ? athlete ? endedAthleteTop : endedMemberTop : wavesTop} alt="" />
    <img className="check-in-waves check-in-waves--bottom" src={lastSession ? athlete ? endedAthleteBottom : endedMemberBottom : wavesBottom} alt="" /></>}
    <h1 ref={heading} tabIndex={-1}>{user.checkIn}</h1>
    <p className="check-in-lead">{lastSession ? t.visitEnded : offline ? t.restoreCard : registered ? t.confirmed : t.activeLead}</p>
    <div className="check-in-id">
      <img className="check-in-id__waves" src={lastSession ? athlete ? endedAthleteId : endedMemberId : idWaves} alt="" />
      <p className="check-in-id__state">{lastSession ? <DoorOpen aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{lastSession ? t.sessionEnded : offline ? t.invalidNow : t.sessionActive}</span></p>
      <Photo profile={profile} large />
      <p className="check-in-id__name"><NameWithBadge name={profile?.name ?? profile?.email} badgeLabel={profile?.authorization ? user.activeAuthorization : null} /></p>
      {profile?.name && <p className="check-in-id__small">{profile.email}</p>}
      <p className="check-in-id__category"><UserRound aria-hidden="true" /><span>{athlete ? t.athlete : t.member}</span></p>
      {/* Figma draws "Estudiante" (4104:719) and the sport (4199:3403); no frame draws the employee word. */}
      {detail && <p className="check-in-id__small">{detail}</p>}
      <hr />
      {lastSession ? <div className="check-in-id__times"><div><p className="check-in-id__small">{t.entry}</p><p className="check-in-id__time">{dates.time(startedAt)}</p></div>
        <div><p className="check-in-id__small">{t.exit}</p><p className="check-in-id__time">{dates.time(lastSession.ended_at)}</p></div></div> : <>
        <p className="check-in-id__small">{t.entryRegistered}</p><p className="check-in-id__time">{dates.time(startedAt)}</p></>}
    </div>
    <div className="check-in-duration">
      <Clock aria-hidden="true" />
      <p><span>{lastSession ? t.totalDuration : offline ? t.staleDuration : t.duration}</span><span className="check-in-duration__value">{elapsed(startedAt, lastSession ? Date.parse(lastSession.ended_at) : now)}</span></p>
    </div>
    {period && <PeriodNotice period={period} />}
    {lastSession ? <><Action onClick={onContinue} disabled={busy || offline}>{t.continue}</Action><p className="check-in-caption">{t.endReasons[lastSession.end_reason]}</p></> : <>
      <p className="check-in-show">{offline ? t.connectCard : t.showCard}</p>
      <p className="check-in-caption">{offline ? t.lastUpdate(`${dates.day(new Date(updatedAt), new Date(updatedAt))}, ${dates.time(new Date(updatedAt), true)}`) : t.staffExit}</p></>}
  </>
}
