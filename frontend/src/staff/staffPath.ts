import { useCallback, useEffect, useState } from 'react'

/**
 * The staff dashboard lives at /staff (team decision on E-124's open path name, 2026-11-06), on the same
 * name as the app and with no link from the User sign-in. /staff/recuperar is the password reset of #84.
 */
export const STAFF_PATH = '/staff'

/** A-15, the Administrator's staff accounts screen (#84). The proxy serves the app for it, so it opens directly. */
export const STAFF_TEAM_PATH = '/staff/equipo'

export function isStaffPath(pathname: string): boolean {
  return pathname === STAFF_PATH || pathname.startsWith(`${STAFF_PATH}/`)
}

/** The address bar's path, and a way to change it without reloading. The browser's back button works too. */
export function useStaffPath(): [string, (path: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const changed = () => setPath(window.location.pathname)
    window.addEventListener('popstate', changed)
    return () => window.removeEventListener('popstate', changed)
  }, [])

  const navigate = useCallback((next: string) => {
    if (next !== window.location.pathname) window.history.pushState(null, '', next)
    setPath(next)
  }, [])

  return [path, navigate]
}
