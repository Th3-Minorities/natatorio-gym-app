import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, EmptyState, OfflineState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { StaffLink } from '../people/StaffParts'
import { findPersonPath } from '../staffPath'
import type { ShellProps } from '../team/StaffTeam'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import '../team/staffTeam.css'
import '../sessions/activeSessions.css'
import './roster.css'

// S-05 "Roster de atletas", read only, for Staff and Administrators (Figma 121:3383 and the states 4265:2957, 122:3214,
// 122:3222, 122:3280 and 122:3253, #26, REQ-F-49, REQ-F-45). The email is not here: the API does not send it to Staff.

type StaffAthlete = {
  id: number
  name: string
  sport: string
  student_number: string
  /** When the open visit started, or null when the athlete is not inside. */
  active_session: { started_at: string } | null
}

type Roster = { athletes: StaffAthlete[]; active_count: number; total_count: number }

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'offline' }
  // stale: the last request found no connection, so the rows are the ones from loadedAt.
  | { status: 'ready'; roster: Roster; search: string; loadedAt: number; stale: boolean }

/** Waits this long after the last key before it searches, so typing a number sends one request. */
const SEARCH_DELAY = 300

export function StaffRoster({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const navigate = shellProps.navigation?.onNavigate
  const texts = useMessages()
  const t = texts.staffRoster
  const dates = useDateFormat()
  const session = useStaffSession()
  useDocumentTitle(t.title)
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const searchId = useId()
  const wasOffline = useRef(false)
  const result = useRef<HTMLDivElement>(null)
  // The first answer is not a change of result: only later ones (Reintentar, a search, coming back online) move focus.
  const firstAnswer = useRef(true)

  const report = useEffectEvent((error: unknown) => session.reportError(error))

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DELAY)
    return () => window.clearTimeout(timer)
  }, [query])

  // Every search is a new request, never filtered from the last answer (the list changes as people come and go).
  useEffect(() => {
    let current = true
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    apiRequest<Roster>(`/staff/roster${params.size ? `?${params}` : ''}`).then(
      (roster) => {
        if (current) setLoad({ status: 'ready', roster, search, loadedAt: Date.now(), stale: false })
      },
      (error: unknown) => {
        if (!current) return
        report(error)
        const noConnection = error instanceof ApiError && error.code === 'offline'
        // The rows on screen stay, marked as old, when the connection is lost after a first load (122:3253).
        setLoad((previous) =>
          noConnection && previous.status === 'ready' ? { ...previous, stale: true } : { status: noConnection ? 'offline' : 'error' },
        )
      },
    )
    // A late answer, for an older search, is dropped. The list on screen stays until the new one arrives.
    return () => {
      current = false
    }
  }, [search, attempt])

  // Back online: the rows from before are replaced by a fresh answer.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true
    } else if (wasOffline.current) {
      wasOffline.current = false
      setAttempt((n) => n + 1)
    }
  }, [online])

  /** The title or table of what is on screen, so a screen reader starts from the new result (WCAG 2.4.3). */
  function focusResult() {
    const target = result.current?.querySelector<HTMLElement>('.team-table, .state__title')
    if (!target) return
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1
    target.focus()
  }

  // The button or the input that had focus can be gone when the new result arrives; focus is then on the page
  // itself. Someone still typing in the search box keeps the cursor there.
  useEffect(() => {
    if (load.status === 'loading') return
    const first = firstAnswer.current
    firstAnswer.current = false
    if (!first && document.activeElement === document.body) focusResult()
  }, [load])

  const stale = load.status === 'ready' && (!online || load.stale)

  // Without connection the search box is replaced by the disabled one in the offline panel.
  useEffect(() => {
    if (stale && document.activeElement === document.body) focusResult()
  }, [stale])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const readOnly = <span className="team-chip team-chip--invited-outline">{t.readOnly}</span>

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description}>
      {notice}
      <div className="staff-roster-result" ref={result}>
        {content()}
      </div>
    </DashboardShell>
  )

  function content() {
    switch (load.status) {
      case 'loading':
        return (
          <section className="state" role="status">
            <h2 className="state__title">{t.loadingTitle}</h2>
            <p className="state__detail">{t.loadingText}</p>
            <div className="sessions-skeleton staff-roster-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        )
      case 'error':
        return (
          <section className="state state--error" role="alert">
            <h2 className="state__title">{t.errorTitle}</h2>
            <p className="state__detail">{t.errorText}</p>
            <div className="state__action">
              <Button className="state__button" onClick={retry}>
                {texts.states.retry}
              </Button>
            </div>
          </section>
        )
      case 'offline':
        // Nothing was loaded before the connection went, so there are no rows to keep.
        return <OfflineState online={online} onRetry={retry} />
    }

    const { athletes, active_count: activeCount } = load.roster

    if (stale) return offlinePanel(athletes, load.loadedAt)

    if (athletes.length === 0 && !load.search) {
      return (
        <section className="state" role="status">
          <h2 className="state__title">{t.emptyTitle}</h2>
          {readOnly}
          <p className="state__lead">{t.emptyLead}</p>
          <p className="state__detail">{t.emptyText}</p>
        </section>
      )
    }

    return (
      // One card around the search, the table and the note (121:3383), the panel S-01 uses.
      <div className="sessions-panel">
        <div className="roster-tools">
          <div className="field roster-search staff-roster-search">
            <label className="field__label" htmlFor={searchId}>
              {t.search}
            </label>
            <input
              id={searchId}
              className="field__input"
              type="search"
              autoComplete="off"
              placeholder={t.searchHint}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="roster-readonly">
            {readOnly}
            <span className="roster-readonly__count">{t.count(activeCount)}</span>
          </div>
        </div>

        {athletes.length === 0 ? <EmptyState lead={texts.roster.noMatch(load.search)} detail={texts.roster.noMatchText} /> : table(athletes)}

        <p className="roster-footnote">{t.footnote}</p>
      </div>
    )
  }

  /** The one panel of Figma 122:3253: the title, "Datos no actuales", the sentence, the disabled search and the old rows as cards. */
  function offlinePanel(athletes: StaffAthlete[], loadedAt: number) {
    return (
      <section className="state staff-roster-offline" role="status">
        <h2 className="state__title">{texts.states.offlineTitle}</h2>
        <span className="team-chip team-chip--invited-outline staff-roster-offline__chip">{texts.activeSessions.staleChip}</span>
        <p className="state__detail staff-roster-offline__text">{t.offlineText(dates.time(new Date(loadedAt)))}</p>
        <div className="field staff-roster-offline__search">
          <label className="field__label" htmlFor={searchId}>
            {t.offlineSearch}
          </label>
          <input
            id={searchId}
            className="field__input"
            type="search"
            autoComplete="off"
            placeholder={t.offlineSearchHint}
            disabled
            value={query}
            readOnly
          />
        </div>
        <ul className="staff-roster-cards">
          {athletes.map((athlete) => (
            <li key={athlete.id} className="staff-roster-card">
              <strong className="staff-roster-card__name">{athlete.name}</strong>
              <span className="staff-roster-card__meta">{`${athlete.student_number} · ${athlete.sport}`}</span>
              {action(athlete)}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  function table(athletes: StaffAthlete[]) {
    return (
      // Scrolls sideways on a narrow window; tabIndex lets the keyboard scroll it too (WCAG 2.1.1).
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      <div className="team-table" role="region" aria-label={t.title} tabIndex={0}>
        <table className="staff-roster-table" aria-label={t.title}>
          <thead>
            <tr>
              <th scope="col">{t.columns.name}</th>
              <th scope="col">{t.columns.studentNumber}</th>
              <th scope="col">{t.columns.sport}</th>
              <th scope="col">{t.columns.action}</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id}>
                <td>{athlete.name}</td>
                <td>{athlete.student_number}</td>
                <td>{athlete.sport}</td>
                <td>{action(athlete)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  /** "Entrada registrada" with the time for an athlete who is inside (4265:2957); otherwise the Check in button. */
  function action(athlete: StaffAthlete) {
    if (athlete.active_session) {
      return (
        <div className="roster-entry">
          <span className="team-chip team-chip--active">{t.registered}</span>
          <span className="roster-entry__time">{t.registeredAt(dates.time(athlete.active_session.started_at))}</span>
        </div>
      )
    }
    // The name tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
    const label = `${t.checkIn}, ${athlete.name}`
    if (stale) {
      return (
        <Button variant="secondary" aria-label={label} aria-disabled="true">
          {t.checkIn}
        </Button>
      )
    }
    return (
      <StaffLink
        href={findPersonPath(athlete.student_number)}
        navigate={navigate}
        className="button button--secondary"
        aria-label={label}
      >
        {t.checkIn}
      </StaffLink>
    )
  }
}
