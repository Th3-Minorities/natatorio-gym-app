import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, LoadingState } from '../../components'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { OCCUPANCY_POLL } from '../../occupancy/useOccupancy'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { minutesBetween } from '../people/personText'
import { ConfirmDialog, PersonPhoto, StaffLink } from '../people/StaffParts'
import { STAFF_PATH, staffSessionPath } from '../staffPath'
import { useStaffSession } from '../useStaffSession'

// S-01's list of who is inside (Figma 121:3032), with search, "Marcar salida" (122:3002) and the welcome after an
// assisted Check In (4319:1662), #26. It asks again every 25 seconds while the page is visible (REQ-F-43).

export type Visit = {
  id: number
  started_at: string
  name: string | null
  type: 'athlete' | 'student' | 'employee' | 'manual'
  sport: string | null
  has_photo: boolean
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'offline' } | { status: 'ready'; visits: Visit[]; search: string }

/** Waits this long after the last key before it searches, so typing a name sends one request. */
const SEARCH_DELAY = 300

/** The "?registrado=11" an assisted Check In leaves, read once and removed, so a reload does not repeat it. */
function takeNewVisit(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get('registrado'))
  if (!Number.isInteger(id) || id <= 0) return null
  window.history.replaceState(null, '', STAFF_PATH)
  return id
}

