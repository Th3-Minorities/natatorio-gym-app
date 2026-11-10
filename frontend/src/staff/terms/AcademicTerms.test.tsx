import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_PATH, STAFF_TERMS_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena, offline } from '../team/fakeTeamApi'

// A-04 "Términos" (Figma 101:1525, 4007:1310 and the states in section 170:1373, #21).

const t = es.terms
const fall = { id: 2, name: 'Agosto - diciembre 2026', starts_on: '2026-08-10', ends_on: '2026-12-18', status: 'active' }
const spring = { id: 1, name: 'Enero - mayo 2026', starts_on: '2026-01-12', ends_on: '2026-05-22', status: 'past' }
const next = { id: 3, name: 'Enero - mayo 2027', starts_on: '2027-01-11', ends_on: '2027-05-14', status: 'upcoming' }

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_TERMS_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

function terms(list: object[]) {
  return () => json({ terms: list })
}

async function openScreen(list: object[] = [next, fall, spring], routes = {}) {
  const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/terms': terms(list), ...routes })
  render(<StaffApp />)
  await screen.findByRole('heading', { level: 1, name: t.title })
  return fetchMock
}

function fill(dialog: HTMLElement, values: { name?: string; starts_on?: string; ends_on?: string }) {
  if (values.name !== undefined) fireEvent.change(within(dialog).getByLabelText(t.name), { target: { value: values.name } })
  if (values.starts_on !== undefined) fireEvent.change(within(dialog).getByLabelText(t.startsOn), { target: { value: values.starts_on } })
  if (values.ends_on !== undefined) fireEvent.change(within(dialog).getByLabelText(t.endsOn), { target: { value: values.ends_on } })
}

describe('the terms screen', () => {
  it('opens from "Términos" in the menu', async () => {
    window.history.pushState(null, '', STAFF_PATH)
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/terms': terms([fall]) })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.adminItems.terms }))

    expect(window.location.pathname).toBe(STAFF_TERMS_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.dashboard.adminItems.terms })).toHaveAttribute('aria-current', 'page')
  })

  it('lists the current and coming terms with their dates and state, and the active one above', async () => {
    await openScreen()

    const table = await screen.findByRole('table', { name: t.currentTitle })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Enero - mayo 2027')).toBeInTheDocument()
    expect(within(rows[1]).getByText(t.status.upcoming)).toBeInTheDocument()
    expect(within(rows[2]).getByText('10 ago 2026')).toBeInTheDocument()
    expect(within(rows[2]).getByText('18 dic 2026')).toBeInTheDocument()
    expect(within(rows[2]).getByText(t.status.active)).toBeInTheDocument()
    expect(within(rows[2]).getByRole('button', { name: `${t.edit}, Agosto - diciembre 2026` })).toBeInTheDocument()
    expect(screen.queryByText('Enero - mayo 2026')).not.toBeInTheDocument()
    expect(screen.getByText(t.activeChip)).toBeInTheDocument()
    expect(screen.getAllByText('Agosto - diciembre 2026')).toHaveLength(2)
  })

  it('shows and hides the past terms behind a button', async () => {
    await openScreen()

    const show = await screen.findByRole('button', { name: t.showPast })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(show)

    const past = screen.getByRole('table', { name: t.pastTitle })
    expect(within(past).getByText('Enero - mayo 2026')).toBeInTheDocument()
    expect(within(past).getByText(t.status.past)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.hidePast })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: t.hidePast }))
    expect(screen.queryByRole('table', { name: t.pastTitle })).not.toBeInTheDocument()
  })

  it('says when no term covers today', async () => {
    await openScreen([next, spring])

    expect(await screen.findByText(t.noActiveChip)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.noActiveTitle })).toBeInTheDocument()
    expect(screen.getByText(t.noActiveText)).toBeInTheDocument()
  })

  it('invites the first term when there is none', async () => {
    await openScreen([])

    expect(await screen.findByRole('heading', { name: t.emptyTitle })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('heading', { name: t.emptyTitle }).closest('section')!).getByRole('button', { name: t.create }))
    expect(screen.getByRole('dialog', { name: t.createTitle })).toBeInTheDocument()
  })

  it('offers a retry when the list cannot load', async () => {
    let calls = 0
    await openScreen([], {
      '/api/staff/terms': () => (++calls === 1 ? apiError('server_error', 500) : json({ terms: [fall] })),
    })

    fireEvent.click(await screen.findByRole('button', { name: es.states.retry }))

    expect(await screen.findByRole('table', { name: t.currentTitle })).toBeInTheDocument()
  })

  it('says when there is no connection', async () => {
    await openScreen([], { '/api/staff/terms': offline })

    expect(await screen.findByRole('heading', { name: es.states.offlineTitle })).toBeInTheDocument()
  })

  it('shows no page banner when the connection drops: the buttons are disabled and the form keeps its notice', async () => {
    await openScreen()
    await screen.findByRole('table', { name: t.currentTitle })

    try {
      act(() => goOffline())

      expect(screen.getByRole('button', { name: t.create })).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByText(es.staffTeam.offlineText)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: es.states.offlineTitle })).not.toBeInTheDocument()
    } finally {
      act(() => goOnline())
    }
  })

  it('stays an empty dashboard for a Staff account', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json({ ...lorena, role: 'staff' }) })
    render(<StaffApp />)

    expect(await screen.findByText(`${lorena.name} · ${es.dashboard.roles.staff}`)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/terms')).toEqual([])
  })
})

