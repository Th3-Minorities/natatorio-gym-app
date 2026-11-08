import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { apiError, callsTo, fakeApi, json } from '../team/fakeTeamApi'

// N-11 email link pages (#84): Recuperar contraseña (4039:4170), Revisa tu correo (4039:4224),
// Crear tu contraseña (4126:1316), Restablecer contraseña (4126:1341), Enlace vencido o usado (4039:4325).

const a = es.staffAccess
const signedOut = () => apiError('unauthenticated', 401)
const PASSWORD = 'una frase nueva y larga'

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState(null, '', '/')
})

function at(path: string) {
  window.history.pushState(null, '', path)
}

function choosePassword(password = PASSWORD, confirmation = PASSWORD) {
  fireEvent.change(screen.getByLabelText(a.newPassword), { target: { value: password } })
  fireEvent.change(screen.getByLabelText(a.confirmPassword), { target: { value: confirmation } })
}

describe('N-11 sign-in', () => {
  it('opens Recuperar contraseña from "¿Olvidaste tu contraseña?"', async () => {
    at('/staff')
    fakeApi({ '/api/staff/me': signedOut })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.signIn.forgot }))

    expect(window.location.pathname).toBe('/staff/recuperar')
    expect(await screen.findByRole('heading', { level: 1, name: a.forgotTitle })).toBeInTheDocument()
  })
})

describe('Recuperar contraseña', () => {
  it('sends the email and shows "Revisa tu correo" whatever the answer means', async () => {
    at('/staff/recuperar')
    const fetchMock = fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/email': () => json({ status: 'received' }),
    })
    render(<StaffApp />)

    fireEvent.change(await screen.findByLabelText(a.email), { target: { value: 'mariel@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: a.sendLink }))

    expect(await screen.findByRole('heading', { level: 1, name: a.checkEmailTitle })).toBeInTheDocument()
    expect(screen.getByText(a.checkEmailText)).toBeInTheDocument()
    expect(screen.getByText(a.checkSpam)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/password/email')).toEqual([['POST', { email: 'mariel@example.com' }]])
  })

  it('shows a wrong email under the field', async () => {
    at('/staff/recuperar')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/email': () => apiError('validation_failed', 422, { email: ['email'] }),
    })
    render(<StaffApp />)

    fireEvent.change(await screen.findByLabelText(a.email), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: a.sendLink }))

    expect(await screen.findByText(es.validation.email)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(a.email)).toHaveFocus())
  })

  it('says when there are too many requests', async () => {
    at('/staff/recuperar')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/email': () => apiError('too_many_requests', 429),
    })
    render(<StaffApp />)

    fireEvent.change(await screen.findByLabelText(a.email), { target: { value: 'mariel@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: a.sendLink }))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.too_many_requests)
  })

  it('goes back to sign-in', async () => {
    at('/staff/recuperar')
    fakeApi({ '/api/staff/me': signedOut })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: a.backToSignIn }))

    expect(window.location.pathname).toBe('/staff')
    expect(await screen.findByRole('heading', { level: 1, name: es.signIn.title })).toBeInTheDocument()
  })
})

