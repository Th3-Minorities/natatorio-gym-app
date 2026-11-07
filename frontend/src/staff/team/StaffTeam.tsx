import { useEffect, useEffectEvent, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, ErrorState, LoadingState, Notice, OfflineState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { errorText, useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { useStaffSession } from '../useStaffSession'
import { DeactivateDialog, OwnRoleDialog, RoleDialog } from './AccountDialogs'
import { InviteDialog } from './InviteDialog'
import './staffTeam.css'

// A-15 "Cuentas del staff" (Figma 100:841, #84). Only Administrators reach it; the API checks the role too.
// Not here yet: the term chip and the "no active term" banner, which need the terms of #21.

export type TeamAccount = {
  id: number
  name: string
  email: string
  role: 'staff' | 'admin'
  status: 'active' | 'invited' | 'deactivated'
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'offline' } | { status: 'ready'; accounts: TeamAccount[] }

/** What the screen says above the list after an action (Figma 100:1197, 4039:3311). */
type Banner =
  | { kind: 'invited'; account: TeamAccount }
  | { kind: 'resent'; account: TeamAccount }
  | { kind: 'roleChanged'; account: TeamAccount }
  | { kind: 'failed'; error: ApiError }

type Dialog = { kind: 'role' | 'ownRole' | 'deactivate'; account: TeamAccount }

/** The shell's parts that do not depend on this screen: the account, sign-out, the menu and any notice. */
export type ShellProps = Omit<ComponentProps<typeof DashboardShell>, 'children' | 'title' | 'description' | 'action'> & {
  notice?: ReactNode
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function StaffTeam({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const texts = useMessages()
  const t = texts.staffTeam
  const session = useStaffSession()
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  // Each change counts up, and the effect below asks for the list again.
  const [attempt, setAttempt] = useState(0)
  const [inviting, setInviting] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  // Said to screen readers only, after a change the row shows by itself (deactivate, reactivate).
  const [announcement, setAnnouncement] = useState('')
  // The row whose first action gets focus once the list reloads, since the button pressed is gone.
  const focusRow = useRef<number | null>(null)
  const table = useRef<HTMLDivElement>(null)
  const tableTitleId = useId()
  const bannerTitleId = useId()
  const myEmail = session.state.status === 'signedIn' ? session.state.account.email : null

  useEffect(() => {
    if (load.status !== 'ready' || focusRow.current === null) return
    const target = table.current?.querySelector<HTMLElement>(`tr[data-account="${focusRow.current}"] button`)
    focusRow.current = null
    ;(target ?? table.current)?.focus()
  }, [load])

  // An ended sign-in goes back to N-11. useEffectEvent keeps the session's sign-in checks from reloading the list.
  const report = useEffectEvent((error: unknown) => session.reportError(error))

  useEffect(() => {
    let current = true
    apiRequest<{ accounts: TeamAccount[] }>('/staff/accounts').then(
      ({ accounts }) => {
        if (current) setLoad({ status: 'ready', accounts })
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

  /** Loads the list again behind the current one, which stays on screen until the answer arrives. */
  function refresh() {
    setAttempt((n) => n + 1)
  }

  function invited(account: TeamAccount) {
    setInviting(false)
    setBanner({ kind: 'invited', account })
    refresh()
  }

  async function resend(account: TeamAccount) {
    if (busyId !== null || !online) return
    setBusyId(account.id)
    setBanner(null)
    try {
      await apiRequest(`/staff/accounts/${account.id}/invitation`, { method: 'POST' })
      setBanner({ kind: 'resent', account })
    } catch (error) {
      session.reportError(error)
      const apiError = error instanceof ApiError ? error : new ApiError('server_error', 500)
      setBanner({ kind: 'failed', error: apiError })
      // Someone else changed the account: show what it is now.
      if (apiError.status === 409) refresh()
    } finally {
      setBusyId(null)
    }
  }

  function changed(kind: Dialog['kind'], account: TeamAccount) {
    setDialog(null)
    setBanner(kind === 'role' ? { kind: 'roleChanged', account } : null)
    setAnnouncement(kind === 'deactivate' ? t.deactivated(account.name) : '')
    focusRow.current = account.id
    refresh()
  }

  async function reactivate(account: TeamAccount) {
    if (busyId !== null || !online) return
    setBusyId(account.id)
    setBanner(null)
    setAnnouncement('')
    try {
      await apiRequest(`/staff/accounts/${account.id}/reactivate`, { method: 'POST' })
      setAnnouncement(t.reactivated(account.name))
      focusRow.current = account.id
    } catch (error) {
      session.reportError(error)
      setBanner({ kind: 'failed', error: error instanceof ApiError ? error : new ApiError('server_error', 500) })
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  function open(kind: Dialog['kind'], account: TeamAccount) {
    if (blocked) return
    setBanner(null)
    setDialog({ kind, account })
  }

  const blocked = !online
  const action = (
    <Button aria-disabled={blocked || undefined} onClick={() => !blocked && setInviting(true)}>
      {t.invite}
    </Button>
  )

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description} action={action}>
      {notice}
      {inviting && (
        <InviteDialog onClose={() => setInviting(false)} onInvited={invited} onError={(error) => session.reportError(error)} />
      )}
      {dialog?.kind === 'ownRole' && <OwnRoleDialog account={dialog.account} onClose={() => setDialog(null)} />}
      {(dialog?.kind === 'role' || dialog?.kind === 'deactivate') &&
        (() => {
          const Change = dialog.kind === 'role' ? RoleDialog : DeactivateDialog
          return (
            <Change
              account={dialog.account}
              onClose={() => setDialog(null)}
              onDone={(account) => changed(dialog.kind, account)}
              onError={(error) => {
                session.reportError(error)
                // Someone else changed the account: show what it is now, behind the modal.
                if (error instanceof ApiError && error.status === 409) refresh()
              }}
            />
          )
        })()}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
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
        return <OfflineState detail={t.offlineText} online={online} onRetry={retry} />
    }

    const accounts = load.accounts
    const active = accounts.filter((account) => account.status === 'active').length
    const invitedCount = accounts.filter((account) => account.status === 'invited').length

    return (
      <>
        {!online && (
          <section className="state" role="status">
            <h2 className="state__title">{texts.states.offlineTitle}</h2>
            <p className="state__detail">{t.offlineText}</p>
          </section>
        )}

        {banner?.kind === 'failed' && <Notice title={errorText(texts, banner.error.code, banner.error.status)} />}
        {banner?.kind === 'invited' && (
          <section className="state" role="status" aria-labelledby={bannerTitleId}>
            <h2 className="state__title" id={bannerTitleId}>
              {t.invitedTitle}
            </h2>
            <p className="state__detail">{t.invitedText(firstName(banner.account.name))}</p>
            <span className="team-chip team-chip--invited-outline">{t.status.invited}</span>
          </section>
        )}
        {banner?.kind === 'roleChanged' && (
          <section className="state" role="status" aria-labelledby={bannerTitleId}>
            <h2 className="state__title" id={bannerTitleId}>
              {t.roleChangedTitle}
            </h2>
            <p className="state__detail">
              {t.roleChangedText(banner.account.name, texts.dashboard.roles[banner.account.role])}
            </p>
          </section>
        )}
        {banner?.kind === 'resent' && (
          <section className="state" role="status" aria-labelledby={bannerTitleId}>
            <h2 className="state__title" id={bannerTitleId}>
              {t.resentTitle}
            </h2>
            <p className="state__detail">{t.resentText(banner.account.email, firstName(banner.account.name))}</p>
          </section>
        )}

        <p className="team-summary">{t.summary(active, invitedCount)}</p>

        <div className="team-bar">
          <h2 className="team-bar__title" id={tableTitleId}>
            {t.tableTitle}
          </h2>
          <p className="team-bar__hint">{t.tableHint}</p>
        </div>

        {/* Scrolls sideways on a phone; tabIndex lets the keyboard scroll it too (WCAG 2.1.1). */}
        <div className="team-table" role="region" aria-labelledby={tableTitleId} tabIndex={0} ref={table}>
          <table aria-labelledby={tableTitleId}>
            <thead>
              <tr>
                <th scope="col">{t.columns.name}</th>
                <th scope="col">{t.columns.email}</th>
                <th scope="col">{t.columns.role}</th>
                <th scope="col">{t.columns.status}</th>
                {/* Figma has one "Acciones" column; the team split it so each action lines up down the table. */}
                <th scope="col">{t.columns.account}</th>
                <th scope="col">{t.columns.access}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} data-account={account.id}>
                  <td>{account.name}</td>
                  <td>{account.email}</td>
                  <td>{texts.dashboard.roles[account.role]}</td>
                  <td>
                    <span className={`team-chip team-chip--${account.status}`}>{t.status[account.status]}</span>
                  </td>
                  {actions(account).map((action, column) => (
                    <td key={column}>{action}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="team-note">
          <h2 className="team-note__title">{t.keptTitle}</h2>
          <p className="team-note__text">{t.keptText}</p>
        </section>
      </>
    )
  }

  /** The row's two action columns: Cuenta (Cambiar rol, Reenviar invitación or Reactivar) and Acceso (Desactivar). */
  function actions(account: TeamAccount): [ReactNode, ReactNode] {
    const busy = blocked || busyId !== null
    const rowAction = (label: string, onClick: () => void, disabled = blocked, danger = false) => (
      <Button
        key={label}
        // Bordered, as the team chose over Figma's plain green text.
        variant="secondary"
        className={danger ? 'team-action team-action--danger' : 'team-action'}
        // The name tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
        aria-label={`${label}, ${account.name}`}
        aria-disabled={disabled || undefined}
        onClick={onClick}
      >
        {label}
      </Button>
    )

    // Reactivar has no Figma frame: it sits where the frame shows "Sin acceso", in the same style (E-150).
    if (account.status === 'deactivated') return [rowAction(t.reactivate, () => void reactivate(account), busy), null]
    const deactivate = rowAction(t.deactivate, () => open('deactivate', account), blocked, true)
    if (account.status === 'invited') return [rowAction(t.resend, () => void resend(account), busy), deactivate]
    // Your own row: no Desactivar, and Cambiar rol explains why it cannot change (4039:3285).
    if (account.email === myEmail) return [rowAction(t.changeRole, () => open('ownRole', account)), null]
    return [rowAction(t.changeRole, () => open('role', account)), deactivate]
  }
}
