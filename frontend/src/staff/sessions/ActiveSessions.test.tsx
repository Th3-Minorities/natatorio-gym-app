import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_PATH, STAFF_TEAM_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena, offline, team } from '../team/fakeTeamApi'

// S-01 "Sesiones activas" (Figma 121:2841), for now only the occupancy card (#26). The card adds the level and the
// bar of C-01 (Figma 4106:1869), as E-178 says.

const t = es.activeSessions
const gym = es.gym
const OCCUPANCY = '/api/staff/occupancy'
const occupancy = { count: 18, max: 40, updated_at: '2026-11-07T17:07:24Z', gym: 'open' }

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_PATH)
})

afterEach(() => {
  goOnline()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'hidden')
  window.history.pushState(null, '', '/')
})

/** The X-Auto-Refresh header of each call to a route, in order: undefined for a request that counts as activity. */
function autoRefreshOf(fetchMock: ReturnType<typeof fakeApi>, path: string) {
  return fetchMock.mock.calls
    .filter(([called]) => called === path)
    .map(([, init]) => (init?.headers as Record<string, string> | undefined)?.['X-Auto-Refresh'])
}

function openScreen(routes: Parameters<typeof fakeApi>[0] = {}, account: object = lorena) {
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(account),
    [OCCUPANCY]: () => json(occupancy),
    '/api/staff/sessions': () => json({ sessions: [] }),
    ...routes,
  })
  render(<StaffApp />)
  return fetchMock
}

describe('S-01 occupancy', () => {
  it('is the dashboard home, with the count, the level, the bar and the update time', async () => {
    const fetchMock = openScreen()

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByText(t.description)).toBeInTheDocument()
    const card = screen.getByRole('region', { name: t.inside })
    expect(await screen.findByText('18')).toBeInTheDocument()
    expect(card).toHaveTextContent(gym.moderate)
    expect(card).toHaveTextContent(gym.updated('1:07:24 p. m.'))
    expect(card).toHaveTextContent(t.closeRule)
    expect(card.querySelector('.staff-occupancy__bar > div')).toHaveStyle({ width: '45%' })
    expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(1)
  })

  it('says whether the gym is open, by the same schedule Check In uses', async () => {
    openScreen()
    // Top right of S-01, as Figma draws it (121:3026).
    expect(await screen.findByText(t.gymState.open)).toHaveClass('team-chip')
  })

  it.each([
    ['closed', t.gymState.closed],
    ['athletes_only', t.gymState.athletes_only],
  ])('names the %s state in the same place', async (state, text) => {
    openScreen({ [OCCUPANCY]: () => json({ ...occupancy, gym: state }) })
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(t.gymState.open)).not.toBeInTheDocument()
  })

  it('hides the gym state with the number when the count cannot load', async () => {
    openScreen({ [OCCUPANCY]: () => apiError('server_error', 500) })
    expect(await screen.findByText(gym.failed)).toBeInTheDocument()
    expect(screen.queryByText(t.gymState.open)).not.toBeInTheDocument()
  })

  it('shows the same card to Staff accounts', async () => {
    openScreen({}, { ...lorena, role: 'staff' })

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(await screen.findByText('18')).toBeInTheDocument()
  })

  it('makes "Sesiones activas" in the menu a link to this page', async () => {
    window.history.pushState(null, '', STAFF_TEAM_PATH)
    openScreen({ '/api/staff/accounts': () => json({ accounts: team }) })
    await screen.findByRole('heading', { level: 1, name: es.staffTeam.title })

    fireEvent.click(screen.getByRole('link', { name: es.dashboard.staffItems.activeSessions }))

    expect(window.location.pathname).toBe(STAFF_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.dashboard.staffItems.activeSessions })).toHaveAttribute('aria-current', 'page')
  })

  it('hides the number and says it is not current when the count cannot load', async () => {
    openScreen({ [OCCUPANCY]: () => apiError('server_error', 500) })

    expect(await screen.findByText(gym.failed)).toBeInTheDocument()
    expect(screen.getByText(gym.stale())).toBeInTheDocument()
    expect(screen.queryByText('18')).not.toBeInTheDocument()
  })

  it('says when there is no connection', async () => {
    openScreen({ [OCCUPANCY]: offline })

    expect(await screen.findByText(gym.offline)).toBeInTheDocument()
    expect(screen.getByText(t.staleChip)).toBeInTheDocument()
    expect(screen.getByText(t.offlineText)).toBeInTheDocument()
  })

  it('draws the offline state of 122:2983 once: title, chip, why and the last update', async () => {
    openScreen()
    await screen.findByText('18')
    await screen.findByText(es.activeSessions.emptyTitle)

    act(() => goOffline())

    const card = screen.getByRole('region', { name: t.inside })
    const status = within(card).getByRole('status')
    expect(status).toHaveTextContent(gym.offline)
    expect(within(status).getByText(t.staleChip)).toHaveClass('team-chip')
    expect(within(card).getByText(es.checkIn.lastUpdate('1:07 p. m.'))).toBeInTheDocument()
    expect(card).not.toHaveTextContent('18')
    // The sessions list does not say it again next to the card.
    expect(screen.getAllByText(t.offlineText)).toHaveLength(1)
  })

  it('announces a problem with the count through one status region', async () => {
    openScreen({ [OCCUPANCY]: () => apiError('server_error', 500) })

    await screen.findByText(gym.failed)
    const card = screen.getByRole('region', { name: t.inside })
    expect(within(card).getByRole('status')).toHaveTextContent(gym.failed)
  })

  it('sends the first request as activity and every later one as a background refresh (E-130)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = openScreen()
    expect(await screen.findByText('18')).toBeInTheDocument()
    expect(autoRefreshOf(fetchMock, OCCUPANCY)).toEqual([undefined])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })

    expect(autoRefreshOf(fetchMock, OCCUPANCY)).toEqual([undefined, '1'])
  })

  it('asks again as a background refresh when the connection comes back', async () => {
    const fetchMock = openScreen()
    expect(await screen.findByText('18')).toBeInTheDocument()

    act(() => goOffline())
    act(() => goOnline())

    await vi.waitFor(() => expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(2))
    expect(autoRefreshOf(fetchMock, OCCUPANCY)).toEqual([undefined, '1'])
  })

  it('asks again as soon as the tab is visible again, as a background refresh', async () => {
    const fetchMock = openScreen()
    expect(await screen.findByText('18')).toBeInTheDocument()

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(2))
    expect(autoRefreshOf(fetchMock, OCCUPANCY)).toEqual([undefined, '1'])
  })

  it('asks again every 25 seconds, only while the page is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = openScreen()
    expect(await screen.findByText('18')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })
    expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(2)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50_000)
    })
    expect(callsTo(fetchMock, OCCUPANCY)).toHaveLength(2)
  })

  it('does not announce a new count, only a count that is not current', async () => {
    openScreen()
    await screen.findByText('18')

    expect(screen.getByText('18').closest('[role="status"], [aria-live]')).toBeNull()
  })
})
