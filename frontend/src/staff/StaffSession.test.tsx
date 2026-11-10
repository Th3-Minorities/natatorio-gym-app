import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useMessages } from '../i18n'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { StaffSessionProvider } from './StaffSession'
import { useStaffSession, type StaffSessionState } from './useStaffSession'

// The staff sign-in of #16 in the PWA: /api/staff/me, sign-in, sign-out (docs/design/api-conventions.md, section 6).

const lorena = { name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', locale: 'en' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function errorResponse(code: string, status: number) {
  return json({ error: { code } }, status)
}

/** Answers by path; the CSRF cookie is set so POSTs go straight through. */
function fakeApi(routes: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (path: string, _init?: RequestInit) => {
    const answer = routes[path]
    if (!answer) throw new Error(`No fake answer for ${path}`)
    return answer()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let session: ReturnType<typeof useStaffSession>
let renders = 0

function Probe() {
  const current = useStaffSession()
  const texts = useMessages()
  // Hand the session to the test after rendering, so the test can call signIn, signOut and the others,
  // and count how many times the dashboard redraws.
  useEffect(() => {
    session = current
    renders += 1
  })
  return (
    <>
      <p data-testid="status">{label(current.state)}</p>
      <p data-testid="language">{texts.dashboard.signOut}</p>
    </>
  )
}

function label(state: StaffSessionState): string {
  if (state.status === 'signedIn') return `signedIn:${state.account.name}`
  if (state.status === 'signedOut') return `signedOut:${state.reason ?? 'none'}`
  return state.status
}

function renderSession() {
  return render(
    <StaffSessionProvider>
      <Probe />
    </StaffSessionProvider>,
  )
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('on load', () => {
  it('asks who is signed in, and is checking until the answer comes', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena) })

    renderSession()

    expect(screen.getByTestId('status')).toHaveTextContent('checking')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn:Lorena Ortiz'))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/staff/me')
  })

  it('is signed out when nobody is signed in', async () => {
    fakeApi({ '/api/staff/me': () => errorResponse('unauthenticated', 401) })

    renderSession()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none'))
  })

  it('is offline when the API cannot be reached, and can try again', async () => {
    let reachable = false
    fakeApi({
      '/api/staff/me': () => {
        if (!reachable) throw new TypeError('Failed to fetch')
        return json(lorena)
      },
    })

    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('offline'))

    reachable = true
    await act(() => session.retry())
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn:Lorena Ortiz')
  })
})

describe('signing in and out', () => {
  it('signs in and keeps the account', async () => {
    fakeApi({
      '/api/staff/me': () => errorResponse('unauthenticated', 401),
      '/api/staff/sign-in': () => json(lorena),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'))

    await act(() => session.signIn('lorena@example.com', 'password'))

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn:Lorena Ortiz')
  })

  it('passes a failed sign-in back to the screen and stays signed out', async () => {
    fakeApi({
      '/api/staff/me': () => errorResponse('unauthenticated', 401),
      '/api/staff/sign-in': () => errorResponse('staff_credentials_invalid', 422),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'))

    const error = await act(() => session.signIn('lorena@example.com', 'wrong').catch((e) => e))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'staff_credentials_invalid' })
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none')
  })

  it('signs out', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/sign-out': () => new Response(null, { status: 204 }),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    await act(() => session.signOut())

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none')
  })
})

describe('the sign-in ending by itself', () => {
  it.each([
    ['staff_session_expired', 'timeout'],
    ['staff_account_deactivated', 'deactivated'],
    ['unauthenticated', 'none'],
  ])('a request answered %s signs the person out, with the reason', async (code, reason) => {
    fakeApi({ '/api/staff/me': () => json(lorena) })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    act(() => session.reportError(new ApiError(code, 401)))

    expect(screen.getByTestId('status')).toHaveTextContent(`signedOut:${reason}`)
  })

  it('other errors leave the sign-in alone', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena) })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    act(() => session.reportError(new ApiError('forbidden', 403)))

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn')
  })

  it('checks every minute while signed in, as an automatic refresh, and notices the timeout (E-130)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let expired = false
    const fetchMock = fakeApi({
      '/api/staff/me': () => (expired ? errorResponse('staff_session_expired', 401) : json(lorena)),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    expired = true
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:timeout')
    const check = fetchMock.mock.calls[1]
    expect(new Headers((check[1] as RequestInit).headers).get('X-Auto-Refresh')).toBe('1')
  })

  it('checks after exactly a minute, and the first check on load is not an automatic refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena) })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    await act(() => vi.advanceTimersByTimeAsync(59_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).has('X-Auto-Refresh')).toBe(false)
  })

  it('a background check without connection keeps the person signed in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let online = true
    fakeApi({
      '/api/staff/me': () => {
        if (!online) throw new TypeError('Failed to fetch')
        return json(lorena)
      },
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    online = false
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn')
  })

  it('stops checking after sign-out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/sign-out': () => new Response(null, { status: 204 }),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    await act(() => session.signOut())
    await act(() => vi.advanceTimersByTimeAsync(120_000))

    expect(fetchMock.mock.calls.filter((call) => call[0] === '/api/staff/me')).toHaveLength(1)
  })

  it('a check answered after a sign-out does not sign the person back in', async () => {
    // Shared desk computer: an old "signed in" answer must never bring the dashboard back.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let answerLateCheck: (response: Response) => void = () => {}
    let calls = 0
    fakeApi({
      '/api/staff/me': () => {
        calls += 1
        if (calls === 1) return json(lorena)
        return new Promise<Response>((resolve) => {
          answerLateCheck = resolve
        })
      },
      '/api/staff/sign-out': () => new Response(null, { status: 204 }),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    await act(() => vi.advanceTimersByTimeAsync(60_000))
    await act(() => session.signOut())
    await act(async () => answerLateCheck(json(lorena)))

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none')
  })

  it('a check that finds nothing new does not redraw the dashboard', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fakeApi({ '/api/staff/me': () => json(lorena) })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))
    const before = renders

    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(renders).toBe(before)
  })
})

describe('sign-in and sign-out edge cases', () => {
  it('a sign-out the server already ended still signs out', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/sign-out': () => errorResponse('unauthenticated', 401),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    await act(() => session.signOut())

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none')
  })

  it('a sign-out without connection fails and stays signed in, so nobody thinks the desk is signed out', async () => {
    let online = true
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/sign-out': () => {
        if (!online) throw new TypeError('Failed to fetch')
        return new Response(null, { status: 204 })
      },
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'))

    online = false
    const error = await act(() => session.signOut().catch((e) => e))

    expect(error).toMatchObject({ code: 'offline' })
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn')
  })

  it('a deactivated account is refused at sign-in with its own code', async () => {
    fakeApi({
      '/api/staff/me': () => errorResponse('unauthenticated', 401),
      '/api/staff/sign-in': () => errorResponse('staff_account_deactivated', 403),
    })
    renderSession()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'))

    const error = await act(() => session.signIn('gone@example.com', 'password').catch((e) => e))

    expect(error).toMatchObject({ code: 'staff_account_deactivated', status: 403 })
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut')
  })
})

describe('language', () => {
  it('follows the account once signed in, and is Spanish before', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena) })

    renderSession()

    expect(screen.getByTestId('language')).toHaveTextContent(es.dashboard.signOut)
    await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent(en.dashboard.signOut))
  })
})
