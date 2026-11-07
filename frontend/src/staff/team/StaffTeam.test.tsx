import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_TEAM_PATH } from '../staffPath'

// A-15 "Cuentas del staff" (Figma 100:841, #84): the Administrator's list of staff accounts at /staff/equipo.

const lorena = { name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', locale: 'es' }
const team = [
  { id: 1, name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', status: 'active' },
  { id: 2, name: 'Mariel Vélez Soto', email: 'mariel@example.com', role: 'staff', status: 'active' },
  { id: 3, name: 'Nayeli Lugo Paz', email: 'nayeli@example.com', role: 'staff', status: 'invited' },
  { id: 4, name: 'Damián Ruiz Solís', email: 'damian@example.com', role: 'staff', status: 'deactivated' },
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function fakeApi(routes: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (path: string) => {
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
  window.history.pushState(null, '', STAFF_TEAM_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

describe('the staff accounts screen', () => {
  it('lists each account with its role and status', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: es.staffTeam.title })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: es.staffTeam.tableTitle })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(5)
    expect(within(rows[1]).getByText(es.dashboard.roles.admin)).toBeInTheDocument()
    expect(within(rows[2]).getByText('mariel@example.com')).toBeInTheDocument()
    expect(within(rows[3]).getByText(es.staffTeam.status.invited)).toBeInTheDocument()
    expect(within(rows[4]).getByText(es.staffTeam.status.deactivated)).toBeInTheDocument()
    expect(within(rows[4]).getByRole('button', { name: `${es.staffTeam.reactivate}, Damián Ruiz Solís` })).toBeInTheDocument()
  })

  it('counts active and invited accounts in the summary', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    expect(await screen.findByText('2 activas · 1 invitada')).toBeInTheDocument()
    expect(es.staffTeam.summary(1, 2)).toBe('1 activa · 2 invitadas')
    expect(en.staffTeam.summary(1, 2)).toBe('1 active · 2 invited')
  })

  it('says accounts are kept', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    expect(await screen.findByText(es.staffTeam.keptTitle)).toBeInTheDocument()
    expect(screen.getByText(es.staffTeam.keptText)).toBeInTheDocument()
  })

  it('shows names as plain text, never as HTML', async () => {
    const name = '<img src=x onerror=alert(1)>'
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: [{ ...team[1], name }] }),
    })
    render(<StaffApp />)

    expect(await screen.findByText(name)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('lets the keyboard reach the table when it scrolls on a phone', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    const region = await screen.findByRole('region', { name: es.staffTeam.tableTitle })
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('shows "Cargando cuentas…" while the list loads', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => new Promise<Response>(() => {}) })
    render(<StaffApp />)

    expect(await screen.findByText(es.staffTeam.loadingTitle)).toBeInTheDocument()
    expect(screen.getByText(es.staffTeam.loadingText)).toBeInTheDocument()
  })

  it('shows "Error al cargar" and tries again', async () => {
    let fail = true
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => (fail ? json({ error: { code: 'server_error' } }, 500) : json({ accounts: team })),
    })
    render(<StaffApp />)

    expect(await screen.findByText(es.states.errorTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.states.retry }))
    expect(await screen.findByText(es.states.errorTitle)).toBeInTheDocument()
    fail = false
    fireEvent.click(await screen.findByRole('button', { name: es.states.retry }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/staff/accounts').length).toBeGreaterThanOrEqual(3)
  })

  it('shows "Sin conexión" when the list cannot be reached', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': offline })
    render(<StaffApp />)

    expect(await screen.findByText(es.states.offlineTitle)).toBeInTheDocument()
  })

  it('goes back to sign-in when the session ended', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ error: { code: 'staff_session_expired' } }, 401),
    })
    render(<StaffApp />)

    expect(await screen.findByRole('alert')).toHaveTextContent(es.signIn.timeoutTitle)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('speaks English for an English account', async () => {
    fakeApi({
      '/api/staff/me': () => json({ ...lorena, locale: 'en' }),
      '/api/staff/accounts': () => json({ accounts: team }),
    })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: en.staffTeam.title })).toBeInTheDocument()
    expect(await screen.findByText('2 active · 1 invited')).toBeInTheDocument()
  })
})

describe('getting to the staff accounts screen', () => {
  it('opens from the menu and marks the item as the current page', async () => {
    window.history.pushState(null, '', '/staff')
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    const link = await screen.findByRole('link', { name: es.dashboard.adminItems.staffAccounts })
    expect(link).not.toHaveAttribute('aria-current')
    fireEvent.click(link)

    expect(window.location.pathname).toBe(STAFF_TEAM_PATH)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.dashboard.adminItems.staffAccounts })).toHaveAttribute('aria-current', 'page')
  })

  it('follows the browser back button', async () => {
    window.history.pushState(null, '', '/staff')
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.adminItems.staffAccounts }))
    expect(await screen.findByRole('table')).toBeInTheDocument()

    window.history.pushState(null, '', '/staff')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument())
  })

  it('never asks for the list for a Staff account, even at its address', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json({ ...lorena, role: 'staff' }) })
    render(<StaffApp />)

    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/staff/accounts')).toBe(false)
  })
})
