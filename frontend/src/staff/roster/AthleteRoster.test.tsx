import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_PATH, STAFF_ROSTER_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, json, lorena, offline } from '../team/fakeTeamApi'

// A-05 "Roster de atletas" (Figma 4007:1535, 4007:1918, 4007:2301 and the states in section 170:1373, #21).

const t = es.roster
const alina = {
  id: 1,
  name: 'Alina Mercado Cruz',
  sport: 'Voleibol',
  student_number: '802612346',
  institutional_email: 'alina.mercado@upr.edu',
  status: 'active',
}
const jairo = {
  id: 2,
  name: 'Jairo Pagán Vélez',
  sport: 'Baloncesto',
  student_number: '802523481',
  institutional_email: 'jairo.pagan@upr.edu',
  status: 'active',
}
const darel = {
  id: 3,
  name: 'Darel Colón Vega',
  sport: 'Baloncesto',
  student_number: '802398412',
  institutional_email: 'darel.colon@upr.edu',
  status: 'withdrawn',
}

const ACTIVE = '/api/staff/roster?status=active'

function roster(athletes: object[], activeCount = 2, totalCount = Math.max(athletes.length, activeCount)) {
  return () => json({ athletes, active_count: activeCount, total_count: totalCount })
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_ROSTER_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

async function openScreen(routes: Parameters<typeof fakeApi>[0] = {}) {
  const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), [ACTIVE]: roster([alina, jairo]), ...routes })
  render(<StaffApp />)
  await screen.findByRole('heading', { level: 1, name: t.title })
  return fetchMock
}

function fill(dialog: HTMLElement, values: Partial<Record<'name' | 'sport' | 'number' | 'email', string>>) {
  const labels = { name: t.fullName, sport: t.sport, number: t.studentNumber, email: t.email }
  for (const [field, value] of Object.entries(values)) {
    fireEvent.change(within(dialog).getByLabelText(labels[field as keyof typeof labels]), { target: { value } })
  }
}

