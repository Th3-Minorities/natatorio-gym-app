import { useCallback, useEffect, useState } from 'react'

/**
 * The staff dashboard lives at /staff (team decision on E-124's open path name, 2026-11-06), on the same
 * name as the app and with no link from the User sign-in.
 */
export const STAFF_PATH = '/staff'

/** A-15, the Administrator's staff accounts screen (#84). The proxy serves the app for it, so it opens directly. */
export const STAFF_TEAM_PATH = '/staff/equipo'

/** S-03, find a person and the assisted Check In (#26). */
export const STAFF_FIND_PATH = '/staff/buscar'

/** S-02 for one visit (#26): /staff/sesiones/11. */
export const STAFF_SESSIONS_PATH = '/staff/sesiones'

export function staffSessionPath(id: number): string {
  return `${STAFF_SESSIONS_PATH}/${id}`
}

/** The visit id in an S-02 address, or null. */
export function sessionIdIn(pathname: string): number | null {
  const match = /^\/staff\/sesiones\/(\d{1,18})$/.exec(pathname)
  return match ? Number(match[1]) : null
}

/** The N-11 pages for a forgotten password and the email links (#84). The emails link to the last two. */
export const STAFF_FORGOT_PATH = '/staff/recuperar'
export const STAFF_INVITE_PATH = '/staff/invitacion'
export const STAFF_RESET_PATH = '/staff/restablecer'

export function isStaffPath(pathname: string): boolean {
  return pathname === STAFF_PATH || pathname.startsWith(`${STAFF_PATH}/`)
}

/** Changes the page. replace swaps the current history entry, so Back does not reopen an email link. */
export type Navigate = (path: string, options?: { replace?: boolean }) => void

/** The address bar's path, and a way to change it without reloading. The browser's back button works too. */
export function useStaffPath(): [string, Navigate] {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const changed = () => setPath(window.location.pathname)
    window.addEventListener('popstate', changed)
    return () => window.removeEventListener('popstate', changed)
  }, [])

  const navigate = useCallback<Navigate>((next, options) => {
    const current = window.location.pathname + window.location.search
    if (options?.replace) window.history.replaceState(null, '', next)
    else if (next !== current) window.history.pushState(null, '', next)
    setPath(new URL(next, window.location.origin).pathname)
  }, [])

  return [path, navigate]
}
