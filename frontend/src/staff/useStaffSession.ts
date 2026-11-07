import { createContext, useContext } from 'react'
import { ApiError } from '../api/client'

/** The signed-in staff account, as /api/staff/me answers it (docs/design/api-conventions.md, section 6). */
export type StaffAccount = {
  name: string
  email: string
  role: 'staff' | 'admin'
  locale: string
}

/** Why a sign-in ended without the person signing out: N-11 and the inactivity screen show it. */
export type SignOutReason = 'timeout' | 'deactivated' | null

export type StaffSessionState =
  | { status: 'checking' }
  | { status: 'offline' }
  | { status: 'signedOut'; reason: SignOutReason }
  | { status: 'signedIn'; account: StaffAccount }

export type StaffSession = {
  state: StaffSessionState
  /** Throws the ApiError so the sign-in screen can show it. */
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Asks again after "no connection". */
  retry: () => Promise<void>
  /** Every screen passes its API errors here, so an ended sign-in shows at once. */
  reportError: (error: unknown) => void
}

/** The API codes that mean the staff sign-in is over, and why. */
const ENDED: Record<string, SignOutReason> = {
  staff_session_expired: 'timeout',
  staff_account_deactivated: 'deactivated',
  unauthenticated: null,
}

/** The reason when the error ends the sign-in, undefined when it does not. */
export function endedSignIn(error: unknown): SignOutReason | undefined {
  // Object.hasOwn, not `in`: a code like "constructor" must not match what every object has.
  return error instanceof ApiError && Object.hasOwn(ENDED, error.code) ? ENDED[error.code] : undefined
}

export const StaffSessionContext = createContext<StaffSession | null>(null)

export function useStaffSession(): StaffSession {
  const session = useContext(StaffSessionContext)
  if (!session) throw new Error('useStaffSession needs a StaffSessionProvider above it.')
  return session
}