describe('the roster screen', () => {
  it('opens from "Gestionar atletas" in the menu', async () => {
    window.history.pushState(null, '', STAFF_PATH)
    fakeApi({ '/api/staff/me': () => json(lorena), [ACTIVE]: roster([alina]) })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.adminItems.manageAthletes }))

    expect(window.location.pathname).toBe(STAFF_ROSTER_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.dashboard.adminItems.manageAthletes })).toHaveAttribute('aria-current', 'page')
  })

  it('lists the active athletes with their data, the count and the term', async () => {
    await openScreen()

    const table = await screen.findByRole('table', { name: t.tableTitle })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    for (const text of ['Alina Mercado Cruz', 'Voleibol', '802612346', 'alina.mercado@upr.edu', t.status.active]) {
      expect(within(rows[1]).getByText(text)).toBeInTheDocument()
    }
    expect(within(rows[1]).getByRole('button', { name: `${t.edit}, Alina Mercado Cruz` })).toBeInTheDocument()
    expect(screen.getByText(t.activeCount(2))).toBeInTheDocument()
    expect(screen.getByText(t.continuous)).toBeInTheDocument()
    expect(screen.getByText(t.noteTitle)).toBeInTheDocument()
  })

  it('filters by Activo and Retirado, together or alone', async () => {
    const fetchMock = await openScreen({
      '/api/staff/roster?status=all': roster([alina, jairo, darel]),
      '/api/staff/roster?status=withdrawn': roster([darel]),
    })
    await screen.findByRole('table', { name: t.tableTitle })
    const active = screen.getByRole('button', { name: t.filterActive })
    const withdrawn = screen.getByRole('button', { name: t.filterWithdrawn })
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(withdrawn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(withdrawn)
    expect(await screen.findByText('Darel Colón Vega')).toBeInTheDocument()
    expect(screen.getByText('Alina Mercado Cruz')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: t.tableTitle })).getByText(t.status.withdrawn)).toBeInTheDocument()

    fireEvent.click(active)
    await waitFor(() => expect(screen.queryByText('Alina Mercado Cruz')).not.toBeInTheDocument())
    expect(active).toHaveAttribute('aria-pressed', 'false')

    // The last pressed filter stays on: the list always shows something.
    fireEvent.click(withdrawn)
    expect(withdrawn).toHaveAttribute('aria-pressed', 'true')
    expect(callsTo(fetchMock, '/api/staff/roster?status=all')).toHaveLength(1)
    expect(callsTo(fetchMock, '/api/staff/roster?status=withdrawn')).toHaveLength(1)
  })

  it('searches by name or student number', async () => {
    const fetchMock = await openScreen({ '/api/staff/roster?status=active&search=8026': roster([alina]) })
    await screen.findByRole('table', { name: t.tableTitle })

    fireEvent.change(screen.getByRole('searchbox', { name: t.search }), { target: { value: '8026' } })

    await waitFor(() => expect(screen.queryByText('Jairo Pagán Vélez')).not.toBeInTheDocument())
    expect(callsTo(fetchMock, '/api/staff/roster?status=active&search=8026')).toHaveLength(1)
  })

  it('says when a search finds nobody', async () => {
    await openScreen({ '/api/staff/roster?status=active&search=Zoe': roster([]) })
    await screen.findByRole('table', { name: t.tableTitle })

    fireEvent.change(screen.getByRole('searchbox', { name: t.search }), { target: { value: 'Zoe' } })

    expect(await screen.findByText(t.noMatch('Zoe'))).toBeInTheDocument()
  })

  it('says "no results", not "no athletes yet", when only the filter hides the athletes', async () => {
    await openScreen({ '/api/staff/roster?status=withdrawn': roster([], 2, 2) })
    await screen.findByRole('table', { name: t.tableTitle })

    fireEvent.click(screen.getByRole('button', { name: t.filterWithdrawn }))
    fireEvent.click(screen.getByRole('button', { name: t.filterActive }))

    expect(await screen.findByText(es.states.empty)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.emptyTitle })).not.toBeInTheDocument()
  })

  it('says "no results" when every athlete is withdrawn and only Activo is on', async () => {
    await openScreen({ [ACTIVE]: roster([], 0, 3) })

    expect(await screen.findByText(es.states.empty)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.emptyTitle })).not.toBeInTheDocument()
  })

  it('invites the first athlete when the roster is empty', async () => {
    await openScreen({ [ACTIVE]: roster([], 0) })

    const title = await screen.findByRole('heading', { name: t.emptyTitle })
    fireEvent.click(within(title.closest('section')!).getByRole('button', { name: t.add }))

    expect(screen.getByRole('dialog', { name: t.addTitle })).toBeInTheDocument()
  })

  it('offers a retry when the list cannot load', async () => {
    let calls = 0
    await openScreen({ [ACTIVE]: () => (++calls === 1 ? apiError('server_error', 500) : roster([alina])()) })

    fireEvent.click(await screen.findByRole('button', { name: es.states.retry }))

    expect(await screen.findByRole('table', { name: t.tableTitle })).toBeInTheDocument()
  })

  it('says when there is no connection', async () => {
    await openScreen({ [ACTIVE]: offline })

    expect(await screen.findByRole('heading', { name: es.states.offlineTitle })).toBeInTheDocument()
  })

  it('stays an empty dashboard for a Staff account', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json({ ...lorena, role: 'staff' }) })
    render(<StaffApp />)

    expect(await screen.findByText(`${lorena.name} · ${es.dashboard.roles.staff}`)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => String(path).startsWith('/api/staff/roster'))).toEqual([])
  })
})

