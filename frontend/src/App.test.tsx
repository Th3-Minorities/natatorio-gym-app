import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import type { Account } from './account'
import { routes } from './routes'

const user: Account = { role: 'user', locale: 'en', home: 'U-01' }
const staff: Account = { role: 'staff', locale: 'en' }
const admin: Account = { role: 'admin', locale: 'es' }

function open(path: string, account: Account | null = null) {
  window.history.replaceState(null, '', path)
  return render(<App account={account} />)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

test('welcome and sign in default to Spanish without an account', () => {
  open('/')
  expect(screen.getByRole('heading', { level: 1, name: 'Bienvenida' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Iniciar sesión' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('es')
  expect(screen.queryByRole('link', { name: /personal/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/API:/)).not.toBeInTheDocument()
})

test('existing connection diagnostic is available on its own page', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'ok' })))
  open('/estado-api')
  expect(await screen.findByText('API: conectada')).toBeInTheDocument()
})

test('account language changes the whole page without a top bar language button', () => {
  const view = open('/app/account', user)
  expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  expect(within(screen.getByRole('banner')).queryByRole('combobox')).not.toBeInTheDocument()
  view.rerender(<App account={{ ...user, locale: 'es' }} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('es')
})

test('account language ignores browser storage', () => {
  localStorage.setItem('locale', 'en')
  open('/sign-in')
  expect(document.documentElement.lang).toBe('es')
  localStorage.clear()
})

test('User tabs and More menu follow SM-1 and retain browser back navigation', () => {
  open('/app', user)
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('link')).toHaveLength(5)
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(within(nav).getByRole('link', { name: 'More' }))
  expect(screen.getByRole('link', { name: 'Facility information' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Account' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Install help' })).toBeInTheDocument()
  act(() => {
    window.history.replaceState(null, '', '/app')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(screen.getByRole('heading', { level: 1, name: 'Check In and Gym ID' })).toBeInTheDocument()
})

test('Staff sidebar hides every Administrator item and refuses direct navigation', () => {
  open('/dashboard/terms', staff)
  expect(screen.getByText('You do not have permission to do this.')).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getByRole('link', { name: 'Active sessions' })).toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Academic terms' })).not.toBeInTheDocument()
  expect(screen.queryByText('A-04')).not.toBeInTheDocument()
})

test('Administrator has Staff and Administrator navigation', () => {
  open('/dashboard/terms', admin)
  expect(screen.getByRole('heading', { level: 1, name: 'Periodos académicos' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  expect(within(nav).getByRole('link', { name: 'Sesiones activas' })).toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: 'Cuentas del personal' })).toBeInTheDocument()
})

test('account names are rendered as text', () => {
  const name = '<img src=x onerror=alert(1)>'
  open('/dashboard', { ...staff, name })
  expect(screen.getByText(name)).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})

test.each(['U-01', 'U-02', 'U-07'] as const)('signed-in landing opens account home %s', (home) => {
  open('/', { ...user, home })
  expect(screen.getByText(home)).toBeInTheDocument()
})

test('guest dashboard URL shows only Staff sign in', () => {
  open('/dashboard/terms')
  expect(screen.getByRole('heading', { level: 1, name: 'Acceso del personal' })).toBeInTheDocument()
  expect(screen.queryByText('A-04')).not.toBeInTheDocument()
})

test.each(routes.filter((route) => !['N-01', 'N-09'].includes(route.id)))(
  'placeholder $id is reachable for an allowed account', (route) => {
    const account = route.id === 'N-11' ? null : route.access === 'admin' ? admin
      : route.access === 'staff' || route.path.startsWith('/dashboard') ? staff
        : route.access === 'user' || route.access === 'account' ? user : null
    open(route.path, account)
    expect(screen.getByText(route.id)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  },
)

test('health errors use translated stable codes and never server messages or HTML', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: {
    code: 'database_unavailable', message: '<img src=x onerror=alert(1)>',
  } }, { status: 503 })))
  open('/app', user)
  expect(await screen.findByText('The service is unavailable right now. Try again later.')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
  expect(screen.queryByText(/onerror/)).not.toBeInTheDocument()
})

test('network failure shows the app-wide banner, which clears after reconnecting', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValue(Response.json({ status: 'ok' }))
  vi.stubGlobal('fetch', fetchMock)
  open('/')
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  act(() => window.dispatchEvent(new Event('online')))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  new Response('<html>Bad Gateway</html>', { status: 502 }),
  Response.json({ status: 'down' }),
])('malformed health response shows no connection', async (response) => {
  vi.stubGlobal('fetch', vi.fn(async () => response))
  open('/estado-api')
  expect(await screen.findByText('API: sin conexión')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
})

test('offline event remains visible across pages and disables account actions on landing', () => {
  open('/')
  act(() => window.dispatchEvent(new Event('offline')))
  expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByRole('link', { name: 'Iniciar sesión' }))
  expect(screen.getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Ayuda para instalar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
})

test('API health request uses JSON and cannot use the browser HTTP cache', () => {
  open('/')
  expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({
    headers: { Accept: 'application/json' }, cache: 'no-store', signal: expect.any(AbortSignal),
  }))
})

test('a hanging health request becomes offline after ten seconds', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
  try {
    open('/')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
  } finally {
    vi.useRealTimers()
  }
})

test('skip link targets the main landmark and unknown routes have a translated error', () => {
  open('/unknown')
  expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#main')
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument()
})
