import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserApp, UserEntry } from './UserApp'
import { es } from '../i18n/es'

const account = {
  name: 'María Rodríguez', email: 'm***z@upr.edu', locale: 'es', account_type: null, authorization: null,
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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear() })

const expandWelcome = () => fireEvent.click(screen.getByRole('button', { name: 'Toca o desliza para continuar' }))

function open(path = '/sign-in') {
  window.history.replaceState({}, '', path)
  render(<UserApp />)
}
function fillSignIn() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@example.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
}

function expectAccessLayout(passwords = 1, signIn = true) {
  expect(screen.getByRole('main').closest('.user-app')).toHaveClass('user-app--large')
  expect(document.querySelector('form')).toBeInTheDocument()
  expect(screen.queryAllByRole('button', { name: 'Mostrar contraseña' })).toHaveLength(passwords)
  expect(document.documentElement.lang).toBe('es')
  if (signIn) {
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByText('¿Primera vez aquí?')).toBeInTheDocument()
    expect(screen.getByText('Comenzar')).toBeInTheDocument()
  }
}

describe('N-02', () => {
  it('shows the main Figma copy and accessible fields', () => {
    open()
    expectAccessLayout()
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
    expectAccessLayout()
  })

  it('shows identical wrong-credentials copy and retains the entered email', async () => {
    answer = async () => error('user_credentials_invalid')
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa el correo y la contraseña e intenta de nuevo.')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('user@example.com')
    expectAccessLayout()
  })

  it('shows the Puerto Rico retry time and enables the button when the wait ends', async () => {
    answer = async () => json({ error: { code: 'too_many_requests' } }, 429, { 'Retry-After': '1' })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo a las')
    expectAccessLayout()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled(), { timeout: 2000 })
  })

  it('keeps fields offline and resumes when the browser reconnects', async () => {
    answer = async () => { throw new TypeError('network') }
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Sin conexión · Datos no actualizados')).toBeInTheDocument()
    expectAccessLayout()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('a long password')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    fireEvent(window, new Event('online'))
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('shows server validation errors under both sign-in fields and focuses the email', async () => {
    answer = async () => error('validation_failed', 422, { email: ['email'], password: ['required'] })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Escribe un correo electrónico válido.')).toBeVisible()
    expect(screen.getByText('Este campo es obligatorio.')).toBeVisible()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('Escribe un correo electrónico válido.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Este campo es obligatorio.')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    expectAccessLayout()
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveFocus())
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
  })

  it('opens the account in the server language after sign-in', async () => {
    answer = async () => json({ ...account, locale: 'en' })
    open(); fillSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
  })
})

