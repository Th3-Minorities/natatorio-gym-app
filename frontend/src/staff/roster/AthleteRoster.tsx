import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, EmptyState, ErrorState, LoadingState, OfflineState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import type { ShellProps } from '../team/StaffTeam'
import { TermStatus } from '../team/TermStatus'
import { AthleteDialog } from './AthleteDialog'
import { DownloadDialog } from './DownloadDialog'
import { ReinstateDialog, WithdrawDialog } from './StatusDialogs'
import '../team/staffTeam.css'
import './roster.css'

// A-05 "Roster de atletas" (Figma 4007:1535, 4007:1918, 4007:2301 and the states in section 170:1373, #21). Only
// Administrators reach it; the API checks the role too. Staff get their read-only roster in S-05 (#26).

export type Athlete = {
  id: number
  name: string
  sport: string
  student_number: string
  institutional_email: string
  status: 'active' | 'withdrawn'
}

type Roster = { athletes: Athlete[]; active_count: number }

type Load = { status: 'loading' } | { status: 'error' } | { status: 'offline' } | { status: 'ready'; roster: Roster; search: string }

/** Add, or edit one athlete. */
type Editing = { athlete: Athlete | null }

type StatusChange = { kind: 'withdraw' | 'reinstate'; athlete: Athlete }

/** Waits this long after the last key before it searches, so typing a number sends one request. */
const SEARCH_DELAY = 300

