import { useEffect, useState } from 'react'
import { Calendar, Image, Megaphone, TriangleAlert, Users, WifiOff } from 'lucide-react'
import { ApiError, apiRequest } from '../api/client'
import { useDateFormat } from '../format/dateTime'
import { useMessages } from '../i18n'
import { UserPage } from './ui'
import { useConnection } from './useConnection'
import './gym.css'

type Occupancy = { count: number; max: number; updated_at: string }

export function Gym({ ended }: { ended: (error: unknown) => boolean }) {
  const t = useMessages().gym
  const user = useMessages().user
  const dates = useDateFormat()
  const online = useConnection()
  const [data, setData] = useState<Occupancy | null>(null)
  const [problem, setProblem] = useState<'offline' | 'error' | null>(null)
  const offline = !online || problem === 'offline'

  useEffect(() => {
    if (!online) return
    let disposed = false
    let pending = false
    const refresh = async (background = false) => {
      if (pending || !navigator.onLine || document.hidden) return
      pending = true
      try {
        const next = await apiRequest<Occupancy>('/user/occupancy', { autoRefresh: background })
        if (!disposed) { setData(next); setProblem(null) }
      } catch (error) {
        if (!disposed && !ended(error)) setProblem(error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error')
      } finally { pending = false }
    }
    void refresh()
    const timer = setInterval(() => void refresh(true), 25_000)
    const visible = () => { if (!document.hidden) void refresh(true) }
    document.addEventListener('visibilitychange', visible)
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [online, ended])

  const available = online && !problem && data !== null
  return <UserPage header={false} current="gym" offline={offline} className="gym">
    <h1 tabIndex={-1}>{user.gym}</h1>
    {!offline && <p>{t.lead}</p>}
    <section className="gym-occupancy" aria-labelledby="occupancy-heading" aria-busy={!data && !problem && online}>
      <div className="gym-occupancy__heading"><h2 id="occupancy-heading">{t.title}</h2>{available && <Users aria-hidden="true" />}</div>
      {available ? <>
        <p className="gym-occupancy__count"><strong>{data.count}</strong><span>{t.people}</span><span className="gym-occupancy__badge">{data.count < data.max / 3 ? t.low : data.count <= 2 * data.max / 3 ? t.moderate : t.high}</span></p>
        <div className="gym-occupancy__bar" aria-hidden="true"><div style={{ width: `${Math.min(100, data.count / data.max * 100)}%` }} /></div>
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

