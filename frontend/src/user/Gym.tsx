import { Calendar, Image, Megaphone, TriangleAlert, Users, WifiOff } from 'lucide-react'
import { useDateFormat } from '../format/dateTime'
import { useMessages } from '../i18n'
import { occupancyLevel, occupancyPercent, useOccupancy } from '../occupancy/useOccupancy'
import { UserPage } from './ui'
import './gym.css'

export function Gym({ ended }: { ended: (error: unknown) => boolean }) {
  const t = useMessages().gym
  const user = useMessages().user
  const dates = useDateFormat()
  const { data, problem, online, offline, available } = useOccupancy('/user/occupancy', ended)

  return <UserPage header={false} current="gym" offline={offline} className="gym">
    <h1 tabIndex={-1}>{user.gym}</h1>
    {!offline && <p>{t.lead}</p>}
    <section className="gym-occupancy" aria-labelledby="occupancy-heading" aria-busy={!data && !problem && online}>
      <div className="gym-occupancy__heading"><h2 id="occupancy-heading">{t.title}</h2>{available && <Users aria-hidden="true" />}</div>
      {available && data ? <>
        <p className="gym-occupancy__count"><strong>{data.count}</strong><span>{t.people}</span><span className="gym-occupancy__badge">{t[occupancyLevel(data)]}</span></p>
        <div className="gym-occupancy__bar" aria-hidden="true"><div style={{ width: `${occupancyPercent(data)}%` }} /></div>
        <p className="gym-caption">{t.updated(dates.time(data.updated_at, true))}</p>
      </> : offline || problem ? <>
        {offline ? <WifiOff aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
        <p className="gym-occupancy__problem" role="status">{offline ? t.offline : t.failed}</p>
        <p className="gym-caption">{t.stale(data ? dates.time(data.updated_at) : undefined)}</p>
      </> : <><div className="gym-occupancy__skeleton" aria-hidden="true" /><p role="status">{t.loading}</p></>}
    </section>
    {/* These destinations are supplied by the schedules, notices and machine-guide issues. */}
    <div className="gym-shortcuts"><div><Calendar aria-hidden="true" /><span>{t.schedules}</span></div><div><Megaphone aria-hidden="true" /><span>{t.notices}</span></div></div>
    <h2 className="gym-guide-title">{t.guide}</h2>
    <div className="gym-machine"><Image aria-hidden="true" /><div><h3>{t.bench}</h3><p>{t.learnBench}</p></div></div>
    <div className="gym-machine"><Image aria-hidden="true" /><div><h3>{t.pulldown}</h3><p>{t.learnPulldown}</p></div></div>
  </UserPage>
}

