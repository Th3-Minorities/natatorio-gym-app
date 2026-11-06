/// <reference types="node" />
import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'
import { serviceWorkerSource } from '../service-worker'

function worker() {
  const listeners = new Map<string, (event: unknown) => void>()
  const shell = new Response('<html>shell</html>')
  const match = vi.fn(async () => shell)
  const addAll = vi.fn(async () => {})
  const cache = { match, addAll }
  const caches = {
    open: vi.fn(async () => cache),
    keys: async () => ['natatorio-shell-old', 'another-app'],
    delete: vi.fn(async () => true),
  }
  const fetch = vi.fn(async () => new Response('network'))
  runInNewContext(serviceWorkerSource(['/index.html', '/assets/app.js'], 'new'), {
    self: {
      addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
      location: { origin: 'https://gym.test' },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    }, caches, fetch, URL,
  })
  return { listeners, caches, fetch, match, addAll, shell }
}

test.each(['/api', '/api/health', '/api/accounts?locale=en'])('worker never reads cached API responses for %s', async (path) => {
  const { listeners, fetch, caches } = worker()
  const request = { url: `https://gym.test${path}`, method: 'GET', mode: 'navigate' }
  let response: Promise<Response> | undefined
  listeners.get('fetch')!({ request, respondWith: (value: Promise<Response>) => { response = value } })
  await response
  expect(fetch).toHaveBeenCalledWith(request, { cache: 'no-store' })
  expect(caches.open).not.toHaveBeenCalled()
})

test('API failure rejects instead of returning an offline HTML shell', async () => {
  const { listeners, fetch, caches } = worker()
  fetch.mockRejectedValueOnce(new TypeError('offline'))
  let response: Promise<Response> | undefined
  listeners.get('fetch')!({
    request: { url: 'https://gym.test/api/health', method: 'POST', mode: 'cors' },
    respondWith: (value: Promise<Response>) => { response = value },
  })
  await expect(response).rejects.toThrow('offline')
  expect(caches.open).not.toHaveBeenCalled()
})

test('offline app navigation uses the precached shell', async () => {
  const { listeners, fetch, match, shell } = worker()
  fetch.mockRejectedValueOnce(new TypeError('offline'))
  let response: Promise<Response> | undefined
  listeners.get('fetch')!({
    request: { url: 'https://gym.test/install', method: 'GET', mode: 'navigate' },
    respondWith: (value: Promise<Response>) => { response = value },
  })
  expect(await response).toBe(shell)
  expect(match).toHaveBeenCalledWith('/index.html')
})

test('install precaches only build files and activation removes only older app caches', async () => {
  const { listeners, caches, addAll } = worker()
  let work: Promise<unknown> | undefined
  const event = { waitUntil: (promise: Promise<unknown>) => { work = promise } }
  listeners.get('install')!(event)
  await work
  expect(addAll).toHaveBeenCalledWith(['/index.html', '/assets/app.js'])
  listeners.get('activate')!(event)
  await work
  expect(caches.delete).toHaveBeenCalledExactlyOnceWith('natatorio-shell-old')
})