/** onChange: the list changed here (a check-out), so the occupancy card asks again instead of waiting for its poll. */
export function SessionsList({ navigate, onChange }: { navigate?: (path: string) => void; onChange?: () => void }) {
  const texts = useMessages()
  const t = texts.activeSessions
  const dates = useDateFormat()
  const online = useConnection()
  const session = useStaffSession()
  const report = useEffectEvent((error: unknown) => session.reportError(error))
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [newVisit] = useState(takeNewVisit)
  const [message, setMessage] = useState('')
  const [checkingOut, setCheckingOut] = useState<Visit | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  // Recounts the time inside each minute without asking the server.
  const [now, setNow] = useState(() => Date.now())
  const titleId = useId()
  const searchId = useId()
  const welcomeId = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const countTitle = useRef<HTMLHeadingElement>(null)
  // The row that was pressed is gone after a check-out: focus goes to the list title (WCAG 2.4.3).
  const [checkedOutCount, setCheckedOutCount] = useState(0)

  useEffect(() => {
    if (checkedOutCount > 0) countTitle.current?.focus()
  }, [checkedOutCount])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DELAY)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let current = true
    const ask = async (background: boolean) => {
      if (background && (document.hidden || !navigator.onLine)) return
      try {
        const path = search ? `/staff/sessions?${new URLSearchParams({ search })}` : '/staff/sessions'
        const { sessions } = await apiRequest<{ sessions: Visit[] }>(path, { autoRefresh: background })
        if (!current) return
        setNow(Date.now())
        setLoad({ status: 'ready', visits: sessions, search })
      } catch (error) {
        if (!current) return
        report(error)
        // A failed refresh keeps the list on screen; only a first load shows the error.
        if (!background) setLoad({ status: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error' })
      }
    }
    void ask(false)
    const timer = window.setInterval(() => void ask(true), OCCUPANCY_POLL)
    return () => {
      current = false
      window.clearInterval(timer)
    }
  }, [search, attempt])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  async function checkOut() {
    if (!checkingOut || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await apiRequest(`/staff/sessions/${checkingOut.id}/check-out`, { method: 'POST' })
      setMessage(t.checkedOut(checkingOut.name ?? ''))
      setCheckingOut(null)
      setCheckedOutCount((n) => n + 1)
    } catch (error) {
      session.reportError(error)
      setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
    } finally {
      setBusy(false)
      // Someone else may have ended it: show what the list is now, behind the dialog, and the count with it.
      setAttempt((n) => n + 1)
      onChange?.()
    }
  }

  const visits = load.status === 'ready' ? load.visits : []
  const welcomed = newVisit !== null ? visits.find((visit) => visit.id === newVisit) : undefined

  return (
    <>
      {checkingOut && (
        <ConfirmDialog
          title={t.confirmTitle}
          question={t.checkOutTitle(checkingOut.name ?? '')}
          text={t.checkOutText}
          confirm={t.confirmCheckOut}
          busy={busy}
          problem={<ProblemNotice problem={problem} tone="error" />}
          onConfirm={() => void checkOut()}
          onClose={() => {
            setCheckingOut(null)
            setProblem(null)
          }}
        />
      )}
      {/* One live region that stays on the page, so a new message is read out (WCAG 4.1.3). */}
      <div role="status" className="sessions-live">
        {welcomed && (
          <section className="sessions-welcome" aria-labelledby={welcomeId}>
            <h2 className="sessions-welcome__title" id={welcomeId}>
              {t.checkedInTitle}
            </h2>
            <p className="sessions-welcome__text">{t.checkedInText(welcomed.name ?? '')}</p>
          </section>
        )}
        {message && <p className="sessions-message">{message}</p>}
      </div>

      <section className="sessions-panel" aria-labelledby={titleId}>
        <div className="sessions-panel__tools">
          <div className="field sessions-search">
            <label className="field__label" htmlFor={searchId}>
              {t.search}
            </label>
            <input
              id={searchId}
              ref={searchInput}
              className="field__input"
              type="search"
              autoComplete="off"
              placeholder={t.searchHint}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="sessions-panel__count">
            <h2 className="sessions-panel__title" id={titleId} ref={countTitle} tabIndex={-1}>
              {load.status === 'ready' ? t.count(visits.length) : t.tableTitle}
            </h2>
            <p className="sessions-panel__date">{t.today(dates.date(new Date(now).toISOString()))}</p>
          </div>
        </div>
        {content()}
      </section>
    </>
  )

  function content() {
    switch (load.status) {
      case 'loading':
        return (
          <>
            <LoadingState title={t.loadingTitle} detail={t.loadingText} />
            <div className="sessions-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )
      case 'error':
      case 'offline':
        return (
          <section className="state state--error" role="alert">
            <h3 className="state__title">{load.status === 'offline' ? texts.states.offlineTitle : t.errorTitle}</h3>
            <p className="state__detail">{load.status === 'offline' ? t.offlineText : t.errorText}</p>
            <Button className="state__button" disabled={!online} onClick={retry}>
              {texts.states.retry}
            </Button>
          </section>
        )
    }
    if (visits.length === 0) {
      return load.search ? (
        <section className="state">
          <h3 className="state__title">{t.noMatchTitle}</h3>
          <p className="state__detail">{t.noMatchText(load.search)}</p>
          <Button
            variant="secondary"
            className="state__button"
            onClick={() => {
              setQuery('')
              setSearch('')
              searchInput.current?.focus()
            }}
          >
            {t.clearSearch}
          </Button>
        </section>
      ) : (
        <section className="state">
          <h3 className="state__title">{t.emptyTitle}</h3>
          <p className="state__detail">{t.emptyText}</p>
        </section>
      )
    }

    return (
      <>
        {/* Scrolls sideways on a narrow window; tabIndex lets the keyboard scroll it too (WCAG 2.1.1). */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="sessions-table" role="region" aria-labelledby={titleId} tabIndex={0}>
          <table aria-label={t.tableTitle}>
            <thead>
              <tr>
                <th scope="col">{t.columns.person}</th>
                <th scope="col">{t.columns.checkIn}</th>
                <th scope="col">{t.columns.inside}</th>
                <th scope="col">{t.columns.authorization}</th>
                <th scope="col">{t.columns.action}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.id} className={visit.id === newVisit ? 'sessions-row--new' : undefined}>
                  <td>
                    <div className="sessions-person">
                      <PersonPhoto
                        src={visit.has_photo ? `/api/staff/sessions/${visit.id}/photo` : null}
                        name={visit.name}
                        size="small"
                      />
                      <StaffLink
                        href={staffSessionPath(visit.id)}
                        navigate={navigate}
                        className="sessions-person__name"
                        aria-label={t.open(visit.name ?? '')}
                      >
                        {visit.name}
                      </StaffLink>
                    </div>
                  </td>
                  <td>{dates.time(visit.started_at)}</td>
                  <td>{t.minutes(minutesBetween(visit.started_at, now))}</td>
                  <td>
                    <span className="team-chip team-chip--invited-outline">{t.types[visit.type]}</span>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      className="sessions-checkout"
                      // The name tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
                      aria-label={`${t.checkOut}, ${visit.name ?? ''}`}
                      aria-disabled={!online || undefined}
                      onClick={() => {
                        if (!online) return
                        setMessage('')
                        setCheckingOut(visit)
                      }}
                    >
                      {t.checkOut}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sessions-panel__hint">{t.selectHint}</p>
      </>
    )
  }
}
