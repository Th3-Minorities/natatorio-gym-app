import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_TEAM_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena, offline, team } from './fakeTeamApi'

// A-15 invite (Figma 100:1126, 100:1197, 100:1231) and resend (4039:3311), #84.

const t = es.staffTeam
const yariel = { id: 9, name: 'Yariel Nieves León', email: 'yariel@example.com', role: 'admin', status: 'invited' }

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_TEAM_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  goOnline()
  window.history.pushState(null, '', '/')
})

async function openInvite() {
  fireEvent.click(await screen.findByRole('button', { name: t.invite }))
  return screen.getByRole('dialog', { name: t.inviteTitle })
}

function fill(dialog: HTMLElement, name: string, email: string) {
  fireEvent.change(within(dialog).getByLabelText(t.fullName), { target: { value: name } })
  fireEvent.change(within(dialog).getByLabelText(t.email), { target: { value: email } })
}

describe('inviting a person', () => {
  it('opens the form with the name field ready to type', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    const dialog = await openInvite()
    expect(within(dialog).getByText(t.inviteText)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(t.fullName)).toHaveFocus()
    expect(within(dialog).getByRole('radio', { name: es.dashboard.roles.staff })).toBeChecked()
  })

  it('sends the invitation, closes the form and says it was sent', async () => {
    let accounts = team
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts }),
      'POST /api/staff/accounts': () => {
        accounts = [...team, yariel]
        return json({ account: yariel }, 201)
      },
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    // One live region is on the page before the banner, so screen readers speak what appears in it.
    const live = document.querySelector('.team-live')
    expect(live).toHaveAttribute('role', 'status')
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    fireEvent.click(within(dialog).getByRole('radio', { name: es.dashboard.roles.admin }))
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    const banner = await screen.findByRole('region', { name: t.invitedTitle })
    expect(banner).toHaveTextContent(t.invitedText('Yariel'))
    expect(live).toContainElement(banner)
    expect(within(banner).getByText(t.status.invited)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('yariel@example.com')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts')).toContainEqual([
      'POST',
      { name: 'Yariel Nieves León', email: 'yariel@example.com', role: 'admin' },
    ])
  })

  it('closes without sending when cancelled', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    const dialog = await openInvite()
    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts').some(([method]) => method === 'POST')).toBe(false)
  })

  it('shows "Este correo ya está en uso", then goes back to the form to fix the email', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => apiError('validation_failed', 422, { email: ['unique'] }),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'mariel@example.com')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    // Focus moves in an effect right after the view changes, so wait for it instead of checking at once.
    const heading = await within(dialog).findByRole('heading', { name: t.emailInUseTitle })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(within(dialog).getByText(t.emailInUseText('mariel@example.com'))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.fixEmail }))

    expect(within(dialog).getByLabelText(t.email)).toHaveFocus()
    expect(within(dialog).getByLabelText(t.email)).toHaveValue('mariel@example.com')
    expect(within(dialog).getByLabelText(t.fullName)).toHaveValue('Yariel Nieves León')
  })

  it('shows each field the server refused and moves to the first one', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => apiError('validation_failed', 422, { name: ['required'], email: ['email'] }),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, '', 'not-an-email')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    expect(await within(dialog).findByText(es.validation.required)).toBeInTheDocument()
    expect(within(dialog).getByText(es.validation.email)).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText(t.fullName)).toHaveFocus())
  })

  it('sends only once while the request runs', async () => {
    let finish: (response: Response) => void = () => {}
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => new Promise<Response>((resolve) => (finish = resolve)),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    const send = within(dialog).getByRole('button', { name: t.sendInvite })
    fireEvent.click(send)
    fireEvent.click(send)

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(callsTo(fetchMock, '/api/staff/accounts').filter(([method]) => method === 'POST')).toHaveLength(1)
    await act(async () => finish(json({ account: yariel }, 201)))
  })

  it('stays open on Esc and Cancelar while the invitation is being sent', async () => {
    let finish: (response: Response) => void = () => {}
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => new Promise<Response>((resolve) => (finish = resolve)),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.getByRole('dialog', { name: t.inviteTitle })).toBeInTheDocument()
    await act(async () => finish(json({ account: yariel }, 201)))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says there is no connection, not that the request failed', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': offline,
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(es.signIn.offlineTitle)
    expect(alert).toHaveTextContent(es.states.offlineRetryText)
    expect(alert).not.toHaveClass('notice--error')
  })

  it('shows a refused invitation in the pink error notice', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => apiError('server_error', 500),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    expect(await within(dialog).findByRole('alert')).toHaveClass('notice--error')
  })

  it('goes back to sign-in when the session ended', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts': () => apiError('staff_session_expired', 401),
    })
    render(<StaffApp />)

    const dialog = await openInvite()
    fill(dialog, 'Yariel Nieves León', 'yariel@example.com')
    fireEvent.click(within(dialog).getByRole('button', { name: t.sendInvite }))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.signIn.timeoutTitle)
  })

  it('cannot invite without a connection', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)
    await screen.findByRole('table')

    act(() => goOffline())

    const invite = screen.getByRole('button', { name: t.invite })
    expect(invite).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(invite)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(t.offlineText)).toBeInTheDocument()
  })
})

describe('resending an invitation', () => {
  it('sends a new link and says so', async () => {
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts/3/invitation': () => json(null, 204),
    })
    render(<StaffApp />)

    const row = (await screen.findByText('Nayeli Lugo Paz')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: `${t.resend}, Nayeli Lugo Paz` }))

    const banner = await screen.findByRole('region', { name: t.resentTitle })
    expect(banner).toHaveTextContent(t.resentText('nayeli@example.com', 'Nayeli'))
    expect(document.querySelector('.team-live')).toHaveAttribute('role', 'status')
    expect(document.querySelector('.team-live')).toContainElement(banner)
    expect(callsTo(fetchMock, '/api/staff/accounts/3/invitation')).toEqual([['POST', undefined]])
  })

  it('only invited rows offer it', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)
    await screen.findByRole('table')

    expect(screen.getAllByRole('button', { name: new RegExp(`^${t.resend}`) })).toHaveLength(1)
  })

  it('explains a refusal and loads the list again', async () => {
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts/3/invitation': () => apiError('staff_account_not_invited', 409),
    })
    render(<StaffApp />)

    const row = (await screen.findByText('Nayeli Lugo Paz')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: `${t.resend}, Nayeli Lugo Paz` }))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.staff_account_not_invited)
    await waitFor(() => expect(callsTo(fetchMock, '/api/staff/accounts').length).toBe(2))
  })
})