describe('adding and editing athletes', () => {
  it('adds athletes one after another, keeping the sport', async () => {
    const fetchMock = await openScreen({
      'POST /api/staff/roster': (body) => json({ athlete: { id: 9, status: 'active', ...(body as object) } }, 201),
    })

    fireEvent.click(await screen.findByRole('button', { name: t.add }))
    const dialog = screen.getByRole('dialog', { name: t.addTitle })
    fill(dialog, { sport: 'Voleibol' })
    expect(within(dialog).getByRole('heading', { name: t.addingTitle('Voleibol') })).toBeInTheDocument()
    fill(dialog, { name: 'Zarela Vélez Matos', number: '802645901', email: 'zarela.velez@upr.edu' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveAndNext }))

    expect(await within(dialog).findByText(t.savedNext('Zarela Vélez Matos'))).toBeInTheDocument()
    expect(within(dialog).getByText(t.savedChip)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(t.sport)).toHaveValue('Voleibol')
    expect(within(dialog).getByLabelText(t.fullName)).toHaveValue('')
    expect(within(dialog).getByLabelText(t.studentNumber)).toHaveValue('')
    expect(within(dialog).getByLabelText(t.email)).toHaveValue('')
    await waitFor(() => expect(within(dialog).getByLabelText(t.fullName)).toHaveFocus())
    expect(callsTo(fetchMock, '/api/staff/roster')).toEqual([
      ['POST', { name: 'Zarela Vélez Matos', sport: 'Voleibol', student_number: '802645901', institutional_email: 'zarela.velez@upr.edu' }],
    ])
    await waitFor(() => expect(callsTo(fetchMock, ACTIVE).length).toBeGreaterThan(1))

    fireEvent.click(within(dialog).getByRole('button', { name: t.close }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the athlete who already has the student number', async () => {
    await openScreen({
      'POST /api/staff/roster': () =>
        json({ error: { code: 'roster_student_number_taken', details: { athlete: { id: 1, name: alina.name } } } }, 422),
    })

    fireEvent.click(await screen.findByRole('button', { name: t.add }))
    const dialog = screen.getByRole('dialog', { name: t.addTitle })
    fill(dialog, { sport: 'Voleibol', name: 'Otra Persona', number: '802612346', email: 'otra@upr.edu' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveAndNext }))

    expect(await within(dialog).findByRole('heading', { name: t.takenTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.takenText('802612346', alina.name))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.fixNumber }))

    await waitFor(() => expect(within(dialog).getByLabelText(t.studentNumber)).toHaveFocus())
    expect(within(dialog).getByLabelText(t.fullName)).toHaveValue('Otra Persona')
  })

  it('shows the plain error in the pink banner when the number race sends no athlete', async () => {
    await openScreen({ 'POST /api/staff/roster': () => apiError('roster_student_number_taken', 422) })

    fireEvent.click(await screen.findByRole('button', { name: t.add }))
    const dialog = screen.getByRole('dialog', { name: t.addTitle })
    fill(dialog, { sport: 'Voleibol', name: 'Otra Persona', number: '802612346', email: 'otra@upr.edu' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveAndNext }))

    const notice = await within(dialog).findByText(es.errors.roster_student_number_taken)
    expect(notice.closest('.notice')).toHaveClass('notice--error')
    expect(within(dialog).queryByRole('heading', { name: t.takenTitle })).not.toBeInTheDocument()
  })

  it('shows a refused field under the field', async () => {
    await openScreen({
      'POST /api/staff/roster': () => apiError('validation_failed', 422, { student_number: ['digits'] }),
    })

    fireEvent.click(await screen.findByRole('button', { name: t.add }))
    const dialog = screen.getByRole('dialog', { name: t.addTitle })
    fill(dialog, { sport: 'Voleibol', name: 'Ana', number: '12', email: 'ana@upr.edu' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveAndNext }))

    const number = within(dialog).getByLabelText(t.studentNumber)
    await waitFor(() => expect(number).toHaveFocus())
    expect(number).toHaveAccessibleDescription(es.validation.digits)
  })

  it('edits an athlete with the data filled in', async () => {
    const fetchMock = await openScreen({
      'PATCH /api/staff/roster/1': () => json({ athlete: { ...alina, sport: 'Natación' } }),
    })

    fireEvent.click(await screen.findByRole('button', { name: `${t.edit}, Alina Mercado Cruz` }))
    const dialog = screen.getByRole('dialog', { name: t.editTitle })
    expect(within(dialog).getByText(t.editText('Alina Mercado Cruz'))).toBeInTheDocument()
    expect(within(dialog).getByLabelText(t.studentNumber)).toHaveValue('802612346')
    fill(dialog, { sport: 'Natación' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveChanges }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const status = screen.getByRole('status')
    expect(within(status).getByText(t.saved('Alina Mercado Cruz'))).toBeInTheDocument()
    expect(within(status).getByText('Agosto - diciembre 2026', { selector: '.team-chip' })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/roster/1')).toEqual([
      ['PATCH', { name: alina.name, sport: 'Natación', student_number: alina.student_number, institutional_email: alina.institutional_email }],
    ])
  })
})
