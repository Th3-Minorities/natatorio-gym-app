import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { RefreshCw } from 'lucide-react'
import { Button, TextField } from '../../components'
import { fieldErrorText, useMessages } from '../../i18n'
import { ProblemNotice } from '../ProblemNotice'
import { SignInLayout } from '../SignInLayout'
import { STAFF_FORGOT_PATH, STAFF_PATH } from '../staffPath'
import type { Navigate } from '../staffPath'
import { useDocumentTitle } from '../useDocumentTitle'

// The N-11 pages a staff member opens before signing in (#84): forgotten password, and the password
// pages the invitation and reset emails link to. None of them says whether an email has an account.

type PageProps = { navigate: Navigate }

/** A link that changes the page without reloading, like the menu (Ctrl or middle click opens a new tab). */
function PageLink({ to, navigate, className, children }: { to: string; navigate: Navigate; className: string; children: ReactNode }) {
  return (
    <a
      className={className}
      href={to}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

function BackToSignIn({ navigate }: PageProps) {
  const a = useMessages().staffAccess
  return (
    <PageLink to={STAFF_PATH} navigate={navigate} className="button button--secondary button--large button--full">
      {a.backToSignIn}
    </PageLink>
  )
}

/** The page title. It takes focus when the page appears, so a screen reader starts from it. */
function Title({ id, children }: { id: string; children: ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])
  return (
    <h1 className="sign-in__title" id={id} ref={title} tabIndex={-1}>
      {children}
    </h1>
  )
}

/** "Recuperar contraseña" (4039:4170), then "Revisa tu correo" (4039:4224), the same for every email. */
export function ForgotPasswordPage({ navigate }: PageProps) {
  const texts = useMessages()
  const a = texts.staffAccess
  const titleId = useId()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState<string>()
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [focusEmail, setFocusEmail] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [sending, setSending] = useState(false)
  useDocumentTitle(sent ? a.checkEmailTitle : a.forgotTitle)

  useEffect(() => {
    if (focusEmail) emailRef.current?.focus()
  }, [focusEmail])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setProblem(null)
    setEmailError(undefined)
    try {
      await apiRequest('/staff/password/email', { method: 'POST', body: { email: email.trim() } })
      setSent(true)
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('server_error', 500)
      const rule = apiError.code === 'validation_failed' ? apiError.details?.email?.[0] : undefined
      if (rule) {
        setEmailError(fieldErrorText(texts, rule))
        setFocusEmail((n) => n + 1)
      } else {
        setProblem(apiError)
      }
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  if (sent) {
    return (
      <SignInLayout>
        <section className="sign-in__card" aria-labelledby={titleId}>
          <Title id={titleId}>{a.checkEmailTitle}</Title>
          <p className="sign-in__description">{a.checkEmailText}</p>
          <p className="sign-in__note">{a.checkSpam}</p>
          <BackToSignIn navigate={navigate} />
        </section>
      </SignInLayout>
    )
  }

  return (
    <SignInLayout>
      <form className="sign-in__card" aria-labelledby={titleId} noValidate onSubmit={send}>
        <Title id={titleId}>{a.forgotTitle}</Title>
        <p className="sign-in__description">{a.forgotText}</p>
        <ProblemNotice problem={problem} tone="error" />
        <TextField
          ref={emailRef}
          label={a.email}
          type="email"
          autoComplete="username"
          placeholder={a.emailPlaceholder}
          maxLength={255}
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button type="submit" size="large" fullWidth aria-disabled={sending || undefined}>
          {a.sendLink}
        </Button>
        <BackToSignIn navigate={navigate} />
      </form>
    </SignInLayout>
  )
}

type Invitee = { name: string; email: string; role: 'staff' | 'admin' }

/** Where each kind of link is checked and used (docs/design/api-conventions.md, section 6). */
function linkRequest(kind: 'invite' | 'reset', link: { token: string; email: string }) {
  return kind === 'invite'
    ? { base: '/staff/invitation', body: { token: link.token }, invalidCode: 'staff_invite_link_invalid' }
    : { base: '/staff/password', body: { email: link.email, token: link.token }, invalidCode: 'staff_reset_link_invalid' }
}

type LinkState = { status: 'checking' } | { status: 'expired' } | { status: 'failed' } | { status: 'form'; invitee?: Invitee }

type SetPasswordProps = PageProps & {
  /** invite: "Crear tu contraseña" (4126:1316); reset: "Restablecer contraseña" (4126:1341). */
  kind: 'invite' | 'reset'
  /** Back on N-11, which says the password was saved. */
  onSaved: () => void
}

/**
 * N-11 around the link page, with one status region that stays on the page through every state. "Revisando el
 * enlace…" is put in it after the page mounts, since a live region that appears with its text is often not read.
 */
function LinkShell({ announce, children }: { announce: string; children: ReactNode }) {
  const region = useRef<HTMLParagraphElement>(null)
  // The text is written into the region after it is on the page; React never renders children inside it. A layout
  // effect, so the text changes together with the state it describes and never lags behind the new title.
  useLayoutEffect(() => {
    if (region.current) region.current.textContent = announce
  }, [announce])
  return (
    <SignInLayout>
      <p className="visually-hidden" role="status" ref={region} />
      {children}
    </SignInLayout>
  )
}

/** The password page an email link opens, or "Enlace vencido o usado" (4039:4325) when the link no longer works. */
export function SetPasswordPage({ kind, navigate, onSaved }: SetPasswordProps) {
  const texts = useMessages()
  const a = texts.staffAccess
  const titleId = useId()
  const hintId = useId()
  // The link's token, and the email for a reset, as the email sent them. Read once, when the page opens.
  const [link] = useState(() => {
    const query = new URLSearchParams(window.location.search)
    return { token: query.get('token') ?? '', email: query.get('email') ?? '' }
  })
  const hasLink = link.token !== '' && (kind === 'invite' || link.email !== '')
  const [state, setState] = useState<LinkState>(hasLink ? { status: 'checking' } : { status: 'expired' })
  const [attempt, setAttempt] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({})
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [focus, setFocus] = useState<{ to: 'password' | 'confirmation'; count: number } | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [sending, setSending] = useState(false)

  const { base, body: linkBody, invalidCode } = linkRequest(kind, link)

  const formTitle = kind === 'invite' ? a.createTitle : a.resetTitle
  const announce = state.status === 'checking' ? a.checking : ''
  const pageTitle = state.status === 'expired' ? a.expiredTitle : state.status === 'failed' ? texts.states.errorTitle : formTitle
  useDocumentTitle(pageTitle)

  useEffect(() => {
    if (link.token === '' || (kind === 'reset' && link.email === '')) return
    const request = linkRequest(kind, link)
    let current = true
    apiRequest<Invitee | undefined>(`${request.base}/validate`, { method: 'POST', body: request.body }).then(
      (invitee) => {
        if (current) setState({ status: 'form', invitee: kind === 'invite' ? invitee : undefined })
      },
      (error: unknown) => {
        if (!current) return
        setState({ status: error instanceof ApiError && error.code === request.invalidCode ? 'expired' : 'failed' })
      },
    )
    return () => {
      current = false
    }
    // attempt counts the retries after "Error al cargar".
  }, [attempt, kind, link])

  useEffect(() => {
    if (focus) (focus.to === 'password' ? passwordRef : confirmationRef).current?.focus()
  }, [focus])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setProblem(null)
    setErrors({})
    try {
      await apiRequest(`${base}/${kind === 'invite' ? 'accept' : 'reset'}`, {
        method: 'POST',
        body: { ...linkBody, password, password_confirmation: confirmation },
      })
      onSaved()
    } catch (error) {
      refused(error instanceof ApiError ? error : new ApiError('server_error', 500))
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  function refused(error: ApiError) {
    if (error.code === invalidCode) {
      setState({ status: 'expired' })
      return
    }
    const rule = error.code === 'validation_failed' ? error.details?.password?.[0] : undefined
    const confirmRule = error.code === 'validation_failed' ? error.details?.password_confirmation?.[0] : undefined
    if (rule === 'confirmed' || (!rule && confirmRule)) {
      setErrors({ confirmation: fieldErrorText(texts, rule ?? confirmRule ?? 'confirmed') })
      setFocus((current) => ({ to: 'confirmation', count: (current?.count ?? 0) + 1 }))
    } else if (rule) {
      setErrors({ password: fieldErrorText(texts, rule) })
      setFocus((current) => ({ to: 'password', count: (current?.count ?? 0) + 1 }))
    } else {
      setProblem(error)
    }
  }

  if (state.status === 'expired') {
    return (
      <LinkShell announce={announce}>
        <section className="sign-in__card" aria-labelledby={titleId}>
          <Title id={titleId}>{a.expiredTitle}</Title>
          <p className="sign-in__description">{kind === 'invite' ? a.inviteExpiredText : a.resetExpiredText}</p>
          {kind === 'invite' ? (
            <p className="sign-in__note">{a.inviteExpiredHelp}</p>
          ) : (
            <PageLink
              to={STAFF_FORGOT_PATH}
              navigate={navigate}
              className="button button--primary button--large button--full"
            >
              {a.requestAnother}
            </PageLink>
          )}
          <BackToSignIn navigate={navigate} />
        </section>
      </LinkShell>
    )
  }

  // 4424:1753: the page's own title while the link is checked.
  if (state.status === 'checking') {
    return (
      <LinkShell announce={announce}>
        <section className="sign-in__card" aria-labelledby={titleId}>
          <Title id={titleId}>{pageTitle}</Title>
          {/* Said by the page's status region instead (LinkShell), which is on the page before the text. */}
          <p className="sign-in__description" aria-hidden="true">
            {a.checking}
          </p>
          <RefreshCw size={20} className="sign-in__checking-icon" />
        </section>
      </LinkShell>
    )
  }

  // 4424:1792: the link could not be checked (server error or no connection).
  if (state.status === 'failed') {
    return (
      <LinkShell announce={announce}>
        <section className="sign-in__card" aria-labelledby={titleId}>
          <Title id={titleId}>{texts.states.errorTitle}</Title>
          <p className="sign-in__description" role="alert">
            {texts.states.errorDetail}
          </p>
          <Button
            size="large"
            fullWidth
            onClick={() => {
              setState({ status: 'checking' })
              setAttempt((n) => n + 1)
            }}
          >
            {texts.states.retry}
          </Button>
          <BackToSignIn navigate={navigate} />
        </section>
      </LinkShell>
    )
  }

  const invitee = state.invitee
  return (
    <LinkShell announce={announce}>
      <form className="sign-in__card" aria-labelledby={titleId} noValidate onSubmit={save}>
        <Title id={titleId}>{formTitle}</Title>
        <p className="sign-in__description">{kind === 'invite' ? a.createText : a.resetText}</p>
        {invitee && (
          <div className="sign-in__identity">
            <p className="sign-in__identity-name">{invitee.name}</p>
            <p className="sign-in__identity-detail">
              {texts.dashboard.roles[invitee.role]} · {invitee.email}
            </p>
          </div>
        )}
        <ProblemNotice problem={problem} tone="error" />
        {/* A hidden username, so password managers save the new password with the right account. */}
        {(invitee?.email ?? link.email) && (
          <input type="email" autoComplete="username" value={invitee?.email ?? link.email} readOnly hidden />
        )}
        <TextField
          ref={passwordRef}
          label={a.newPassword}
          type="password"
          autoComplete="new-password"
          placeholder={a.newPasswordPlaceholder}
          maxLength={255}
          value={password}
          error={errors.password}
          aria-describedby={hintId}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          ref={confirmationRef}
          label={a.confirmPassword}
          type="password"
          autoComplete="new-password"
          placeholder={a.confirmPasswordPlaceholder}
          maxLength={255}
          value={confirmation}
          error={errors.confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <p className="sign-in__note" id={hintId}>
          {a.passwordHint}
        </p>
        <Button type="submit" size="large" fullWidth aria-disabled={sending || undefined}>
          {kind === 'invite' ? a.createSubmit : a.resetSubmit}
        </Button>
      </form>
    </LinkShell>
  )
}
