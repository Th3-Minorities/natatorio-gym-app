import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckIn } from './CheckIn'
import { Gym } from './Gym'
import { UserApp, type UserProfile } from './UserApp'
import { I18nProvider } from '../i18n'

const profile: UserProfile = { name: 'Daniel Rivera', email: 'daniel@email.com', locale: 'es', account_type: 'paid', authorization: { type: 'paid', term: '2026' }, updated_at: '2026-11-07T17:07:24Z' }
const session = { id: 1, started_at: '2026-11-07T16:42:00Z', status: 'active' }
let status: object
let occupancy: object
let failOccupancy: 'offline' | 'server' | null
const ended = vi.fn(() => false)
const reloadProfile = async () => {}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { Date: 'Sat, 07 Nov 2026 17:07:24 GMT' } })
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
function connection(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  fireEvent(window, new Event(online ? 'online' : 'offline'))
}
function visibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  fireEvent(document, new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
  connection(true)
  visibility(false)
  status = { session, athletes_period: null, account_type: 'member', member_group: 'student' }
  occupancy = { count: 18, max: 40, updated_at: '2026-11-07T17:07:24Z' }
  failOccupancy = null
  ended.mockClear()
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.endsWith('/me')) return json(profile)
    if (path.endsWith('/occupancy')) {
      if (failOccupancy === 'offline') throw new Error('network')
      if (failOccupancy === 'server') return new Response(JSON.stringify({ error: { code: 'server_error' } }), { status: 500 })
      return json(occupancy)
    }
    return json(status)
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, 'hidden') })

