import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { storeLocale } from './deviceLocale'
import { UserApp } from './UserApp'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let requests: { path: string; body: unknown }[]
beforeEach(() => {
  requests = []
  document.cookie = 'XSRF-TOKEN=test'
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (path.endsWith('/privacy') && !init?.body) return json({ version: 'draft', draft: true, store_url: null, contact_number: '265-3866' })
    if (path.endsWith('/lookup')) return json({ state: 'ready', name: '[Nombre]', masked_email: 'c***@upr.edu' })
    return new Response(null, { status: 204 })
  }))
  window.history.replaceState({}, '', '/register')
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function reachIdentification() {
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  await screen.findByLabelText('Número de estudiante o transacción')
}

// Navigation focuses the title on the next frame; wait for that and drop it so a later focus move is the one under test.
async function dropFocus() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Registro' })).toHaveFocus())
  ;(document.activeElement as HTMLElement).blur()
}

it('shows privacy before the unified identification field', async () => {
  render(<UserApp />)
  expect(await screen.findByRole('heading', { name: 'Antes de comenzar' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  await reachIdentification()
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  expect(screen.getByText('Estudiante: 9 dígitos.')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Escribe tu número')).not.toHaveAttribute('maxlength')
  expect(screen.getByText('Número de autorización: 6 o 7 caracteres, puede tener letras.')).toBeInTheDocument()
})

it('allows letters and any length and uses the imported name without rendering HTML', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(screen.getByText('¡Hola, [Nombre]!')).toBeInTheDocument()
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: 'A', locale: 'es' })
  expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Contacto de emergencia')).not.toBeInTheDocument()
})

it('does not save an account when the password step continues to the photo', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '12345A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Tu foto de identificación' })).toBeInTheDocument()
  expect(requests.some((request) => request.path.endsWith('/complete'))).toBe(false)
})

it('shows the short password sentence once, as the error with no grey hint above it', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '12345A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'short' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  const field = screen.getByLabelText('Contraseña')
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getAllByText('Usa al menos 10 caracteres.')).toHaveLength(1)
  const described = field.getAttribute('aria-describedby')!.split(' ')
  expect(described.map((id) => document.getElementById(id)?.className)).toEqual(['field__error'])
})

