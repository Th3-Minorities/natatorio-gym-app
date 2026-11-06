import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

// The page only talks to the API through fetch, so each test fakes fetch with one real answer shape.
function fakeFetch(answer: () => Promise<Response>) {
  const fetchMock = vi.fn(answer)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the waiting text while the API has not answered', () => {
  fakeFetch(() => new Promise<Response>(() => {}))

  render(<App />)

  expect(screen.getByText('Comprobando la API...')).toBeInTheDocument()
})

test('calls the health check with JSON accept header', () => {
  const fetchMock = fakeFetch(() => new Promise<Response>(() => {}))

  render(<App />)

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/health',
    expect.objectContaining({ headers: { Accept: 'application/json' } }),
  )
})

test('shows connected when the API answers ok', async () => {
  fakeFetch(async () => jsonResponse({ status: 'ok' }, 200))

  render(<App />)

  expect(await screen.findByText('API: conectada')).toBeInTheDocument()
})

test('shows the error code and never the message', async () => {
  fakeFetch(async () =>
    jsonResponse({ error: { code: 'database_unavailable', message: 'Mensaje interno' } }, 503),
  )

  render(<App />)

  expect(await screen.findByText('API: error (database_unavailable)')).toBeInTheDocument()
  expect(screen.queryByText(/Mensaje interno/)).not.toBeInTheDocument()
})

test('shows no connection when the request fails', async () => {
  fakeFetch(async () => {
    throw new TypeError('Failed to fetch')
  })

  render(<App />)

  expect(await screen.findByText('API: sin conexión')).toBeInTheDocument()
})

test('shows no connection when the proxy answers with an HTML page', async () => {
  fakeFetch(
    async () =>
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
  )

  render(<App />)

  expect(await screen.findByText('API: sin conexión')).toBeInTheDocument()
})

test('shows no connection when ok status has an unexpected body', async () => {
  fakeFetch(async () => jsonResponse({ status: 'down' }, 200))

  render(<App />)

  expect(await screen.findByText('API: sin conexión')).toBeInTheDocument()
})
