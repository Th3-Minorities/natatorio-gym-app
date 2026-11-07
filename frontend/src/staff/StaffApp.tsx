import { useState } from 'react'
import { LoadingState, Notice } from '../components'
import { DashboardShell } from '../dashboard/DashboardShell'
import { useMessages } from '../i18n'
import { SignInLayout } from './SignInLayout'
import { StaffSessionProvider } from './StaffSession'
import { StaffSignIn } from './StaffSignIn'
import { STAFF_TEAM_PATH, useStaffPath } from './staffPath'
import { StaffTeam } from './team/StaffTeam'
import { useStaffSession, type StaffAccount } from './useStaffSession'

// The staff part of the PWA, at /staff (#16): N-11 until someone signs in, then the dashboard shell.

function SignedIn({ account }: { account: StaffAccount }) {
  const session = useStaffSession()
  const texts = useMessages().dashboard
  const [signOutFailed, setSignOutFailed] = useState(false)
  const [path, navigate] = useStaffPath()
  const navigation = { currentPath: path, onNavigate: navigate, staffAccounts: STAFF_TEAM_PATH }
  // A Staff account at an Administrator address sees the empty dashboard; the API refuses the list anyway.
  const onTeam = account.role === 'admin' && path === STAFF_TEAM_PATH

  async function signOut() {
    setSignOutFailed(false)
    try {
      await session.signOut()
    } catch {
      // No connection: still signed in on the server, so say so instead of pretending.
      setSignOutFailed(true)
    }
  }

  const shell = {
    account: { name: account.name, role: account.role },
    onSignOut: signOut,
    navigation,
    notice: signOutFailed ? <Notice title={texts.signOutFailedTitle}>{texts.signOutFailedText}</Notice> : null,
  }

  if (onTeam) return <StaffTeam shell={shell} />

  const { notice, ...shellProps } = shell
  return (
    // Without a screen: no title and an empty main area. S-01, the first screen after sign-in, is #26.
    <DashboardShell {...shellProps}>{notice}</DashboardShell>
  )
}

function StaffScreens() {
  const session = useStaffSession()
  const { state } = session

  switch (state.status) {
    case 'checking':
      return (
        <SignInLayout>
          <LoadingState />
        </SignInLayout>
      )
    case 'offline':
      return <StaffSignIn onSignIn={session.signIn} startWith="offline" />
    case 'signedOut':
      // A new N-11 each time a sign-in ends, so an old notice never stays behind.
      return <StaffSignIn key={state.reason ?? 'signed-out'} onSignIn={session.signIn} startWith={state.reason} />
    case 'signedIn':
      return <SignedIn account={state.account} />
  }
}

export function StaffApp() {
  return (
    <StaffSessionProvider>
      <StaffScreens />
    </StaffSessionProvider>
  )
}
