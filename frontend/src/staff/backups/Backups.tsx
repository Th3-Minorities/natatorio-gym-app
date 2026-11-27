import { useEffect, useEffectEvent, useId, useState } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, ErrorState, LoadingState } from '../../components'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { SavedCard } from '../SavedCard'
import { TermStatus } from '../team/TermStatus'
import type { ShellProps } from '../team/StaffTeam'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import { DownloadDialog, RestoreDialog } from './BackupDialogs'
import '../team/staffTeam.css'
import './backups.css'

// A-16 "Respaldos" (Figma 4799:662, 4799:667, 4799:675 and the states in section 170:3067, #86). Only
// Administrators reach it; the API checks the role too. A backup or a restore runs on the server after the answer,
// so the screen asks again every few seconds until it ends.

export type Backup = { name: string; created_at: string; size: number }

type Status = {
  running: boolean
  // Which job runs and, for a restore, on which copy: a restore another tab or Admin started shows too.
  running_kind: 'backup' | 'restore' | null
  running_name: string | null
  backups: Backup[]
  kept: number
  next_at: string
  failed_at: string | null
  // at: when the restore ended. audit_csv: the file in the backup folder with the audit entries made after the copy.
  last_restore: { name: string; ok: boolean; at: string; audit_csv: string | null } | null
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'offline' } | { status: 'ready'; data: Status }

const POLL_MS = 3000

/** "1.28 GB", as drawn. */
function size(bytes: number): string {
  const [value, unit] = bytes >= 1e9 ? [bytes / 1e9, 'GB'] : bytes >= 1e6 ? [bytes / 1e6, 'MB'] : [bytes / 1e3, 'KB']
  return `${value.toFixed(2)} ${unit}`
}

/** The copy's moment from its file name, which is in Puerto Rico time (UTC-4 all year), or null for any other name. */
function copyMoment(name: string): string | null {
  const match = /^backup-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(\d{2})\.tar$/.exec(name)
  return match ? `${match[1]}T${match[2]}:${match[3]}:${match[4]}-04:00` : null
}

