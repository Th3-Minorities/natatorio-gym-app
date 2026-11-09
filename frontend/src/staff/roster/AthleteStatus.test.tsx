import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_ROSTER_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, json, lorena } from '../team/fakeTeamApi'

// Retirar and Restituir on A-05 (Figma 101:1221, 101:1248, 101:1285 and 101:1383, #21).

const t = es.roster
const alina = {
  id: 1,
  name: 'Alina Mercado Cruz',
  sport: 'Voleibol',
  student_number: '802612346',
  institutional_email: 'alina.mercado@upr.edu',
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

const ALL = '/api/staff/roster?status=all'

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_ROSTER_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

/** Opens A-05 with both filters on, so active and withdrawn athletes show. */
async function openScreen(routes: Parameters<typeof fakeApi>[0] = {}) {
  let list: object[] = [alina, darel]
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(lorena),
    '/api/staff/roster?status=active': () => json({ athletes: [alina], active_count: 1 }),
    [ALL]: () => json({ athletes: list, active_count: 1 }),
    ...routes,
  })
  render(<StaffApp />)
  await screen.findByRole('table', { name: t.tableTitle })
  fireEvent.click(screen.getByRole('button', { name: t.filterWithdrawn }))
  await screen.findByText(darel.name)
  return { fetchMock, setList: (next: object[]) => (list = next) }
}

describe('withdrawing an athlete', () => {
  it('asks first, then withdraws and says so', async () => {
    let setList: (next: object[]) => void = () => {}
    const opened = await openScreen({
      'POST /api/staff/roster/1/withdraw': () => {
        setList([{ ...alina, status: 'withdrawn' }, darel])
        return json({ athlete: { ...alina, status: 'withdrawn' } })
      },
    })
    setList = opened.setList

    fireEvent.click(screen.getByRole('button', { name: `${t.withdraw}, ${alina.name}` }))
    const dialog = screen.getByRole('dialog', { name: t.withdrawTitle(alina.name) })
    expect(within(dialog).getByText(t.withdrawText)).toBeInTheDocument()
    expect(within(dialog).getByText(t.withdrawMeta(alina.student_number, alina.sport))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.withdrawConfirm }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(t.withdrawn(alina.name))
    expect(await screen.findByRole('button', { name: `${t.reinstate}, ${alina.name}` })).toBeInTheDocument()
    expect(callsTo(opened.fetchMock, '/api/staff/roster/1/withdraw')).toEqual([['POST', undefined]])
  })

  it('closes with Cancelar and sends nothing', async () => {
    const { fetchMock } = await openScreen()

    fireEvent.click(screen.getByRole('button', { name: `${t.withdraw}, ${alina.name}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/roster/1/withdraw')).toEqual([])
  })

  it('says when someone else changed the athlete, and reloads the list', async () => {
    const { fetchMock } = await openScreen({
      'POST /api/staff/roster/1/withdraw': () => apiError('roster_status_changed', 409),
    })
    const before = callsTo(fetchMock, ALL).length

    fireEvent.click(screen.getByRole('button', { name: `${t.withdraw}, ${alina.name}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.withdrawConfirm }))

    const changed = await within(screen.getByRole('dialog')).findByText(es.errors.roster_status_changed)
    // The pink error banner, as N-11 draws its errors (Figma 4745:2133).
    expect(changed.closest('.notice')).toHaveClass('notice--error')
    await waitFor(() => expect(callsTo(fetchMock, ALL).length).toBeGreaterThan(before))
  })
})

describe('reinstating an athlete', () => {
  it('needs a reason of at least 10 characters, then reinstates with it', async () => {
    const { fetchMock } = await openScreen({
      'POST /api/staff/roster/3/reinstate': () => json({ athlete: { ...darel, status: 'active' } }),
    })

    fireEvent.click(screen.getByRole('button', { name: `${t.reinstate}, ${darel.name}` }))
    const dialog = screen.getByRole('dialog', { name: t.reinstateTitle(darel.name) })
    expect(within(dialog).getByText(t.reinstateText)).toBeInTheDocument()
    const reason = within(dialog).getByLabelText(t.reason)
    expect(reason).toHaveAccessibleDescription(t.reasonHint)

    fireEvent.change(reason, { target: { value: 'Error' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.reinstateConfirm }))

    expect(within(dialog).getByRole('heading', { name: t.shortTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.shortText)).toBeInTheDocument()
    expect(reason).toHaveAccessibleDescription(t.reasonCount(5))
    expect(reason).toHaveAttribute('aria-invalid', 'true')
    expect(callsTo(fetchMock, '/api/staff/roster/3/reinstate')).toEqual([])

    fireEvent.change(reason, { target: { value: 'Retiro por error del administrador' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.reinstateConfirm }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(t.reinstated(darel.name))
    expect(callsTo(fetchMock, '/api/staff/roster/3/reinstate')).toEqual([
      ['POST', { reason: 'Retiro por error del administrador' }],
    ])
  })

  it('explains when the athlete already has an active authorization', async () => {
    await openScreen({
      'POST /api/staff/roster/3/reinstate': () =>
        json(
          { error: { code: 'roster_reinstate_active_authorization', details: { term: { name: 'Agosto - diciembre 2026' } } } },
          409,
        ),
    })

    fireEvent.click(screen.getByRole('button', { name: `${t.reinstate}, ${darel.name}` }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(t.reason), { target: { value: 'Retiro por error del administrador' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.reinstateConfirm }))

    expect(await within(dialog).findByRole('heading', { name: t.refusedTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.refusedText(darel.name, 'Agosto - diciembre 2026'))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.close }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
