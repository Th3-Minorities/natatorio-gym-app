import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, LoadingState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { STAFF_PATH, staffSessionPath } from '../staffPath'
import type { ShellProps } from '../team/StaffTeam'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import { PersonCard, type Person } from './PersonCard'
import { ConfirmDialog, StaffLink } from './StaffParts'
import '../team/staffTeam.css'
import '../sessions/activeSessions.css'

// S-03 "Buscar persona y Check in asistido" (Figma 4283:1011 and its states, REQ-F-46, #26): find a member by name or
// an athlete by student number, compare the photo, and record the entry with the same rules as their own Check In.

type Refusal = 'noAuthorization' | 'photoRequired' | 'photoPending' | 'gymClosed' | 'athletesOnly'

type View =
  | { kind: 'start' }
  | { kind: 'searching' }
  | { kind: 'notFound' }
  | { kind: 'failed' }
  | { kind: 'offline' }
  | { kind: 'select'; people: Person[] }
  | { kind: 'person'; person: Person; refusal?: Refusal; unconfirmed?: boolean }

const REFUSALS: Record<string, Refusal> = {
  check_in_no_authorization: 'noAuthorization',
  check_in_photo_required: 'photoRequired',
  check_in_photo_pending: 'photoPending',
  check_in_gym_closed: 'gymClosed',
  check_in_athletes_only: 'athletesOnly',
}

/** What stops the entry before Staff even try, from what the search answered. */
function refusalOf(person: Person): Refusal | undefined {
  if (!person.authorization.current) return 'noAuthorization'
  if (person.photo_pending) return 'photoPending'
  if (!person.has_photo) return 'photoRequired'
  return undefined
}

