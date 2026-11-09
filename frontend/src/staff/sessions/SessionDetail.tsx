import { useEffect, useEffectEvent, useId, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, LoadingState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { minutesBetween } from '../people/personText'
import { ConfirmDialog } from '../people/StaffParts'
import { PersonCard, type Person } from '../people/PersonCard'
import type { ShellProps } from '../team/StaffTeam'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import '../team/staffTeam.css'
import './activeSessions.css'

// S-02 "Persona y sesión" (Figma 121:3142 and its states, #26): who the visit belongs to, what Staff may see
// (REQ-NF-19), and the corrections on an active visit (REQ-F-48) and the photo-pending mark (REQ-F-94).

type SessionStatus = 'active' | 'checked_out' | 'ended_early' | 'void' | 'expired' | 'closed'

type Detail = {
  session: { id: number; started_at: string; status: SessionStatus; ended_at: string | null }
  person: Person & { emergency_contact: { name: string; phone: string } | null }
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; detail: Detail }

type Action = 'check-out' | 'end-early' | 'void' | 'pending'

const DONE: Record<Exclude<Action, 'pending'>, 'checked_out' | 'ended_early' | 'void'> = {
  'check-out': 'checked_out',
  'end-early': 'ended_early',
  void: 'void',
}

export function SessionDetail({ shell, sessionId }: { shell: ShellProps; sessionId: number }) {
  const { notice, ...shellProps } = shell
  const texts = useMessages()
  const t = texts.sessionDetail
  const dates = useDateFormat()
  useDocumentTitle(t.title)
  const online = useConnection()
  const session = useStaffSession()
  const report = useEffectEvent((error: unknown) => session.reportError(error))
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [asking, setAsking] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [changed, setChanged] = useState(false)
  const [message, setMessage] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const sessionTitleId = useId()
  const changedId = useId()
  const pendingId = useId()

  useEffect(() => {
    let current = true
    apiRequest<Detail>(`/staff/sessions/${sessionId}`).then(
      (detail) => {
        if (!current) return
        setUpdatedAt(new Date().toISOString())
        setLoad({ status: 'ready', detail })
      },
      (error: unknown) => {
        if (!current) return
        report(error)
        // A reload behind the page keeps what is shown; only a first load shows the error.
        setLoad((before) => (before.status === 'ready' ? before : { status: 'error' }))
      },
    )
    return () => {
      current = false
    }
  }, [sessionId, attempt])

  async function act() {
    if (!asking || busy || load.status !== 'ready') return
    const { detail } = load
    setBusy(true)
    setProblem(null)
    try {
      if (asking === 'pending') {
        await apiRequest(`/staff/people/${detail.person.user_id}/photo-pending`, { method: 'POST' })
        setMessage(t.done.pending)
      } else {
        await apiRequest(`/staff/sessions/${detail.session.id}/${asking}`, { method: 'POST' })
        setMessage(t.done[DONE[asking]])
      }
      setChanged(false)
      setAsking(null)
    } catch (error) {
      session.reportError(error)
      const apiError = error instanceof ApiError ? error : new ApiError('server_error', 500)
      if (apiError.status === 409 && asking !== 'pending') {
        // Ended or changed elsewhere (122:3141): say so on the page, not in the dialog.
        setChanged(true)
        setAsking(null)
      } else {
        setProblem(apiError)
      }
    } finally {
      setBusy(false)
      setAttempt((n) => n + 1)
    }
  }

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description}>
      {notice}
      {dialog()}
      {/* One live region that stays on the page, so a new message is read out (WCAG 4.1.3). */}
      <div role="status" className="sessions-live">
        {message && <p className="sessions-message">{message}</p>}
        {!online && load.status === 'ready' && updatedAt && <p className="sessions-message">{t.offlineText(dates.time(updatedAt))}</p>}
      </div>
      {changed && (
        <section className="notice notice--error" aria-labelledby={changedId}>
          <h2 className="notice__title" id={changedId}>
            {t.changedTitle}
          </h2>
          <p className="notice__text">{t.changedText}</p>
          <p className="notice__text">{t.changedHint}</p>
        </section>
      )}
      {content()}
    </DashboardShell>
  )

  function content() {
    if (load.status === 'loading') return <LoadingState title={t.loadingTitle} detail={t.loadingText} />
    if (load.status === 'error') {
      return (
        <section className="state state--error" role="alert">
          <h2 className="state__title">{t.errorTitle}</h2>
          <p className="state__detail">{t.errorText}</p>
          <Button
            className="state__button"
            onClick={() => {
              setLoad({ status: 'loading' })
              setAttempt((n) => n + 1)
            }}
          >
            {texts.states.retry}
          </Button>
        </section>
      )
    }

    const { session: visit, person } = load.detail
    const active = visit.status === 'active'
    const emergency = person.emergency_contact

    return (
      <>
        <PersonCard
          person={person}
          photo={person.has_photo ? `/api/staff/sessions/${visit.id}/photo` : null}
          extra={
            emergency && (
              <>
                <p className="person-card__label">{t.emergency}</p>
                <p className="person-card__line">{`${emergency.name} · ${emergency.phone}`}</p>
              </>
            )
          }
        />

        <section className="session-card" aria-labelledby={sessionTitleId}>
          <div className="session-card__head">
            <h2 className="session-card__title" id={sessionTitleId}>
              {active ? t.currentSession : t.endedSession}
            </h2>
            <span className={active ? 'team-chip team-chip--active' : 'team-chip team-chip--deactivated'}>
              {active ? t.activeChip : t.ended[visit.status as keyof typeof t.ended]}
            </span>
          </div>
          <dl className="session-card__facts">
            <div>
              <dt>{t.checkIn}</dt>
              <dd>{dates.dateTime(visit.started_at)}</dd>
            </div>
            {active ? (
              <div>
                <dt>{t.inside}</dt>
                <dd>{texts.activeSessions.minutes(minutesBetween(visit.started_at))}</dd>
              </div>
            ) : (
              visit.ended_at && (
                <div>
                  <dt>{t.exit}</dt>
                  <dd>{dates.dateTime(visit.ended_at)}</dd>
                </div>
              )
            )}
          </dl>
          {active && (
            <>
              <p className="session-card__rule">{texts.activeSessions.closeRule}</p>
              <div className="session-card__actions">
                {(['check-out', 'end-early', 'void'] as const).map((action, index) => (
                  <Button
                    key={action}
                    variant={index === 0 ? 'primary' : 'secondary'}
                    aria-disabled={!online || undefined}
                    onClick={() => online && open(action)}
                  >
                    {{ 'check-out': t.checkOut, 'end-early': t.endEarly, void: t.void }[action]}
                  </Button>
                ))}
              </div>
            </>
          )}
        </section>

        {person.photo_pending ? (
          <section className="photo-question photo-question--pending" aria-labelledby={pendingId}>
            <h2 className="photo-question__title" id={pendingId}>
              {t.pendingTitle}
            </h2>
            <p className="photo-question__text">{t.pendingText}</p>
          </section>
        ) : (
          person.authorization.current && (
            <section className="photo-question" aria-labelledby={pendingId}>
              <div>
                <h2 className="photo-question__title" id={pendingId}>
                  {t.photoQuestion}
                </h2>
                <p className="photo-question__text">{t.photoQuestionText}</p>
              </div>
              <Button className="button--danger" aria-disabled={!online || undefined} onClick={() => online && open('pending')}>
                {t.markPending}
              </Button>
            </section>
          )
        )}
      </>
    )
  }

  function open(action: Action) {
    setMessage('')
    setProblem(null)
    setAsking(action)
  }

  function dialog() {
    if (!asking || load.status !== 'ready') return null
    const name = load.detail.person.name ?? ''
    const meta = load.detail.person.student_number ? t.studentNumber(load.detail.person.student_number) : undefined
    const common = {
      meta,
      busy,
      problem: <ProblemNotice problem={problem} tone="error" />,
      onConfirm: () => void act(),
      onClose: () => setAsking(null),
    }
    switch (asking) {
      case 'check-out':
        return <ConfirmDialog {...common} title={t.checkOutTitle(name)} text={t.checkOutText} confirm={t.checkOut} />
      case 'end-early':
        return <ConfirmDialog {...common} title={t.endEarlyTitle(name)} text={t.endEarlyText} confirm={t.endEarlyConfirm} />
      case 'void':
        return <ConfirmDialog {...common} title={t.voidTitle(name)} text={t.voidText} confirm={t.voidConfirm} danger />
      case 'pending':
        return (
          <ConfirmDialog
            {...common}
            title={t.pendingConfirmTitle(name)}
            text={t.pendingConfirmText}
            note={t.pendingConfirmNote}
            confirm={t.pendingConfirm}
            danger
          />
        )
    }
  }
}
