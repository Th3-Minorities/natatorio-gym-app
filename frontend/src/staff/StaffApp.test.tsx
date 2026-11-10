import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { StaffApp } from './StaffApp'
import { isStaffPath } from './staffPath'

// The staff part of the PWA at /staff: N-11 until someone signs in, then the dashboard shell (#16).

const lorena = { name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', locale: 'es' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function errorResponse(code: string, status: number) {
  return json({ error: { code } }, status)
}

function fakeApi(routes: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (path: string, _init?: RequestInit) => {
    const answer = routes[path]
    if (!answer) throw new Error(`No fake answer for ${path}`)
    return answer()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const offline = () => {
  throw new TypeError('Failed to fetch')
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the /staff address', () => {
  it.each([
    ['/staff', true],
    ['/staff/', true],
    ['/staff/recuperar', true],
    ['/staffing', false],
    ['/', false],
    ['/api/staff/me', false],
  ])('%s belongs to the staff part: %s', (path, expected) => {
    expect(isStaffPath(path)).toBe(expected)
  })
})

describe('before anyone signs in', () => {
  it('shows "Cargando" while it asks who is signed in', () => {
    fakeApi({ '/api/staff/me': () => new Promise<Response>(() => {}) })

    render(<StaffApp />)

    expect(screen.getByRole('status')).toHaveTextContent(es.states.loading)
  })

  it('shows N-11 when nobody is signed in', async () => {
    fakeApi({ '/api/staff/me': () => errorResponse('unauthenticated', 401) })

    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: es.signIn.title })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows N-11 with "Sin conexión" when the API cannot be reached', async () => {
    fakeApi({ '/api/staff/me': offline })

    render(<StaffApp />)

    expect(await screen.findByRole('alert')).toHaveTextContent(es.signIn.offlineTitle)
  })
})

describe('signing in and out', () => {
  it('opens the dashboard after signing in, in the account language', async () => {
    fakeApi({
      '/api/staff/me': () => errorResponse('unauthenticated', 401),
      '/api/staff/sign-in': () => json({ ...lorena, locale: 'en' }),
    })
    render(<StaffApp />)
    await screen.findByRole('heading', { name: es.signIn.title })

    fireEvent.change(screen.getByLabelText(es.signIn.email), { target: { value: 'lorena@example.com' } })
    fireEvent.change(screen.getByLabelText(es.signIn.password), { target: { value: 'password' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: es.signIn.submit })))

    expect(await screen.findByText(`Lorena Ortiz · ${en.dashboard.roles.admin}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.dashboard.signOut })).toBeInTheDocument()
  })

  it('shows the shell with an empty main area when already signed in', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena) })

    render(<StaffApp />)

    expect(await screen.findByText(`Lorena Ortiz · ${es.dashboard.roles.admin}`)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: es.dashboard.menu })).toBeInTheDocument()
    // No screen exists yet for the main area (#26 builds S-01), but screen readers still get a page heading.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(es.dashboard.brandName)
    expect(screen.queryByRole('heading', { name: es.signIn.title })).not.toBeInTheDocument()
  })

  it('goes back to N-11 after signing out', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/sign-out': () => new Response(null, { status: 204 }),
    })
    render(<StaffApp />)

    const signOutButton = await screen.findByRole('button', { name: es.dashboard.signOut })
    await act(async () => fireEvent.click(signOutButton))

    expect(await screen.findByRole('heading', { level: 1, name: es.signIn.title })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so and stays signed in when the sign-out cannot reach the server', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/sign-out': offline })
    render(<StaffApp />)

    const signOutButton = await screen.findByRole('button', { name: es.dashboard.signOut })
    await act(async () => fireEvent.click(signOutButton))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.dashboard.signOutFailedTitle)
    expect(screen.getByRole('alert')).toHaveTextContent(es.dashboard.signOutFailedText)
    expect(screen.getByRole('alert')).toHaveClass('notice--error')
    expect(screen.getByRole('button', { name: es.dashboard.signOut })).toBeInTheDocument()
  })
})

describe('when the sign-in ends by itself', () => {
  it('goes to N-11 with "Sesión vencida" when the minute check finds it expired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let expired = false
    fakeApi({ '/api/staff/me': () => (expired ? errorResponse('staff_session_expired', 401) : json(lorena)) })
    render(<StaffApp />)
    await screen.findByRole('button', { name: es.dashboard.signOut })

    expired = true
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.signIn.timeoutTitle)
    expect(screen.getByRole('heading', { level: 1, name: es.signIn.title })).toBeInTheDocument()
  })

  it('goes to N-11 with "Cuenta desactivada" when the account was deactivated', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let deactivated = false
    fakeApi({
      '/api/staff/me': () => (deactivated ? errorResponse('staff_account_deactivated', 401) : json(lorena)),
    })
    render(<StaffApp />)
    await screen.findByRole('button', { name: es.dashboard.signOut })

    deactivated = true
    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.signIn.deactivatedTitle)
  })
})

describe('N-11 after a timeout', () => {
  it('does not keep the old notice once the person signs in again and out again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let expired = false
    fakeApi({
      '/api/staff/me': () => (expired ? errorResponse('staff_session_expired', 401) : json(lorena)),
      '/api/staff/sign-in': () => json(lorena),
      '/api/staff/sign-out': () => new Response(null, { status: 204 }),
    })
    render(<StaffApp />)
    await screen.findByRole('button', { name: es.dashboard.signOut })
    expired = true
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    await screen.findByRole('alert')

    expired = false
    fireEvent.change(screen.getByLabelText(es.signIn.email), { target: { value: 'lorena@example.com' } })
    fireEvent.change(screen.getByLabelText(es.signIn.password), { target: { value: 'password' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: es.signIn.submit })))
    const signOutButton = await screen.findByRole('button', { name: es.dashboard.signOut })
    await act(async () => fireEvent.click(signOutButton))

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: es.signIn.title })).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
