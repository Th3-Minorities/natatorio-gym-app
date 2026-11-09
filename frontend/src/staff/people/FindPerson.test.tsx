import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_FIND_PATH, STAFF_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, json, lorena, offline } from '../team/fakeTeamApi'
import { camila } from '../sessions/fakeSessions'

// S-03 "Buscar persona y Check in asistido" (Figma 4283:1011, 4288:1573, 4288:1920, 4288:2028 and the states, #26).

const t = es.findPerson
const name = 'Camila Rivera Santiago'
const BY_NUMBER = '/api/staff/people?search=802612345'
const luis = { ...camila, user_id: 8, name: 'Luis Méndez', student_number: null, type: 'student', sport: null, masked_email: 'l***z@upr.edu' }
const luis2 = { ...luis, user_id: 9, name: 'Luis Méndez Rivera', masked_email: 'l***4@upr.edu' }

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_FIND_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

async function search(text: string, routes: Parameters<typeof fakeApi>[0] = {}) {
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(lorena),
    [BY_NUMBER]: () => json({ people: [camila] }),
    '/api/staff/occupancy': () => json({ count: 1, max: 40, updated_at: new Date().toISOString(), gym: 'open' }),
    '/api/staff/sessions': () => json({ sessions: [] }),
    ...routes,
  })
  render(<StaffApp />)
  expect(await screen.findByRole('heading', { name: t.startTitle })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(t.search), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: t.submit }))
  return fetchMock
}

describe('S-03 assisted Check In', () => {
  it('opens from "Buscar persona" in the menu', async () => {
    window.history.pushState(null, '', STAFF_PATH)
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/occupancy': () => json({ count: 0, max: 40, updated_at: new Date().toISOString(), gym: 'open' }),
      '/api/staff/sessions': () => json({ sessions: [] }),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.staffItems.searchPerson }))

    expect(window.location.pathname).toBe(STAFF_FIND_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
  })

  it('finds an athlete, checks the photo and records the entry after asking', async () => {
    const fetchMock = await search('802612345', {
      'POST /api/staff/check-in': () => json({ session: { id: 31, status: 'active' } }, 201),
    })

    expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
    expect(screen.getByText(t.noSession)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: es.sessionDetail.photo })).toHaveAttribute('src', '/api/staff/people/7/photo')
    fireEvent.click(screen.getByRole('button', { name: t.photoMatches }))
    const dialog = screen.getByRole('dialog', { name: t.confirmTitle })
    expect(within(dialog).getByText(t.confirmText(name))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.confirm }))

    await waitFor(() => expect(window.location.pathname).toBe(STAFF_PATH))
    expect(callsTo(fetchMock, '/api/staff/check-in')).toEqual([['POST', { user_id: 7 }]])
  })

  it('lets Staff pick the right account when names repeat, by the masked email', async () => {
    await search('Luis Méndez', { [`/api/staff/people?${new URLSearchParams({ search: 'Luis Méndez' })}`]: () => json({ people: [luis, luis2] }) })

    expect(await screen.findByRole('heading', { name: t.selectTitle })).toBeInTheDocument()
    expect(screen.getByText('Luis Méndez · l***z@upr.edu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.selectOne('Luis Méndez Rivera') }))

    expect(await screen.findByRole('heading', { name: 'Luis Méndez Rivera' })).toBeInTheDocument()
  })

  it('says when nobody matches', async () => {
    await search('Zoe', { '/api/staff/people?search=Zoe': () => json({ people: [] }) })

    expect(await screen.findByRole('heading', { name: t.notFoundTitle })).toBeInTheDocument()
  })

  it('says when the search fails or there is no connection', async () => {
    await search('Zoe', { '/api/staff/people?search=Zoe': () => apiError('server_error', 500) })
    expect(await screen.findByRole('heading', { name: t.failedTitle })).toBeInTheDocument()
  })

  it('says when there is no connection', async () => {
    await search('Zoe', { '/api/staff/people?search=Zoe': offline })
    expect(await screen.findByRole('heading', { name: t.offlineTitle })).toBeInTheDocument()
  })

  it.each([
    ['no current authorization', { authorization: { current: false, term: null } }, t.refusals.noAuthorization.title],
    ['no photo', { has_photo: false }, t.refusals.photoRequired.title],
    ['a pending photo', { photo_pending: true }, t.refusals.photoPending.title],
  ])('explains %s before any entry, with no way to confirm', async (_, change, title) => {
    await search('802612345', { [BY_NUMBER]: () => json({ people: [{ ...camila, ...change }] }) })

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.photoMatches })).not.toBeInTheDocument()
  })

  it('shows the open visit instead of a second one (4288:1695)', async () => {
    const startedAt = new Date().toISOString()
    await search('802612345', { [BY_NUMBER]: () => json({ people: [{ ...camila, active_session: { id: 11, started_at: startedAt } }] }) })

    expect(await screen.findByRole('heading', { name: t.activeTitle })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.openActive })).toHaveAttribute('href', '/staff/sesiones/11')
    expect(screen.queryByRole('button', { name: t.photoMatches })).not.toBeInTheDocument()
  })

  it.each([
    ['check_in_gym_closed', t.refusals.gymClosed.title],
    ['check_in_athletes_only', t.refusals.athletesOnly.title],
  ])('explains a refusal from the server (%s)', async (code, title) => {
    await search('802612345', { 'POST /api/staff/check-in': () => apiError(code, 409) })

    fireEvent.click(await screen.findByRole('button', { name: t.photoMatches }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.confirm }))

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(window.location.pathname).toBe(STAFF_FIND_PATH)
  })

  it('marks the photo pending when it does not match, and records no entry', async () => {
    const fetchMock = await search('802612345', {
      'POST /api/staff/people/7/photo-pending': () => json({ person: { ...camila, photo_pending: true } }),
    })

    fireEvent.click(await screen.findByRole('button', { name: t.photoDiffers }))
    const dialog = screen.getByRole('dialog', { name: t.pendingTitle })
    expect(within(dialog).getByText(t.pendingText(name))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.pendingConfirm }))

    expect(await screen.findByRole('heading', { name: t.refusals.photoPending.title })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/check-in')).toEqual([])
  })

  it('closes the confirmation with Cancelar and records nothing', async () => {
    const fetchMock = await search('802612345')

    fireEvent.click(await screen.findByRole('button', { name: t.photoMatches }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/check-in')).toEqual([])
  })
})