it('protects direct registration URLs with the privacy step', async () => {
  window.history.replaceState({}, '', '/register/identify')
  render(<UserApp />)
  expect(await screen.findByRole('heading', { name: 'Antes de comenzar' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Número de estudiante o transacción')).not.toBeInTheDocument()
})

it('offers the exact English privacy frame before collecting data', async () => {
  render(<UserApp />)
  fireEvent.click(await screen.findByRole('link', { name: 'Aviso de privacidad' }))
  fireEvent.click(await screen.findByRole('link', { name: 'English' }))
  expect(await screen.findByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
  expect(screen.getByText('The gym-approved privacy notice will appear here before any personal data is collected.')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('retains the entered number and uses existing help copy on an unavailable number', async () => {
  render(<UserApp />)
  await screen.findByRole('heading', { name: 'Antes de comenzar' })
  await reachIdentification()
  const status = screen.getByRole('status')
  expect(status).toBeEmptyDOMElement()
  expect(screen.getByRole('status')).toBe(status)
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'registration_number_unavailable', details: { contact_number: ['787-555-0199'] } } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: "' OR 1=1" } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(status).toHaveTextContent('No pudimos validar este número. Revisa tu recibo o llama al 787-555-0199.'))
  expect(screen.getByText('No pudimos validar este número. Revisa tu recibo o llama al 787-555-0199.', { selector: '.field__error' })).toBeInTheDocument()
  expect(status).toHaveClass('registration-status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Número de autorización')).toHaveValue("' OR 1=1")
})

it('shows the N03-02 state with the server contact number and retries the edited value with Continuar', async () => {
  render(<UserApp />)
  await reachIdentification()
  await dropFocus()
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'registration_number_unavailable', details: { contact_number: ['787-555-0199'] } } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'AB12C3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  const heading = await screen.findByRole('heading', { name: 'Revisa tu número' })
  expect(screen.getByText('Usa el número de autorización de tu recibo.')).toBeInTheDocument()
  const field = screen.getByLabelText('Número de autorización')
  expect(field).toHaveValue('AB12C3')
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(field).not.toHaveAttribute('readonly')
  expect(screen.getByText('No pudimos validar este número. Revisa tu recibo o llama al 787-555-0199.', { selector: '.field__error' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ayuda: 787-555-0199' })).toHaveAttribute('href', 'tel:787-555-0199')
  expect(screen.queryByText('Estudiante: 9 dígitos.')).not.toBeInTheDocument()
  expect(screen.queryByText(/Descripción del pago/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Necesitas una membresía pagada/)).not.toBeInTheDocument()
  expect(screen.queryByText('¿Ya tienes cuenta?')).not.toBeInTheDocument()
  await waitFor(() => expect(heading).toHaveFocus())
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    return json({ state: 'ready', name: '[Nombre]', masked_email: 'c***@upr.edu' })
  }))
  fireEvent.change(field, { target: { value: 'AB12C4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(requests.at(-1)?.body).toEqual({ authorization_number: 'AB12C4', locale: 'es' })
})

async function reachUnavailable() {
  render(<UserApp />)
  await reachIdentification()
  await dropFocus()
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'registration_number_unavailable', details: { contact_number: ['787-555-0199'] } } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'AB12C3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  const heading = await screen.findByRole('heading', { name: 'Revisa tu número' })
  await waitFor(() => expect(heading).toHaveFocus())
  heading.blur()
}

it('clears the N03-02 error and aria-invalid while the number is corrected', async () => {
  await reachUnavailable()
  const field = screen.getByLabelText('Número de autorización')
  expect(field).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(field, { target: { value: 'AB12C4' } })
  expect(field).not.toHaveAttribute('aria-invalid')
  expect(screen.queryByText(/No pudimos validar este número/)).not.toBeInTheDocument()
})

it.each([
  ['a 429 with Retry-After', () => new Response(JSON.stringify({ error: { code: 'too_many_attempts' } }), { status: 429, headers: { 'Retry-After': '90' } }), 'Registro', null],
  ['an offline failure', () => { throw new TypeError('network') }, 'Registro', null],
  ['a student not on the roster', () => json({ error: { code: 'student_not_on_roster', details: { contact_number: ['787-555-0199'] } } }, 422), 'Revisa tu número', 'El número de estudiante se usa para atletas.'],
])('leaves N03-02 for the right step and moves focus to the title after %s', async (_name, answer, title, body) => {
  await reachUnavailable()
  vi.stubGlobal('fetch', vi.fn(async () => answer()))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Ayuda: 787-555-0199' })).not.toBeInTheDocument())
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  if (body) expect(screen.getByText(body)).toBeInTheDocument()
  else expect(screen.queryByText('Usa el número de autorización de tu recibo.')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
})

it('shows the N03-02 state in English with the phone from the server', async () => {
  storeLocale('en')
  try {
    render(<UserApp />)
    fireEvent.click(await screen.findByRole('button', { name: en.registration.continueRegistration }))
    await screen.findByLabelText(en.registration.number)
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'registration_number_unavailable', details: { contact_number: ['787-555-0199'] } } }, 422)))
    fireEvent.change(screen.getByLabelText(en.registration.number), { target: { value: 'AB12C3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Check your number' })).toBeInTheDocument()
    expect(screen.getByText('Use the authorization number on your receipt.')).toBeInTheDocument()
    expect(screen.getByLabelText('Authorization number')).toHaveValue('AB12C3')
    expect(screen.getByRole('link', { name: 'Help: 787-555-0199' })).toHaveAttribute('href', 'tel:787-555-0199')
  } finally { storeLocale('es') }
})

