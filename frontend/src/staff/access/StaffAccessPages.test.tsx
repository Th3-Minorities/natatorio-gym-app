import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { apiError, callsTo, fakeApi, json, offline } from '../team/fakeTeamApi'

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

  it('says there is no connection, not that the request failed', async () => {
    at('/staff/recuperar')
    fakeApi({ '/api/staff/me': signedOut, 'POST /api/staff/password/email': offline })
    render(<StaffApp />)

    fireEvent.change(await screen.findByLabelText(a.email), { target: { value: 'mariel@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: a.sendLink }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(es.signIn.offlineTitle)
    expect(alert).toHaveTextContent(es.states.offlineRetryText)
    expect(document.title).toBe(`${a.forgotTitle} · ${es.dashboard.brandName}`)
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

    await screen.findByLabelText(a.newPassword)
    expect(screen.getByRole('heading', { level: 1, name: a.createTitle })).toBeInTheDocument()
    expect(document.title).toBe(`${a.createTitle} · ${es.dashboard.brandName}`)
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

    await screen.findByLabelText(a.newPassword)
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

    await screen.findByLabelText(a.newPassword)
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

    await screen.findByLabelText(a.newPassword)
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

    await screen.findByLabelText(a.newPassword)
    expect(screen.getByRole('heading', { level: 1, name: a.resetTitle })).toBeInTheDocument()
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
    expect(within(card).getByRole('link', { name: a.backToSignIn })).toBeInTheDocument()

    // 4424:1683: "Solicitar otro enlace" opens Recuperar contraseña without reloading.
    fireEvent.click(within(card).getByRole('link', { name: a.requestAnother }))
    expect(window.location.pathname).toBe('/staff/recuperar')
    expect(await screen.findByRole('heading', { level: 1, name: a.forgotTitle })).toBeInTheDocument()
  })

  it('shows the page title and "Revisando el enlace…" while the link is checked (4424:1753)', async () => {
    at('/staff/restablecer?token=tok&email=mariel%40example.com')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/validate': () => new Promise<Response>(() => {}),
    })
    render(<StaffApp />)

    const heading = await screen.findByRole('heading', { level: 1, name: a.resetTitle })
    const card = heading.closest('section') as HTMLElement
    expect(within(card).getByText(a.checking)).toBeInTheDocument()
    // The text is also said by a status region that was on the page before it, so screen readers speak it once.
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(a.checking))
    expect(card).not.toHaveAttribute('role')
    expect(screen.queryByText(es.states.loading)).not.toBeInTheDocument()
  })

  it('shows "Error al cargar" when the link cannot be checked, and checks again with Reintentar (4424:1792)', async () => {
    at('/staff/restablecer?token=tok&email=mariel%40example.com')
    let answers = 0
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/password/validate': () => (answers++ === 0 ? apiError('server_error', 500) : json(null, 204)),
    })
    render(<StaffApp />)

    const heading = await screen.findByRole('heading', { level: 1, name: es.states.errorTitle })
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()
    const card = heading.closest('section') as HTMLElement
    expect(within(card).getByText(es.states.errorDetail)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: a.backToSignIn })).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: es.states.retry }))

    expect(await screen.findByLabelText(a.newPassword)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: a.resetTitle })).toBeInTheDocument()
    // The same status region stayed on the page through checking, the error and the form.
    expect(status).toBeInTheDocument()
    expect(status).toBeEmptyDOMElement()
  })

  it('keeps the invitation help on an expired invitation link', async () => {
    at('/staff/invitacion?token=old')
    fakeApi({
      '/api/staff/me': signedOut,
      'POST /api/staff/invitation/validate': () => apiError('staff_invite_link_invalid', 422),
    })
    render(<StaffApp />)

    expect(await screen.findByText(a.inviteExpiredHelp)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: a.requestAnother })).not.toBeInTheDocument()
  })
})
