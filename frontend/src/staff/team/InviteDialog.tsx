import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, Modal, TextField } from '../../components'
import { fieldErrorText, useMessages } from '../../i18n'
import { ProblemNotice } from '../ProblemNotice'
import type { TeamAccount } from './StaffTeam'

// "Invitar al equipo" (Figma 100:1126) and its "Este correo ya está en uso" view (100:1231), #84.

type Role = TeamAccount['role']
type Field = 'name' | 'email' | 'role'
type FieldErrors = Partial<Record<Field, string>>

type InviteDialogProps = {
  onClose: () => void
  onInvited: (account: TeamAccount) => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

export function InviteDialog({ onClose, onInvited, onError }: InviteDialogProps) {
  const texts = useMessages()
  const t = texts.staffTeam
  const titleId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [view, setView] = useState<'form' | 'emailInUse'>('form')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [sending, setSending] = useState(false)
  // Where focus goes after a change of view or a refusal, read by the effect below.
  const [focus, setFocus] = useState<{ to: 'name' | 'email' | 'emailInUse'; count: number }>({ to: 'name', count: 0 })

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const inUseRef = useRef<HTMLHeadingElement>(null)
  // The guard against a second send; the button is aria-disabled, so it keeps keyboard focus.
  const busy = useRef(false)

  useEffect(() => {
    const target = { name: nameRef, email: emailRef, emailInUse: inUseRef }[focus.to]
    target.current?.focus()
  }, [focus])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setProblem(null)
    try {
      const { account } = await apiRequest<{ account: TeamAccount }>('/staff/accounts', {
        method: 'POST',
        body: { name, email, role },
      })
      onInvited(account)
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
    const details = apiError.code === 'validation_failed' ? apiError.details ?? {} : {}
    if (details.email?.includes('unique')) {
      setErrors({})
      setView('emailInUse')
      setFocus((current) => ({ to: 'emailInUse', count: current.count + 1 }))
      return
    }
    const found: FieldErrors = {}
    for (const field of ['name', 'email', 'role'] as const) {
      const rule = details[field]?.[0]
      if (rule) found[field] = fieldErrorText(texts, rule)
    }
    setErrors(found)
    if (found.name || found.email) {
      setFocus((current) => ({ to: found.name ? 'name' : 'email', count: current.count + 1 }))
    } else {
      setProblem(apiError)
    }
  }

  /** Esc and Cancelar close the dialog only when no invitation is being sent. */
  function close() {
    if (!busy.current) onClose()
  }

  function fixEmail() {
    setView('form')
    setFocus((current) => ({ to: 'email', count: current.count + 1 }))
  }

  return (
    <Modal labelledBy={titleId} onClose={close}>
      {view === 'emailInUse' ? (
        <div className="modal__body">
          <h2 className="modal__title" id={titleId} ref={inUseRef} tabIndex={-1}>
            {t.emailInUseTitle}
          </h2>
          <p className="modal__text">{t.emailInUseText(email)}</p>
          <TextField
            ref={emailRef}
            label={t.email}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={fixEmail}>
              {t.fixEmail}
            </Button>
          </div>
        </div>
      ) : (
        <form className="modal__body" noValidate onSubmit={send}>
          <h2 className="modal__title" id={titleId}>
            {t.inviteTitle}
          </h2>
          <p className="modal__text">{t.inviteText}</p>
          <ProblemNotice problem={problem} />
          <TextField
            ref={nameRef}
            label={t.fullName}
            autoComplete="off"
            maxLength={255}
            value={name}
            error={errors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            ref={emailRef}
            label={t.email}
            type="email"
            autoComplete="off"
            maxLength={255}
            value={email}
            error={errors.email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <fieldset className="choice">
            <legend className="field__label">{t.role}</legend>
            <div className="choice__options">
              {(['staff', 'admin'] as const).map((option) => (
                <label key={option} className="choice__option">
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={role === option}
                    onChange={() => setRole(option)}
                  />
                  <span>{texts.dashboard.roles[option]}</span>
                </label>
              ))}
            </div>
            {errors.role && <p className="field__error">{errors.role}</p>}
          </fieldset>
          <div className="modal__actions">
            <Button type="submit" aria-disabled={sending || undefined}>
              {t.sendInvite}
            </Button>
            <Button variant="secondary" onClick={close}>
              {t.cancel}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
