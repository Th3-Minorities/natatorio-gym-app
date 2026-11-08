import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, Modal, TextField } from '../../components'
import { useDateFormat } from '../../format/dateTime'
import { fieldErrorText, useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import type { Term } from './AcademicTerms'

// "Crear término" and "Editar término" (Figma 101:1737, 101:1793), with "Fecha inválida" (101:1850),
// "Solapamiento" (101:1884) and "Sin conexión" (101:1935), #21.

type Field = 'name' | 'starts_on' | 'ends_on'
type Values = Record<Field, string>
type FieldErrors = Partial<Record<Field, string>>
type Overlap = { name: string; starts_on: string; ends_on: string }
type View = { kind: 'form' } | { kind: 'order' } | { kind: 'overlap'; term: Overlap }

type TermDialogProps = {
  /** The term to edit, or null to create one. */
  term: Term | null
  /** The active term's name, drawn as a chip at the top of every modal. */
  activeName: string | null
  onClose: () => void
  onSaved: (term: Term) => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function TermDialog({ term, activeName, onClose, onSaved, onError }: TermDialogProps) {
  const texts = useMessages()
  const t = texts.terms
  const format = useDateFormat()
  const online = useConnection()
  const titleId = useId()
  const [values, setValues] = useState<Values>({
    name: term?.name ?? '',
    starts_on: term?.starts_on ?? '',
    ends_on: term?.ends_on ?? '',
  })
  const [view, setView] = useState<View>({ kind: 'form' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [sending, setSending] = useState(false)
  // Where focus goes after a change of view or a refusal, read by the effect below. Nothing on the first render:
  // the dialog itself puts focus on its first field.
  const [focus, setFocus] = useState<{ to: Field | 'title'; count: number } | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const startsRef = useRef<HTMLInputElement>(null)
  const endsRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // The guard against a second send; the button is aria-disabled, so it keeps keyboard focus.
  const busy = useRef(false)

  useEffect(() => {
    if (!focus) return
    const target = { name: nameRef, starts_on: startsRef, ends_on: endsRef, title: titleRef }[focus.to]
    target.current?.focus()
  }, [focus])

  function moveFocus(to: Field | 'title') {
    setFocus((current) => ({ to, count: (current?.count ?? 0) + 1 }))
  }

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy.current || !online) return
    busy.current = true
    setSending(true)
    setProblem(null)
    try {
      const { term: saved } = await apiRequest<{ term: Term }>(term ? `/staff/terms/${term.id}` : '/staff/terms', {
        method: term ? 'PATCH' : 'POST',
        body: values,
      })
      onSaved(saved)
    } catch (error) {
      onError(error)
      refused(error)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  function refused(error: unknown) {
    const apiError = error instanceof ApiError ? error : new ApiError('server_error', 500)
    if (apiError.code === 'term_overlap' && apiError.details?.term) {
      setErrors({})
      // term_overlap's details hold the other term, not field rules (api-conventions).
      setView({ kind: 'overlap', term: apiError.details.term as unknown as Overlap })
      moveFocus('title')
      return
    }
    const details = apiError.code === 'validation_failed' ? (apiError.details ?? {}) : {}
    if (details.ends_on?.includes('after_or_equal')) {
      setErrors({})
      setView({ kind: 'order' })
      moveFocus('title')
      return
    }
    const found: FieldErrors = {}
    for (const field of ['name', 'starts_on', 'ends_on'] as const) {
      const rule = details[field]?.[0]
      if (rule) found[field] = fieldErrorText(texts, rule)
    }
    setErrors(found)
    const first = (['name', 'starts_on', 'ends_on'] as const).find((field) => found[field])
    if (first) moveFocus(first)
    else setProblem(apiError)
  }

  /** Esc and Cancelar close the dialog only when nothing is being saved. */
  function close() {
    if (!busy.current) onClose()
  }

  function fixDates() {
    setView({ kind: 'form' })
    moveFocus('starts_on')
  }

  const chip = activeName && <span className="team-chip team-chip--invited-outline terms-modal-chip">{activeName}</span>

  const dateField = (field: 'starts_on' | 'ends_on', invalid = false) => (
    <TextField
      ref={field === 'starts_on' ? startsRef : endsRef}
      label={field === 'starts_on' ? t.startsOn : t.endsOn}
      type="date"
      required
      value={values[field]}
      error={errors[field]}
      aria-invalid={invalid || undefined}
      onChange={(event) => set(field, event.target.value)}
    />
  )

  if (view.kind !== 'form') {
    const overlap = view.kind === 'overlap' ? view.term : null
    return (
      <Modal labelledBy={titleId} onClose={close}>
        <div className="modal__body">
          {chip}
          <h2 className="modal__title" id={titleId} ref={titleRef} tabIndex={-1}>
            {overlap ? t.overlapTitle : t.orderTitle}
          </h2>
          <p className="modal__text">
            {overlap
              ? t.overlapText(overlap.name, format.date(overlap.starts_on), format.date(overlap.ends_on))
              : t.orderText}
          </p>
          {dateField('starts_on', Boolean(overlap))}
          {dateField('ends_on', true)}
          <div className="modal__actions">
            <Button variant="secondary" onClick={fixDates}>
              {t.fixDates}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <form className="modal__body" noValidate onSubmit={save}>
        {chip}
        <h2 className="modal__title" id={titleId}>
          {term ? t.editTitle : t.createTitle}
        </h2>
        <p className="modal__text">{term ? term.name : t.createText}</p>
        {!online && (
          <section className="state">
            <h3 className="state__title">{texts.states.offlineTitle}</h3>
            <p className="state__detail">{t.offlineText}</p>
          </section>
        )}
        <ProblemNotice problem={problem} />
        <TextField
          ref={nameRef}
          label={t.name}
          autoComplete="off"
          required
          maxLength={50}
          value={values.name}
          error={errors.name}
          onChange={(event) => set('name', event.target.value)}
        />
        {dateField('starts_on')}
        {dateField('ends_on')}
        {term && DAY.test(values.ends_on) && <p className="terms-edit-note">{t.editNote(format.date(values.ends_on))}</p>}
        <div className="modal__actions">
          <Button type="submit" aria-disabled={sending || !online || undefined}>
            {term ? t.saveChanges : t.saveNew}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
