import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UserApp } from './UserApp'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const WAIVER = { version: 'borrador-2026-11-08', text: 'Relevo de responsabilidad\n\nPrimer párrafo.' }
let lookup: () => Response
let validate: () => Response | Promise<Response>
let complete: () => Response
let calls: { path: string; body: unknown }[]

beforeEach(() => {
  calls = []
  lookup = () => json({ state: 'athlete', masked_email: 'm***z@upr.edu', resend_in: 300 })
  validate = () => json({ name: 'Marta <b>Ruiz</b>' })
  complete = () => json({ id: 1 }, 201)
  document.cookie = 'XSRF-TOKEN=test'
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: async () => [] } })
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body instanceof FormData ? Object.fromEntries(init.body) : init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, body })
    if (path.endsWith('/registration/privacy') && !init?.body) return json({ version: 'draft', draft: true, store_url: null, contact_number: '265-3866' })
    if (path.endsWith('/lookup')) return lookup()
    if (path.endsWith('/athlete/validate')) return validate()
    if (path.includes('/waiver')) return json(WAIVER)
    if (path.endsWith('/athlete/complete')) return complete()
    return new Response(null, { status: 204 })
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })

async function sendLink() {
  window.history.replaceState({}, '', '/register')
  render(<UserApp />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  fireEvent.change(await screen.findByLabelText('Número de estudiante o transacción'), { target: { value: '802123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

function openLink(token = 'abc') {
  window.history.replaceState({}, '', `/register/athlete?token=${token}`)
  render(<UserApp />)
}

it('shows N03-09 with the masked email and a 5 minute resend countdown, and Corregir número goes back to the field', async () => {
  await sendLink()
  const heading = await screen.findByRole('heading', { name: 'Revisa tu correo' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.getByText('Enviamos un enlace a tu correo institucional.')).toBeInTheDocument()
  expect(screen.getByText('m***z@upr.edu')).toBeInTheDocument()
  expect(screen.getByText('Abre el enlace en tu correo para completar contraseña, foto y relevo.')).toBeInTheDocument()
  expect(screen.getByText('Revisa también la carpeta de correo no deseado.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reenviar en 05:00' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Corregir número' }))
  expect(await screen.findByLabelText('Número de estudiante o transacción')).toHaveValue('802123456')
})

it('enables the resend after the countdown and sends the same number again', async () => {
  const start = Date.now()
  await sendLink()
  await screen.findByRole('heading', { name: 'Revisa tu correo' })
  vi.spyOn(Date, 'now').mockReturnValue(start + 301_000)
  const resend = await screen.findByRole('button', { name: 'Solicitar enlace' }, { timeout: 3000 })
  expect(resend).toBeEnabled()
  fireEvent.click(resend)
  await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/lookup'))).toHaveLength(2))
  expect(calls.filter((call) => call.path.endsWith('/lookup')).at(-1)?.body).toEqual({ authorization_number: '802123456', locale: 'es' })
})

it('shows N03-10 with the time from Retry-After when the link limit is hit', async () => {
  lookup = () => new Response(JSON.stringify({ error: { code: 'athlete_link_limit' } }), { status: 429, headers: { 'Retry-After': '120' } })
  await sendLink()
  expect(await screen.findByRole('heading', { name: 'Espera para pedir otro enlace' })).toBeInTheDocument()
  expect(screen.getByText('Ya alcanzaste el límite de enlaces para este número de estudiante.')).toBeInTheDocument()
  expect(screen.getByText(/^Prueba de nuevo a las \d/)).toBeInTheDocument()
  expect(screen.getByText('Si ya recibiste un enlace, revisa tu correo institucional.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Solicitar enlace' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Ayuda: 265-3866' })).toHaveAttribute('href', 'tel:265-3866')
})

it('checks the link (N05-01), then shows privacy and the password step with the roster name as text', async () => {
  let release: (response: Response) => void = () => {}
  validate = () => new Promise((resolve) => { release = resolve })
  openLink('tok123')
  expect(await screen.findByRole('heading', { name: 'Verificando tu enlace' })).toBeInTheDocument()
  expect(screen.getByText('Todavía no se ha creado una cuenta ni vinculado tu registro.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled()
  expect(calls.find((call) => call.path.endsWith('/athlete/validate'))?.body).toEqual({ token: 'tok123' })
  await act(async () => release(json({ name: 'Marta <b>Ruiz</b>' })))
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  expect(await screen.findByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
  expect(screen.getByText('¡Hola, Marta <b>Ruiz</b>!')).toBeInTheDocument()
})

it('sends the link token, not a number, when the athlete creates the account', async () => {
  openLink('tok123')
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Tu foto de identificación' })
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('BORRADOR · Versión borrador-2026-11-08')
  fireEvent.click(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.'))
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana Rodríguez' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '787 555 0100' } })
  complete = () => json({ error: { code: 'athlete_link_expired' } }, 422)
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  // The link expired while the form was open: N05-02, and no number was sent.
  expect(await screen.findByRole('heading', { name: 'Tu enlace venció' })).toBeInTheDocument()
  const sent = calls.find((call) => call.path.endsWith('/athlete/complete'))?.body as Record<string, unknown>
  expect(sent.token).toBe('tok123')
  expect(sent).not.toHaveProperty('authorization_number')
  expect(sent.locale).toBe('es')
})

it.each([
  ['athlete_link_expired', 'Tu enlace venció', ['Este enlace ya no es válido', 'Pedir otro enlace', 'Ayuda: 265-3866']],
  ['athlete_link_invalid', 'Tu enlace venció', ['Este enlace ya no es válido']],
  ['athlete_link_used', 'Este enlace ya se usó', ['Si completaste tu registro, inicia sesión con tu cuenta.', 'Iniciar sesión', 'Volver al registro']],
  ['athlete_link_replaced', 'Usa tu enlace más reciente', ['Revisa tu correo institucional', 'Abre el mensaje más reciente para continuar.', 'Pedir otro enlace']],
])('shows the N05 screen for %s', async (code, title, texts) => {
  validate = () => json({ error: { code } }, 422)
  openLink()
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  for (const text of texts) expect(screen.getByText(text)).toBeInTheDocument()
})

it('shows N05-05 with the contact number from the server when the record was claimed', async () => {
  validate = () => json({ error: { code: 'roster_record_claimed', details: { contact_number: ['787-555-0199'] } } }, 422)
  openLink()
  expect(await screen.findByRole('heading', { name: 'No pudimos vincular este registro' })).toBeInTheDocument()
  expect(screen.getByText('Llama al 787-555-0199 para revisar tu acceso.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ayuda: 787-555-0199' })).toHaveAttribute('href', 'tel:787-555-0199')
  expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/sign-in')
})

it('shows N05-07 on a server error and N05-06 offline, and Reintentar checks the link again', async () => {
  validate = () => json({ error: { code: 'server_error' } }, 500)
  openLink()
  expect(await screen.findByRole('heading', { name: 'No pudimos verificar tu enlace' })).toBeInTheDocument()
  validate = () => { throw new TypeError('Failed to fetch') }
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('heading', { name: 'Verifica tu enlace' })).toBeInTheDocument()
  expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  expect(screen.getByText('No hemos creado una cuenta ni vinculado un registro desde esta pantalla.')).toBeInTheDocument()
})