export function AthleteRoster({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const texts = useMessages()
  const t = texts.roster
  const session = useStaffSession()
  useDocumentTitle(t.title)
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // Activo and Retirado can be on together (4007:2301); one always stays on.
  const [filters, setFilters] = useState({ active: true, withdrawn: false })
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [saved, setSaved] = useState('')
  // The row whose first action gets focus once the list reloads, since the button pressed is gone.
  const focusRow = useRef<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const emptyId = useId()
  const searchId = useId()

  useEffect(() => {
    if (load.status !== 'ready' || focusRow.current === null) return
    const target = tableRef.current?.querySelector<HTMLElement>(`tr[data-athlete="${focusRow.current}"] button`)
    focusRow.current = null
    ;(target ?? tableRef.current)?.focus()
  }, [load])

  const report = useEffectEvent((error: unknown) => session.reportError(error))
  const status = filters.active && filters.withdrawn ? 'all' : filters.active ? 'active' : 'withdrawn'

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DELAY)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let current = true
    const params = new URLSearchParams({ status })
    if (search) params.set('search', search)
    apiRequest<Roster>(`/staff/roster?${params}`).then(
      (roster) => {
        if (current) setLoad({ status: 'ready', roster, search })
      },
      (error: unknown) => {
        if (!current) return
        report(error)
        setLoad({ status: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error' })
      },
    )
    // A late answer, for an older filter or search, is dropped. The list on screen stays until the new one arrives.
    return () => {
      current = false
    }
  }, [status, search, attempt])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  function toggle(filter: 'active' | 'withdrawn') {
    setFilters((current) => {
      const next = { ...current, [filter]: !current[filter] }
      return next.active || next.withdrawn ? next : current
    })
  }

  function open(athlete: Athlete | null) {
    if (!online) return
    setSaved('')
    setEditing({ athlete })
  }

  function openStatus(kind: StatusChange['kind'], athlete: Athlete) {
    if (!online) return
    setSaved('')
    setStatusChange({ kind, athlete })
  }

  function statusChanged(kind: StatusChange['kind'], athlete: Athlete) {
    setStatusChange(null)
    setSaved(kind === 'withdraw' ? t.withdrawn(athlete.name) : t.reinstated(athlete.name))
    focusRow.current = athlete.id
    setAttempt((n) => n + 1)
  }

  function edited(athlete: Athlete) {
    setEditing(null)
    setSaved(t.saved(athlete.name))
    setAttempt((n) => n + 1)
  }

  const addButton = (
    <Button aria-disabled={!online || undefined} onClick={() => open(null)}>
      {t.add}
    </Button>
  )

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description}>
      {notice}
      {editing && (
        <AthleteDialog
          athlete={editing.athlete}
          onClose={() => setEditing(null)}
          onAdded={() => setAttempt((n) => n + 1)}
          onEdited={edited}
          onError={(error) => session.reportError(error)}
        />
      )}
      {statusChange &&
        (() => {
          const Change = statusChange.kind === 'withdraw' ? WithdrawDialog : ReinstateDialog
          return (
            <Change
              athlete={statusChange.athlete}
              onClose={() => setStatusChange(null)}
              onDone={(athlete) => statusChanged(statusChange.kind, athlete)}
              onError={(error) => {
                session.reportError(error)
                // Someone else changed the athlete: show what it is now, behind the modal.
                if (error instanceof ApiError && error.status === 409) setAttempt((n) => n + 1)
              }}
            />
          )
        })()}
      {downloading && (
        <DownloadDialog
          onClose={() => setDownloading(false)}
          onDownloaded={() => {
            setDownloading(false)
            setSaved(t.downloaded)
          }}
          onError={(error) => session.reportError(error)}
        />
      )}
      <div className="roster-context">
        <TermStatus text={t.continuous} />
        <div className="roster-context__actions">
          <Button
            variant="secondary"
            aria-disabled={!online || undefined}
            onClick={() => {
              if (!online) return
              setSaved('')
              setDownloading(true)
            }}
          >
            {t.download}
          </Button>
          {addButton}
        </div>
      </div>
      {/* One live region that is always on the page: a region added together with its text is often not read (WCAG 4.1.3). */}
      <div className="team-live" role="status">
        {saved && <p className="roster-saved">{saved}</p>}
        {load.status === 'ready' && !online && (
          <section className="state">
            <h2 className="state__title">{texts.states.offlineTitle}</h2>
            <p className="state__detail">{t.offlineText}</p>
          </section>
        )}
      </div>
      {content()}
    </DashboardShell>
  )

  function content() {
    switch (load.status) {
      case 'loading':
        return <LoadingState title={t.loadingTitle} detail={t.loadingText} />
      case 'error':
        return <ErrorState onRetry={retry} />
      case 'offline':
        return <OfflineState online={online} onRetry={retry} />
    }

    const { athletes, active_count: activeCount } = load.roster

    return (
      <>
        <p className="team-summary">{t.activeCount(activeCount)}</p>

        <div className="roster-tools">
          <div className="field roster-search">
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
          {(['active', 'withdrawn'] as const).map((filter) => (
            <Button
              key={filter}
              variant={filters[filter] ? 'primary' : 'secondary'}
              className="roster-filter"
              aria-pressed={filters[filter]}
              onClick={() => toggle(filter)}
            >
              {filter === 'active' ? t.filterActive : t.filterWithdrawn}
            </Button>
          ))}
        </div>

        {athletes.length === 0 ? empty() : table(athletes)}

        <section className="team-note">
          <h2 className="team-note__title">{t.noteTitle}</h2>
          <p className="team-note__text">{t.noteText}</p>
        </section>
      </>
    )
  }

  function empty() {
    if (load.status === 'ready' && load.search) {
      return <EmptyState lead={t.noMatch(load.search)} detail={t.noMatchText} />
    }
    return (
      <section className="state" aria-labelledby={emptyId}>
        <h2 className="state__title" id={emptyId}>
          {t.emptyTitle}
        </h2>
        <p className="state__detail">{t.emptyText}</p>
        <div className="state__action">{addButton}</div>
      </section>
    )
  }

  /** Editar and Retirar for an active athlete, Restituir for a withdrawn one (4007:2301). */
  function actions(athlete: Athlete) {
    const action = (label: string, onClick: () => void) => (
      <Button
        key={label}
        variant="link"
        className="team-action"
        // The name tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
        aria-label={`${label}, ${athlete.name}`}
        aria-disabled={!online || undefined}
        onClick={onClick}
      >
        {label}
      </Button>
    )
    if (athlete.status === 'withdrawn') return action(t.reinstate, () => openStatus('reinstate', athlete))
    return [action(t.edit, () => open(athlete)), action(t.withdraw, () => openStatus('withdraw', athlete))]
  }

  function table(athletes: Athlete[]) {
    return (
      // Scrolls sideways on a narrow window; tabIndex lets the keyboard scroll it too (WCAG 2.1.1).
      <div className="team-table" role="region" aria-label={t.tableTitle} tabIndex={0} ref={tableRef}>
        <table className="roster-table" aria-label={t.tableTitle}>
          <thead>
            <tr>
              <th scope="col">{t.columns.name}</th>
              <th scope="col">{t.columns.sport}</th>
              <th scope="col">{t.columns.studentNumber}</th>
              <th scope="col">{t.columns.email}</th>
              <th scope="col">{t.columns.status}</th>
              <th scope="col">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id} data-athlete={athlete.id}>
                <td>{athlete.name}</td>
                <td>{athlete.sport}</td>
                <td>{athlete.student_number}</td>
                <td>{athlete.institutional_email}</td>
                <td>
                  <span className={`team-chip roster-chip--${athlete.status}`}>{t.status[athlete.status]}</span>
                </td>
                <td>
                  <div className="team-actions">{actions(athlete)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}