describe('creating and editing a term', () => {
  it('creates a term and lists it', async () => {
    let list = [spring]
    const fetchMock = await openScreen(undefined, {
      '/api/staff/terms': () => json({ terms: list }),
      'POST /api/staff/terms': () => {
        list = [fall, spring]
        return json({ term: fall }, 201)
      },
    })

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    const dialog = screen.getByRole('dialog', { name: t.createTitle })
    expect(within(dialog).getByText(t.createText)).toBeInTheDocument()
    fill(dialog, { name: 'Agosto - diciembre 2026', starts_on: '2026-08-10', ends_on: '2026-12-18' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveNew }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('table', { name: t.currentTitle })).toHaveTextContent('Agosto - diciembre 2026')
    const status = screen.getByRole('status')
    expect(within(status).getByText(t.saved('Agosto - diciembre 2026'))).toBeInTheDocument()
    // The card carries the active term chip, like every A-04 state (Figma 4745:2051).
    expect(within(status).getByText('Agosto - diciembre 2026', { selector: '.team-chip' })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/terms').filter(([method]) => method === 'POST')).toEqual([
      ['POST', { name: 'Agosto - diciembre 2026', starts_on: '2026-08-10', ends_on: '2026-12-18' }],
    ])
  })

  it('edits a term with its values filled in and says when its authorizations end', async () => {
    const fetchMock = await openScreen(undefined, {
      'PATCH /api/staff/terms/2': () => json({ term: { ...fall, ends_on: '2026-12-11' } }),
    })

    fireEvent.click(await screen.findByRole('button', { name: `${t.edit}, Agosto - diciembre 2026` }))
    const dialog = screen.getByRole('dialog', { name: t.editTitle })
    expect(within(dialog).getByLabelText(t.name)).toHaveValue('Agosto - diciembre 2026')
    expect(within(dialog).getByLabelText(t.startsOn)).toHaveValue('2026-08-10')
    fill(dialog, { ends_on: '2026-12-11' })
    expect(within(dialog).getByText(t.editNote('11 dic 2026'))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveChanges }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(callsTo(fetchMock, '/api/staff/terms/2')).toEqual([
      ['PATCH', { name: 'Agosto - diciembre 2026', starts_on: '2026-08-10', ends_on: '2026-12-11' }],
    ])
  })

  it('explains dates in the wrong order and goes back to the start date', async () => {
    await openScreen(undefined, {
      'POST /api/staff/terms': () => apiError('validation_failed', 422, { ends_on: ['after_or_equal'] }),
    })

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    const dialog = screen.getByRole('dialog', { name: t.createTitle })
    fill(dialog, { name: 'Al revés', starts_on: '2026-12-18', ends_on: '2026-08-10' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveNew }))

    expect(await within(dialog).findByRole('heading', { name: t.orderTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.orderText)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(t.endsOn)).toHaveAttribute('aria-invalid', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: t.fixDates }))

    expect(within(dialog).getByRole('heading', { name: t.createTitle })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText(t.startsOn)).toHaveFocus())
    expect(within(dialog).getByLabelText(t.name)).toHaveValue('Al revés')
  })

  it('names the term the dates overlap', async () => {
    await openScreen(undefined, {
      'POST /api/staff/terms': () =>
        json({ error: { code: 'term_overlap', details: { term: { name: fall.name, starts_on: fall.starts_on, ends_on: fall.ends_on } } } }, 422),
    })

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    const dialog = screen.getByRole('dialog', { name: t.createTitle })
    fill(dialog, { name: 'Verano', starts_on: '2026-12-01', ends_on: '2027-05-21' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveNew }))

    expect(await within(dialog).findByRole('heading', { name: t.overlapTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.overlapText('Agosto - diciembre 2026', '10 ago 2026', '18 dic 2026'))).toBeInTheDocument()
  })

  it('shows a server error in the pink banner', async () => {
    await openScreen(undefined, { 'POST /api/staff/terms': () => apiError('server_error', 500) })

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    const dialog = screen.getByRole('dialog', { name: t.createTitle })
    fill(dialog, { name: 'Verano', starts_on: '2026-12-01', ends_on: '2027-05-21' })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveNew }))

    const notice = await within(dialog).findByText(es.errors.server_error)
    expect(notice.closest('.notice')).toHaveClass('notice--error')
  })

  it('shows a missing field under the field', async () => {
    await openScreen(undefined, {
      'POST /api/staff/terms': () => apiError('validation_failed', 422, { name: ['required'] }),
    })

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    const dialog = screen.getByRole('dialog', { name: t.createTitle })
    fireEvent.click(within(dialog).getByRole('button', { name: t.saveNew }))

    const name = within(dialog).getByLabelText(t.name)
    await waitFor(() => expect(name).toHaveFocus())
    expect(name).toHaveAccessibleDescription(es.validation.required)
  })

  it('closes with Cancelar and sends nothing', async () => {
    const fetchMock = await openScreen()

    fireEvent.click(screen.getByRole('button', { name: t.create }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/terms').filter(([method]) => method !== 'GET')).toEqual([])
  })
})
