import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiRequest } from '../api/client'
import { I18nProvider } from '../i18n'
import {
  StaffSessionContext,
  endedSignIn,
  type StaffAccount,
  type StaffSession,
  type StaffSessionState,
} from './useStaffSession'

/**
 * Checks once a minute while signed in, as an automatic refresh (E-130): it does not keep the sign-in
 * alive, but it lets the dashboard notice a timeout without waiting for the next click.
 */
const CHECK_EVERY_MS = 60_000

/** Asks who is signed in. Answers the next state, or null to keep the current one. */
async function whoIsSignedIn(autoRefresh: boolean): Promise<StaffSessionState | null> {
  try {
    const account = await apiRequest<StaffAccount>('/staff/me', { autoRefresh })
    return { status: 'signedIn', account }
  } catch (error) {
    const reason = endedSignIn(error)
    if (reason !== undefined) return { status: 'signedOut', reason }
    // A failed background check keeps the screen as it is; a failed first check shows "no connection".
    return autoRefresh ? null : { status: 'offline' }
  }
}

/** Same status and same account fields: nothing for the screens to redraw. */
function sameState(a: StaffSessionState, b: StaffSessionState): boolean {
  if (a.status !== b.status) return false
  if (a.status === 'signedIn' && b.status === 'signedIn') {
    const [x, y] = [a.account, b.account]
    return x.name === y.name && x.email === y.email && x.role === y.role && x.locale === y.locale
  }
  if (a.status === 'signedOut' && b.status === 'signedOut') return a.reason === b.reason
  return true
}

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StaffSessionState>({ status: 'checking' })

  // Goes up each time the person signs in or out, or the sign-in ends. An answer to a check that started
  // before that is old and is dropped, so a late "signed in" never brings the dashboard back.
  const changes = useRef(0)
  const change = useCallback((next: StaffSessionState) => {
    changes.current += 1
    setState(next)
  }, [])

  const check = useCallback(async (autoRefresh: boolean) => {
    const startedAt = changes.current
    const next = await whoIsSignedIn(autoRefresh)
    if (next && startedAt === changes.current) {
      setState((current) => (sameState(current, next) ? current : next))
    }
  }, [])

  useEffect(() => {
    // Ignore a late answer after the page is gone (StrictMode runs effects twice in development).
    let ignore = false
    const startedAt = changes.current
    whoIsSignedIn(false).then((next) => {
      if (!ignore && next && startedAt === changes.current) setState(next)
    })
    return () => {
      ignore = true
    }
  }, [])

  const signedIn = state.status === 'signedIn'
  useEffect(() => {
    if (!signedIn) return
    const timer = setInterval(() => void check(true), CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [signedIn, check])

  const session = useMemo<StaffSession>(
    () => ({
      state,
      async signIn(email, password) {
        const account = await apiRequest<StaffAccount>('/staff/sign-in', { method: 'POST', body: { email, password } })
        change({ status: 'signedIn', account })
      },
      async signOut() {
        try {
          await apiRequest('/staff/sign-out', { method: 'POST' })
        } catch (error) {
          // Already signed out on the server: nothing left to end. Any other failure, like no connection,
          // is thrown and the person stays signed in, so nobody believes the desk is signed out when it is not.
          if (endedSignIn(error) === undefined) throw error
        }
        change({ status: 'signedOut', reason: null })
      },
      retry: () => check(false),
      reportError(error) {
        const reason = endedSignIn(error)
        if (reason !== undefined) change({ status: 'signedOut', reason })
      },
    }),
    [state, check, change],
  )

  // The dashboard speaks the account language (E-104); before sign-in it is Spanish (E-103).
  const locale = state.status === 'signedIn' ? state.account.locale : undefined

  return (
    <StaffSessionContext.Provider value={session}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </StaffSessionContext.Provider>
  )
}
