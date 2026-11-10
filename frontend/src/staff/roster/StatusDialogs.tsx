import { useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, Modal } from '../../components'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { TermChip } from '../team/TermStatus'
import type { Athlete } from './AthleteRoster'

// "Retirar" (Figma 101:1221) and "Restituir" (101:1248, 101:1285, 101:1383) on A-05, #21. The backend revokes or
// reactivates the authorization; these dialogs only ask and report.

type StatusDialogProps = {
  athlete: Athlete
  onClose: () => void
  onDone: (athlete: Athlete) => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

/**
 * Someone else changed the athlete, or a race left the athlete with an active authorization already: the pink error
 * banner (Figma 4745:2133, E-188). Other refusals keep the neutral notice.
 */
function changedTone(problem: ApiError | null) {
  return problem?.code === 'roster_status_changed' || problem?.code === 'roster_reinstate_active_authorization' ? 'error' : undefined
}

/** Sends one POST at a time and keeps the refusal to show it. */
function useSend(onError: (error: unknown) => void) {
  const busy = useRef(false)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)

  async function send<T>(path: string, body?: Record<string, unknown>): Promise<T | ApiError> {
    busy.current = true
    setSending(true)
    setProblem(null)
    try {
      return await apiRequest<T>(path, { method: 'POST', body })
    } catch (error) {
      onError(error)
      return error instanceof ApiError ? error : new ApiError('server_error', 500)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return { busy, sending, problem, setProblem, send }
}

export function WithdrawDialog({ athlete, onClose, onDone, onError }: StatusDialogProps) {
  const t = useMessages().roster
  const online = useConnection()
  const titleId = useId()
  const { busy, sending, problem, setProblem, send } = useSend(onError)

  async function withdraw() {
    if (busy.current || !online) return
    const result = await send<{ athlete: Athlete }>(`/staff/roster/${athlete.id}/withdraw`)
    if (result instanceof ApiError) setProblem(result)
    else onDone(result.athlete)
  }

  return (
    <Modal labelledBy={titleId} onClose={() => !busy.current && onClose()}>
      <div className="modal__body">
        <TermChip className="roster-modal-chip" />
        <h2 className="modal__title" id={titleId}>
          {t.withdrawTitle(athlete.name)}
        </h2>
        <p className="modal__text">{t.withdrawText}</p>
        <p className="roster-meta">{t.withdrawMeta(athlete.student_number, athlete.sport)}</p>
        <ProblemNotice problem={problem} tone={changedTone(problem)} />
        <div className="modal__actions">
          <Button aria-disabled={sending || !online || undefined} onClick={() => void withdraw()}>
            {t.withdrawConfirm}
          </Button>
          <Button variant="secondary" onClick={() => !busy.current && onClose()}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const MIN_REASON = 10

export function ReinstateDialog({ athlete, onClose, onDone, onError }: StatusDialogProps) {
  const t = useMessages().roster
  const online = useConnection()
  const titleId = useId()
  const reasonId = useId()
  const hintId = `${reasonId}-hint`
  const [reason, setReason] = useState('')
  // Set after a try with a short reason: the title, text and counter change (101:1285).
  const [tooShort, setTooShort] = useState(false)
  const [refusedTerm, setRefusedTerm] = useState<string | null>(null)
  const reasonRef = useRef<HTMLInputElement>(null)
  const refusedRef = useRef<HTMLHeadingElement>(null)
  const { busy, sending, problem, setProblem, send } = useSend(onError)
  const length = reason.trim().length

  async function reinstate(event: FormEvent) {
    event.preventDefault()
    if (busy.current || !online) return
    if (length < MIN_REASON) {
      setTooShort(true)
      reasonRef.current?.focus()
      return
    }
    const result = await send<{ athlete: Athlete }>(`/staff/roster/${athlete.id}/reinstate`, { reason: reason.trim() })
    if (!(result instanceof ApiError)) {
      onDone(result.athlete)
      return
    }
    // Its details name the term of the other authorization, not field rules (api-conventions). A race refusal
    // sends none, and the view would read "activa en .", so the plain error shows instead.
    const term = result.details?.term as unknown as { name?: string } | undefined
    if (result.code === 'roster_reinstate_active_authorization' && term?.name) {
      setRefusedTerm(term.name)
      requestAnimationFrame(() => refusedRef.current?.focus())
      return
    }
    if (result.code === 'validation_failed' && result.details?.reason) {
      setTooShort(true)
      reasonRef.current?.focus()
      return
    }
    setProblem(result)
  }

  if (refusedTerm !== null) {
    return (
      <Modal labelledBy={titleId} onClose={onClose}>
        <div className="modal__body">
          <TermChip className="roster-modal-chip" />
          <h2 className="modal__title" id={titleId} ref={refusedRef} tabIndex={-1}>
            {t.refusedTitle}
          </h2>
          <p className="modal__text">{t.refusedText(athlete.name, refusedTerm)}</p>
          <div className="modal__actions">
            <Button variant="secondary" onClick={onClose}>
              {t.close}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const short = tooShort && length < MIN_REASON

  return (
    <Modal labelledBy={titleId} onClose={() => !busy.current && onClose()}>
      <form className="modal__body" noValidate onSubmit={reinstate}>
        <TermChip className="roster-modal-chip" />
        {/* Live, because after a short reason sent with Enter focus stays in the field and nothing else announces the change. */}
        <h2 className="modal__title" id={titleId} aria-live="polite">
          {short ? t.shortTitle : t.reinstateTitle(athlete.name)}
        </h2>
        <p className="modal__text" aria-live="polite">
          {short ? t.shortText : t.reinstateText}
        </p>
        <ProblemNotice problem={problem} tone={changedTone(problem)} />
        <div className="field">
          <label className="field__label" htmlFor={reasonId}>
            {t.reason}
          </label>
          <input
            ref={reasonRef}
            id={reasonId}
            className="field__input"
            autoComplete="off"
            required
            maxLength={1000}
            value={reason}
            aria-invalid={short || undefined}
            aria-describedby={hintId}
            onChange={(event) => setReason(event.target.value)}
          />
          <p id={hintId} className={short ? 'roster-reason-hint roster-reason-hint--short' : 'roster-reason-hint'}>
            {short ? t.reasonCount(length) : t.reasonHint}
          </p>
        </div>
        <div className="modal__actions">
          <Button type="submit" aria-disabled={sending || short || !online || undefined}>
            {t.reinstateConfirm}
          </Button>
          <Button variant="secondary" onClick={() => !busy.current && onClose()}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
