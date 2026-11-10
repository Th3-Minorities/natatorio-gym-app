import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, json, lorena } from '../team/fakeTeamApi'
import { camilaVisit, luisVisit, sessions } from './fakeSessions'

// S-01's list of who is inside (Figma 121:2841, 4319:1662 and the states in 122:2957 to 122:3020, #26).

const t = es.activeSessions
const SESSIONS = '/api/staff/sessions'
const occupancy = { count: 2, max: 40, updated_at: new Date().toISOString(), gym: 'open' }

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

function openList(routes: Parameters<typeof fakeApi>[0] = {}) {
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(lorena),
    '/api/staff/occupancy': () => json(occupancy),
    [SESSIONS]: sessions([camilaVisit, luisVisit]),
    ...routes,
  })
  render(<StaffApp />)
  return fetchMock
}

describe('S-01 list', () => {
  it('lists who is inside with the time, the time inside, the type and Marcar salida', async () => {
    openList()

    const table = await screen.findByRole('table', { name: t.tableTitle })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByRole('link', { name: t.open('Camila Rivera Santiago') })).toHaveAttribute('href', '/staff/sesiones/11')
    expect(within(rows[1]).getByText('1 h 14 min')).toBeInTheDocument()
    expect(within(rows[1]).getByText(t.types.athlete)).toBeInTheDocument()
    expect(within(rows[2]).getByText('38 min')).toBeInTheDocument()
    expect(within(rows[2]).getByText(t.types.student)).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: `${t.checkOut}, Camila Rivera Santiago` })).toBeInTheDocument()
    expect(screen.getByText(t.count(2))).toBeInTheDocument()
    expect(screen.getByText(t.selectHint)).toBeInTheDocument()
  })

  it('searches by name and says when nobody matches', async () => {
    const fetchMock = openList({ [`${SESSIONS}?search=Daniela`]: sessions([]) })
    await screen.findByRole('table', { name: t.tableTitle })

    fireEvent.change(screen.getByRole('searchbox', { name: t.search }), { target: { value: 'Daniela' } })

    expect(await screen.findByText(t.noMatchText('Daniela'))).toBeInTheDocument()
    expect(callsTo(fetchMock, `${SESSIONS}?search=Daniela`)).toHaveLength(1)
  })

  it('says when nobody is inside', async () => {
    openList({ [SESSIONS]: sessions([]) })

    expect(await screen.findByRole('heading', { name: t.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(t.emptyText)).toBeInTheDocument()
  })

  it('offers a retry when the list cannot load', async () => {
    let calls = 0
    openList({ [SESSIONS]: () => (++calls === 1 ? apiError('server_error', 500) : sessions([camilaVisit])()) })

    expect(await screen.findByText(t.errorText)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.states.retry }))

    expect(await screen.findByRole('table', { name: t.tableTitle })).toBeInTheDocument()
  })

  it('checks a person out after asking, and reloads the list', async () => {
    let list = [camilaVisit, luisVisit]
    const fetchMock = openList({
      [SESSIONS]: () => sessions(list)(),
      'POST /api/staff/sessions/11/check-out': () => {
        list = [luisVisit]
        return json({ session: { id: 11, status: 'checked_out' } })
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: `${t.checkOut}, Camila Rivera Santiago` }))
    const dialog = screen.getByRole('dialog', { name: t.confirmTitle })
    expect(within(dialog).getByText(t.checkOutTitle('Camila Rivera Santiago'))).toBeInTheDocument()
    expect(within(dialog).getByText(t.checkOutText)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.confirmCheckOut }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(t.checkedOut('Camila Rivera Santiago'))).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Camila Rivera Santiago')).not.toBeInTheDocument())
    expect(callsTo(fetchMock, '/api/staff/sessions/11/check-out')).toEqual([['POST', undefined]])
  })

  it('updates the occupancy card at once after a check-out, without waiting for the next poll', async () => {
    let list = [camilaVisit, luisVisit]
    openList({
      [SESSIONS]: () => sessions(list)(),
      '/api/staff/occupancy': () => json({ ...occupancy, count: list.length }),
      'POST /api/staff/sessions/11/check-out': () => {
        list = [luisVisit]
        return json({ session: { id: 11, status: 'checked_out' } })
      },
    })
    const card = await screen.findByRole('region', { name: t.inside })
    await waitFor(() => expect(card).toHaveTextContent('2'))

    fireEvent.click(await screen.findByRole('button', { name: `${t.checkOut}, Camila Rivera Santiago` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.confirmCheckOut }))

    await waitFor(() => expect(card.querySelector('strong')).toHaveTextContent('1'))
  })

  it('says when the visit had already ended, and reloads', async () => {
    const fetchMock = openList({
      'POST /api/staff/sessions/11/check-out': () => apiError('check_out_session_not_active', 409),
    })
    fireEvent.click(await screen.findByRole('button', { name: `${t.checkOut}, Camila Rivera Santiago` }))
    const before = callsTo(fetchMock, SESSIONS).length
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.confirmCheckOut }))

    expect(await within(screen.getByRole('dialog')).findByText(es.errors.check_out_session_not_active)).toBeInTheDocument()
    await waitFor(() => expect(callsTo(fetchMock, SESSIONS).length).toBeGreaterThan(before))
  })

  it('opens S-02 from the name', async () => {
    openList({ '/api/staff/sessions/11': () => json({ session: { id: 11 }, person: {} }) })

    fireEvent.click(await screen.findByRole('link', { name: t.open('Camila Rivera Santiago') }))

    expect(window.location.pathname).toBe('/staff/sesiones/11')
  })

  it('welcomes an assisted Check In and marks its row (4319:1662)', async () => {
    window.history.pushState(null, '', `${STAFF_PATH}?registrado=11`)
    openList()

    expect(await screen.findByRole('heading', { name: t.checkedInTitle })).toBeInTheDocument()
    expect(screen.getByText(t.checkedInText('Camila Rivera Santiago'))).toBeInTheDocument()
    const row = screen.getByText('Camila Rivera Santiago').closest('tr')!
    expect(row).toHaveClass('sessions-row--new')
    // The notice is said once; a reload does not bring it back.
    expect(window.location.search).toBe('')
  })

  it('moves focus to the list title after a check-out, since the pressed button is gone', async () => {
    let list = [camilaVisit, luisVisit]
    openList({
      [SESSIONS]: () => sessions(list)(),
      'POST /api/staff/sessions/11/check-out': () => {
        list = [luisVisit]
        return json({ session: { id: 11, status: 'checked_out' } })
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: `${t.checkOut}, Camila Rivera Santiago` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.confirmCheckOut }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { name: t.count(1) })).toHaveFocus())
  })

  it('clears the search from the empty result, and puts the cursor back in the box (122:3020)', async () => {
    openList({ [`${SESSIONS}?search=Daniela`]: sessions([]) })
    await screen.findByRole('table', { name: t.tableTitle })
    const box = screen.getByRole('searchbox', { name: t.search })
    fireEvent.change(box, { target: { value: 'Daniela' } })
    await screen.findByText(t.noMatchText('Daniela'))

    fireEvent.click(screen.getByRole('button', { name: t.clearSearch }))

    expect(box).toHaveValue('')
    expect(box).toHaveFocus()
    expect(await screen.findByRole('table', { name: t.tableTitle })).toBeInTheDocument()
  })

  it('shows the skeleton bars while it loads (122:2957)', async () => {
    openList({ [SESSIONS]: () => new Promise<Response>(() => {}) })

    expect(await screen.findByText(t.loadingTitle)).toBeInTheDocument()
    expect(document.querySelectorAll('.sessions-skeleton span')).toHaveLength(3)
  })
})
