import { useEffect, useRef, useState } from 'react'
import { LoadingState, Notice } from '../components'
import { DashboardShell } from '../dashboard/DashboardShell'
import { useMessages } from '../i18n'
import { SignInLayout } from './SignInLayout'
import { StaffSessionProvider } from './StaffSession'
import { StaffSignIn } from './StaffSignIn'
import { ForgotPasswordPage, SetPasswordPage } from './access/StaffAccessPages'
import {
  STAFF_FORGOT_PATH,
  STAFF_INVITE_PATH,
  STAFF_PATH,
  STAFF_RESET_PATH,
  STAFF_TEAM_PATH,
  useStaffPath,
  type Navigate,
} from './staffPath'
import { StaffTeam } from './team/StaffTeam'
import { useStaffSession, type StaffAccount } from './useStaffSession'

// The staff part of the PWA, at /staff (#16): N-11 until someone signs in, then the dashboard shell.

function SignedIn({ account, path, navigate }: { account: StaffAccount; path: string; navigate: Navigate }) {
  const session = useStaffSession()
  const texts = useMessages().dashboard
  const [signOutFailed, setSignOutFailed] = useState(false)

  // After a menu click the page's h1 takes focus, so a screen reader starts from the new page. Done here, not in
  // the shell: the shell of each screen is a new one, so it never sees the path change.
  const shownPath = useRef(path)
  useEffect(() => {
    if (shownPath.current === path) return
    shownPath.current = path
    document.querySelector<HTMLElement>('#dashboard-content h1')?.focus()
  }, [path])

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
  const [path, navigate] = useStaffPath()
  // Set when a new password was saved from an email link, so N-11 says so once.
  const [saved, setSaved] = useState(false)

  function passwordSaved() {
    setSaved(true)
    // replace: Back does not reopen the used email link, and its token leaves the address bar.
    navigate(STAFF_PATH, { replace: true })
  }

  // The pages before sign-in (#84). They open from N-11 or an email link, signed in or not.
  if (path === STAFF_FORGOT_PATH) return <ForgotPasswordPage navigate={navigate} />
  if (path === STAFF_INVITE_PATH) return <SetPasswordPage kind="invite" navigate={navigate} onSaved={passwordSaved} />
  if (path === STAFF_RESET_PATH) return <SetPasswordPage kind="reset" navigate={navigate} onSaved={passwordSaved} />

  switch (state.status) {
    case 'checking':
      return (
        <SignInLayout>
          <LoadingState />
        </SignInLayout>
      )
    case 'offline':
      return <StaffSignIn onSignIn={session.signIn} startWith="offline" navigate={navigate} />
    case 'signedOut':
      // A new N-11 each time a sign-in ends, so an old notice never stays behind.
      return (
        <StaffSignIn
          key={state.reason ?? (saved ? 'saved' : 'signed-out')}
          onSignIn={session.signIn}
          startWith={state.reason ?? (saved ? 'saved' : null)}
          navigate={navigate}
        />
      )
    case 'signedIn':
      return <SignedIn account={state.account} path={path} navigate={navigate} />
  }
}

export function StaffApp() {
  return (
    <StaffSessionProvider>
      <StaffScreens />
    </StaffSessionProvider>
  )
}