describe('Gym ID and ended visits', () => {
  async function registerVisit() {
    status = { session: null, athletes_period: null, account_type: 'member' }
    vi.stubGlobal('navigator', Object.create(navigator, { geolocation: { value: {
      getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 18.21, longitude: -67.14, accuracy: 12 } } as GeolocationPosition),
    } } }))
    const view = render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    status = { ...status, session }
    fireEvent.click(screen.getByRole('button', { name: 'Mantén presionado para entrar' }))
    await flush()
    expect(screen.getByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    return view
  }

  it('keeps the new-entry text through polls, visibility changes and reconnecting without repeating the announcement', async () => {
    await registerVisit()
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    visibility(true)
    visibility(false)
    await flush()
    expect(screen.getByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    connection(false)
    connection(true)
    await flush()
    expect(screen.getByText('¡Tu entrada quedó registrada!', { selector: '.check-in-lead' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows the existing-entry text after a new mount', async () => {
    const { unmount } = await registerVisit()
    unmount()
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(screen.getByText('Tu entrada está registrada')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('clears the new-entry text when the session id changes', async () => {
    await registerVisit()
    status = { ...status, session: { ...session, id: 2 } }
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('Tu entrada está registrada')).toBeInTheDocument()
    status = { ...status, session }
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('Tu entrada está registrada')).toBeInTheDocument()
  })

  it('uses the server clock despite a wrong device clock, ticks once a second and freezes offline', async () => {
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(screen.getByText('Tu entrada está registrada')).toBeInTheDocument()
    expect(screen.getByText('00:25:24')).toBeInTheDocument()
    expect(document.querySelector('img[src="/api/user/photo"]')).toHaveAttribute('alt', '')
    await act(async () => { await vi.advanceTimersByTimeAsync(999) })
    expect(screen.getByText('00:25:24')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(31) })
    expect(screen.getByText('00:25:25')).toBeInTheDocument()
    expect(screen.getByText('00:25:25').closest('[aria-live]')).toBeNull()
    connection(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('No válida ahora')).toBeInTheDocument()
    expect(screen.getByText('Duración · Sin actualizar')).toBeInTheDocument()
    expect(screen.getByText('00:25:25')).toBeInTheDocument()
    expect(document.querySelector('.check-in--confirmed')).toBeNull()
  })

  it.each(['checked_out', 'expired', 'closed'] as const)('shows a fixed summary for %s and Continue checks current access without posting', async (reason) => {
    status = { session: null, last_session: { id: 1, started_at: session.started_at, ended_at: '2026-11-07T18:10:00Z', end_reason: reason }, account_type: 'athlete', sport: 'Voleibol', athletes_period: null }
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(screen.getByText('Tu visita ha terminado')).toBeInTheDocument()
    expect(screen.getByText('Sesión finalizada')).toBeInTheDocument()
    expect(screen.getByText('01:28:00')).toBeInTheDocument()
    expect(screen.getByText({ checked_out: 'Tu salida fue registrada por el personal.', expired: 'La sesión se cerró automáticamente.', closed: 'La sesión terminó por cierre del gimnasio.' }[reason])).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('01:28:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await flush()
    expect(screen.getByRole('heading', { name: 'Registra tu entrada' })).toBeInTheDocument()
    expect(screen.queryByText('Sesión finalizada')).not.toBeInTheDocument()
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
  })

  it('refreshes an active visit and switches to the ended summary when the backend closes it', async () => {
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    status = { session: null, last_session: { id: 1, started_at: session.started_at, ended_at: '2026-11-07T17:10:00Z', end_reason: 'checked_out' }, account_type: 'member', athletes_period: null }
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('Sesión finalizada')).toBeInTheDocument()
    expect(screen.getByText('00:28:00')).toBeInTheDocument()
  })

  it('does not repaint the duration more than once a second during clock resynchronization', async () => {
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status), { headers: { Date: 'Sat, 07 Nov 2026 17:07:25 GMT' } }))
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(screen.getByText('00:25:24')).toBeInTheDocument()
  })

  it('recovers from offline only after revalidating the session', async () => {
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    connection(false)
    status = { session: null, last_session: { id: 1, started_at: session.started_at, ended_at: '2026-11-07T18:42:00Z', end_reason: 'expired' }, account_type: 'member', athletes_period: null }
    connection(true)
    await flush()
    expect(screen.getByText('Sesión finalizada')).toBeInTheDocument()
  })

  it('does not announce confirmation for an existing session or after reconnecting', async () => {
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    connection(false)
    connection(true)
    await flush()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('skips hidden polls and focus, refreshes once when visible, and removes listeners on unmount', async () => {
    const { unmount } = render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    visibility(true)
    fireEvent.focus(window)
    await act(async () => { await vi.advanceTimersByTimeAsync(50000) })
    expect(fetch).toHaveBeenCalledTimes(1)
    visibility(false)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
    visibility(true)
    visibility(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('waits for visibility before requesting the initial session', async () => {
    visibility(true)
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    expect(fetch).not.toHaveBeenCalled()
    visibility(false)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([1000, 1500, -1000, -1500])('ignores clock offset jitter of %i ms', async (jitter) => {
    vi.setSystemTime(new Date('2026-11-07T17:07:24Z'))
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(2030) })
    // Move the device clock independently, back on the second boundary; the HTTP Date remains a whole second.
    vi.setSystemTime(Date.now() - 30 - jitter)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status), { headers: { Date: 'Sat, 07 Nov 2026 17:07:26 GMT' } }))
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const expected = Math.max(26, Math.floor(27 - jitter / 1000))
    expect(screen.getByText(`00:25:${expected}`)).toBeInTheDocument()
  })

  it('applies a large clock correction without moving the displayed duration backwards', async () => {
    vi.setSystemTime(new Date('2026-11-07T17:07:24Z'))
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(2030) })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status), { headers: { Date: 'Sat, 07 Nov 2026 17:07:20 GMT' } }))
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByText('00:25:26')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(6030) })
    expect(screen.getByText('00:25:27')).toBeInTheDocument()
  })

  it('applies a forward clock correction larger than 1500 ms', async () => {
    vi.setSystemTime(new Date('2026-11-07T17:07:24Z'))
    render(<CheckIn profile={profile} reloadProfile={reloadProfile} ended={ended} />)
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status), { headers: { Date: 'Sat, 07 Nov 2026 17:07:30 GMT' } }))
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(1030) })
    expect(screen.getByText('00:25:31')).toBeInTheDocument()
  })
})

