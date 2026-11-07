import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'

// The API answers JSON under /api with an error code and no text (docs/design/api-conventions.md).
// POSTs need Sanctum's CSRF cookie first (section 6, "Staff sign-in").

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function fakeFetch(...answers: Array<() => Response | Promise<Response>>) {
  const fetchMock = vi.fn()
  for (const answer of answers) fetchMock.mockImplementationOnce(async () => answer())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setCsrfCookie(value: string | null) {
  document.cookie = value === null ? 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' : `XSRF-TOKEN=${value}; path=/`
}

function headersOf(call: unknown[]): Headers {
  return new Headers((call[1] as RequestInit).headers)
}

beforeEach(() => setCsrfCookie(null))
afterEach(() => vi.unstubAllGlobals())

describe('apiRequest', () => {
  it('reads JSON from /api with the JSON accept header', async () => {
    const fetchMock = fakeFetch(() => json({ name: 'Ana' }))

    await expect(apiRequest('/staff/me')).resolves.toEqual({ name: 'Ana' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/staff/me')
    expect(headersOf(fetchMock.mock.calls[0]).get('Accept')).toBe('application/json')
  })

  it('answers nothing for a 204', async () => {
    setCsrfCookie('token')
    fakeFetch(() => new Response(null, { status: 204 }))

    await expect(apiRequest('/staff/sign-out', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('gets the CSRF cookie before the first POST and sends it back decoded', async () => {
    const fetchMock = fakeFetch(
      () => {
        setCsrfCookie('abc%3D%3D')
        return new Response(null, { status: 204 })
      },
      () => json({ name: 'Ana' }),
    )

    await apiRequest('/staff/sign-in', { method: 'POST', body: { email: 'a@example.com', password: 'x' } })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/sanctum/csrf-cookie')
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/staff/sign-in')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'a@example.com', password: 'x' }))
    expect(headersOf(fetchMock.mock.calls[1]).get('X-XSRF-TOKEN')).toBe('abc==')
    expect(headersOf(fetchMock.mock.calls[1]).get('Content-Type')).toBe('application/json')
  })

  it('does not ask for the CSRF cookie again when it already has one', async () => {
    setCsrfCookie('token')
    const fetchMock = fakeFetch(() => new Response(null, { status: 204 }))

    await apiRequest('/staff/sign-out', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gets a new CSRF cookie and tries once more when the token expired (419)', async () => {
    setCsrfCookie('old')
    const fetchMock = fakeFetch(
      () => json({ error: { code: 'session_expired' } }, 419),
      () => {
        setCsrfCookie('new')
        return new Response(null, { status: 204 })
      },
      () => new Response(null, { status: 204 }),
    )

    await apiRequest('/staff/sign-out', { method: 'POST' })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/staff/sign-out',
      '/api/sanctum/csrf-cookie',
      '/api/staff/sign-out',
    ])
    expect(headersOf(fetchMock.mock.calls[2]).get('X-XSRF-TOKEN')).toBe('new')
  })

  it('marks a request the screen makes by itself, so it does not count as activity (E-130)', async () => {
    const fetchMock = fakeFetch(() => json({}))

    await apiRequest('/staff/me', { autoRefresh: true })

    expect(headersOf(fetchMock.mock.calls[0]).get('X-Auto-Refresh')).toBe('1')
  })

  it('does not mark requests a person started', async () => {
    const fetchMock = fakeFetch(() => json({}))

    await apiRequest('/staff/me')

    expect(headersOf(fetchMock.mock.calls[0]).has('X-Auto-Refresh')).toBe(false)
  })
})

describe('errors', () => {
  it('become an ApiError with the code and status, never the server text', async () => {
    setCsrfCookie('token')
    fakeFetch(() => json({ error: { code: 'staff_credentials_invalid' } }, 422))

    const error = (await apiRequest('/staff/sign-in', { method: 'POST', body: {} }).catch((e) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'staff_credentials_invalid', status: 422 })
  })

  it('keep the field details of a validation error', async () => {
    setCsrfCookie('token')
    fakeFetch(() => json({ error: { code: 'validation_failed', details: { email: ['required'] } } }, 422))

    const error = (await apiRequest('/staff/sign-in', { method: 'POST', body: {} }).catch((e) => e)) as ApiError

    expect(error.details).toEqual({ email: ['required'] })
  })

  it('carry the seconds to wait after too many tries (REQ-F-07)', async () => {
    setCsrfCookie('token')
    fakeFetch(() => json({ error: { code: 'too_many_requests' } }, 429, { 'Retry-After': '300' }))

    const error = (await apiRequest('/staff/sign-in', { method: 'POST', body: {} }).catch((e) => e)) as ApiError

    expect(error).toMatchObject({ code: 'too_many_requests', retryAfter: 300 })
  })

  it('are "offline" when the request does not reach the server', async () => {
    fakeFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    await expect(apiRequest('/staff/me')).rejects.toMatchObject({ code: 'offline', status: 0 })
  })

  it('are "offline" when the proxy answers its own HTML error page', async () => {
    fakeFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))

    await expect(apiRequest('/staff/me')).rejects.toMatchObject({ code: 'offline', status: 502 })
  })
})
