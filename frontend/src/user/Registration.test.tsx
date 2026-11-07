import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    if (path.endsWith('/privacy') && !init?.body) return json({ version: 'draft', draft: true, store_url: null })
    if (path.endsWith('/lookup')) return json({ state: 'ready', name: '[Nombre]', masked_email: 'c***@upr.edu' })
    return new Response(null, { status: 204 })
  }))
  window.history.replaceState({}, '', '/register')
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function reachPaid() {
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  fireEvent.click(await screen.findByRole('link', { name: 'Pagué la membresía. Me registro con el número de mi recibo.' }))
  await screen.findByLabelText('Número de autorización')
}

it('shows privacy before any field, and opens only the drawn paid path', async () => {
  render(<UserApp />)
  expect(await screen.findByRole('heading', { name: 'Antes de comenzar' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  await reachPaid()
  expect(screen.getByPlaceholderText('Ej. 12345A')).not.toHaveAttribute('maxlength')
  expect(screen.getByText('6 caracteres; puede incluir letras. Lo encuentras en la descripción del pago, en el correo del recibo.')).toBeInTheDocument()
})

it('allows letters and any length and uses the imported name without rendering HTML', async () => {
  render(<UserApp />)
  await reachPaid()
  fireEvent.change(screen.getByLabelText('Número de autorización'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(screen.getByText('¡Hola, [Nombre]!')).toBeInTheDocument()
  expect(requests.find((request) => request.path.endsWith('/lookup'))?.body).toEqual({ authorization_number: 'A' })
  expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Contacto de emergencia')).not.toBeInTheDocument()
})

it('does not save an account when validating the password at the last drawn step', async () => {
  render(<UserApp />)
  await reachPaid()
  fireEvent.change(screen.getByLabelText('Número de autorización'), { target: { value: '12345A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(requests.some((request) => request.path.endsWith('/complete'))).toBe(false)
  expect(screen.getByLabelText('Contraseña')).toHaveValue('a long password')
})

it('protects direct registration URLs with the privacy step', async () => {
  window.history.replaceState({}, '', '/register/paid')
  render(<UserApp />)
  expect(await screen.findByRole('heading', { name: 'Antes de comenzar' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Número de autorización')).not.toBeInTheDocument()
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
  const status = screen.getByRole('status')
  expect(status).toBeEmptyDOMElement()
  await reachPaid()
  expect(screen.getByRole('status')).toBe(status)
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'registration_number_unavailable' } }, 422)))
  fireEvent.change(screen.getByLabelText('Número de autorización'), { target: { value: "' OR 1=1" } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(status).toHaveTextContent('Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866.'))
  expect(status).toHaveClass('registration-status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Número de autorización')).toHaveValue("' OR 1=1")
})

it('announces the lookup error and Retry-After wait in the mounted status region', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-07T12:00:00Z').getTime())
  render(<UserApp />)
  await reachPaid()
  const status = screen.getByRole('status')
  expect(status).toBeEmptyDOMElement()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'too_many_attempts' } }), {
    status: 429, headers: { 'Retry-After': '90' },
  })))
  fireEvent.change(screen.getByLabelText('Número de autorización'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(status).toHaveTextContent('Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866. Intenta de nuevo a las 8:01 a. m..'))
  expect(screen.getByRole('status')).toBe(status)
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('renders an imported script as text and never claims it', async () => {
  render(<UserApp />)
  await reachPaid()
  vi.stubGlobal('fetch', vi.fn(async () => json({ state: 'ready', name: '<script>alert(1)</script>', masked_email: 'c***@upr.edu' })))
  fireEvent.change(screen.getByLabelText('Número de autorización'), { target: { value: 'A' } })
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
