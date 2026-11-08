/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

// Runs against the built app through the proxy: the service worker only exists in the production build.

test('manifest and launcher icons are linked and served (REQ-F-66)', async ({ page }) => {
  await page.goto('/install')
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!
    return await (await fetch(link.href)).json() as { name: string; display: string; start_url: string; icons: { sizes: string; src: string }[] }
  })
  expect(manifest).toMatchObject({ name: 'Gimnasio RUM', display: 'standalone', start_url: '/account' })
  expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(['192x192', '192x192', '512x512', '512x512'])
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/icon-180.png')
  for (const path of ['/icon-180.png', '/icon-192.png', '/icon-512.png']) {
    expect((await page.request.get(path)).headers()['content-type']).toBe('image/png')
  }
  expect((await page.request.get('/sw.js')).headers()['cache-control']).toBe('no-cache')
})

test('the service worker precaches the app, never the API, and N-09 opens without connection', async ({ page, context }) => {
  await page.goto('/welcome')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
  await page.evaluate(() => fetch('/api/health'))
  const cached = await page.evaluate(async () => {
    const paths: string[] = []
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname)
    return paths
  })
  expect(cached).toContain('/index.html')
  expect(cached.some((path) => path === '/api' || path.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  try {
    await page.goto('/install')
    await expect(page.getByRole('heading', { level: 1, name: 'Instala la app' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
