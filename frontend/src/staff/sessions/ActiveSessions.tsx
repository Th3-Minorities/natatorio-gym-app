import { TriangleAlert, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useId, useRef } from 'react'
import { ApiError } from '../../api/client'
import { DashboardShell } from '../../dashboard/DashboardShell'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { occupancyLevel, occupancyPercent, useOccupancy } from '../../occupancy/useOccupancy'
import type { ShellProps } from '../team/StaffTeam'
import { useDocumentTitle } from '../useDocumentTitle'
import { useStaffSession } from '../useStaffSession'
import './activeSessions.css'

// S-01 "Sesiones activas" (Figma 121:2841), the dashboard home for Staff and Administrators (#26). For now only the
// occupancy card: the sessions list, check-out and the "Gimnasio abierto" chip come later.

export function ActiveSessions({ shell }: { shell: ShellProps }) {
  const { notice, ...shellProps } = shell
  const texts = useMessages()
  const t = texts.activeSessions
  useDocumentTitle(t.title)

  return (
    <DashboardShell {...shellProps} title={t.title} description={t.description}>
      {notice}
      <OccupancyCard />
    </DashboardShell>
  )
}

/**
 * The count Users see on Gimnasio, with Figma's S-01 layout plus the level and the bar of C-01 (E-178). A new count
 * is not announced, to avoid noise; "not current" is announced once (screen map, accessibility notes).
 */
function OccupancyCard() {
  const texts = useMessages()
  const t = texts.activeSessions
  const gym = texts.gym
  const dates = useDateFormat()
  const session = useStaffSession()
  const titleId = useId()
  // The session object changes with each sign-in check; a ref keeps the polling from starting over each time.
  const report = useRef(session.reportError)
  useEffect(() => {
    report.current = session.reportError
  })
  // An ended sign-in goes back to N-11, so the card does not show that error.
  const ended = useCallback((error: unknown) => {
    report.current(error)
    return error instanceof ApiError && error.status === 401
  }, [])
  const { data, problem, online, offline, available } = useOccupancy('/staff/occupancy', ended)

  return (
    <section className="staff-occupancy" aria-labelledby={titleId} aria-busy={(!data && !problem && online) || undefined}>
      <div className="staff-occupancy__main">
        <h2 className="staff-occupancy__label" id={titleId}>
          {t.inside}
        </h2>
        {available && data ? (
          <>
            <p className="staff-occupancy__count">
              <strong>{data.count}</strong>
              <span className="staff-occupancy__level">{gym[occupancyLevel(data)]}</span>
            </p>
            <div className="staff-occupancy__bar" aria-hidden="true">
              <div style={{ width: `${occupancyPercent(data)}%` }} />
            </div>
            <p className="staff-occupancy__caption">{gym.updated(dates.time(data.updated_at, true))}</p>
          </>
        ) : offline || problem ? (
          <>
            <p className="staff-occupancy__problem" role="status">
              {offline ? <WifiOff aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
              {offline ? gym.offline : gym.failed}
            </p>
            <p className="staff-occupancy__caption">{gym.stale(data ? dates.time(data.updated_at) : undefined)}</p>
          </>
        ) : (
          <>
            <div className="staff-occupancy__skeleton" aria-hidden="true" />
            <p className="staff-occupancy__caption" role="status">
              {gym.loading}
            </p>
          </>
        )}
      </div>
      <p className="staff-occupancy__rule">{t.closeRule}</p>
    </section>
  )
}
