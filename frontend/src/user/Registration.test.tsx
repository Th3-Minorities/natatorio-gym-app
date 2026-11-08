import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: 'A' })
  expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Contacto de emergencia')).not.toBeInTheDocument()
})

it('does not save an account when validating the password at the last drawn step', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '12345A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(requests.some((request) => request.path.endsWith('/complete'))).toBe(false)
  expect(screen.getByLabelText('Contraseña')).toHaveValue('a long password')
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
  await waitFor(() => expect(status).toHaveTextContent('Necesitas una membresía pagada. ¿Problemas? Llama al 787-555-0199.'))
  expect(screen.getByText('Necesitas una membresía pagada. ¿Problemas? Llama al 787-555-0199.', { selector: '.field__error' })).toBeInTheDocument()
  expect(status).toHaveClass('registration-status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Número de estudiante o transacción')).toHaveValue("' OR 1=1")
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

it.each(['123456789', '802123456', '000000000', ' 987654321 '])('keeps student number %s on identification, announces the student hint and sends no lookup', async (number) => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: number } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Estudiante: 9 dígitos.')
  const field = screen.getByLabelText('Número de estudiante o transacción')
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(document.querySelector('.registration-hint')).toHaveClass('registration-hint--flagged')
  expect(field).toHaveAccessibleDescription(/Estudiante: 9 dígitos\./)
  expect(requests.some((request) => request.path.endsWith('/lookup'))).toBe(false)
  fireEvent.change(field, { target: { value: '1234' } })
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(field).not.toHaveAttribute('aria-invalid')
  expect(document.querySelector('.registration-hint')).not.toHaveClass('registration-hint--flagged')
})

it('drops the student flag when the user leaves identification', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '123456789' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.getByRole('status')).toHaveTextContent('Estudiante: 9 dígitos.')
  fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
  await screen.findByRole('button', { name: 'Continuar con el registro' })
  await reachIdentification()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.getByLabelText('Número de estudiante o transacción')).not.toHaveAttribute('aria-invalid')
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

it('shows the receipt example, payment help and buy button on identification', async () => {
  render(<UserApp />)
  await reachIdentification()
  expect(screen.getByText('Descripción del pago ·')).toBeInTheDocument()
  expect(screen.getByText('4K7Q2B')).toBeInTheDocument()
  expect(screen.getByText('Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Comprar membresía' })).toHaveAttribute('aria-disabled', 'true')
})

it('looks up ten digits as an authorization number', async () => {
  render(<UserApp />)
  await reachIdentification()
  fireEvent.change(screen.getByLabelText('Número de estudiante o transacción'), { target: { value: '1234567890' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: '1234567890' })
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
