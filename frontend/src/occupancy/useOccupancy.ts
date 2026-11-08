import { useEffect, useState } from 'react'
import { ApiError, apiRequest } from '../api/client'
import { useConnection } from '../user/useConnection'

// The occupancy count that C-01 on Gimnasio and S-01 on the dashboard both show (REQ-F-41, E-164, E-178).

export type Occupancy = { count: number; max: number; updated_at: string }

export type OccupancyLevel = 'low' | 'moderate' | 'high'

/** Thirds of the top of the bar: Baja, Moderada, Alta. A count over the top is Alta (E-178). */
export function occupancyLevel({ count, max }: Occupancy): OccupancyLevel {
  return count < max / 3 ? 'low' : count <= (2 * max) / 3 ? 'moderate' : 'high'
}

/** How full the bar is, from 0 to 100. */
export function occupancyPercent({ count, max }: Occupancy): number {
  return Math.min(100, (count / max) * 100)
}

/** Asks every 25 seconds (E-164: 20 to 30), only while the page is visible and online. */
export const OCCUPANCY_POLL = 25_000

/**
 * Loads the count from path and asks again while the page is visible. ended says whether an error ended the
 * sign-in; that screen then leaves, so the error is not shown here.
 */
export function useOccupancy(path: string, ended: (error: unknown) => boolean) {
  const online = useConnection()
  const [data, setData] = useState<Occupancy | null>(null)
  const [problem, setProblem] = useState<'offline' | 'error' | null>(null)

  useEffect(() => {
    if (!online) return
    let disposed = false
    let pending = false
    const refresh = async (background = false) => {
      if (pending || !navigator.onLine || document.hidden) return
      pending = true
      try {
        const next = await apiRequest<Occupancy>(path, { autoRefresh: background })
        if (!disposed) {
          setData(next)
          setProblem(null)
        }
      } catch (error) {
        if (!disposed && !ended(error)) setProblem(error instanceof ApiError && error.code === 'offline' ? 'offline' : 'error')
      } finally {
        pending = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(true), OCCUPANCY_POLL)
    const visible = () => {
      if (!document.hidden) void refresh(true)
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [online, ended, path])

  const offline = !online || problem === 'offline'
  return { data, problem, online, offline, available: online && !problem && data !== null }
}
