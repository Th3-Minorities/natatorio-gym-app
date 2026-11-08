import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../api/client'
import { Button, TextField } from '../components'
import { useDateFormat } from '../format/dateTime'
import { fieldErrorText, useMessages } from '../i18n'
import type { UserProfile } from './UserApp'
import { PasswordField, UserLoading, UserNotice, UserPage } from './ui'
import { useConnection } from './useConnection'

type Mode = 'sign-in' | 'recover' | 'reset'
type Problem = 'wrong' | 'wait' | 'offline' | 'server' | 'expired' | 'replaced' | null

export function UserAccess({ mode, replaced, onSignedIn, navigate }: {
  mode: Mode; replaced?: boolean; onSignedIn: (profile: UserProfile) => void; navigate: (path: string) => void
}) {
  const texts = useMessages()
  const t = texts.user
  const dates = useDateFormat()
  const online = useConnection()
  const offlinePasswordHintId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [received, setReceived] = useState(false)
  const [validating, setValidating] = useState(mode === 'reset')
  const [problem, setProblem] = useState<Problem>(replaced ? 'replaced' : null)
  const [waitUntil, setWaitUntil] = useState<Date | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const form = useRef<HTMLFormElement>(null)
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') ?? ''
  const resetEmail = params.get('email') ?? ''
  const compact = busy || Boolean(problem) || received || validating || !online || Object.keys(fields).length > 0
  const offline = !online || problem === 'offline'

  useEffect(() => {
    if (!waitUntil) return
    const timer = setTimeout(() => setWaiting(false), Math.max(0, waitUntil.getTime() - Date.now()))
    return () => clearTimeout(timer)
  }, [waitUntil])

  useEffect(() => {
    const reconnect = () => setProblem((current) => current === 'offline' ? null : current)
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [])

  useEffect(() => {
    if (mode !== 'reset') return
    let active = true
    apiRequest('/user/password/validate', { method: 'POST', body: { email: resetEmail, token } }).catch((error: unknown) => {
      if (active) setProblem(error instanceof ApiError && error.code === 'offline' ? 'offline' : 'expired')
    }).finally(() => { if (active) setValidating(false) })
    return () => { active = false }
  }, [mode, resetEmail, token])

  function handleError(error: unknown) {
    const failure = error instanceof ApiError ? error : new ApiError('server_error', 500)
    if (failure.code === 'validation_failed') {
      const next: Record<string, string> = {}
      for (const [field, rules] of Object.entries(failure.details ?? {})) {
        next[field] = mode === 'reset' && field === 'password' ? t.passwordInvalid
          : mode === 'reset' && field === 'password_confirmation' ? t.confirmationInvalid : fieldErrorText(texts, rules[0])
      }
      if (mode === 'reset' && failure.details?.password?.includes('confirmed')) next.password_confirmation = t.confirmationInvalid
      setFields(next)
      // Only N-07 draws inline field errors. The other forms use their drawn rejection panel.
      if (mode === 'sign-in') setProblem('wrong')
      if (mode === 'recover') setProblem('server')
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus())
    } else if (failure.code === 'too_many_requests') {
      setProblem('wait')
      setWaitUntil(new Date(Date.now() + (failure.retryAfter ?? 60) * 1000))
      setWaiting(true)
    } else if (failure.code === 'offline') setProblem('offline')
    else if (failure.code === 'user_reset_link_invalid') setProblem('expired')
    else if (failure.code === 'user_credentials_invalid') setProblem('wrong')
    else setProblem('server')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || waiting || offline || validating) return
    setBusy(true)
    setFields({})
    setProblem(null)
    try {
      if (mode === 'sign-in') {
        onSignedIn(await apiRequest<UserProfile>('/user/sign-in', { method: 'POST', body: { email, password } }))
      } else if (mode === 'recover') {
        await apiRequest('/user/password/email', { method: 'POST', body: { email } })
        setReceived(true)
      } else {
        await apiRequest('/user/password/reset', { method: 'POST', body: { email: resetEmail, token, password, password_confirmation: confirmation } })
        navigate('/sign-in')
      }
    } catch (error) { handleError(error) }
    finally { setBusy(false) }
  }

  if (validating) return <UserPage><h1 tabIndex={-1}>{t.newPassword}</h1><UserLoading detail={t.validating} /></UserPage>
  if (problem === 'expired') return <UserPage>
    <h1 tabIndex={-1}>{t.expiredTitle}</h1><UserNotice title={t.expiredNotice}>{t.expiredText}</UserNotice>
    <a className="button button--primary user-action" href="/recover-password">{t.requestAgain}</a>
    <a className="button button--secondary user-action" href="/sign-in">{t.returnToSignIn}</a>
  </UserPage>
  if (received) return <UserPage>
    <h1 tabIndex={-1}>{t.checkEmail}</h1><UserNotice title={t.received} success>{t.spam}</UserNotice><p>{t.receivedText}</p>
    <a className="button button--primary user-action" href="/sign-in">{t.returnToSignIn}</a>
  </UserPage>

  const title = mode === 'sign-in' ? compact ? t.signIn : t.signInTitle : mode === 'recover' ? t.recover : t.newPassword
  const notice = problem === 'wrong' ? [t.wrongTitle, t.wrongText]
    : problem === 'wait' && waitUntil ? [t.waitTitle, t.waitText(dates.time(waitUntil))]
    : problem === 'replaced' ? [t.replacedTitle, t.replacedText]
    : problem === 'server' && mode === 'recover' ? [t.sendErrorTitle, t.sendErrorText] : null
  const description = mode === 'sign-in' ? t.description : mode === 'recover'
    ? compact ? t.recoverStateDescription : t.recoverDescription : t.newDescription
  const submitText = mode === 'sign-in' ? busy ? t.signing : t.signIn : mode === 'recover' ? busy ? t.sending : t.send : t.save

  return <UserPage large={!compact} offline={offline} back={mode === 'sign-in' ? '/welcome' : '/sign-in'}>
    <h1 tabIndex={-1}>{title}</h1>
    {notice && <UserNotice title={notice[0]}>{notice[1]}</UserNotice>}
    <p className="user-description">{description}</p>
    <form ref={form} onSubmit={submit} noValidate aria-busy={busy} data-mode={mode}>
      {mode !== 'reset' && <TextField label={t.email} type="email" placeholder={t.emailPlaceholder} autoComplete="username"
        maxLength={255} required value={email} error={fields.email} onChange={(event) => setEmail(event.target.value)} />}
      {mode !== 'recover' && <PasswordField label={mode === 'reset' ? t.newPassword : t.password}
        placeholder={mode === 'reset' ? t.newPlaceholder : t.passwordPlaceholder} value={password} onChange={setPassword}
        error={mode === 'reset' ? fields.password : undefined} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
        hint={mode === 'reset' && !offline ? t.passwordHint : undefined}
        describedBy={mode === 'reset' && offline ? offlinePasswordHintId : undefined} />}
      {mode === 'reset' && <PasswordField label={t.confirmPassword} placeholder={t.confirmPlaceholder}
        value={confirmation} onChange={setConfirmation} error={fields.password_confirmation} />}
      {mode === 'sign-in' && <a className="user-forgot" href="/recover-password">{t.forgot}</a>}
      {mode === 'reset' && offline && <p id={offlinePasswordHintId} className="user-caption">{t.passwordHint}</p>}
      <Button className="user-action" type="submit" fullWidth disabled={busy || waiting || offline}>{submitText}</Button>
      {offline && <p className="user-caption" role="status">{t.offlineForm}</p>}
      {mode === 'recover' && !compact && <p>{t.recoverHint}</p>}
      {mode !== 'sign-in' && <a className="user-return" href="/sign-in">{t.returnToSignIn}</a>}
      {mode === 'sign-in' && !compact && <div className="user-register"><span>{t.firstTime}</span><a href="/register" className="user-register-action">{t.begin}</a></div>}
    </form>
  </UserPage>
}
