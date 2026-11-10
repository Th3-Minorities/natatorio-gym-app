import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { storeLocale } from './deviceLocale'
import { UserApp } from './UserApp'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const WAIVER = { version: 'borrador-2026-11-08', text: 'Relevo de responsabilidad\n\nPrimer párrafo.\n\nSegundo párrafo.' }
let sent: Record<string, FormDataEntryValue>[]
let complete: () => Response | Promise<Response>
let waiver: () => Response

function stubCamera(devices: { kind: string }[], permission = 'prompt') {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: async () => devices } })
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: permission }) } })
}

beforeEach(() => {
  sent = []
  complete = () => json({ id: 1 }, 201)
  waiver = () => json(WAIVER)
  document.cookie = 'XSRF-TOKEN=test'
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  stubCamera([{ kind: 'videoinput' }])
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/registration/privacy') && !init?.body) return json({ version: 'draft', draft: true, store_url: null, contact_number: '265-3866' })
    if (path.endsWith('/lookup')) return json({ state: 'ready', name: 'Ana', masked_email: 'a***@upr.edu' })
    if (path.includes('/waiver')) return waiver()
    if (path.endsWith('/complete')) { sent.push(Object.fromEntries(init!.body as FormData)); return complete() }
    return new Response(null, { status: 204 })
  }))
  window.history.replaceState({}, '', '/register')
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })

async function reachPhoto() {
  render(<UserApp />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con el registro' }))
  fireEvent.change(await screen.findByLabelText('Número de estudiante o autorización'), { target: { value: '4K7Q2B' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Crea una contraseña' })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Tu foto de identificación' })
}

function choose(name = 'me.jpg') {
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } })
}

async function reachContact() {
  await reachPhoto()
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('BORRADOR · Versión borrador-2026-11-08')
}

function fillContact() {
  fireEvent.click(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.'))
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana Rodríguez' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '787 555 0100' } })
}

it('collects photo, waiver and contact, creates the account once, then opens install help that leads to Check In', async () => {
  await reachPhoto()
  expect(await screen.findByRole('button', { name: 'Tomar foto' })).toBeInTheDocument()
  expect(screen.getByText('Aún no has elegido una foto')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  choose()
  expect(screen.getByRole('img', { name: 'Vista previa de la foto elegida' })).toHaveAttribute('src', 'blob:photo')
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'Relevo y contacto de emergencia' })).toBeInTheDocument()
  expect(await screen.findByText('BORRADOR · Versión borrador-2026-11-08')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Leer relevo completo' }))
  expect(await screen.findByRole('heading', { name: 'Relevo' })).toBeInTheDocument()
  expect(screen.getByText('Segundo párrafo.')).toBeInTheDocument()
  expect(screen.queryByText('Relevo de responsabilidad')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver al registro' }))
  expect(await screen.findByLabelText('He leído y acepto el relevo de responsabilidad.')).toBeChecked()
  expect(sent).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(window.location.pathname).toBe('/install'))
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({
    authorization_number: '4K7Q2B', password: 'a long password', password_confirmation: 'a long password', waiver_accepted: '1',
    waiver_version: 'borrador-2026-11-08', emergency_contact_name: 'Ana Rodríguez', emergency_contact_phone: '787 555 0100', locale: 'es',
  })
  expect(sent[0].photo).toBeInstanceOf(File)
  expect(window.location.search).toBe('?registered')
  expect(document.querySelector('.user-navigation')).toBeNull()
  expect(document.querySelector('.install-skip')).toHaveAttribute('href', '/check-in')
})

