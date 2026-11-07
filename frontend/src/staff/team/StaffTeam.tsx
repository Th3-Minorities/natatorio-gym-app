import { useEffect, useEffectEvent, useId, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { ErrorState, LoadingState, OfflineState } from '../../components'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { useStaffSession } from '../useStaffSession'
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

export function StaffTeam() {
  const texts = useMessages()
  const t = texts.staffTeam
  const session = useStaffSession()
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  // Each retry counts up, and the effect below asks for the list again.
  const [attempt, setAttempt] = useState(0)
  const tableTitleId = useId()

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

  switch (load.status) {
    case 'loading':
      return <LoadingState title={t.loadingTitle} detail={t.loadingText} />
    case 'error':
      return <ErrorState onRetry={retry} />
    case 'offline':
      return <OfflineState detail={t.offlineText} online={online} onRetry={retry} />
  }

  const active = load.accounts.filter((account) => account.status === 'active').length
  const invited = load.accounts.filter((account) => account.status === 'invited').length

  return (
    <>
      {!online && (
        <section className="state" role="status">
          <h2 className="state__title">{texts.states.offlineTitle}</h2>
          <p className="state__detail">{t.offlineText}</p>
        </section>
      )}

      <p className="team-summary">{t.summary(active, invited)}</p>

      <div className="team-bar">
        <h2 className="team-bar__title" id={tableTitleId}>
          {t.tableTitle}
        </h2>
        <p className="team-bar__hint">{t.tableHint}</p>
      </div>

      {/* Scrolls sideways on a phone; tabIndex lets the keyboard scroll it too (WCAG 2.1.1). */}
      <div className="team-table" role="region" aria-labelledby={tableTitleId} tabIndex={0}>
        <table aria-labelledby={tableTitleId}>
          <thead>
            <tr>
              <th scope="col">{t.columns.name}</th>
              <th scope="col">{t.columns.email}</th>
              <th scope="col">{t.columns.role}</th>
              <th scope="col">{t.columns.status}</th>
              <th scope="col">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {load.accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>{texts.dashboard.roles[account.role]}</td>
                <td>
                  <span className={`team-chip team-chip--${account.status}`}>{t.status[account.status]}</span>
                </td>
                <td>{account.status === 'deactivated' ? t.noAccess : null}</td>
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