describe('Crear tu contraseña, from the invitation', () => {
  const invited = () => json({ name: 'Lucía Vega Ramos', email: 'lucia@example.com', role: 'admin' })

  it('shows who was invited, saves the password and goes back to sign-in', async () => {
    at('/staff/invitacion?token=abc123')
    const fetchMock = fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': invited,
      'POST /api/staff/invitation/accept': () => json(null, 204),
    })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: a.createTitle })).toBeInTheDocument()
    expect(screen.getByText('Lucía Vega Ramos')).toBeInTheDocument()
    expect(screen.getByText(`${es.dashboard.roles.admin} · lucia@example.com`)).toBeInTheDocument()
    expect(screen.getByLabelText(a.newPassword)).toHaveAccessibleDescription(a.passwordHint)
    choosePassword()
    fireEvent.click(screen.getByRole('button', { name: a.createSubmit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(a.savedTitle)
    expect(window.location.pathname).toBe('/staff')
    expect(window.location.search).toBe('')
    expect(callsTo(fetchMock, '/api/staff/invitation/validate')).toEqual([['POST', { token: 'abc123' }]])
    expect(callsTo(fetchMock, '/api/staff/invitation/accept')).toEqual([
      ['POST', { token: 'abc123', password: PASSWORD, password_confirmation: PASSWORD }],
    ])
  })

  it('shows "Enlace vencido o usado" for a link that no longer works', async () => {
    at('/staff/invitacion?token=old')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': () => apiError('staff_invite_link_invalid', 422),
    })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: a.expiredTitle })).toBeInTheDocument()
    expect(screen.getByText(a.inviteExpiredText)).toBeInTheDocument()
    expect(screen.getByText(a.inviteExpiredHelp)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: a.backToSignIn })).toBeInTheDocument()
  })

  it('shows "Enlace vencido o usado" without asking when the link has no token', async () => {
    at('/staff/invitacion')
    const fetchMock = fakeApi({ '/api/staff/me': signedOut })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: a.expiredTitle })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/api/staff/invitation/validate')).toEqual([])
  })

  it('shows the password rules the server refused', async () => {
    at('/staff/invitacion?token=abc123')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': invited,
      'POST /api/staff/invitation/accept': () => apiError('validation_failed', 422, { password: ['password'] }),
    })
    render(<StaffApp />)

    await screen.findByRole('heading', { level: 1, name: a.createTitle })
    choosePassword('corta', 'corta')
    fireEvent.click(screen.getByRole('button', { name: a.createSubmit }))

    expect(await screen.findByText(es.validation.password)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(a.newPassword)).toHaveFocus())
  })

  it('shows a confirmation that does not match under the second field', async () => {
    at('/staff/invitacion?token=abc123')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': invited,
      'POST /api/staff/invitation/accept': () => apiError('validation_failed', 422, { password: ['confirmed'] }),
    })
    render(<StaffApp />)

    await screen.findByRole('heading', { level: 1, name: a.createTitle })
    choosePassword(PASSWORD, 'otra cosa distinta')
    fireEvent.click(screen.getByRole('button', { name: a.createSubmit }))

    const confirm = screen.getByLabelText(a.confirmPassword)
    await waitFor(() => expect(confirm).toHaveFocus())
    expect(confirm).toHaveAccessibleDescription(es.validation.confirmed)
  })

  it('shows "Enlace vencido o usado" when the link stops working while the form is open', async () => {
    at('/staff/invitacion?token=abc123')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': invited,
      'POST /api/staff/invitation/accept': () => apiError('staff_invite_link_invalid', 422),
    })
    render(<StaffApp />)

    await screen.findByRole('heading', { level: 1, name: a.createTitle })
    choosePassword()
    fireEvent.click(screen.getByRole('button', { name: a.createSubmit }))

    expect(await screen.findByRole('heading', { level: 1, name: a.expiredTitle })).toBeInTheDocument()
  })
})

describe('Restablecer contraseña, from the reset email', () => {
  it('saves the new password and goes back to sign-in', async () => {
    at('/staff/restablecer?token=tok&email=mariel%40example.com')
    const fetchMock = fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/validate': () => json(null, 204),
      'POST /api/staff/password/reset': () => json(null, 204),
    })
    render(<StaffApp />)

    expect(await screen.findByRole('heading', { level: 1, name: a.resetTitle })).toBeInTheDocument()
    expect(screen.getByText(a.resetText)).toBeInTheDocument()
    choosePassword()
    fireEvent.click(screen.getByRole('button', { name: a.resetSubmit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(a.savedTitle)
    expect(window.location.pathname).toBe('/staff')
    expect(callsTo(fetchMock, '/api/staff/password/reset')).toEqual([
      ['POST', { email: 'mariel@example.com', token: 'tok', password: PASSWORD, password_confirmation: PASSWORD }],
    ])
  })

  it('shows "Enlace vencido o usado" and where to ask for a new link', async () => {
    at('/staff/restablecer?token=old&email=mariel%40example.com')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/validate': () => apiError('staff_reset_link_invalid', 422),
    })
    render(<StaffApp />)

    const heading = await screen.findByRole('heading', { level: 1, name: a.expiredTitle })
    const card = heading.closest('section') as HTMLElement
    expect(within(card).getByText(a.resetExpiredText)).toBeInTheDocument()
    expect(within(card).getByText(a.resetExpiredHelp)).toBeInTheDocument()
  })
})
