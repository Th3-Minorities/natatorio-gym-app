import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { camila } from '../sessions/fakeSessions'
import { StaffApp } from '../StaffApp'
import { STAFF_FIND_PATH, STAFF_ROSTER_VIEW_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena, offline } from '../team/fakeTeamApi'

// S-05 "Roster de atletas", read only (Figma 121:3383, 4265:2957, 122:3214, 122:3222, 122:3280, 122:3253, #26).

const t = es.staffRoster
const staff = { ...lorena, name: 'Mariel Vélez Soto', role: 'staff' }
const camilaRow = { id: 1, name: 'Camila Rivera Santiago', sport: 'Baloncesto femenino', student_number: '802612345', active_session: null }
const jairo = { id: 2, name: 'Jairo Pagán Vélez', sport: 'Voleibol', student_number: '802523481', active_session: null }
const inside = { ...jairo, active_session: { started_at: '2026-11-09T13:42:00Z' } }

const ROSTER = '/api/staff/roster'

function roster(athletes: object[], activeCount = athletes.length) {
  return () => json({ athletes, active_count: activeCount, total_count: activeCount })
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_ROSTER_VIEW_PATH)
})

afterEach(() => {
  goOnline()
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

async function openScreen(routes: Parameters<typeof fakeApi>[0] = {}, account: object = staff) {
  const fetchMock = fakeApi({ '/api/staff/me': () => json(account), [ROSTER]: roster([camilaRow, jairo]), ...routes })
  render(<StaffApp />)
  await screen.findByRole('heading', { level: 1, name: t.title })
  return fetchMock
}

describe('S-05 athlete roster, read only', () => {
  it('lists each athlete for Staff with the number in full, the chip and the count, and no email', async () => {
    await openScreen()

    expect(await screen.findByText(camilaRow.name)).toBeInTheDocument()
    expect(screen.getByText(t.description)).toBeInTheDocument()
    expect(screen.getByLabelText(t.search)).toHaveAttribute('placeholder', t.searchHint)
    expect(screen.getByText(t.readOnly)).toBeInTheDocument()
    expect(screen.getByText(t.count(2))).toBeInTheDocument()
    const table = screen.getByRole('table', { name: t.title })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      t.columns.name,
      t.columns.studentNumber,
      t.columns.sport,
      t.columns.action,
    ])
    expect(within(table).getByText('802612345')).toBeInTheDocument()
    expect(within(table).getByText('Voleibol')).toBeInTheDocument()
    expect(screen.getByText(t.footnote)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('@upr.edu')
  })

  it('opens for an Administrator too, and the menu item points to it', async () => {
    window.history.pushState(null, '', '/staff')
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/occupancy': () => json({ count: 0, max: 40, updated_at: new Date().toISOString(), gym: 'open' }),
      '/api/staff/sessions': () => json({ sessions: [] }),
      [ROSTER]: roster([camilaRow]),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.staffItems.athleteRoster }))

    expect(window.location.pathname).toBe(STAFF_ROSTER_VIEW_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(await screen.findByText(camilaRow.name)).toBeInTheDocument()
  })

  it('shows "Entrada registrada" and the start time instead of the button for an athlete who is inside', async () => {
    await openScreen({ [ROSTER]: roster([camilaRow, inside]) })

    const row = (await screen.findByText(inside.name)).closest('tr')!
    expect(within(row).getByText(t.registered)).toBeInTheDocument()
    expect(within(row).getByText(/^Entrada: \d{1,2}:\d{2} [ap]\. m\.$/)).toBeInTheDocument()
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    expect(within(screen.getByText(camilaRow.name).closest('tr')!).getByRole('link')).toBeInTheDocument()
  })

  it('opens S-03 with the student number and runs that search once', async () => {
    const byNumber = '/api/staff/people?search=802612345'
    const fetchMock = await openScreen({
      [byNumber]: () => json({ people: [camila] }),
      '/api/staff/sessions': () => json({ sessions: [] }),
    })

    const link = await screen.findByRole('link', { name: `${t.checkIn}, ${camilaRow.name}` })
    expect(link).toHaveAttribute('href', `${STAFF_FIND_PATH}?numero=802612345`)
    fireEvent.click(link)

    expect(await screen.findByRole('heading', { level: 1, name: es.findPerson.title })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: es.findPerson.verifyTitle })).toBeInTheDocument()
    expect(screen.getByLabelText(es.findPerson.search)).toHaveValue('802612345')
    expect(callsTo(fetchMock, byNumber)).toHaveLength(1)
  })

  it('says it is loading, with three skeleton lines', async () => {
    fakeApi({ '/api/staff/me': () => json(staff), [ROSTER]: () => new Promise<Response>(() => {}) })
    const { container } = render(<StaffApp />)

    expect(await screen.findByRole('heading', { name: t.loadingTitle })).toBeInTheDocument()
    expect(screen.getByText(t.loadingText)).toBeInTheDocument()
    expect(container.querySelectorAll('.sessions-skeleton span')).toHaveLength(3)
  })

  it('says when the roster has no athletes', async () => {
    await openScreen({ [ROSTER]: roster([], 0) })

    expect(await screen.findByRole('heading', { name: t.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(t.readOnly)).toBeInTheDocument()
    expect(screen.getByText(t.emptyLead)).toBeInTheDocument()
    expect(screen.getByText(t.emptyText)).toBeInTheDocument()
  })

  it('says when the roster cannot load, and Reintentar asks again', async () => {
    let answers = 0
    const fetchMock = await openScreen({
      [ROSTER]: () => (answers++ === 0 ? apiError('server_error', 500) : json({ athletes: [camilaRow], active_count: 1, total_count: 1 })),
    })

    expect(await screen.findByRole('heading', { name: t.errorTitle })).toBeInTheDocument()
    expect(screen.getByText(t.errorText)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.states.retry }))

    expect(await screen.findByText(camilaRow.name)).toBeInTheDocument()
    expect(callsTo(fetchMock, ROSTER)).toHaveLength(2)
  })

  it('has no rows to keep when the first load finds no connection', async () => {
    await openScreen({ [ROSTER]: offline })

    expect(await screen.findByRole('heading', { name: es.states.offlineTitle })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('keeps the rows as stale without connection, with the search and every Check in disabled', async () => {
    const fetchMock = await openScreen()
    await screen.findByText(camilaRow.name)

    act(() => goOffline())

    expect(await screen.findByRole('heading', { name: es.states.offlineTitle })).toBeInTheDocument()
    expect(screen.getByText(es.activeSessions.staleChip)).toBeInTheDocument()
    expect(screen.getByText(/^Sin conexión\. Última actualización a las \d{1,2}:\d{2} [ap]\. m\.\.$/)).toBeInTheDocument()
    expect(screen.getByLabelText(t.search)).toBeDisabled()
    expect(screen.getByText(camilaRow.name)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: `${t.checkIn}, ${camilaRow.name}` })).not.toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: new RegExp(`^${t.checkIn},`) })) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }

    // Back online, the rows are asked for again.
    act(() => goOnline())
    await waitFor(() => expect(callsTo(fetchMock, ROSTER)).toHaveLength(2))
    expect(await screen.findByRole('link', { name: `${t.checkIn}, ${camilaRow.name}` })).toBeInTheDocument()
  })

  it('asks the server again for every search and drops the rows that do not match', async () => {
    const fetchMock = await openScreen({
      [`${ROSTER}?search=Jairo`]: roster([jairo], 2),
      [`${ROSTER}?search=Zoe`]: roster([], 2),
    })
    await screen.findByText(camilaRow.name)

    fireEvent.change(screen.getByLabelText(t.search), { target: { value: ' Jairo ' } })
    await waitFor(() => expect(screen.queryByText(camilaRow.name)).not.toBeInTheDocument())
    expect(screen.getByText(jairo.name)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(t.search), { target: { value: 'Zoe' } })
    expect(await screen.findByRole('heading', { name: es.states.empty })).toBeInTheDocument()
    expect(screen.getByText(es.roster.noMatch('Zoe'))).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(t.search), { target: { value: '' } })
    expect(await screen.findByText(camilaRow.name)).toBeInTheDocument()
    expect(callsTo(fetchMock, ROSTER)).toHaveLength(2)
    expect(callsTo(fetchMock, `${ROSTER}?search=Jairo`)).toHaveLength(1)
  })
})
