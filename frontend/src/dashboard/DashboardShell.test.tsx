import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { DashboardShell, type StaffAccount } from './DashboardShell'

// Figma MOCKUPS-GYM, "Dashboard / Shell" (node 98:5). The sign-in that supplies the account is #16.

const admin: StaffAccount = { name: 'Lorena Ortiz', role: 'admin' }
const staff: StaffAccount = { name: 'Luis Ortiz', role: 'staff' }

function renderShell(account: StaffAccount, onSignOut = vi.fn()) {
  render(
    <DashboardShell
      account={account}
      onSignOut={onSignOut}
      title="Título de página"
      description="Descripción de la página"
      action={<button type="button">Acción principal</button>}
    >
      <p>Contenido de la página</p>
    </DashboardShell>,
  )
  return onSignOut
}

describe('DashboardShell', () => {
  it('shows the Staff and General menu items to everyone', () => {
    renderShell(staff)

    const menu = screen.getByRole('navigation', { name: es.dashboard.menu })
    for (const item of [...Object.values(es.dashboard.staffItems), ...Object.values(es.dashboard.generalItems)]) {
      expect(within(menu).getByText(item)).toBeInTheDocument()
    }
  })

  it('hides the Administration items from Staff (REQ-NF-10)', () => {
    renderShell(staff)

    expect(screen.queryByText(es.dashboard.adminSection)).not.toBeInTheDocument()
    for (const item of Object.values(es.dashboard.adminItems)) {
      expect(screen.queryByText(item)).not.toBeInTheDocument()
    }
  })

  it('shows the Administration items to Administrators', () => {
    renderShell(admin)

    expect(screen.getByText(es.dashboard.adminSection)).toBeInTheDocument()
    for (const item of Object.values(es.dashboard.adminItems)) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it('shows who is signed in and their role', () => {
    renderShell(admin)

    expect(screen.getByText(`Lorena Ortiz · ${es.dashboard.roles.admin}`)).toBeInTheDocument()
  })

  it('signs out from the sidebar', () => {
    const onSignOut = renderShell(staff)

    fireEvent.click(screen.getByRole('button', { name: es.dashboard.signOut }))

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('puts the page title, description, action and content in the main area', () => {
    renderShell(staff)

    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Título de página' })).toBeInTheDocument()
    expect(within(main).getByText('Descripción de la página')).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Acción principal' })).toBeInTheDocument()
    expect(within(main).getByText('Contenido de la página')).toBeInTheDocument()
  })

  it('lets keyboard users skip the menu (WCAG 2.4.1)', () => {
    renderShell(staff)

    const skip = screen.getByRole('link', { name: es.dashboard.skipToContent })
    expect(skip).toHaveAttribute('href', '#dashboard-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'dashboard-content')
  })

  it('menu items that no screen has connected yet are plain text, not dead links', () => {
    renderShell(admin)

    expect(within(screen.getByRole('navigation')).queryAllByRole('link')).toEqual([])
  })

  it('follows the account language', () => {
    render(
      <I18nProvider locale="en">
        <DashboardShell account={admin} onSignOut={() => {}} title="Page title">
          <p>Content</p>
        </DashboardShell>
      </I18nProvider>,
    )

    expect(screen.getByText(en.dashboard.staffItems.activeSessions)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.dashboard.signOut })).toBeInTheDocument()
  })

  it('shows the account name as text, never as HTML', () => {
    renderShell({ name: '<img src=x onerror="alert(1)">', role: 'staff' })

    expect(document.querySelector('img')).toBeNull()
  })
})