export function FindPerson({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const navigate = shellProps.navigation?.onNavigate
  const texts = useMessages()
  const t = texts.findPerson
  const dates = useDateFormat()
  useDocumentTitle(t.title)
  const online = useConnection()
  const session = useStaffSession()
  const [text, setText] = useState('')
  const [view, setView] = useState<View>({ kind: 'start' })
  const [asking, setAsking] = useState<'confirm' | 'pending' | null>(null)
  const [busy, setBusy] = useState(false)
  // While the entry is being recorded (Figma 4288:1305).
  const [registering, setRegistering] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  const searchId = useId()
  const resultTitle = useRef<HTMLHeadingElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  // What was searched last, so Reintentar and Actualizar datos ask the same thing even if the box changed.
  const lastQuery = useRef('')

  // Each new result says what it is first: focus goes to its title (WCAG 2.4.3).
  useEffect(() => {
    if (view.kind !== 'start') resultTitle.current?.focus()
  }, [view])

  function search(event: FormEvent) {
    event.preventDefault()
    void run(text.trim())
  }

  async function run(query: string) {
    if (!query || view.kind === 'searching') return
    lastQuery.current = query
    if (!online) {
      setView({ kind: 'offline' })
      return
    }
    setView({ kind: 'searching' })
    try {
      const { people } = await apiRequest<{ people: Person[] }>(`/staff/people?${new URLSearchParams({ search: query })}`)
      if (people.length === 0) setView({ kind: 'notFound' })
      else if (people.length === 1) choose(people[0])
      else setView({ kind: 'select', people })
    } catch (error) {
      session.reportError(error)
      setView({ kind: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'failed' })
    }
  }

  function choose(person: Person) {
    setView({ kind: 'person', person, refusal: refusalOf(person) })
  }

  /** Starts over: an empty box, and the cursor in it. */
  function backToSearch() {
    setText('')
    setView({ kind: 'start' })
    searchInput.current?.focus()
  }

  /** "Actualizar datos" (4288:1329): asks again for this person, who may have an open visit by now. */
  async function refresh(person: Person) {
    if (busy || !online) return
    setBusy(true)
    try {
      const { people } = await apiRequest<{ people: Person[] }>(`/staff/people?${new URLSearchParams({ search: lastQuery.current })}`)
      const updated = people.find((other) => other.user_id === person.user_id)
      if (updated) choose(updated)
      else setView({ kind: 'notFound' })
    } catch (error) {
      session.reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function checkIn(person: Person) {
    setBusy(true)
    setProblem(null)
    // The question closes and the screen says the entry is being recorded.
    setAsking(null)
    setRegistering(true)
    try {
      const { session: visit } = await apiRequest<{ session: { id: number } }>('/staff/check-in', {
        method: 'POST',
        body: { user_id: person.user_id },
      })
      setAsking(null)
      // Back to S-01, which welcomes the new visit and marks its row (4319:1662).
      navigate?.(`${STAFF_PATH}?registrado=${visit.id}`)
    } catch (error) {
      session.reportError(error)
      setAsking(null)
      const apiError = error instanceof ApiError ? error : new ApiError('server_error', 500)
      if (apiError.code === 'check_in_session_active') {
        const open = apiError.details?.session as unknown as { id: number; started_at: string } | undefined
        setView({ kind: 'person', person: { ...person, active_session: open ?? null } })
      } else if (REFUSALS[apiError.code]) {
        setView({ kind: 'person', person, refusal: REFUSALS[apiError.code] })
      } else {
        // No answer or a server error: the entry may or may not exist (4288:1329).
        setView({ kind: 'person', person, unconfirmed: true })
      }
    } finally {
      setBusy(false)
      setRegistering(false)
    }
  }

  async function markPending(person: Person) {
    setBusy(true)
    setProblem(null)
    try {
      const { person: updated } = await apiRequest<{ person: Person }>(`/staff/people/${person.user_id}/photo-pending`, { method: 'POST' })
      setAsking(null)
      setView({ kind: 'person', person: updated, refusal: 'photoPending' })
    } catch (error) {
      session.reportError(error)
      setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description}>
      {notice}
      {dialog()}
      <form className="find-search" onSubmit={search} noValidate>
        <div className="field find-search__field">
          <label className="field__label" htmlFor={searchId}>
            {t.search}
          </label>
          <input
            id={searchId}
            ref={searchInput}
            className="field__input"
            autoComplete="off"
            maxLength={255}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" aria-disabled={view.kind === 'searching' || undefined}>
          {t.submit}
        </Button>
      </form>
      {result()}
    </DashboardShell>
  )

  function heading(title: string) {
    return (
      <h2 className="state__title" ref={resultTitle} tabIndex={-1}>
        {title}
      </h2>
    )
  }

  function result() {
    switch (view.kind) {
      case 'start':
        return (
          <section className="state">
            <h2 className="state__title">{t.startTitle}</h2>
            <p className="state__detail">{t.startText}</p>
          </section>
        )
      case 'searching':
        return <LoadingState title={t.searchingTitle} detail={t.searchingText} />
      case 'notFound':
        return (
          <section className="state" role="status">
            {heading(t.notFoundTitle)}
            <p className="state__detail">{t.notFoundText}</p>
            <div className="find-verify__actions">
              <Button variant="secondary" onClick={backToSearch}>
                {t.backToSearch}
              </Button>
            </div>
          </section>
        )
      case 'failed':
      case 'offline':
        return (
          <section className="state state--error" role="alert">
            {heading(view.kind === 'failed' ? t.failedTitle : t.offlineTitle)}
            <p className="state__detail">{view.kind === 'failed' ? t.failedText : t.offlineText}</p>
            <div className="find-verify__actions">
              {view.kind === 'failed' ? (
                <Button variant="secondary" onClick={() => void run(lastQuery.current)}>
                  {texts.states.retry}
                </Button>
              ) : (
                // Offline (4288:1160): the entry cannot be confirmed.
                <Button aria-disabled="true">{t.confirm}</Button>
              )}
            </div>
          </section>
        )
      case 'select':
        return (
          <section className="state find-select">
            {heading(t.selectTitle)}
            <p className="state__detail">{t.selectText}</p>
            <ul className="find-select__list">
              {view.people.map((person) => (
                <li key={person.user_id} className="find-select__item">
                  <span>{[person.name, person.masked_email].filter(Boolean).join(' · ')}</span>
                  <Button variant="secondary" aria-label={t.selectOne(person.name ?? '')} onClick={() => choose(person)}>
                    {t.select}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )
      case 'person':
        return personView(view)
    }
  }

  function personView(current: Extract<View, { kind: 'person' }>) {
    const { person, refusal, unconfirmed } = current
    const open = person.active_session

    return (
      <>
        <PersonCard
          person={person}
          photo={person.has_photo && person.authorization.current ? `/api/staff/people/${person.user_id}/photo` : null}
          extra={!open && !refusal && <p className="person-card__muted">{t.noSession}</p>}
        />
        {open ? (
          <section className="state">
            {heading(t.activeTitle)}
            <p className="state__detail">{t.activeText(person.name ?? '', dates.time(open.started_at))}</p>
            <StaffLink href={staffSessionPath(open.id)} navigate={navigate} className="button button--secondary find-link">
              {t.openActive}
            </StaffLink>
            <StaffLink href={STAFF_PATH} navigate={navigate} className="button button--secondary find-link">
              {texts.sessionDetail.backToSessions}
            </StaffLink>
          </section>
        ) : refusal ? (
          <section className="state state--error" role="alert">
            {heading(t.refusals[refusal].title)}
            <p className="state__detail">{t.refusals[refusal].text}</p>
            <div className="find-verify__actions">
              <Button variant="secondary" onClick={backToSearch}>
                {t.backToSearch}
              </Button>
            </div>
          </section>
        ) : registering ? (
          <LoadingState title={t.registeringTitle} detail={t.registeringText} />
        ) : (
          <section className="state find-verify">
            {unconfirmed ? (
              <div role="alert">
                {heading(t.unconfirmedTitle)}
                <p className="state__detail">{t.unconfirmedText}</p>
              </div>
            ) : (
              <>
                {heading(t.verifyTitle)}
                <p className="state__detail">{t.verifyText}</p>
              </>
            )}
            <div className="find-verify__actions">
              {unconfirmed ? (
                // Figma's only action here (4288:1329).
                <Button variant="secondary" aria-disabled={busy || !online || undefined} onClick={() => void refresh(person)}>
                  {texts.sessionDetail.refresh}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" aria-disabled={!online || undefined} onClick={() => online && setAsking('confirm')}>
                    {t.photoMatches}
                  </Button>
                  <Button className="button--danger" aria-disabled={!online || undefined} onClick={() => online && setAsking('pending')}>
                    {t.photoDiffers}
                  </Button>
                </>
              )}
            </div>
          </section>
        )}
      </>
    )
  }

  function dialog() {
    if (!asking || view.kind !== 'person') return null
    const person = view.person
    const name = person.name ?? ''
    const common = {
      busy,
      problem: <ProblemNotice problem={problem} tone="error" />,
      onClose: () => {
        setAsking(null)
        setProblem(null)
      },
    }
    return asking === 'confirm' ? (
      <ConfirmDialog
        {...common}
        title={t.confirmTitle}
        text={t.confirmText(name)}
        confirm={t.confirm}
        onConfirm={() => void checkIn(person)}
      />
    ) : (
      <ConfirmDialog
        {...common}
        title={t.pendingTitle}
        text={t.pendingText(name)}
        confirm={t.pendingConfirm}
        danger
        onConfirm={() => void markPending(person)}
      />
    )
  }
}
