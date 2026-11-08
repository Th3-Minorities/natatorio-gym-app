import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserApp, UserEntry } from './UserApp'

const account = {
  name: 'María Rodríguez', email: 'm***z@upr.edu', locale: 'es', authorization: null,
  updated_at: '2026-11-07T14:00:00Z',
}
let answer: (path: string, init?: RequestInit) => Promise<Response>
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers })
const error = (code: string, status = 422, details?: object) => json({ error: { code, details } }, status)

beforeEach(() => {
  answer = async (path) => path.endsWith('/me') ? json(account) : new Response(null, { status: 204 })
  vi.stubGlobal('fetch', vi.fn((path: string, init?: RequestInit) => answer(path, init)))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  document.cookie = 'XSRF-TOKEN=test'
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function open(path = '/sign-in') {
  window.history.replaceState({}, '', path)
  render(<UserApp />)
}
function fillSignIn() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@example.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
}

describe('N-02', () => {
  it('shows the main Figma copy and accessible fields', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByText('Ingresa a tu cuenta para continuar.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recover-password')
  })

  it('shows and hides passwords with a labeled button', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('announces the submitting state and prevents duplicate submits', async () => {
    answer = () => new Promise(() => {})
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('button', { name: 'Iniciando sesión…' })).toBeDisabled()
  })

  it('shows identical wrong-credentials copy and retains the entered email', async () => {
    answer = async () => error('user_credentials_invalid')
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa el correo y la contraseña e intenta de nuevo.')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('user@example.com')
  })

  it('shows the Puerto Rico retry time and enables the button when the wait ends', async () => {
    answer = async () => json({ error: { code: 'too_many_requests' } }, 429, { 'Retry-After': '1' })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo a las')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled(), { timeout: 2000 })
  })

  it('keeps fields offline and resumes when the browser reconnects', async () => {
    answer = async () => { throw new TypeError('network') }
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Sin conexión · Datos no actualizados')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('a long password')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    fireEvent(window, new Event('online'))
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('announces a server validation rejection with the drawn panel and focuses the email', async () => {
    answer = async () => error('validation_failed', 422, { email: ['email'] })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa el correo y la contraseña e intenta de nuevo.')
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveFocus())
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
  })

  it('opens the account in the server language after sign-in', async () => {
    answer = async () => json({ ...account, locale: 'en' })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })
})

describe('N-06 and N-07', () => {
  it('shows sending and the same received state for a reset request', async () => {
    let finish!: (response: Response) => void
    answer = () => new Promise((resolve) => { finish = resolve })
    open('/recover-password')
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('button', { name: 'Enviando enlace…' })).toBeDisabled()
    await act(async () => finish(json({ status: 'received' })))
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument()
  })

  it('shows the drawn server failure and keeps the email for retry', async () => {
    answer = async () => error('server_error', 500)
    open('/recover-password')
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar la solicitud')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('any@example.com')
  })

  it('validates the link before displaying the new password fields', async () => {
    let finish!: (response: Response) => void
    answer = () => new Promise((resolve) => { finish = resolve })
    open('/reset-password?token=token&email=user%40example.com')
    expect(screen.getByText('Estamos verificando el enlace…')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirmar contraseña')).not.toBeInTheDocument()
    await act(async () => finish(new Response(null, { status: 204 })))
    expect(await screen.findByLabelText('Confirmar contraseña')).toBeInTheDocument()
  })

  it('shows expired or used links with the drawn recovery actions', async () => {
    answer = async () => error('user_reset_link_invalid')
    open('/reset-password?token=used&email=user%40example.com')
    expect(await screen.findByRole('heading', { name: 'El enlace ya no es válido' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/recover-password')
  })

  it('shows the password and confirmation errors from the server', async () => {
    answer = async (path) => path.endsWith('/validate') ? new Response(null, { status: 204 })
      : error('validation_failed', 422, { password: ['min'], password_confirmation: ['confirmed'] })
    open('/reset-password?token=token&email=user%40example.com')
    fireEvent.change(await screen.findByLabelText('Nueva contraseña'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Usa al menos 10 caracteres y evita contraseñas comprometidas.')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas deben coincidir.')).toBeInTheDocument()
  })

  it('returns to sign-in after saving a password', async () => {
    open('/reset-password?token=token&email=user%40example.com')
    fireEvent.change(await screen.findByLabelText('Nueva contraseña'), { target: { value: 'a long password' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})

describe('U-03 and U-05', () => {
  it.each(['sign-out', 'locale', 'account'])('announces a server error from %s and keeps the current screen for retry', async (endpoint) => {
    answer = async (path) => path.endsWith('/me') ? json(account) : error('server_error', 500)
    open(endpoint === 'account' ? '/account/delete' : '/account/settings')
    if (endpoint === 'account') {
      fireEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
      fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' }))
    } else {
      fireEvent.click(await screen.findByRole('button', { name: endpoint === 'locale' ? 'English' : 'Cerrar sesión' }))
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado. Intenta más tarde.')
    expect(window.location.pathname).toBe(endpoint === 'account' ? '/account/delete' : '/account/settings')
  })

  it('uses status for static information boxes', async () => {
    open('/account/delete')
    await screen.findByRole('button', { name: 'Eliminar mi cuenta' })
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows account data safely and reaches deletion through settings', async () => {
    answer = async () => json({ ...account, name: '<script>alert(1)</script>' })
    open('/account')
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: /Ajustes/ }))
    fireEvent.click(screen.getByRole('link', { name: 'Eliminar cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Eliminar cuenta' })).toBeInTheDocument()
  })

  it('shows loading and account load failures with retry', async () => {
    answer = async () => error('server_error', 500)
    open('/account')
    expect(screen.getByText('Cargando tu cuenta…')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta')
    answer = async () => json(account)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(account.name)).toBeInTheDocument()
  })

  it('shows the other-device state when a protected request rejects the session', async () => {
    answer = async () => error('user_session_replaced', 401)
    open('/account')
    expect(await screen.findByRole('alert')).toHaveTextContent('Iniciaste sesión en otro dispositivo')
  })

  it('requires confirmation before deleting and shows the drawn success state', async () => {
    open('/account/delete')
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    expect(screen.getByRole('heading', { name: '¿Eliminar tu cuenta?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tu cuenta se eliminó'))
  })

  it('shows active-authorization refusal and does not offer a destructive button', async () => {
    answer = async () => json({ ...account, authorization: { type: 'paid', term: '2026' } })
    open('/account/delete')
    expect(await screen.findByRole('heading', { name: 'No puedes eliminar la cuenta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).toBeNull()
  })

  it('signs out only after the server accepts and returns to sign-in', async () => {
    open('/account/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})

describe('User destinations', () => {
  it('opens welcome directly and keeps unavailable destinations as non-links', () => {
    window.history.replaceState({}, '', '/welcome')
    render(<UserEntry><p>Health page</p></UserEntry>)
    expect(screen.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeInTheDocument()
    expect(screen.queryByText('Health page')).toBeNull()
    expect(screen.getByRole('link', { name: 'Registrarme' })).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('link', { name: 'Instalar app' })).toBeNull()
  })

  it('shows the help line on welcome with the contact number from the API', async () => {
    answer = async () => json({ version: 'draft', draft: true, store_url: null, contact_number: '787-555-0199' })
    open('/welcome')
    expect(await screen.findByText('Necesitas una membresía pagada o estar en el roster de atletas. Ayuda · 787-555-0199.')).toBeInTheDocument()
  })

  it('returns from sign-in to welcome', async () => {
    open()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
    fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
    expect(await screen.findByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Comenzar' })).toBeNull()
  })

  it('keeps account destinations without screens as non-links', async () => {
    open('/account')
    await screen.findByRole('heading', { name: 'Mi cuenta' })
    for (const name of ['Gimnasio', 'Check-in', 'Soy atleta']) expect(screen.queryByRole('link', { name })).toBeNull()
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/account')
  })

  it('ties the password hint to the new-password field', async () => {
    open('/reset-password?token=token&email=user%40example.com')
    const password = await screen.findByLabelText('Nueva contraseña')
    expect(password).toHaveAccessibleDescription('Usa al menos 10 caracteres.')
  })

  it('keeps the password hint associated with the field while offline', async () => {
    open('/reset-password?token=token&email=user%40example.com')
    const password = await screen.findByLabelText('Nueva contraseña')
    fireEvent(window, new Event('offline'))
    expect(password).toHaveAccessibleDescription('Usa al menos 10 caracteres.')
  })
})