it('offers only Subir foto with the drawn line when there is no camera', async () => {
  stubCamera([])
  await reachPhoto()
  expect(await screen.findByText('Este dispositivo o navegador no tiene una cámara disponible. Puedes subir una foto.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tomar foto' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument()
})

it('offers only Subir foto with the drawn line when the camera permission is denied', async () => {
  stubCamera([{ kind: 'videoinput' }], 'denied')
  await reachPhoto()
  expect(await screen.findByText('No tenemos permiso para usar tu cámara. Puedes subir una foto de tu dispositivo.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tomar foto' })).not.toBeInTheDocument()
})

it.each([
  [{ photo: ['mimetypes'] }, 422, 'Formato no permitido'],
  [{ photo: ['max'] }, 422, 'La foto supera 10 MB'],
  [undefined, 413, 'La foto supera 10 MB'],
])('returns to the photo step with the drawn alert for %s and retries with the kept data', async (details, status, title) => {
  complete = () => json({ error: { code: status === 413 ? 'payload_too_large' : 'validation_failed', details } }, status)
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByRole('heading', { name: 'Revisa tu foto' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(title)
  complete = () => json({ id: 1 }, 201)
  choose('other.png')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(window.location.pathname).toBe('/install'))
  expect(sent[1]).toMatchObject({ emergency_contact_name: 'Ana Rodríguez' })
  expect((sent[1].photo as File).name).toBe('other.png')
})

it('marks the contact fields the server rejects and keeps the acceptance', async () => {
  complete = () => json({ error: { code: 'validation_failed', details: { emergency_contact_phone: ['regex'] } } }, 422)
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByText('Escribe un número de teléfono válido.')).toBeInTheDocument()
  expect(screen.queryByText('Escribe el nombre de tu contacto.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.')).toBeChecked()
})

it('sends a compromised password back to the password step', async () => {
  complete = () => json({ error: { code: 'validation_failed', details: { password: ['password'] } } }, 422)
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  const error = await screen.findByText('Esta contraseña apareció en una filtración. Elige otra.')
  const hint = screen.getByText('Usa al menos 10 caracteres.')
  expect(hint.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText('Contraseña').getAttribute('aria-describedby')).toBe(`${hint.id} ${error.id}`)
  expect(screen.getByRole('heading', { name: 'Crea una contraseña' })).toBeInTheDocument()
})

it('shows the saving state, then the final save error that returns to the photo', async () => {
  let fail!: (response: Response) => void
  complete = () => new Promise<Response>((resolve) => { fail = resolve })
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByRole('heading', { name: 'Guardando tu cuenta' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  fail(json({ error: { code: 'server_error' } }, 500))
  expect(await screen.findByRole('heading', { name: 'No pudimos crear tu cuenta' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a mi foto' }))
  expect(await screen.findByRole('heading', { name: 'Tu foto de identificación' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Vista previa de la foto elegida' })).toBeInTheDocument()
})

it('treats a retry refused because the account already exists as success', async () => {
  complete = () => json({ error: { code: 'forbidden' } }, 403)
  vi.mocked(fetch).mockImplementation(async (path, init) => {
    if (String(path).endsWith('/user/me')) return json({ id: 1 })
    if (String(path).includes('/waiver')) return waiver()
    if (String(path).endsWith('/complete')) return complete()
    if (String(path).endsWith('/lookup')) return json({ state: 'ready', name: 'Ana', masked_email: 'a***@upr.edu' })
    if (String(path).endsWith('/registration/privacy') && !init?.body) return json({ version: 'draft', draft: true, store_url: null, contact_number: '265-3866' })
    return new Response(null, { status: 204 })
  })
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(window.location.pathname).toBe('/install'))
})

it('blocks account creation when the waiver cannot load and retries it', async () => {
  waiver = () => json({ error: { code: 'registration_waiver_unavailable' } }, 503)
  await reachPhoto()
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'No pudimos cargar el relevo' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument()
  waiver = () => json(WAIVER)
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('BORRADOR · Versión borrador-2026-11-08')).toBeInTheDocument()
})

it('shows the waiver-failed screen for a 502 HTML response and loads the waiver on Reintentar', async () => {
  waiver = () => new Response('<html>', { status: 502 })
  await reachPhoto()
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('heading', { name: 'No pudimos cargar el relevo' })).toBeInTheDocument()
  waiver = () => json(WAIVER)
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('BORRADOR · Versión borrador-2026-11-08')).toBeInTheDocument()
})

async function failOnPhoto(response: () => Response) {
  complete = response
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await screen.findByRole('heading', { name: 'Revisa tu foto' })
}

it('sends nothing on Reintentar when the waiver box is no longer checked', async () => {
  await failOnPhoto(() => json({ error: { code: 'validation_failed', details: { photo: ['max'] } } }, 422))
  window.history.back()
  fireEvent.click(await screen.findByLabelText('He leído y acepto el relevo de responsabilidad.'))
  window.history.forward()
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(window.location.pathname).toBe('/register/contact'))
  expect(sent).toHaveLength(1)
})

it('shows the 10 MB photo error for a 413 whose body is the proxy HTML page', async () => {
  await failOnPhoto(() => new Response('<html>', { status: 413 }))
  expect(screen.getByRole('alert')).toHaveTextContent('La foto supera 10 MB')
})

it('rejects a photo over 10 MB before sending anything', async () => {
  await reachPhoto()
  const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
  Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [big] } })
  expect(screen.getByRole('alert')).toHaveTextContent('La foto supera 10 MB')
  expect(screen.getByText('Aún no has elegido una foto')).toBeInTheDocument()
  choose()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  expect(sent).toHaveLength(0)
})

it('clears a 12 MB pick with a valid one after the waiver loaded, without Reintentar', async () => {
  await reachContact()
  window.history.back()
  await screen.findByRole('heading', { name: 'Tu foto de identificación' })
  const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
  Object.defineProperty(big, 'size', { value: 12 * 1024 * 1024 })
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [big] } })
  expect(screen.getByRole('alert')).toHaveTextContent('La foto supera 10 MB')
  expect(screen.getByRole('heading', { name: 'Tu foto de identificación' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  choose()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
})

it('shows the save-failed screen when the connection drops during /complete', async () => {
  await reachContact()
  fillContact()
  vi.mocked(fetch).mockImplementation(async (path) => {
    if (String(path).endsWith('/complete')) throw new TypeError('network')
    return new Response(null, { status: 204 })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByRole('heading', { name: 'No pudimos crear tu cuenta' })).toBeInTheDocument()
})

it('returns to the privacy step when the server says the privacy notice was not accepted', async () => {
  await reachContact()
  fillContact()
  complete = () => json({ error: { code: 'registration_privacy_required' } }, 403)
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByRole('button', { name: 'Continuar con el registro' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/register')
})

it('returns to the privacy step when the waiver load says the privacy notice was not accepted', async () => {
  waiver = () => json({ error: { code: 'registration_privacy_required' } }, 403)
  await reachPhoto()
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('button', { name: 'Continuar con el registro' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/register')
})

it('moves focus to the heading in the saving, save-failed and waiver-failed screens', async () => {
  let fail!: (response: Response) => void
  complete = () => new Promise<Response>((resolve) => { fail = resolve })
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Guardando tu cuenta' })).toHaveFocus())
  fail(json({ error: { code: 'server_error' } }, 500))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'No pudimos crear tu cuenta' })).toHaveFocus())
})

it('moves focus to the heading when the waiver cannot load', async () => {
  waiver = () => json({ error: { code: 'registration_waiver_unavailable' } }, 503)
  await reachPhoto()
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'No pudimos cargar el relevo' })).toHaveFocus())
})