it('announces the lookup error and Retry-After wait in the mounted status region', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-07T12:00:00Z').getTime())
  render(<UserApp />)
  await reachIdentification()
  const status = screen.getByRole('status')
  expect(status).toBeEmptyDOMElement()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'too_many_attempts' } }), {
    status: 429, headers: { 'Retry-After': '90' },
  })))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(status).toHaveTextContent('Intenta de nuevo a las 8:01 a. m.'))
  expect(screen.getByRole('status')).toBe(status)
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  expect(screen.getByText('Intenta de nuevo a las 8:01 a. m.', { selector: '.field__error' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('renders an imported script as text and never claims it', async () => {
  render(<UserApp />)
  await reachIdentification()
  vi.stubGlobal('fetch', vi.fn(async () => json({ state: 'ready', name: '<script>alert(1)</script>', masked_email: 'c***@upr.edu' })))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('¡Hola, <script>alert(1)</script>!')).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
})

it('restores the signed-out page language when leaving English privacy', async () => {
  render(<UserApp />)
  fireEvent.click(await screen.findByRole('link', { name: 'Aviso de privacidad' }))
  fireEvent.click(await screen.findByRole('link', { name: 'English' }))
  fireEvent.click(screen.getByRole('link', { name: 'Back' }))
  expect(await screen.findByRole('heading', { name: 'Bienvenido al gimnasio' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('es')
})

it.each(['123456789', ' 987654321 '])('sends student number %s to the lookup and shows N03-09 for an athlete on the roster', async (number) => {
  render(<UserApp />)
  await reachIdentification()
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    return json({ state: 'athlete', masked_email: 'm***z@upr.edu', resend_in: 300 })
  }))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: number } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument()
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: number, locale: 'es' })
})

it('shows the N03-03 state with the server contact number when the student is not on the roster', async () => {
  render(<UserApp />)
  await reachIdentification()
  await dropFocus()
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'student_not_on_roster', details: { contact_number: ['787-555-0199'] } } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '802123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  const heading = await screen.findByRole('heading', { name: 'Revisa tu número' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.getByText('El número de estudiante se usa para atletas.')).toBeInTheDocument()
  expect(screen.getByLabelText('Número de estudiante')).toHaveValue('802123456')
  expect(screen.getByText('No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 787-555-0199.', { selector: '.field__error' })).toBeInTheDocument()
  expect(screen.getByText('Si pagaste una membresía, usa el número de autorización de tu recibo.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ver ejemplo del recibo' })).toBeInTheDocument()
  ;(document.activeElement as HTMLElement).blur()
  expect(heading).not.toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir número' }))
  const identification = await screen.findByRole('heading', { name: 'Registro' })
  await waitFor(() => expect(identification).toHaveFocus())
  expect(screen.getByLabelText('Número de estudiante o transacción')).toHaveValue('802123456')
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('shows the N03-11 state with sign in and change number when the athlete record is claimed', async () => {
  render(<UserApp />)
  await reachIdentification()
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'roster_record_claimed', details: { contact_number: ['787-555-0199'] } } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '802123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Revisa tu registro' })).toBeInTheDocument()
  expect(screen.getByText('Este número de estudiante ya tiene un registro de atleta vinculado.')).toBeInTheDocument()
  expect(screen.getByText('Este registro no está disponible para crear otra cuenta.', { selector: '.field__error' })).toBeInTheDocument()
  expect(screen.getByText('Si ya tienes cuenta, inicia sesión. Si necesitas revisar el vínculo, llama al 787-555-0199.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar número' }))
  expect(await screen.findByRole('heading', { name: 'Registro' })).toBeInTheDocument()
})

