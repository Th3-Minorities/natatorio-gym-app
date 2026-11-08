import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserApp } from './UserApp'
import styles from './checkIn.css?raw'

const member = {
  name: 'Daniel Rivera', email: 'daniel@email.com', locale: 'es',
  authorization: { type: 'paid', term: '[Período actual]' }, updated_at: '2026-11-07T14:00:00Z',
}
const athlete = { ...member, name: 'Valeria Ramos', email: 'valeria@upr.edu', authorization: { type: 'athlete', term: '[Período actual]' } }
const period = { starts_at: '2026-11-07T18:00:00Z', ends_at: '2026-11-07T20:00:00Z' }
const session = { id: 1, started_at: '2026-11-07T16:42:00Z', status: 'active' }
const idle = { session: null, athletes_period: null, account_type: 'member' }

type Answer = (path: string, init?: RequestInit) => Promise<Response>
let status: object
let post: Answer
let position: (success: PositionCallback, failure: PositionErrorCallback, options?: PositionOptions) => void
const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code })
const refuse = (code: string, details?: object, httpStatus = 422) => json({ error: { code, details } }, httpStatus)

beforeEach(() => {
  status = idle
  post = async () => json({ ...idle, session }, 201)
  position = (success) => success({ coords: { latitude: 18.2101, longitude: -67.1408, accuracy: 12 } } as GeolocationPosition)
  vi.stubGlobal('fetch', vi.fn((path: string, init?: RequestInit) => {
    if (path.endsWith('/me')) return Promise.resolve(json((status as { account_type: string }).account_type === 'athlete' ? athlete : member))
    if (path.endsWith('/check-in') && init?.method === 'POST') return post(path, init)
    if (path.endsWith('/check-in')) return Promise.resolve(json(status))
    return Promise.resolve(new Response(null, { status: 204 }))
  }))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true, value: { getCurrentPosition: vi.fn((s: PositionCallback, f: PositionErrorCallback, o?: PositionOptions) => position(s, f, o)) },
  })
  document.cookie = 'XSRF-TOKEN=test'
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

async function open() {
  window.history.replaceState({}, '', '/check-in')
  render(<UserApp />)
  return screen.findByRole('heading', { name: 'Check-in', level: 1 })
}

function hold(milliseconds = 1000) {
  vi.useFakeTimers()
  const button = screen.getByRole('button', { name: 'Mantén presionado para entrar' })
  fireEvent.keyDown(button, { key: ' ' })
  act(() => { vi.advanceTimersByTime(milliseconds) })
  vi.useRealTimers()
  return button
}

const geolocation = () => navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>

