import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { Button, Notice, TextField } from '../components'
import { useDateFormat } from '../format/dateTime'
import { errorText, fieldErrorText, useMessages } from '../i18n'
import { SignInLayout } from './SignInLayout'
import { STAFF_FORGOT_PATH, type Navigate } from './staffPath'

// N-11, staff sign-in, as drawn in Figma MOCKUPS-GYM (4039:3721) with its states. On the dashboard path,
// with no link from the User sign-in (E-124). The same form for Staff and Administrators (E-114).

type Problem =
  | { kind: 'timeout' }
  | { kind: 'wrong' }
  | { kind: 'wait'; until: Date | null }
  | { kind: 'offline' }
  | { kind: 'deactivated' }
  | { kind: 'saved' }
  | { kind: 'other'; code: string; status: number }

type FieldErrors = { email?: string; password?: string }

type StaffSignInProps = {
  onSignIn: (email: string, password: string) => Promise<void>
  /**
   * A notice to open with: the last sign-in ended by itself ("Sesión vencida" 4039:4365, "Cuenta desactivada"
   * 4039:4094), or the API could not be reached when the page opened ("Sin conexión" 4039:4018).
   */
  startWith?: 'timeout' | 'deactivated' | 'offline' | 'saved' | null
  /** Opens "¿Olvidaste tu contraseña?" (4039:4170, #84) without reloading the page. */
  navigate?: Navigate
}

export function StaffSignIn({ onSignIn, startWith = null, navigate }: StaffSignInProps) {
  const texts = useMessages()
  const t = texts.signIn
  const dates = useDateFormat()
  const titleId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<Problem | null>(startWith ? { kind: startWith } : null)
  const [busy, setBusy] = useState(false)
  // What keeps the button disabled after an answer (Figma states 3942, 4018, 4094).
  const [waiting, setWaiting] = useState(false)
  const [offlineBlock, setOfflineBlock] = useState(() => startWith === 'offline' && !navigator.onLine)
  const [deactivatedBlock, setDeactivatedBlock] = useState(startWith === 'deactivated')

  // Focus moves after the error is on screen, so a screen reader reads the field together with its error.
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [focusRequest, setFocusRequest] = useState<{ field: 'email' | 'password'; count: number } | null>(null)
  useEffect(() => {
    if (!focusRequest) return
    ;(focusRequest.field === 'email' ? emailRef : passwordRef).current?.focus()
  }, [focusRequest])

  // Too many tries: open the button again at the time the server gave (REQ-F-07).
  const waitUntil = problem?.kind === 'wait' ? problem.until : null
  useEffect(() => {
    if (!waitUntil) return
    const timer = setTimeout(() => setWaiting(false), Math.max(0, waitUntil.getTime() - Date.now()))
    return () => clearTimeout(timer)
  }, [waitUntil])

  // No connection: open the button again when the browser is back online.
  useEffect(() => {
    if (!offlineBlock) return
    const online = () => setOfflineBlock(false)
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [offlineBlock])

  const disabled = busy || waiting || offlineBlock || deactivatedBlock

  function change(field: 'email' | 'password', value: string) {
    if (field === 'email') setEmail(value)
    else setPassword(value)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    // Another email or password may belong to an active account.
    setDeactivatedBlock(false)
  }

  function show(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'server_error'
    const status = error instanceof ApiError ? error.status : 500

    switch (code) {
      case 'staff_credentials_invalid':
        setProblem({ kind: 'wrong' })
        return
      case 'too_many_requests': {
        const seconds = error instanceof ApiError ? error.retryAfter : undefined
        setProblem({ kind: 'wait', until: seconds ? new Date(Date.now() + seconds * 1000) : null })
        setWaiting(Boolean(seconds))
        return
      }
      case 'offline':
        setProblem({ kind: 'offline' })
        // Only block while the browser knows it is offline; if it is online, the server may answer next time.
        setOfflineBlock(!navigator.onLine)
        return
      case 'staff_account_deactivated':
        setProblem({ kind: 'deactivated' })
        setDeactivatedBlock(true)
        return
      case 'validation_failed': {
        const details = error instanceof ApiError ? (error.details ?? {}) : {}
        showFieldErrors({
          email: details.email?.[0] ? fieldErrorText(texts, details.email[0]) : undefined,
          password: details.password?.[0] ? fieldErrorText(texts, details.password[0]) : undefined,
        })
        return
      }
      default:
        setProblem({ kind: 'other', code, status })
    }
  }

  /** Shows the errors and sends focus to the first field that has one, so its error is read out (WCAG 3.3.1). */
  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors)
    const first = errors.email ? 'email' : errors.password ? 'password' : null
    if (first) setFocusRequest((current) => ({ field: first, count: (current?.count ?? 0) + 1 }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    // The button is aria-disabled, not disabled, so it keeps focus; this guard is what blocks a second submit.
    if (disabled) return

    const required = fieldErrorText(texts, 'required')
    const missing: FieldErrors = {
      email: email.trim() === '' ? required : undefined,
      password: password === '' ? required : undefined,
    }
    showFieldErrors(missing)
    if (missing.email || missing.password) return

    setProblem(null)
    setBusy(true)
    try {
      await onSignIn(email.trim(), password)
    } catch (error) {
      show(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SignInLayout>
      <form className="sign-in__card" aria-labelledby={titleId} noValidate onSubmit={submit}>
          <h1 className="sign-in__title" id={titleId}>
            {t.title}
          </h1>
          <p className="sign-in__description">{t.description}</p>

          {problem?.kind === 'timeout' && <Notice title={t.timeoutTitle}>{t.timeoutText}</Notice>}
          {problem?.kind === 'wrong' && <Notice tone="error" title={t.wrongTitle}>{t.wrongText}</Notice>}
          {problem?.kind === 'wait' && (
            <Notice title={t.waitTitle}>
              {problem.until ? t.waitText(dates.time(problem.until)) : errorText(texts, 'too_many_requests', 429)}
            </Notice>
          )}
          {problem?.kind === 'offline' && <Notice title={t.offlineTitle}>{t.offlineText}</Notice>}
          {problem?.kind === 'deactivated' && <Notice tone="error" title={t.deactivatedTitle}>{t.deactivatedText}</Notice>}
          {/* After a new password from an email link (#84). Not drawn in Figma. */}
          {problem?.kind === 'saved' && (
            <Notice title={texts.staffAccess.savedTitle}>{texts.staffAccess.savedText}</Notice>
          )}
          {problem?.kind === 'other' && (
            <Notice tone="error" title={t.wrongTitle}>{errorText(texts, problem.code, problem.status)}</Notice>
          )}

          <TextField
            label={t.email}
            type="email"
            autoComplete="username"
            placeholder={t.emailPlaceholder}
            ref={emailRef}
            value={email}
            error={fieldErrors.email}
            onChange={(event) => change('email', event.target.value)}
          />
          <TextField
            label={t.password}
            type="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            ref={passwordRef}
            value={password}
            error={fieldErrors.password}
            onChange={(event) => change('password', event.target.value)}
          />

          {/* aria-disabled, not disabled: a disabled button drops keyboard focus to the page while it is busy. */}
          <Button type="submit" size="large" fullWidth aria-disabled={disabled || undefined}>
            {busy ? t.submitting : t.submit}
          </Button>
          <a
            className="button button--link button--full"
            href={STAFF_FORGOT_PATH}
            onClick={(event) => {
              if (!navigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              navigate(STAFF_FORGOT_PATH)
            }}
          >
            {t.forgot}
          </a>
      </form>
    </SignInLayout>
  )
}
