import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, Modal, TextField } from '../../components'
import { fieldErrorText, useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { TermChip } from '../team/TermStatus'
import type { Athlete } from './AthleteRoster'

// "Añadir atleta" with the quick form (Figma 101:1084, 101:1150), "Editar atleta" (101:1314), "Número repetido"
// (101:1380) and "Sin conexión" (101:1403), #21. Adding keeps the form open for the next athlete, with the same sport.

type Field = 'name' | 'sport' | 'student_number' | 'institutional_email'
type Values = Record<Field, string>
type FieldErrors = Partial<Record<Field, string>>
type View = { kind: 'form' } | { kind: 'taken'; number: string; name: string }

const FIELDS: Field[] = ['sport', 'name', 'student_number', 'institutional_email']

type AthleteDialogProps = {
  /** The athlete to edit, or null to add athletes. */
  athlete: Athlete | null
  onClose: () => void
  /** An athlete was added; the form stays open for the next one. */
  onAdded: (athlete: Athlete) => void
  onEdited: (athlete: Athlete) => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

export function AthleteDialog({ athlete, onClose, onAdded, onEdited, onError }: AthleteDialogProps) {
  const texts = useMessages()
  const t = texts.roster
  const online = useConnection()
  const titleId = useId()
  const [values, setValues] = useState<Values>({
    name: athlete?.name ?? '',
    sport: athlete?.sport ?? '',
    student_number: athlete?.student_number ?? '',
    institutional_email: athlete?.institutional_email ?? '',
  })
  const [view, setView] = useState<View>({ kind: 'form' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [lastSaved, setLastSaved] = useState('')
  const [sending, setSending] = useState(false)
  const [focus, setFocus] = useState<{ to: Field | 'title'; count: number } | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const sportRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // The guard against a second send; the button is aria-disabled, so it keeps keyboard focus.
  const busy = useRef(false)

  useEffect(() => {
    if (!focus) return
    const target = {
      name: nameRef,
      sport: sportRef,
      student_number: numberRef,
      institutional_email: emailRef,
      title: titleRef,
    }[focus.to]
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
      const { athlete: saved } = await apiRequest<{ athlete: Athlete }>(
        athlete ? `/staff/roster/${athlete.id}` : '/staff/roster',
        {
          method: athlete ? 'PATCH' : 'POST',
          body: {
            name: values.name,
            sport: values.sport,
            student_number: values.student_number,
            institutional_email: values.institutional_email,
          },
        },
      )
      if (athlete) {
        onEdited(saved)
        return
      }
      // The next athlete: same sport, the rest empty, and the name first (Figma 101:1150).
      setErrors({})
      setLastSaved(saved.name)
      setValues((current) => ({ ...current, name: '', student_number: '', institutional_email: '' }))
      moveFocus('name')
      onAdded(saved)
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
    setLastSaved('')
    if (apiError.code === 'roster_student_number_taken') {
      // Its details name the athlete who has the number, not field rules (api-conventions).
      const other = apiError.details?.athlete as unknown as { name?: string } | undefined
      setErrors({})
      setView({ kind: 'taken', number: values.student_number, name: other?.name ?? '' })
      moveFocus('title')
      return
    }
    const details = apiError.code === 'validation_failed' ? (apiError.details ?? {}) : {}
    const found: FieldErrors = {}
    for (const field of FIELDS) {
      const rule = details[field]?.[0]
      if (rule) found[field] = fieldErrorText(texts, rule)
    }
    setErrors(found)
    const first = FIELDS.find((field) => found[field])
    if (first) moveFocus(first)
    else setProblem(apiError)
  }

  /** Esc, Cerrar and Cancelar close the dialog only when nothing is being saved. */
  function close() {
    if (!busy.current) onClose()
  }

  function fixNumber() {
    setView({ kind: 'form' })
    moveFocus('student_number')
  }

  if (view.kind === 'taken') {
    return (
      <Modal labelledBy={titleId} onClose={close}>
        <div className="modal__body">
          <TermChip className="roster-modal-chip" />
          <h2 className="modal__title" id={titleId} ref={titleRef} tabIndex={-1}>
            {t.takenTitle}
          </h2>
          <p className="modal__text">{t.takenText(view.number, view.name)}</p>
          <div className="modal__actions">
            <Button variant="secondary" onClick={fixNumber}>
              {t.fixNumber}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const sportField = (
    <TextField
      ref={sportRef}
      label={t.sport}
      autoComplete="off"
      required
      maxLength={50}
      value={values.sport}
      error={errors.sport}
      onChange={(event) => set('sport', event.target.value)}
    />
  )
  const nameField = (
    <TextField
      ref={nameRef}
      label={t.fullName}
      autoComplete="off"
      required
      maxLength={255}
      placeholder={athlete ? undefined : t.fullNameHint}
      value={values.name}
      error={errors.name}
      onChange={(event) => set('name', event.target.value)}
    />
  )
  const title = athlete ? t.editTitle : values.sport.trim() ? t.addingTitle(values.sport.trim()) : t.addTitle

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <form className="modal__body" noValidate onSubmit={save}>
        <TermChip className="roster-modal-chip" />
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        {/* Says that the athlete was saved, inside the dialog, where focus stays (WCAG 4.1.3). */}
        <div role="status" className="roster-dialog-status">
          <p className="modal__text">
            {athlete ? t.editText(athlete.name) : lastSaved ? t.savedNext(lastSaved) : t.addText}
          </p>
          {lastSaved && <span className="team-chip team-chip--invited-outline roster-modal-chip">{t.savedChip}</span>}
        </div>
        {!online && (
          <section className="state">
            <h3 className="state__title">{texts.states.offlineTitle}</h3>
            <p className="state__detail">{t.offlineText}</p>
          </section>
        )}
        <ProblemNotice problem={problem} />
        {/* Adding starts with the sport, which stays for the next athlete (101:1084); editing starts with the name. */}
        {athlete ? nameField : sportField}
        {athlete ? sportField : nameField}
        <TextField
          ref={numberRef}
          label={t.studentNumber}
          autoComplete="off"
          inputMode="numeric"
          required
          maxLength={9}
          placeholder={athlete ? undefined : t.studentNumberHint}
          value={values.student_number}
          error={errors.student_number}
          onChange={(event) => set('student_number', event.target.value)}
        />
        <TextField
          ref={emailRef}
          label={t.email}
          type="email"
          autoComplete="off"
          required
          maxLength={255}
          value={values.institutional_email}
          error={errors.institutional_email}
          onChange={(event) => set('institutional_email', event.target.value)}
        />
        <div className="modal__actions">
          <Button type="submit" aria-disabled={sending || !online || undefined}>
            {athlete ? t.saveChanges : t.saveAndNext}
          </Button>
          <Button variant="secondary" onClick={close}>
            {athlete ? t.cancel : t.close}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