export function Backups({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const t = useMessages().backups
  const session = useStaffSession()
  const format = useDateFormat()
  useDocumentTitle(t.title)
  const online = useConnection()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  // auto: a check the screen made by itself while something runs; it does not keep the sign-in alive (E-130).
  const [attempt, setAttempt] = useState({ n: 0, auto: false })
  // The attempt whose request has ended, so the next automatic check waits for it and two never overlap.
  const [settled, setSettled] = useState(-1)
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [downloading, setDownloading] = useState<Backup | null>(null)
  const [restoring, setRestoring] = useState<{ backup: Backup; started: boolean } | null>(null)
  // The `at` of the failed restore whose banner the Admin closed.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const listId = useId()

  const report = useEffectEvent((error: unknown) => session.reportError(error))
  // When a restore this screen started has ended, "Restaurando" gives way to the result of the restore (see content()).
  const restoreEnded = useEffectEvent((data: Status) => {
    if (restoring?.started && !data.running) setRestoring(null)
  })

  useEffect(() => {
    let current = true
    apiRequest<Status>('/staff/backups', { autoRefresh: attempt.auto }).then(
      (data) => {
        if (!current) return
        setLoad({ status: 'ready', data })
        setSettled(attempt.n)
        restoreEnded(data)
      },
      (error: unknown) => {
        if (!current) return
        report(error)
        setSettled(attempt.n)
        // A failed check while the list is on screen keeps the list; the next check tries again.
        setLoad((shown) =>
          shown.status === 'ready' ? shown : { status: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error' },
        )
      },
    )
    return () => {
      current = false
    }
  }, [attempt])

  const data = load.status === 'ready' ? load.data : null
  const running = Boolean(data?.running) || Boolean(restoring?.started)

  useEffect(() => {
    if (!running || settled !== attempt.n) return
    const timer = setTimeout(() => setAttempt(({ n }) => ({ n: n + 1, auto: true })), POLL_MS)
    return () => clearTimeout(timer)
  }, [running, attempt, settled])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt(({ n }) => ({ n: n + 1, auto: false }))
  }

  async function backUpNow() {
    if (!online || running) return
    setProblem(null)
    try {
      await apiRequest('/staff/backups', { method: 'POST' })
    } catch (error) {
      session.reportError(error)
      // backup_running: one already runs, so the screen just shows it.
      if (!(error instanceof ApiError && error.code === 'backup_running')) {
        setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
        return
      }
    }
    setLoad((shown) => (shown.status === 'ready' ? { status: 'ready', data: { ...shown.data, running: true } } : shown))
    setAttempt(({ n }) => ({ n: n + 1, auto: false }))
  }

  const disabled = !online || running || undefined
  const action = (
    <Button aria-disabled={disabled} onClick={() => void backUpNow()}>
      {t.backUpNow}
    </Button>
  )
  const when = (iso: string) => `${format.date(iso)} · ${format.time(iso)}`

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description} action={action}>
      {notice}
      {downloading && <DownloadDialog backup={downloading} onClose={() => setDownloading(null)} onError={(error) => session.reportError(error)} />}
      {restoring && !restoring.started && (
        <RestoreDialog
          backup={restoring.backup}
          onClose={() => setRestoring(null)}
          onError={(error) => session.reportError(error)}
          onStarted={() => {
            setRestoring({ backup: restoring.backup, started: true })
            setAttempt(({ n }) => ({ n: n + 1, auto: false }))
          }}
        />
      )}
      <TermStatus text={t.activeTerm} noTermText={t.noTermText} />
      <ProblemNotice problem={problem} tone="error" />
      {(!online || load.status === 'offline') && (
        <section className="state" role="status">
          <h2 className="state__title">{t.offlineTitle}</h2>
          <p className="state__lead">{t.offlineLead}</p>
          <p className="state__detail">{t.offlineText}</p>
        </section>
      )}
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
        return null
    }

    const { backups, kept, next_at: nextAt, failed_at: failedAt, last_restore: lastRestore } = load.data
    const latest = backups[0]
    // A restore this screen did not start (another tab, another Admin) is shown the same way as one it started.
    const runningMoment = load.data.running && load.data.running_kind === 'restore' && load.data.running_name ? copyMoment(load.data.running_name) : null
    const restoringDate = restoring?.started ? format.date(restoring.backup.created_at) : runningMoment ? format.date(runningMoment) : null
    // The result of the last restore stays while it is the newest event: a backup or a restore that starts or ends
    // after it replaces it, and "Volver a respaldos" closes the failed one. It is there when the Admin signs in again.
    const restoreMoment = lastRestore ? copyMoment(lastRestore.name) : null
    const restoreAt = lastRestore ? Date.parse(lastRestore.at) : 0
    const showRestore =
      lastRestore !== null &&
      restoreMoment !== null &&
      !load.data.running &&
      !restoring &&
      dismissed !== lastRestore.at &&
      (!latest || restoreAt > Date.parse(latest.created_at)) &&
      (!failedAt || restoreAt > Date.parse(failedAt))

    return (
      <>
        {showRestore && !lastRestore.ok && (
          <section className="state" role="alert">
            <h2 className="state__title">{t.restoreFailedTitle}</h2>
            <p className="state__lead">{t.restoreFailedLead(format.date(restoreMoment))}</p>
            <p className="state__detail">{t.restoreFailedText}</p>
            <div className="state__action">
              <Button variant="secondary" className="state__button" onClick={() => setDismissed(lastRestore.at)}>
                {t.backToBackups}
              </Button>
            </div>
          </section>
        )}

        {/* One live region that is always on the page, so "Respaldando" is read when it appears (WCAG 4.1.3). */}
        <div className="team-live" role="status">
          {showRestore && lastRestore.ok && <SavedCard text={t.restored(format.date(restoreMoment))} />}
          {restoringDate !== null && (
            <section className="state">
              <h2 className="state__title">{t.restoringTitle}</h2>
              <p className="state__detail">{t.restoringText(restoringDate)}</p>
              <div className="state__action">
                <Button className="state__button" aria-disabled="true">
                  {t.restoring}
                </Button>
              </div>
            </section>
          )}
          {load.data.running && restoringDate === null && !restoring && (
            <section className="state">
              <h2 className="state__title">{t.runningTitle}</h2>
              <p className="state__detail">{t.runningText}</p>
              <div className="state__action">
                <Button className="state__button" aria-disabled="true">
                  {t.running}
                </Button>
              </div>
            </section>
          )}
        </div>

        {failedAt && !load.data.running && (
          <section className="state" role="alert">
            <h2 className="state__title">{t.failedTitle}</h2>
            <p className="state__lead">{t.failedLead(format.date(failedAt), format.time(failedAt))}</p>
            <p className="state__detail">
              {latest ? t.failedText(backups.length, `${format.date(latest.created_at)}, ${format.time(latest.created_at)}`) : t.failedNoCopy}
            </p>
            <div className="state__action">
              <Button className="state__button" aria-disabled={disabled} onClick={() => void backUpNow()}>
                {t.retryBackup}
              </Button>
            </div>
          </section>
        )}

        {latest ? (
          <>
            <div className="backups-cards">
              <p className="backups-card">
                <span>{when(latest.created_at)}</span>
                <span>{t.lastBackup}</span>
              </p>
              <p className="backups-card">
                <span>{when(nextAt)}</span>
                <span>{t.nextAutomatic}</span>
              </p>
              <p className="backups-card">
                <span>{t.keptCount(backups.length, kept)}</span>
                <span>{t.onServer}</span>
              </p>
            </div>

            <h2 className="backups-list-title" id={listId}>
              {t.listTitle}
            </h2>
            {/* Scrolls sideways on a narrow window; tabIndex lets the keyboard scroll it too (WCAG 2.1.1). */}
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="team-table" role="region" aria-labelledby={listId} tabIndex={0}>
              <table className="backups-table" aria-labelledby={listId}>
                <thead>
                  <tr>
                    <th scope="col">{t.columns.date}</th>
                    <th scope="col">{t.columns.result}</th>
                    <th scope="col">{t.columns.content}</th>
                    <th scope="col">{t.columns.size}</th>
                    <th scope="col">{t.columns.download}</th>
                    <th scope="col">{t.columns.restore}</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.name}>
                      <td>{when(backup.created_at)}</td>
                      <td>
                        <span className="team-chip team-chip--invited-outline">{t.correct}</span>
                      </td>
                      <td>{t.databaseAndPhotos}</td>
                      <td>{size(backup.size)}</td>
                      <td>
                        <Button
                          variant="secondary"
                          className="backups-row-button"
                          // The date tells the rows apart for screen readers; the visible text comes first (WCAG 2.5.3).
                          aria-label={`${t.download}, ${when(backup.created_at)}`}
                          aria-disabled={disabled}
                          onClick={() => online && !running && setDownloading(backup)}
                        >
                          {t.download}
                        </Button>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          className="backups-row-button"
                          aria-label={`${t.restore}, ${when(backup.created_at)}`}
                          aria-disabled={disabled}
                          onClick={() => {
                            if (!online || running) return
                            setRestoring({ backup, started: false })
                          }}
                        >
                          {t.restore}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          !load.data.running && (
            <section className="state">
              <h2 className="state__title">{t.emptyTitle}</h2>
              <p className="state__lead">{t.emptyLead}</p>
              <p className="state__detail">{t.emptyText(`${format.date(nextAt)}, ${format.time(nextAt)}`)}</p>
              <div className="state__action">
                <Button className="state__button" aria-disabled={disabled} onClick={() => void backUpNow()}>
                  {t.backUpNow}
                </Button>
              </div>
            </section>
          )
        )}

        <section className="team-note backups-note">
          <h2 className="team-note__title">{t.encryptedTitle}</h2>
          <p className="team-note__text">{t.encryptedText}</p>
        </section>
        <section className="team-note backups-note">
          <h2 className="team-note__title">{t.replacesTitle}</h2>
          <p className="team-note__text">{t.replacesText}</p>
        </section>
        <p className="backups-footnote">{t.footnote}</p>
      </>
    )
  }
}
