import { vi } from 'vitest'

// Test helpers for the A-15 screens (#84). Only the test files import this module.

export const term = { name: 'Fall 2026', starts_on: '2026-08-10', ends_on: '2026-12-18' }

export const lorena = { name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', locale: 'es', active_term: term }

export const team = [
  { id: 1, name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', status: 'active' },
  { id: 2, name: 'Mariel Vélez Soto', email: 'mariel@example.com', role: 'staff', status: 'active' },
  { id: 3, name: 'Nayeli Lugo Paz', email: 'nayeli@example.com', role: 'staff', status: 'invited' },
  { id: 4, name: 'Damián Ruiz Solís', email: 'damian@example.com', role: 'staff', status: 'deactivated' },
]

export function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function apiError(code: string, status: number, details?: Record<string, string[]>) {
  return json({ error: details ? { code, details } : { code } }, status)
}

export const offline = () => {
  throw new TypeError('Failed to fetch')
}

type Answer = (body: unknown) => Response | Promise<Response>

/** Routes are "METHOD /api/path"; a bare "/api/path" is a GET. */
export function fakeApi(routes: Record<string, Answer>) {
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const answer = routes[`${method} ${path}`] ?? (method === 'GET' ? routes[path] : undefined)
    if (!answer) throw new Error(`No fake answer for ${method} ${path}`)
    return answer(init?.body ? JSON.parse(String(init.body)) : undefined)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The calls the screen made to one route, as [method, body]. */
export function callsTo(fetchMock: ReturnType<typeof fakeApi>, path: string) {
  return fetchMock.mock.calls
    .filter(([called]) => called === path)
    .map(([, init]) => [init?.method ?? 'GET', init?.body ? JSON.parse(String(init.body)) : undefined] as const)
}

export function goOffline() {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  window.dispatchEvent(new Event('offline'))
}

export function goOnline() {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  window.dispatchEvent(new Event('online'))
}
