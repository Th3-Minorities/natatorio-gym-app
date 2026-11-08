import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_TEAM_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena, offline, team } from './fakeTeamApi'

// A-15 change role (Figma 4039:3226, 4039:3252, 4039:3285), deactivate (100:1205) and reactivate (no frame), #84.

const t = es.staffTeam
const roles = es.dashboard.roles

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_TEAM_PATH)
})

afterEach(() => {
  vi.unstubAllGlobals()
  goOnline()
  window.history.pushState(null, '', '/')
})

async function row(name: string) {
  return (await screen.findByText(name)).closest('tr') as HTMLElement
}

describe('the actions on each row', () => {
  it('match Figma for each kind of row', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    const names = async (name: string) =>
      within(await row(name)).queryAllByRole('button').map((button) => button.textContent)
    expect(await names('Lorena Ortiz')).toEqual([t.changeRole])
    expect(await names('Mariel Vélez Soto')).toEqual([t.changeRole, t.deactivate])
    expect(await names('Nayeli Lugo Paz')).toEqual([t.resend, t.deactivate])
    expect(await names('Damián Ruiz Solís')).toEqual([t.reactivate])
  })

  it('sit in one Acciones column as plain links, all in the same style', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    await screen.findByRole('table')
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      t.columns.name,
      t.columns.email,
      t.columns.role,
      t.columns.status,
      t.columns.actions,
    ])
    const buttons = within(screen.getByRole('table')).getAllByRole('button')
    expect(buttons).toHaveLength(6)
    for (const button of buttons) {
      expect(button).toHaveClass('button--link')
      expect(button).not.toHaveClass('team-action--danger')
    }
  })

  it('name the person for screen readers', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    expect(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${t.reactivate}, Damián Ruiz Solís` })).toBeInTheDocument()
  })
})

describe('changing a role', () => {
  it('starts on the other role, saves it and says so', async () => {
    let accounts = team
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts }),
      'PATCH /api/staff/accounts/2/role': () => {
        accounts = team.map((a) => (a.id === 2 ? { ...a, role: 'admin' } : a))
        return json({ account: accounts[1] })
      },
    })
    render(<StaffApp />)

    fireEvent.click(within(await row('Mariel Vélez Soto')).getByRole('button', { name: `${t.changeRole}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.changeRole })
    expect(within(dialog).getByText('Mariel Vélez Soto')).toBeInTheDocument()
    expect(within(dialog).getByText(t.currentRole(roles.staff))).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: roles.admin })).toBeChecked()
    expect(within(dialog).getByText(t.roleAudit)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.save }))

    const banner = await screen.findByRole('region', { name: t.roleChangedTitle })
    expect(banner).toHaveTextContent(t.roleChangedText('Mariel Vélez Soto', roles.admin))
    expect(document.querySelector('.team-live')).toHaveAttribute('role', 'status')
    expect(document.querySelector('.team-live')).toContainElement(banner)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts/2/role')).toEqual([['PATCH', { role: 'admin' }]])
    await waitFor(() => expect(within(screen.getAllByRole('row')[2]).getByText(roles.admin)).toBeInTheDocument())
  })

  it('tells you that you cannot change your own role, without asking the server', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    fireEvent.click(within(await row('Lorena Ortiz')).getByRole('button', { name: `${t.changeRole}, Lorena Ortiz` }))
    const dialog = screen.getByRole('dialog', { name: t.ownRoleTitle })
    expect(within(dialog).getByText(`Lorena Ortiz · ${roles.admin}`)).toBeInTheDocument()
    expect(within(dialog).getByText(t.ownRoleText(roles.admin))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.understood }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/role'))).toBe(false)
  })

  it('closes without sending when the role is the one it has now', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    fireEvent.click(within(await row('Mariel Vélez Soto')).getByRole('button', { name: `${t.changeRole}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.changeRole })
    fireEvent.click(within(dialog).getByRole('radio', { name: roles.staff }))
    fireEvent.click(within(dialog).getByRole('button', { name: t.save }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(t.roleChangedTitle)).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts/2/role')).toEqual([])
  })

  it('stays open on Esc and Cancelar while the change is being sent', async () => {
    let finish: (response: Response) => void = () => {}
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'PATCH /api/staff/accounts/2/role': () => new Promise<Response>((resolve) => (finish = resolve)),
    })
    render(<StaffApp />)

    fireEvent.click(within(await row('Mariel Vélez Soto')).getByRole('button', { name: `${t.changeRole}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.changeRole })
    fireEvent.click(within(dialog).getByRole('button', { name: t.save }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.getByRole('dialog', { name: t.changeRole })).toBeInTheDocument()
    await act(async () => finish(json({ account: { ...team[1], role: 'admin' } })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says there is no connection, not that the request failed', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'PATCH /api/staff/accounts/2/role': offline,
    })
    render(<StaffApp />)

    fireEvent.click(within(await row('Mariel Vélez Soto')).getByRole('button', { name: `${t.changeRole}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.changeRole })
    fireEvent.click(within(dialog).getByRole('button', { name: t.save }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(es.signIn.offlineTitle)
    expect(alert).toHaveTextContent(es.states.offlineRetryText)
    expect(alert).not.toHaveTextContent(es.errors.bad_request)
  })

  it('shows a refusal inside the form', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'PATCH /api/staff/accounts/2/role': () => apiError('staff_account_status_changed', 409),
    })
    render(<StaffApp />)

    fireEvent.click(within(await row('Mariel Vélez Soto')).getByRole('button', { name: `${t.changeRole}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.changeRole })
    fireEvent.click(within(dialog).getByRole('button', { name: t.save }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(es.errors.staff_account_status_changed)
  })
})

describe('deactivating an account', () => {
  it('asks first, then deactivates and says so to screen readers', async () => {
    let accounts = team
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts }),
      'POST /api/staff/accounts/2/deactivate': () => {
        accounts = team.map((a) => (a.id === 2 ? { ...a, status: 'deactivated' } : a))
        return json({ account: accounts[1] })
      },
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog', { name: t.deactivateTitle('Mariel Vélez Soto') })
    expect(within(dialog).getByText(t.deactivateText)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.deactivateConfirm }))

    expect(await screen.findByText(t.deactivated('Mariel Vélez Soto'))).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts/2/deactivate')).toEqual([['POST', undefined]])
    expect(await screen.findByRole('button', { name: `${t.reactivate}, Mariel Vélez Soto` })).toBeInTheDocument()
  })

  it('puts focus on Cancelar first, since the other button is destructive', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: t.cancel })).toHaveFocus())
  })

  it('stays open on Esc and Cancelar while the account is being deactivated', async () => {
    let finish: (response: Response) => void = () => {}
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts/2/deactivate': () => new Promise<Response>((resolve) => (finish = resolve)),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t.deactivateConfirm }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => finish(json({ account: { ...team[1], status: 'deactivated' } })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does nothing when cancelled', async () => {
    const fetchMock = fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts/2/deactivate')).toEqual([])
  })

  it('explains why the last Administrator stays', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts/2/deactivate': () => apiError('staff_last_administrator', 409),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t.deactivateConfirm }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(es.errors.staff_last_administrator)
  })

  it('cannot deactivate without a connection', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), '/api/staff/accounts': () => json({ accounts: team }) })
    render(<StaffApp />)
    const button = await screen.findByRole('button', { name: `${t.deactivate}, Mariel Vélez Soto` })

    act(() => goOffline())
    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('reactivating an account', () => {
  it('reactivates at once and says so to screen readers', async () => {
    let accounts = team
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts }),
      'POST /api/staff/accounts/4/reactivate': () => {
        accounts = team.map((a) => (a.id === 4 ? { ...a, status: 'active' } : a))
        return json({ account: accounts[3] })
      },
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.reactivate}, Damián Ruiz Solís` }))

    expect(await screen.findByText(t.reactivated('Damián Ruiz Solís'))).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/accounts/4/reactivate')).toEqual([['POST', undefined]])
    expect(await screen.findByRole('button', { name: `${t.deactivate}, Damián Ruiz Solís` })).toBeInTheDocument()
  })

  it('explains a refusal', async () => {
    fakeApi({
      '/api/staff/me': () => json(lorena),
      '/api/staff/accounts': () => json({ accounts: team }),
      'POST /api/staff/accounts/4/reactivate': () => apiError('staff_account_status_changed', 409),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('button', { name: `${t.reactivate}, Damián Ruiz Solís` }))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.staff_account_status_changed)
  })
})

describe('an Administrator who lost the role', () => {
  it('leaves the list when the API answers forbidden, instead of offering a retry that fails', async () => {
    let me = lorena
    fakeApi({
      '/api/staff/me': () => json(me),
      '/api/staff/accounts': () => {
        me = { ...lorena, role: 'staff' }
        return apiError('forbidden', 403)
      },
    })
    render(<StaffApp />)

    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: t.title })).not.toBeInTheDocument())
    expect(screen.queryByText(es.states.errorTitle)).not.toBeInTheDocument()
  })
})
