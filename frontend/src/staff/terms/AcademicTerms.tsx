import { useEffect, useEffectEvent, useId, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, ErrorState, LoadingState, OfflineState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import type { ShellProps } from '../team/StaffTeam'
import { TermDialog } from './TermDialog'
import '../team/staffTeam.css'
import './terms.css'

// A-04 "Términos" (Figma 101:1526, 4007:1310 and the states in section 170:1373, #21). Only Administrators reach
// it; the API checks the role too. Terms are never deleted (E-107), so there is no delete action.

export type Term = {
  id: number
  name: string
  starts_on: string
  ends_on: string
  status: 'active' | 'upcoming' | 'past'
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'offline' } | { status: 'ready'; terms: Term[] }

/** Create, or edit one term. */
type Editing = { term: Term | null }

export function AcademicTerms({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const texts = useMessages()
  const t = texts.terms
  const session = useStaffSession()
  const format = useDateFormat()
  useDocumentTitle(t.title)
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [saved, setSaved] = useState('')
  const currentId = useId()
  const pastId = useId()
  const emptyId = useId()
  const noActiveId = useId()

  // An ended sign-in goes back to N-11. useEffectEvent keeps the session's checks from reloading the list.
  const report = useEffectEvent((error: unknown) => session.reportError(error))

  useEffect(() => {
    let current = true
    apiRequest<{ terms: Term[] }>('/staff/terms').then(
      ({ terms }) => {
        if (current) setLoad({ status: 'ready', terms })
      },
      (error: unknown) => {
        if (!current) return
        report(error)
        setLoad({ status: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error' })
      },
    )
    // A late answer, for a screen that is gone or an older try, is dropped.
    return () => {
      current = false
    }
  }, [attempt])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  function open(term: Term | null) {
    if (!online) return
    setSaved('')
    setEditing({ term })
  }

  function done(term: Term) {
    setEditing(null)
    setSaved(t.saved(term.name))
    // The list behind stays on screen until the new one arrives.
    setAttempt((n) => n + 1)
  }

  const terms = load.status === 'ready' ? load.terms : []
  const active = terms.find((term) => term.status === 'active') ?? null
  const action = (
    <Button aria-disabled={!online || undefined} onClick={() => open(null)}>
      {t.create}
    </Button>
  )

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description} action={action}>
      {notice}
      {editing && (
        <TermDialog
          term={editing.term}
          activeName={active?.name ?? null}
          onClose={() => setEditing(null)}
          onSaved={done}
          onError={(error) => session.reportError(error)}
        />
      )}
      {/* One live region that is always on the page: a region added together with its text is often not read (WCAG 4.1.3). */}
      <div className="team-live" role="status">
        {saved && <p className="terms-saved">{saved}</p>}
        {load.status === 'ready' && !online && (
          <section className="state">
            <h2 className="state__title">{texts.states.offlineTitle}</h2>
            <p className="state__detail">{texts.staffTeam.offlineText}</p>
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

    if (terms.length === 0) {
      return (
        <section className="state" aria-labelledby={emptyId}>
          <h2 className="state__title" id={emptyId}>
            {t.emptyTitle}
          </h2>
          <p className="state__detail">{t.emptyText}</p>
          <div className="state__action">
            <Button aria-disabled={!online || undefined} onClick={() => open(null)}>
              {t.create}
            </Button>
          </div>
        </section>
      )
    }

    const current = terms.filter((term) => term.status !== 'past')
    const past = terms.filter((term) => term.status === 'past')

    return (
      <>
        {active ? (
          <div className="terms-context">
            <span className="team-chip team-chip--invited-outline">{t.activeChip}</span>
            <span className="terms-context__name">{active.name}</span>
          </div>
        ) : (
          <section className="state" aria-labelledby={noActiveId}>
            <span className="team-chip team-chip--invited-outline">{t.noActiveChip}</span>
            <h2 className="state__title" id={noActiveId}>
              {t.noActiveTitle}
            </h2>
            <p className="state__detail">{t.noActiveText}</p>
          </section>
        )}

        {current.length > 0 && (
          <>
            <div className="team-bar">
              <h2 className="team-bar__title" id={currentId}>
                {t.currentTitle}
              </h2>
              <p className="terms-hint">{t.currentHint}</p>
            </div>
            {table(current, currentId)}
          </>
        )}

        {past.length > 0 && (
          <Button variant="link" className="terms-toggle" aria-expanded={showPast} onClick={() => setShowPast((shown) => !shown)}>
            {showPast ? t.hidePast : t.showPast}
          </Button>
        )}

        {showPast && past.length > 0 && (
          <>
            <div className="team-bar">
              <h2 className="team-bar__title" id={pastId}>
                {t.pastTitle}
              </h2>
            </div>
            {table(past, pastId)}
          </>
        )}

        <section className="team-note">
          <h2 className="team-note__title">{t.noteTitle}</h2>
          <p className="team-note__text">{t.noteText}</p>
        </section>
      </>
    )
  }

  function table(list: Term[], titleId: string) {
    return (
      // Scrolls sideways on a narrow window; tabIndex lets the keyboard scroll it too (WCAG 2.1.1).
      <div className="team-table" role="region" aria-labelledby={titleId} tabIndex={0}>
        <table className="terms-table" aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">{t.columns.name}</th>
              <th scope="col">{t.columns.startsOn}</th>
              <th scope="col">{t.columns.endsOn}</th>
              <th scope="col">{t.columns.status}</th>
              <th scope="col">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((term) => (
              <tr key={term.id}>
                <td>{term.name}</td>
                <td>{format.date(term.starts_on)}</td>
                <td>{format.date(term.ends_on)}</td>
                <td>
                  <span className={`team-chip terms-chip--${term.status}`}>{t.status[term.status]}</span>
                </td>
                <td>
                  <Button
                    variant="link"
                    className="team-action"
                    // The name tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
                    aria-label={`${t.edit}, ${term.name}`}
                    aria-disabled={!online || undefined}
                    onClick={() => open(term)}
                  >
                    {t.edit}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}