describe('Gimnasio occupancy', () => {
  it.each([
    ['es', 'Actualizado a las 1:07:24 p. m.', 'Dato no actualizado · Último dato a las 1:07 p. m.'],
    ['en', 'Updated at 1:07:24 PM', 'Data not updated · Last data at 1:07 PM'],
  ] as const)('uses 12-hour update times with seconds only for fresh data in %s', async (locale, fresh, stale) => {
    render(<I18nProvider locale={locale}><Gym ended={ended} /></I18nProvider>)
    await flush()
    expect(screen.getByText(fresh)).toBeInTheDocument()
    failOccupancy = 'server'
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText(stale)).toBeInTheDocument()
  })

  it.each([
    ['es', 'Dato no actualizado'], ['en', 'Data not updated'],
  ] as const)('shows only the stale label when the first load fails in %s', async (locale, label) => {
    failOccupancy = 'server'
    render(<I18nProvider locale={locale}><Gym ended={ended} /></I18nProvider>)
    await flush()
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument()
    expect(screen.queryByText(/Último dato|Last data/)).not.toBeInTheDocument()
    expect(screen.queryByText('18')).not.toBeInTheDocument()
  })

  it('keeps future destinations visible without interactive or focusable elements', async () => {
    render(<Gym ended={ended} />)
    await flush()
    for (const label of ['Horarios', 'Avisos', 'Banco de pesas', 'Jalón al pecho', 'Aprende a usarlo →', 'Aprende a usarla →']) {
      const text = screen.getByText(label)
      expect(text).toBeVisible()
      expect(text.closest('a, button, [role="link"], [role="button"], [tabindex]')).toBeNull()
    }
  })

  async function openGym() {
    window.history.replaceState({}, '', '/gym')
    render(<UserApp />)
    await flush()
  }
  it('shows the count, polls after 25 seconds and links the selected tab', async () => {
    await openGym()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gimnasio' })).toHaveAttribute('aria-current', 'page')
    occupancy = { count: 0, max: 40, updated_at: '2026-11-07T17:07:49Z' }
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Baja')).toBeInTheDocument()
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([path]) => path.endsWith('/occupancy'))
    expect(calls).toHaveLength(2)
    expect(calls[1][1].headers['X-Auto-Refresh']).toBe('1')
  })
  it.each([
    [0, 60, 'Baja', 'Low', 0], [19, 60, 'Baja', 'Low', 19 / 60 * 100],
    [20, 60, 'Moderada', 'Moderate', 100 / 3], [40, 60, 'Moderada', 'Moderate', 200 / 3],
    [41, 60, 'Alta', 'High', 41 / 60 * 100], [80, 60, 'Alta', 'High', 100],
  ])('shows the level and capped bar for %i of %i', async (count, max, spanish, english, percent) => {
    occupancy = { count, max, updated_at: '2026-11-07T17:07:24Z' }
    const { rerender } = render(<I18nProvider locale="es"><Gym ended={ended} /></I18nProvider>)
    await flush()
    expect(screen.getByText(spanish)).toBeInTheDocument()
    const bar = document.querySelector('.gym-occupancy__bar')!
    expect(bar).toHaveAttribute('aria-hidden', 'true')
    expect(parseFloat((bar.firstElementChild as HTMLElement).style.width)).toBeCloseTo(percent)
    rerender(<I18nProvider locale="en"><Gym ended={ended} /></I18nProvider>)
    expect(screen.getByText(english)).toBeInTheDocument()
  })
  it('skips hidden polls, refreshes once when visible and removes listeners on unmount', async () => {
    const { unmount } = render(<Gym ended={ended} />)
    await flush()
    visibility(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(50000) })
    expect(fetch).toHaveBeenCalledTimes(1)
    visibility(false)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
    visibility(true)
    visibility(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('waits for visibility before requesting initial occupancy', async () => {
    visibility(true)
    render(<Gym ended={ended} />)
    await flush()
    expect(fetch).not.toHaveBeenCalled()
    visibility(false)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('hides stale numbers offline, stops requests, and refreshes on reconnect', async () => {
    await openGym()
    connection(false)
    expect(screen.queryByText('18')).not.toBeInTheDocument()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(50000) })
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([path]) => path.endsWith('/occupancy'))).toHaveLength(1)
    connection(true)
    await flush()
    expect(screen.getByText('18')).toBeInTheDocument()
  })
  it('hides the previous number after an unsuccessful refresh', async () => {
    await openGym()
    failOccupancy = 'offline'
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.queryByText('18')).not.toBeInTheDocument()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })
  it('shows the drawn error state and hides the count after a server error', async () => {
    await openGym()
    failOccupancy = 'server'
    await act(async () => { await vi.advanceTimersByTimeAsync(25000) })
    expect(screen.getByText('No pudimos actualizar')).toBeInTheDocument()
    expect(screen.queryByText('18')).not.toBeInTheDocument()
    expect(screen.getByText(/^Dato no actualizado/)).toBeInTheDocument()
  })
  it('shows the loading frame until the first answer arrives', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done }))
    render(<Gym ended={ended} />)
    expect(screen.getByRole('status')).toHaveTextContent('Actualizando ocupación…')
    expect(screen.getByRole('region', { name: 'Ocupación estimada' })).toHaveAttribute('aria-busy', 'true')
    resolve(json(occupancy))
    await flush()
    expect(screen.getByText('18')).toBeInTheDocument()
  })
  it('does not show a number or request occupancy when opened offline', async () => {
    connection(false)
    render(<Gym ended={ended} />)
    await flush()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})
