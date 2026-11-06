/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  for (const path of ['/', '/sign-in', '/install', '/dashboard/sign-in', '/schedules', '/notices', '/estado-api']) {
    test(`base ${path} at ${width}px has no WCAG AA violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const audit = await new AxeBuilder({ page }).withTags([
        'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa',
      ]).analyze()
      expect(audit.violations).toEqual([])
      await expect(page.locator('html')).toHaveAttribute('lang', 'es')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
}

test('keyboard skip link moves focus to main and client navigation focuses the new page', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await page.getByRole('link', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenida' })).toBeVisible()
})

test('built worker opens the shell offline and never stores any API response', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
  const onlineHealth = await page.evaluate(async () => {
    const response = await fetch('/api/health')
    await fetch('/api/missing')
    await fetch('/api/health', { method: 'POST' })
    return response.json()
  })
  expect(onlineHealth).toEqual({ status: 'ok' })
  const cached = await page.evaluate(async () => {
    const names = await caches.keys()
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()))
    return requests.flat().map((request) => new URL(request.url).pathname)
  })
  expect(cached).toContain('/index.html')
  for (const path of ['/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png']) {
    expect(cached).toContain(path)
  }
  expect(cached.some((path) => path === '/api' || path.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  try {
    // This path has never been loaded. The fallback must be the precached shell.
    await page.goto('/install')
    await expect(page.getByRole('heading', { level: 1, name: 'Ayuda para instalar' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Sin conexión')
    for (const path of ['/api', '/api/health', '/api/missing']) {
      expect(await page.evaluate(async (url) => {
        try { await fetch(url); return false } catch { return true }
      }, path)).toBe(true)
    }
  } finally {
    await context.setOffline(false)
  }
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('static manifest and launcher icons are available at the required sizes', async ({ page }) => {
  await page.goto('/')
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!
    return await (await fetch(link.href)).json() as {
      display: string; start_url: string; icons: { sizes: string; src: string }[]
    }
  })
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect(appleIcon).toBe('/icon-180.png')
  const icons = [{ sizes: '180x180', src: appleIcon! }, ...manifest.icons]
  for (const size of [180, 192, 512]) {
    const icon = icons.find((item: { sizes: string }) => item.sizes === `${size}x${size}`)
    expect(icon).toBeTruthy()
    if (!icon) throw new Error(`Missing ${size}px icon`)
    expect(icon.src).toBe(`/icon-${size}.png`)
    const dimensions = await page.evaluate((src: string) => new Promise<number[]>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight])
      image.onerror = reject
      image.src = src
    }), icon.src)
    expect(dimensions).toEqual([size, size])
  }
})