describe('U-01 Check In', () => {
  it('shows the member initial state (4104:95)', async () => {
    await open()
    expect(await screen.findByText('¿Listo para entrenar?')).toBeInTheDocument()
    expect(await screen.findByText('Daniel Rivera')).toBeInTheDocument()
    expect(screen.getByText('Miembro')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Autorización activa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registra tu entrada' })).toBeInTheDocument()
    expect(screen.getByText('Confirma tu llegada al gimnasio.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeInTheDocument()
    expect(screen.getByText('Necesitaremos verificar tu ubicación.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).not.toHaveAttribute('aria-current')
  })

  it('shows the athlete initial state (4104:173)', async () => {
    status = { ...idle, account_type: 'athlete' }
    await open()
    expect(await screen.findByText('Atleta')).toBeInTheDocument()
    expect(await screen.findByText('Valeria Ramos')).toBeInTheDocument()
    expect(document.querySelector('.check-in--athlete')).not.toBeNull()
  })

  it('cancels when the press ends before one second (4104:251)', async () => {
    await open()
    await screen.findByText('¿Listo para entrenar?')
    vi.useFakeTimers()
    const button = screen.getByRole('button', { name: 'Mantén presionado para entrar' })
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 })
    act(() => { vi.advanceTimersByTime(600) })
    expect(button).toHaveAccessibleName('Mantén presionado…')
    fireEvent.pointerUp(button, { pointerId: 1 })
    act(() => { vi.advanceTimersByTime(1000) })
    vi.useRealTimers()
    expect(button).toHaveAccessibleName('Mantén presionado para entrar')
    expect(geolocation()).not.toHaveBeenCalled()
  })

  it('asks for a precise location after one second and shows the drawn confirmation (4104:719)', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(geolocation().mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
    const request = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(request[1].body)).toEqual({ latitude: 18.2101, longitude: -67.1408, accuracy: 12 })
    expect(screen.getByText('Sesión activa')).toBeInTheDocument()
    expect(screen.getByText('12:42 p. m.')).toBeInTheDocument()
    expect(screen.getByText('Duración')).toBeInTheDocument()
    expect(screen.getByText('Muestra esta tarjeta al personal.')).toBeInTheDocument()
    expect(screen.getByText('El personal registra tu salida.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('¡Tu entrada quedó registrada!')
    status = { ...idle, session }
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))
    expect(document.querySelector('.visually-hidden[role="status"]')).toBeEmptyDOMElement()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.getByText('Sesión activa')).toBeInTheDocument())
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(storage).not.toHaveBeenCalled()
  })

  it('shows and announces the locating and registering states (4363:4027, 4363:4121)', async () => {
    let found!: PositionCallback
    let saved!: () => void
    position = (success) => { found = success }
    post = () => new Promise((resolve) => { saved = () => resolve(json({ ...idle, session }, 201)) })
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByText('Estamos procesando tu Check-in')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Obteniendo ubicación…' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('heading', { name: 'Obteniendo ubicación' })).toBeInTheDocument()
    expect(screen.getByText('Confirmamos tu llegada al gimnasio.')).toBeInTheDocument()
    expect(screen.getByText('Permite la ubicación si el navegador lo solicita.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Obteniendo ubicación')
    expect(screen.getByText('Daniel Rivera')).toBeInTheDocument()

    act(() => { found({ coords: { latitude: 18.2101, longitude: -67.1408, accuracy: 12 } } as GeolocationPosition) })
    expect(await screen.findByRole('button', { name: 'Registrando entrada…' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Registrando entrada' })).toBeInTheDocument()
    expect(screen.getByText('Guardamos la hora de tu entrada.')).toBeInTheDocument()
    expect(screen.getByText('Espera la confirmación antes de entrar.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Registrando entrada')

    act(() => { saved() })
    expect(await screen.findByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
  })

  it('registers on a click from assistive technology but not on a quick tap', async () => {
    await open()
    await screen.findByText('¿Listo para entrenar?')
    const button = screen.getByRole('button', { name: 'Mantén presionado para entrar' })
    fireEvent.click(button, { detail: 1 })
    expect(geolocation()).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(await screen.findByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(geolocation()).toHaveBeenCalledTimes(1)
  })

  it('shows the athletes-only notice on the confirmation (REQ-F-83)', async () => {
    status = { ...idle, session, athletes_period: { state: 'upcoming', ...period } }
    await open()
    const notice = (await screen.findByText(/Próximo horario exclusivo de atletas/)).closest('p')!
    expect(notice).toHaveTextContent(/· 2:00–4:00 p\. m\.$/)
    expect(screen.getByText('Sesión activa')).toBeInTheDocument()
  })

  it('shows the athletes-only notice that comes with a new Check In (REQ-F-83)', async () => {
    post = async () => json({ ...idle, session, athletes_period: { state: 'upcoming', ...period } }, 201)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByText(/Próximo horario exclusivo de atletas/)).toBeInTheDocument()
  })

  it('opens the confirmation without asking for location when a session is active (4199:3403)', async () => {
    status = { ...idle, account_type: 'athlete', session }
    await open()
    expect(await screen.findByText('Tu entrada está registrada', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(document.querySelector('.check-in--confirmed.check-in--athlete')).not.toBeNull()
    expect(geolocation()).not.toHaveBeenCalled()
  })

  it.each([
    ['check_in_no_authorization', 'Tu acceso no está vigente', 'No encontramos una autorización vigente para registrar tu entrada.', 'Revisar mi acceso'],
    ['check_in_gym_closed', 'El gimnasio está cerrado', 'Consulta los horarios y los avisos antes de tu próxima visita.', 'Ver horarios'],
    ['check_in_photo_required', 'Necesitamos una foto nueva', 'Actualiza tu foto para el nuevo término antes de registrar tu entrada.', 'Actualizar foto'],
    ['check_in_photo_pending', 'Tu foto necesita actualizarse', 'El personal marcó tu foto como pendiente. Carga una foto nueva desde tu teléfono.', 'Actualizar foto'],
    ['location_required', 'No pudimos obtener tu ubicación', 'Espera un momento y vuelve a intentarlo desde el gimnasio.', 'Intentar de nuevo'],
    ['check_in_low_accuracy', 'Necesitamos mayor precisión', 'La ubicación recibida no tiene suficiente precisión para confirmar tu llegada.', 'Intentar de nuevo'],
    ['check_in_outside_boundary', 'Acércate al gimnasio', 'Debes estar dentro del área del gimnasio para registrar tu entrada.', 'Intentar de nuevo'],
  ])('shows the drawn refusal for %s', async (code, title, text, action) => {
    post = async () => refuse(code)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByText('Revisa lo necesario para continuar')).toBeInTheDocument()
    expect(screen.getByText(action)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(title)
    expect(screen.queryByRole('button', { name: 'Mantén presionado para entrar' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Check-in', level: 1 })))
  })

  it('hides the authorization mark and links to the account when access is not current (4106:1284)', async () => {
    post = async () => refuse('check_in_no_authorization')
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('link', { name: 'Revisar mi acceso' })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('img', { name: 'Autorización activa' })).toBeNull()
  })

  it('shows the athlete authorization text (4199:4067)', async () => {
    status = { ...idle, account_type: 'athlete' }
    post = async () => refuse('check_in_no_authorization')
    await open()
    await screen.findByText('Atleta')
    hold()
    expect(await screen.findByRole('heading', { name: 'Tu acceso de atleta no está vigente' })).toBeInTheDocument()
    expect(screen.getByText('No encontramos una autorización de atleta vigente. Consulta con el personal para revisar tu acceso.')).toBeInTheDocument()
    expect(screen.getByText('Ver información de contacto')).toBeInTheDocument()
  })

  it('shows a denied location permission with retry and help (4433:4364)', async () => {
    position = (_, failure) => failure({ code: 1 } as GeolocationPositionError)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'Activa el permiso de ubicación' })).toBeInTheDocument()
    expect(screen.getByText('Revisa lo necesario para continuar')).toBeInTheDocument()
    expect(screen.getByText('Activa el permiso de ubicación en los ajustes del navegador. Luego pulsa Reintentar para continuar con tu Check-in.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver cómo activar ubicación' })).toBeInTheDocument()
    expect(screen.getByText('En la PWA, abre los ajustes del sitio desde el navegador.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'POST' }))
  })

  it('asks for location again and continues the Check In from the denied screen', async () => {
    position = (_, failure) => failure({ code: 1 } as GeolocationPositionError)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    position = (success) => success({ coords: { latitude: 18.2101, longitude: -67.1408, accuracy: 12 } } as GeolocationPosition)
    fireEvent.click(retry)
    expect(await screen.findByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
  })

  it('opens the location help as a modal dialog, traps Tab, closes with Escape and returns focus (4459:4335)', async () => {
    position = (_, failure) => failure({ code: 1 } as GeolocationPositionError)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    const opener = await screen.findByRole('button', { name: 'Ver cómo activar ubicación' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Activa tu ubicación' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
    expect(within(dialog).getByText('Sigue los pasos de tu navegador y vuelve para reintentar.')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading').map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ['H2', 'Activa tu ubicación'], ['H3', 'iPhone · Safari'], ['H3', 'Android · Chrome'],
    ])
    const lists = within(dialog).getAllByRole('list')
    expect(lists.map((list) => list.tagName)).toEqual(['OL', 'OL'])
    expect(within(lists[0]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Abre este sitio en Safari.', 'Menú de página → Configuración del sitio web.', 'Ubicación → Permitir.',
    ])
    expect(within(lists[1]).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Abre este sitio en Chrome.', 'Información del sitio → Permisos.', 'Ubicación → Permitir.',
    ])
    expect(within(dialog).getByText('Activa también la ubicación del dispositivo. Si usas la app instalada, revisa el permiso desde el navegador.')).toBeInTheDocument()

    const close = within(dialog).getByRole('button', { name: 'Cerrar ayuda' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(dialog).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(close).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()

    fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ayuda' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it.each([[2], [3]])('shows an unavailable location for geolocation error %i (4106:1597)', async (code) => {
    position = (_, failure) => failure({ code } as GeolocationPositionError)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'No pudimos obtener tu ubicación' })).toBeInTheDocument()
  })

  it('shows no connection when registering and checks the session before retrying (4106:1789)', async () => {
    post = async () => { throw new TypeError('network') }
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'Necesitas conexión' })).toBeInTheDocument()
    expect(screen.getByText('Sin conexión · Datos no actualizados')).toBeInTheDocument()
    expect(screen.getByText('Conéctate a internet para verificar y registrar tu entrada.')).toBeInTheDocument()
    status = { ...idle, session }
    geolocation().mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }))
    expect(await screen.findByText('Tu entrada está registrada', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(geolocation()).not.toHaveBeenCalled()
  })

  it('retries the location causes with a new location', async () => {
    post = async () => refuse('check_in_outside_boundary')
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    await screen.findByRole('heading', { name: 'Acércate al gimnasio' })
    post = async () => json({ ...idle, session }, 201)
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    expect(await screen.findByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(geolocation()).toHaveBeenCalledTimes(2)
  })

  it('shows the athletes notice an hour before the exclusive period (4105:554)', async () => {
    status = { ...idle, athletes_period: { state: 'upcoming', ...period } }
    await open()
    const notice = (await screen.findByText(/Próximo horario exclusivo de atletas/)).closest('p')!
    expect(notice).toHaveTextContent(/· 2:00–4:00 p\. m\.$/)
    expect(screen.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeInTheDocument()
  })

  it('shows members when they can enter during the exclusive period (4105:639)', async () => {
    status = { ...idle, athletes_period: { state: 'active', ...period } }
    await open()
    expect(await screen.findByText('Consulta tu próximo acceso')).toBeInTheDocument()
    const panel = screen.getByRole('heading', { name: 'Ahora entrenan los atletas' }).parentElement!
    for (const text of ['Horario exclusivo · 2:00–4:00 p. m.', 'Podrás registrar tu entrada', 'A partir de las 4:00 p. m.', 'Tu membresía sigue vigente.', 'Ver horarios']) {
      expect(within(panel).getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByText('Check-in disponible al terminar este periodo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mantén presionado para entrar' })).toBeNull()
  })

  it('keeps the entry action for athletes during the exclusive period (4105:704)', async () => {
    status = { ...idle, account_type: 'athlete', athletes_period: { state: 'active', ...period } }
    await open()
    expect(await screen.findByText(/^Horario exclusivo de atletas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mantén presionado para entrar' })).toBeInTheDocument()
  })

  it('shows the exclusive period when the server refuses a member with athletes_only', async () => {
    post = async () => refuse('check_in_athletes_only', period, 409)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'Ahora entrenan los atletas' })).toBeInTheDocument()
    expect(screen.getByText('A partir de las 4:00 p. m.')).toBeInTheDocument()
  })

  it('shows the exclusive period from the refusal when the first status request failed', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const original = fetchMock.getMockImplementation() as (path: string, init?: RequestInit) => Promise<Response>
    fetchMock.mockImplementation((path: string, init?: RequestInit) =>
      path.endsWith('/check-in') && !init?.method ? Promise.resolve(refuse('server_error', undefined, 500)) : original(path, init))
    post = async () => refuse('check_in_athletes_only', period, 409)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'Ahora entrenan los atletas' })).toBeInTheDocument()
    expect(screen.getByText('A partir de las 4:00 p. m.')).toBeInTheDocument()
  })

  it.each([
    ['a server error', () => refuse('server_error', undefined, 500), 'No pudimos enviar la solicitud', 'Algo salió mal de nuestro lado. Intenta más tarde.'],
    ['a validation error', () => refuse('validation_failed'), 'No pudimos enviar la solicitud', 'Algunos campos necesitan corrección.'],
    ['an unknown 5xx code', () => refuse('some_new_code', undefined, 503), 'No pudimos enviar la solicitud', 'Algo salió mal de nuestro lado. Intenta más tarde.'],
  ])('reuses the existing failure texts for %s', async (_, answer, title, text) => {
    post = async () => answer()
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(title)
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument()
  })

  it('reuses the sign-in wait texts after too many tries', async () => {
    post = async () => new Response(JSON.stringify({ error: { code: 'too_many_requests' } }), { status: 429, headers: { 'Retry-After': '60' } })
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('heading', { name: 'Espera antes de intentar de nuevo' })).toBeInTheDocument()
    expect(screen.getByText(/^Intenta de nuevo a las /)).toBeInTheDocument()
  })

  it.each([
    [{ account_type: 'member', member_group: 'student' }, 'Estudiante'],
    [{ account_type: 'athlete', sport: 'Voleibol' }, 'Voleibol'],
  ])('shows the group or sport under the category on the confirmation', async (extra, line) => {
    status = { ...idle, ...extra, session }
    await open()
    expect(await screen.findByText(line)).toBeInTheDocument()
  })

  it('shows no group line for employees, which no frame draws', async () => {
    status = { ...idle, member_group: 'employee', session }
    await open()
    await screen.findByText('Sesión activa')
    expect(document.querySelectorAll('.check-in-id__small')).toHaveLength(2)
  })

  it('returns to sign-in when the session is rejected', async () => {
    post = async () => refuse('unauthenticated', undefined, 401)
    await open()
    await screen.findByText('¿Listo para entrenar?')
    hold()
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('U-01 Check In motion', () => {
  const reduced = styles.split('@media (prefers-reduced-motion: reduce)').slice(1).join(' ')

  it('drifts the card waves with transform only and stops every animation under reduced motion', () => {
    expect(styles).toMatch(/\.check-in-id__waves \{[^}]*animation: check-in-drift 24s linear infinite/)
    expect(styles).toMatch(/@keyframes check-in-drift \{[^@]*transform: translateX\(-16px\)[^@]*translateX\(16px\)/)
    expect(reduced).toMatch(/\.check-in-id__waves \{[^}]*animation: none/)
    expect(reduced).toMatch(/\.check-in-hold__progress \{[^}]*animation: none/)
  })
})