it('sends the account request as multipart, without a JSON Content-Type', async () => {
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(sent).toHaveLength(1))
  const call = vi.mocked(fetch).mock.calls.find(([path]) => String(path).endsWith('/complete'))!
  expect(call[1]?.body).toBeInstanceOf(FormData)
  expect(Object.keys(call[1]?.headers ?? {}).map((name) => name.toLowerCase())).not.toContain('content-type')
})

it('marks the unchecked waiver box with the error that describes it and focuses the rejected contact field', async () => {
  complete = () => json({ error: { code: 'validation_failed', details: { waiver_accepted: ['accepted'] } } }, 422)
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  const box = await screen.findByLabelText('He leído y acepto el relevo de responsabilidad.')
  await waitFor(() => expect(box).toHaveAttribute('aria-invalid', 'true'))
  expect(document.getElementById(box.getAttribute('aria-describedby')!)).toBeInTheDocument()
  await waitFor(() => expect(box).toHaveFocus())
})

it('reloads a rejected waiver version and requires a new acceptance before creating the account', async () => {
  complete = () => json({ error: { code: 'validation_failed', details: { waiver_version: ['in'] } } }, 422)
  await reachContact()
  fillContact()
  waiver = () => json({ ...WAIVER, version: 'borrador-2026-11-09' })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByText('BORRADOR · Versión borrador-2026-11-09')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/register/contact')
  expect(screen.getByRole('alert')).toHaveTextContent('El relevo cambió. Léelo y acéptalo de nuevo para crear tu cuenta.')
  expect(screen.getByRole('alert')).toHaveClass('registration-field-error')
  expect(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.')).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(sent).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Leer relevo completo' }))
  expect(await screen.findByText('BORRADOR · Versión borrador-2026-11-09')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver al registro' }))
  fireEvent.click(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.'))
  complete = () => json({ id: 1 }, 201)
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(window.location.pathname).toBe('/install'))
  expect(sent).toHaveLength(2)
  expect(sent[1].waiver_version).toBe('borrador-2026-11-09')
})