describe('N-06 and N-07', () => {
  it.each([
    ['/sign-in', 'server_error'],
    ['/recover-password', 'offline'],
    ['/recover-password', 'too_many_requests'],
    ['/reset-password?token=token&email=user%40example.com', 'offline'],
    ['/reset-password?token=token&email=user%40example.com', 'too_many_requests'],
    ['/reset-password?token=token&email=user%40example.com', 'server_error'],
  ])('keeps the large form on %s after %s', async (path, code) => {
    answer = async (endpoint) => {
      if (endpoint.endsWith('/validate')) return new Response(null, { status: 204 })
      if (code === 'offline') throw new TypeError('network')
      return error(code, code === 'too_many_requests' ? 429 : 500)
    }
    open(path)
    const reset = path.startsWith('/reset-password')
    const signIn = path === '/sign-in'
    const submit = await screen.findByRole('button', { name: reset ? 'Guardar contraseña' : signIn ? 'Iniciar sesión' : 'Enviar enlace' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.submit(submit.closest('form')!)
    await waitFor(() => expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'false'))
    expectAccessLayout(reset ? 2 : signIn ? 1 : 0, signIn)
    if (code === 'offline') expect(screen.getByText('Sin conexión · Datos no actualizados')).toBeInTheDocument()
    if (code === 'too_many_requests') expect(screen.getByRole('alert')).toHaveTextContent('Espera antes de intentar de nuevo')
  })

  it('shows the server validation error under the recovery email and focuses it', async () => {
    answer = async () => error('validation_failed', 422, { email: ['email'] })
    open('/recover-password')
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByText('Escribe un correo electrónico válido.')).toBeVisible()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('Escribe un correo electrónico válido.')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
    expectAccessLayout(0, false)
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveFocus())
  })

  it('shows sending and the same received state for a reset request', async () => {
    let finish!: (response: Response) => void
    answer = () => new Promise((resolve) => { finish = resolve })
    open('/recover-password')
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('button', { name: 'Enviando enlace…' })).toBeDisabled()
    expectAccessLayout(0, false)
    await act(async () => finish(json({ status: 'received' })))
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument()
    // Figma 4099:2335: compact layout, no form.
    expect(screen.getByRole('main').closest('.user-app')).not.toHaveClass('user-app--large')
    expect(screen.queryByLabelText('Correo electrónico')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/sign-in')
  })

  it('shows the drawn server failure and keeps the email for retry', async () => {
    answer = async () => error('server_error', 500)
    open('/recover-password')
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar la solicitud')
    expectAccessLayout(0, false)
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('any@example.com')
  })

  it('keeps the new password form while validating and prevents submission until the link is valid', async () => {
    let finish!: (response: Response) => void
    answer = () => new Promise((resolve) => { finish = resolve })
    open('/reset-password?token=token&email=user%40example.com')
    expect(screen.getByText('Estamos verificando el enlace…')).toBeInTheDocument()
    expectAccessLayout(2, false)
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled()
    await act(async () => finish(new Response(null, { status: 204 })))
    expect(await screen.findByLabelText('Confirmar contraseña')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled())
  })

  it.each([false, true])('revalidates an offline reset link on reconnect (expired: %s)', async (expired) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    let finish!: (response: Response) => void
    const validate = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
    answer = (path) => {
      expect(path).toBe('/api/user/password/validate')
      return validate()
    }
    open('/reset-password?token=token&email=user%40example.com')
    await screen.findByText(es.user.offlineForm)
    await waitFor(() => expect(screen.queryByText(es.user.validating)).toBeNull())
    expect(validate).toHaveBeenCalledTimes(1)

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(2))
    expect(screen.getByText(es.user.validating)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: es.user.save })
    expect(submit).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    expect(fetch).not.toHaveBeenCalledWith('/api/user/password/reset', expect.anything())

    await act(async () => finish(expired ? error('user_reset_link_invalid') : new Response(null, { status: 204 })))
    if (expired) {
      expect(await screen.findByRole('heading', { name: es.user.expiredTitle })).toBeInTheDocument()
    } else {
      await waitFor(() => expect(submit).toBeEnabled())
      await act(async () => { fireEvent(window, new Event('online')) })
      expect(validate).toHaveBeenCalledTimes(2)
    }
  })

  it('keeps the expired screen when the connection returns', async () => {
    const validate = vi.fn()
      .mockResolvedValueOnce(error('user_reset_link_invalid'))
      .mockResolvedValue(new Response('<html>', { status: 502 }))
    answer = () => validate()
    open('/reset-password?token=used&email=user%40example.com')
    expect(await screen.findByRole('heading', { name: es.user.expiredTitle })).toBeInTheDocument()

    await act(async () => { fireEvent(window, new Event('online')) })
    expect(validate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: es.user.expiredTitle })).toBeInTheDocument()
  })

  it('shows expired or used links with the drawn recovery actions', async () => {
    answer = async () => error('user_reset_link_invalid')
    open('/reset-password?token=used&email=user%40example.com')
    expect(await screen.findByRole('heading', { name: 'El enlace ya no es válido' })).toBeInTheDocument()
    // Figma 4099:2377: compact layout, no password fields.
    expect(screen.getByRole('main').closest('.user-app')).not.toHaveClass('user-app--large')
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar contraseña' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/recover-password')
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/sign-in')
  })

  it('shows the password and confirmation errors from the server', async () => {
    answer = async (path) => path.endsWith('/validate') ? new Response(null, { status: 204 })
      : error('validation_failed', 422, { password: ['min'], password_confirmation: ['confirmed'] })
    open('/reset-password?token=token&email=user%40example.com')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled())
    fireEvent.change(await screen.findByLabelText('Nueva contraseña'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Usa al menos 10 caracteres y evita contraseñas comprometidas.')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas deben coincidir.')).toBeInTheDocument()
    const field = screen.getByLabelText('Nueva contraseña')
    const described = field.getAttribute('aria-describedby')!.split(' ')
    const [hint, fieldError] = described.map((id) => document.getElementById(id)!)
    expect(hint.compareDocumentPosition(fieldError) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Usa al menos 10 caracteres.', 'Usa al menos 10 caracteres y evita contraseñas comprometidas.',
    ])
    expectAccessLayout(2, false)
  })

  it('returns to sign-in after saving a password', async () => {
    open('/reset-password?token=token&email=user%40example.com')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled())
    fireEvent.change(await screen.findByLabelText('Nueva contraseña'), { target: { value: 'a long password' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
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

  it('lists the rows in the Figma order, also offline, and links Instalar app, Privacidad and Ajustes', async () => {
    open('/account')
    await screen.findByRole('link', { name: /Instalar app/ })
    const rows = () => Array.from(document.querySelectorAll('.user-account-row')).map((node) => node.querySelector('strong')?.textContent)
    expect(rows()).toEqual(['Mis visitas', 'Contacto de emergencia', 'Instalar app', 'Privacidad', 'Ajustes'])
    const links = () => ({
      install: screen.getByRole('link', { name: /Instalar app/ }).getAttribute('href'),
      privacy: screen.getByRole('link', { name: /Privacidad/ }).getAttribute('href'),
      settings: screen.getByRole('link', { name: /Ajustes/ }).getAttribute('href'),
    })
    expect(links()).toEqual({ install: '/install', privacy: '/account/privacy', settings: '/account/settings' })
    expect(screen.getByRole('link', { name: /Instalar app/ })).toHaveTextContent('Cómo instalar en tu teléfono')
    expect(screen.getByRole('link', { name: /Privacidad/ })).toHaveTextContent('Consulta el aviso de privacidad')
    act(() => { fireEvent(window, new Event('offline')) })
    expect(await screen.findByText('Sin conexión · Datos no actualizados')).toBeInTheDocument()
    expect(links()).toEqual({ install: '/install', privacy: '/account/privacy', settings: '/account/settings' })
  })

  it('hides the account rows while the account is loading or failed', async () => {
    answer = async () => error('server_error', 500)
    open('/account')
    expect(screen.queryByRole('link', { name: /Instalar app/ })).toBeNull()
    await screen.findByRole('alert')
    expect(screen.queryByRole('link', { name: /Instalar app/ })).toBeNull()
  })

  it('shows own email in full, as the server sends it (E-179)', async () => {
    answer = async () => json({ ...account, email: 'maria.rodriguez@upr.edu' })
    open('/account')
    expect(await screen.findByText('maria.rodriguez@upr.edu')).toBeInTheDocument()
  })

  it('shows "Desliza para ver más" only while rows are hidden below the list', async () => {
    const heights = { scrollHeight: 500, clientHeight: 300 }
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => heights.scrollHeight)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => heights.clientHeight)
    open('/account')
    expect(await screen.findByText('Desliza para ver más')).toBeInTheDocument()
    const list = document.querySelector('.user-account-scroll') as HTMLElement
    list.scrollTop = 200
    fireEvent.scroll(list)
    expect(screen.queryByText('Desliza para ver más')).toBeNull()
  })

  it('has no scroll hint when every row fits', async () => {
    open('/account')
    await screen.findByRole('link', { name: /Instalar app/ })
    expect(screen.queryByText('Desliza para ver más')).toBeNull()
  })

  it('shows the account type even without an active authorization', async () => {
    answer = async () => json({ ...account, account_type: 'paid' })
    open('/account')
    expect(await screen.findByText('Sin autorización activa')).toBeInTheDocument()
    expect(screen.getByText('Miembro', { exact: true })).toBeInTheDocument()
  })

  it('omits the account type when the account never had an authorization', async () => {
    open('/account')
    expect(await screen.findByText('Sin autorización activa')).toBeInTheDocument()
    expect(screen.queryByText(/^(Miembro|Atleta|Acceso manual)$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Contacto de emergencia|Mis visitas/ })).not.toBeInTheDocument()
  })

  it.each([['paid', 'Miembro'], ['athlete', 'Atleta'], ['manual', 'Acceso manual']])('shows the confirmed %s account type and cached access offline', async (type, label) => {
    answer = async () => json({ ...account, account_type: type, authorization: { type, term: '2026' } })
    open('/account')
    expect(await screen.findByText(label, { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Acceso vigente · 2026')).toBeInTheDocument()
    fireEvent(window, new Event('offline'))
    expect(screen.getByText('Acceso guardado · 2026')).toBeInTheDocument()
  })

  it('omits the badge for an unrecognized account type', async () => {
    answer = async () => json({ ...account, account_type: 'unknown', authorization: { type: 'unknown', term: '2026' } })
    open('/account')
    expect(await screen.findByText('Acceso vigente · 2026')).toBeInTheDocument()
    expect(document.querySelector('.user-profile__badge')).not.toBeInTheDocument()
  })

  it('shows the staff help online and the backup notice offline on account deletion', async () => {
    open('/account/delete')
    const help = 'Si necesitas ayuda para eliminar tu cuenta, contacta al Staff del gimnasio.'
    const backups = 'Las copias de respaldo pueden conservar los datos hasta 4 semanas.'
    expect(await screen.findByText(help)).toBeInTheDocument()
    expect(screen.queryByText(backups)).toBeNull()
    fireEvent(window, new Event('offline'))
    expect(await screen.findByText(backups)).toBeInTheDocument()
    expect(screen.queryByText(help)).toBeNull()
  })

  it('returns from account deletion to settings and then to the account', async () => {
    open('/account/delete')
    const backToSettings = await screen.findByRole('link', { name: 'Volver a Ajustes' })
    expect(backToSettings).toHaveAttribute('href', '/account/settings')
    fireEvent.click(backToSettings)
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()

    const backToAccount = screen.getByRole('link', { name: 'Volver a Mi cuenta' })
    expect(backToAccount).toHaveAttribute('href', '/account')
    fireEvent.click(backToAccount)
    expect(screen.getByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Volver a Mi cuenta' })).not.toBeInTheDocument()
  })

  it('identifies each settings language to assistive technology', async () => {
    open('/account/settings')
    expect(await screen.findByRole('button', { name: 'Español' })).toHaveAttribute('lang', 'es')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en')
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

  it('shows U-03 offline without saved data as Figma draws it and loads once the connection returns', async () => {
    answer = async () => { throw new TypeError('network') }
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    open('/account')
    expect(await screen.findByText('Sin datos guardados')).toBeInTheDocument()
    expect(screen.getByText('Conéctate para cargar tu cuenta.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/^Sin conexión$/)
    expect(screen.queryByText('Sin conexión · Datos no actualizados')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(screen.queryByText('No pudimos cargar tu cuenta')).toBeNull()
    expect(document.querySelector('.user-avatar')).toBeNull()
    expect(document.querySelector('.user-account-row')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('aria-current', 'page')
    answer = async () => json(account)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => { fireEvent(window, new Event('online')) })
    expect(await screen.findByText(account.name)).toBeInTheDocument()
    expect(screen.queryByText('Sin datos guardados')).toBeNull()
  })

  it('lets the person retry by hand when the server cannot be reached while the browser is online', async () => {
    answer = async () => { throw new TypeError('network') }
    open('/account')
    expect(await screen.findByText('Sin datos guardados')).toBeInTheDocument()
    answer = async () => json(account)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(account.name)).toBeInTheDocument()
  })

  it('shows the other-device state when a protected request rejects the session', async () => {
    answer = async () => error('user_session_replaced', 401)
    open('/account')
    expect(await screen.findByRole('alert')).toHaveTextContent('Iniciaste sesión en otro dispositivo')
    expectAccessLayout()
  })

  it('requires confirmation before deleting and returns to the welcome screen', async () => {
    open('/account/delete')
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    expect(screen.getByRole('heading', { name: '¿Eliminar tu cuenta?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/welcome')
    expect(screen.queryByText('Tu cuenta se eliminó')).toBeNull()
  })

  it('shows active-authorization refusal and does not offer a destructive button', async () => {
    answer = async () => json({ ...account, authorization: { type: 'paid', term: '2026' } })
    open('/account/delete')
    expect(await screen.findByRole('heading', { name: 'Eliminar cuenta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).toBeNull()
  })

  it('signs out only after the server accepts and returns to sign-in', async () => {
    open('/account/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('User destinations', () => {
  it('opens the welcome screen collapsed, then expands it with the Figma copy and its links', () => {
    window.history.replaceState({}, '', '/welcome')
    render(<UserEntry><p>Health page</p></UserEntry>)
    expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Comenzar' })).toBeNull()
    expandWelcome()
    expect(screen.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toHaveFocus()
    expect(screen.getByText('Tu espacio para entrenar en el RUM.')).toBeInTheDocument()
    expect(screen.getByText('¿Ya tienes cuenta?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Health page')).toBeNull()
    expect(screen.queryByText('Instalar app')).toBeNull()
    expect(screen.queryByText(/Ayuda para instalar/)).toBeNull()
  })

  it('disables Comenzar and Iniciar sesión under a connection banner while offline and enables them when it returns (4546:2929)', () => {
    open('/welcome')
    expandWelcome()
    expect(screen.queryByRole('status')).toBeNull()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    act(() => { fireEvent(window, new Event('offline')) })
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Sin conexión. Conéctate para continuar.')
    expect(banner).toHaveTextContent(es.user.welcomeOffline)
    expect(screen.getByRole('main')).toContainElement(banner)
    expect(screen.getByRole('heading', { name: 'Bienvenido al gimnasio' }).compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: 'Comenzar' })).not.toHaveAttribute('href')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).not.toHaveAttribute('href')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => { fireEvent(window, new Event('online')) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
  })

  it('expands the welcome sheet with a tap or an upward swipe, not with a short drag', () => {
    open('/welcome')
    const sheet = screen.getByRole('main')
    fireEvent.pointerDown(sheet, { clientY: 700, pointerId: 1 })
    fireEvent.pointerMove(sheet, { clientY: 680, pointerId: 1 })
    fireEvent.pointerUp(sheet, { clientY: 680, pointerId: 1 })
    expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
    fireEvent.pointerDown(sheet, { clientY: 700, pointerId: 1 })
    fireEvent.pointerMove(sheet, { clientY: 665, pointerId: 1 })
    expect(screen.getByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeInTheDocument()
  })

  it('expands the welcome sheet with a tap on it', () => {
    open('/welcome')
    const sheet = screen.getByRole('main')
    fireEvent.click(sheet)
    expect(screen.getByRole('link', { name: 'Comenzar' })).toBeInTheDocument()
  })

  it('keeps the language chosen on the welcome screen for every screen before sign in', async () => {
    open('/welcome')
    expandWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Welcome to the gym' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('user-locale')).toBe('en')
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('returns from sign-in to welcome', async () => {
    open()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
    fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
    expect(await screen.findByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument()
    expandWelcome()
    expect(screen.getByRole('link', { name: 'Comenzar' })).toHaveAttribute('href', '/register')
  })

  it('keeps account destinations without screens as non-links', async () => {
    open('/account')
    await screen.findByRole('heading', { name: 'Mi cuenta' })
    expect(screen.queryByRole('link', { name: 'Soy atleta' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Gimnasio' })).toHaveAttribute('href', '/gym')
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/check-in')
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

describe('N-08 from My account', () => {
  const notice = { version: 'draft', draft: true, store_url: null, contact_number: '265-3866' }
  const withNotice = (body: unknown) => {
    answer = async (path) => path.endsWith('/api/privacy') ? json(body) : path.endsWith('/me') ? json(account) : new Response(null, { status: 204 })
  }
  const noNetwork = () => { answer = async () => { throw new TypeError('network down') } }

  it('opens from the Privacidad row and shows the Figma frame with the BORRADOR badge', async () => {
    withNotice(notice)
    open('/account')
    fireEvent.click(await screen.findByRole('link', { name: /Privacidad/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/privacy')
    expect(screen.getByText('Se muestra en el idioma de tu cuenta.')).toBeInTheDocument()
    const card = await screen.findByRole('region', { name: 'Aviso de privacidad' })
    expect(card).toHaveTextContent('BORRADOR')
    expect(card).toHaveTextContent('Texto provisional para el diseño.')
    expect(card.querySelector('a')).toBeNull()
    expect(screen.getByText('Este aviso también está disponible sin conexión.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button')).toBeNull()
    expect(fetch).toHaveBeenCalledWith('/api/privacy', expect.anything())
  })

  it('hides the badge when the notice is not a draft and keeps the answer on the device', async () => {
    withNotice({ ...notice, version: '2026-12-01', draft: false })
    open('/account/privacy')
    await screen.findByRole('region', { name: 'Aviso de privacidad' })
    expect(screen.queryByText('BORRADOR')).toBeNull()
    expect(JSON.parse(localStorage.getItem('privacy-notice') ?? 'null')).toMatchObject({ version: '2026-12-01', draft: false })
  })

  it('goes back to My account with the arrow', async () => {
    withNotice(notice)
    open('/account/privacy')
    fireEvent.click(await screen.findByRole('link', { name: 'Volver a Mi cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account')
  })

  it('shows the last saved notice when offline, even without the account', async () => {
    localStorage.setItem('privacy-notice', JSON.stringify({ ...notice, version: '2026-12-01', draft: false }))
    noNetwork()
    open('/account/privacy')
    expect(await screen.findByRole('region', { name: 'Aviso de privacidad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeInTheDocument()
    expect(screen.queryByText('BORRADOR')).toBeNull()
    expect(screen.getByText('Este aviso también está disponible sin conexión.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/^Sin conexión/)).toBeNull()
  })

  it('shows the draft frame when offline with nothing saved or with a damaged copy', async () => {
    localStorage.setItem('privacy-notice', '{not json')
    noNetwork()
    open('/account/privacy')
    expect(await screen.findByRole('region', { name: 'Aviso de privacidad' })).toHaveTextContent('BORRADOR')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/^Sin conexión/)).toBeNull()
  })
})