it('drops the student state when the user leaves identification', async () => {
  render(<UserApp />)
  await reachIdentification()
  const defaultFetch = fetch
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => path.endsWith('/lookup')
    ? json({ error: { code: 'student_not_on_roster', details: { contact_number: ['265-3866'] } } }, 422)
    : defaultFetch(path, init)))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '123456789' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Revisa tu número' })
  fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
  await screen.findByRole('button', { name: 'Continuar con el registro' })
  await reachIdentification()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('empties the status region when a timed wait ends', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], now: new Date('2026-11-07T12:00:00Z') })
  try {
    render(<UserApp />)
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con el registro' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'too_many_attempts' } }), {
      status: 429, headers: { 'Retry-After': '30' },
    })))
    fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    expect(screen.getByRole('status')).toHaveTextContent('Intenta de nuevo a las')
    await act(async () => { await vi.advanceTimersByTimeAsync(31000) })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  } finally { vi.useRealTimers() }
})

function sendStoreUrl(storeUrl: string | null) {
  const base = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (path, init) => String(path).endsWith('/privacy') && !init?.body
    ? json({ version: 'draft', draft: true, store_url: storeUrl, contact_number: '265-3866' })
    : base(path, init))
}

it('shows the receipt example, payment help and both store controls when the server sends a URL', async () => {
  sendStoreUrl('https://store.example/membership')
  render(<UserApp />)
  await reachIdentification()
  expect(screen.getByText('Descripción del pago ·')).toBeInTheDocument()
  expect(screen.getByText('4K7Q2B')).toBeInTheDocument()
  expect(screen.getByText('Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866.')).toBeInTheDocument()
  expect(screen.getByText('¿No tienes membresía?')).toBeInTheDocument()
  const links = screen.getAllByRole('link', { name: 'Comprar membresía' })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', 'https://store.example/membership')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
})

it('hides both store controls without a URL', async () => {
  render(<UserApp />)
  await reachIdentification()
  expect(screen.getByText('Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866.')).toBeInTheDocument()
  expect(screen.queryByText('¿No tienes membresía?')).not.toBeInTheDocument()
  expect(screen.queryByText('Comprar membresía')).not.toBeInTheDocument()
})

it('looks up ten digits as an authorization number', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '1234567890' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: '1234567890', locale: 'es' })
})

it('announces the masked account and keeps renewal on identification', async () => {
  render(<UserApp />)
  await reachIdentification()
  vi.stubGlobal('fetch', vi.fn(async () => json({ state: 'renewal', masked_email: 'c***@upr.edu' })))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled())
  expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Ya tienes una cuenta con c***@upr.edu. Inicia sesión para añadir esta membresía.')
  fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
  expect(await screen.findByRole('heading', { name: 'Antes de comenzar' })).toBeInTheDocument()
  expect(screen.queryByText(/c\*\*\*@upr\.edu/)).not.toBeInTheDocument()
  await reachIdentification()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'B' } })
  let finishLookup!: (response: Response) => void
  const fetchLookup = vi.fn(() => new Promise<Response>((resolve) => { finishLookup = resolve }))
  vi.stubGlobal('fetch', fetchLookup)
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(fetchLookup).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
  finishLookup(json({ state: 'renewal', masked_email: 'o***@upr.edu' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar con el registro' })).toBeEnabled())
  expect(screen.queryByText(/o\*\*\*@upr\.edu/)).not.toBeInTheDocument()
})

it.each([
  ['server_error', 500, 'Algo salió mal de nuestro lado. Intenta más tarde.'],
  ['unknown_code', 503, 'Algo salió mal de nuestro lado. Intenta más tarde.'],
  ['unknown_code', 422, 'No se pudo procesar la solicitud.'],
  ['registration_number_unavailable', 500, 'Algo salió mal de nuestro lado. Intenta más tarde.'],
  ['offline', 0, 'Conéctate para continuar. Se conservan los datos ingresados.'],
])('announces %s (%s) through the mounted status region', async (code, status, message) => {
  render(<UserApp />)
  await reachIdentification()
  const region = screen.getByRole('status')
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (!status) throw new TypeError('Failed to fetch')
    return json({ error: { code } }, status)
  }))
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(region).toHaveTextContent(message))
  expect(screen.getAllByRole('status')).toContain(region)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
