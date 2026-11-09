import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { apiError, callsTo, fakeApi, json, lorena } from '../team/fakeTeamApi'
import { camilaDetail } from './fakeSessions'

// S-02 "Persona y sesión" (Figma 121:3142, the confirmations 122:3040 to 122:3094 and the states, #26).

const t = es.sessionDetail
const DETAIL = '/api/staff/sessions/11'
const name = 'Camila Rivera Santiago'

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', '/staff/sesiones/11')
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

function openDetail(routes: Parameters<typeof fakeApi>[0] = {}, detail: object = camilaDetail) {
  const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), [DETAIL]: () => json(detail), ...routes })
  render(<StaffApp />)
  return fetchMock
}

function ended(status: string) {
  return { ...camilaDetail, session: { ...camilaDetail.session, status, ended_at: new Date().toISOString() } }
}

describe('S-02 detail', () => {
  it('shows the person, what Staff may see, and the active session', async () => {
    openDetail()

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
    expect(screen.getByText(t.studentNumber('802612345'))).toBeInTheDocument()
    expect(screen.getByText(es.activeSessions.types.athlete)).toBeInTheDocument()
    expect(screen.getByText(`Baloncesto femenino · ${t.authorizationActive}`)).toBeInTheDocument()
    expect(screen.getByText(t.term('Agosto - diciembre 2026'))).toBeInTheDocument()
    expect(screen.getByText(t.waiver('12 ago 2026', '3'))).toBeInTheDocument()
    expect(screen.getByText('Marisol Santiago · 787-555-0146')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: t.photo })).toHaveAttribute('src', '/api/staff/sessions/11/photo')
    const session = screen.getByRole('region', { name: t.currentSession })
    expect(within(session).getByText(t.activeChip)).toBeInTheDocument()
    expect(within(session).getByText('1 h 14 min')).toBeInTheDocument()
    for (const action of [t.checkOut, t.endEarly, t.void]) {
      expect(within(session).getByRole('button', { name: action })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: t.markPending })).toBeInTheDocument()
  })

  it.each([
    ['end early', t.endEarly, t.endEarlyTitle(name), t.endEarlyConfirm, 'end-early', 'ended_early'],
    ['void', t.void, t.voidTitle(name), t.voidConfirm, 'void', 'void'],
    ['check out', t.checkOut, t.checkOutTitle(name), t.checkOut, 'check-out', 'checked_out'],
  ])('can %s an active session after asking', async (_, action, title, confirm, path, status) => {
    let detail: object = camilaDetail
    const fetchMock = openDetail({
      [DETAIL]: () => json(detail),
      [`POST ${DETAIL}/${path}`]: () => {
        detail = ended(status)
        return json({ session: ended(status).session })
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: action }))
    const dialog = screen.getByRole('dialog', { name: title })
    fireEvent.click(within(dialog).getByRole('button', { name: confirm }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const session = await screen.findByRole('region', { name: t.endedSession })
    expect(within(session).getByText(t.ended[status as keyof typeof t.ended])).toBeInTheDocument()
    expect(within(session).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(t.done[status as keyof typeof t.done])).toBeInTheDocument()
    expect(callsTo(fetchMock, `${DETAIL}/${path}`)).toEqual([['POST', undefined]])
  })

  it('says the session changed elsewhere and reloads it', async () => {
    let detail: object = camilaDetail
    openDetail({
      [DETAIL]: () => json(detail),
      [`POST ${DETAIL}/end-early`]: () => {
        detail = ended('checked_out')
        return apiError('check_out_session_not_active', 409)
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: t.endEarly }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.endEarlyConfirm }))

    expect(await screen.findByRole('heading', { name: t.changedTitle })).toBeInTheDocument()
    expect(screen.getByText(t.changedHint)).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: t.endedSession })).toBeInTheDocument()
  })

  it('marks the photo pending after asking, and keeps the session', async () => {
    let detail: object = camilaDetail
    const fetchMock = openDetail({
      [DETAIL]: () => json(detail),
      'POST /api/staff/people/7/photo-pending': () => {
        detail = { ...camilaDetail, person: { ...camilaDetail.person, photo_pending: true } }
        return json({ person: { ...camilaDetail.person, photo_pending: true } })
      },
    })

    fireEvent.click(await screen.findByRole('button', { name: t.markPending }))
    const dialog = screen.getByRole('dialog', { name: t.pendingConfirmTitle(name) })
    expect(within(dialog).getByText(t.pendingConfirmNote)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.pendingConfirm }))

    expect(await screen.findByRole('heading', { name: t.pendingTitle })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.markPending })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: t.currentSession })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/people/7/photo-pending')).toEqual([['POST', undefined]])
  })

  it('shows a finished session with how it ended and no actions', async () => {
    openDetail({}, ended('expired'))

    const session = await screen.findByRole('region', { name: t.endedSession })
    expect(within(session).getByText(t.ended.expired)).toBeInTheDocument()
    expect(within(session).getByText(t.exit)).toBeInTheDocument()
    expect(within(session).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers a retry when the data cannot load', async () => {
    let calls = 0
    openDetail({ [DETAIL]: () => (++calls === 1 ? apiError('server_error', 500) : json(camilaDetail)) })

    expect(await screen.findByRole('heading', { name: t.errorTitle })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: es.states.retry }))

    expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
  })

  it('is also open to Staff accounts', async () => {
    fakeApi({ '/api/staff/me': () => json({ ...lorena, role: 'staff' }), [DETAIL]: () => json(camilaDetail) })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
  })
})