it('focuses the first contact field the server rejects', async () => {
  complete = () => json({ error: { code: 'validation_failed', details: { emergency_contact_phone: ['regex'] } } }, 422)
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(screen.getByLabelText('Teléfono')).toHaveFocus())
})

it('keeps the contact page and shows the wait time after a 429 on /complete', async () => {
  complete = () => new Response(JSON.stringify({ error: { code: 'too_many_attempts' } }), { status: 429, headers: { 'Retry-After': '60' } })
  await reachContact()
  fillContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  expect(await screen.findByText(/Intenta de nuevo a las/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  expect(sent).toHaveLength(1)
})

it('keeps the language chosen on Welcome: English privacy can continue and the waiver loads in English', async () => {
  storeLocale('en')
  render(<UserApp />)
  expect(await screen.findByRole('heading', { name: 'Before you begin' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue registration' }))
  fireEvent.change(await screen.findByLabelText('Student or authorization number'), { target: { value: '4K7Q2B' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Create a password' })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long password' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a long password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Your ID photo' })
  choose()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByText('DRAFT · Version borrador-2026-11-08')).toBeInTheDocument()
  const waiverCall = vi.mocked(fetch).mock.calls.find(([path]) => String(path).includes('/waiver'))!
  expect(String(waiverCall[0])).toContain('locale=en')
})

it('shows the three Figma errors and focuses the checkbox when Crear cuenta is pressed with nothing filled', async () => {
  await reachContact()
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  const box = screen.getByLabelText('He leído y acepto el relevo de responsabilidad.')
  await waitFor(() => expect(box).toHaveFocus())
  expect(screen.getByText('Acepta el relevo para crear tu cuenta.')).toBeInTheDocument()
  expect(screen.getByText('Escribe el nombre de tu contacto.')).toBeInTheDocument()
  expect(screen.getByText('Escribe un número de teléfono válido.')).toBeInTheDocument()
  expect(sent).toHaveLength(0)
  expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith('/complete'))).toBe(false)
  fireEvent.click(box)
  expect(screen.queryByText('Acepta el relevo para crear tu cuenta.')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana' } })
  expect(screen.queryByText('Escribe el nombre de tu contacto.')).not.toBeInTheDocument()
})

it('focuses the first missing field when only the contact is empty', async () => {
  await reachContact()
  fireEvent.click(screen.getByLabelText('He leído y acepto el relevo de responsabilidad.'))
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await waitFor(() => expect(screen.getByLabelText('Nombre completo')).toHaveFocus())
  expect(screen.queryByText('Acepta el relevo para crear tu cuenta.')).not.toBeInTheDocument()
  expect(sent).toHaveLength(0)
})
