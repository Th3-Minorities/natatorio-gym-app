// Only the build's static files enter Cache Storage. No runtime response is ever stored.
export function serviceWorkerSource(files: string[], version: string): string {
  return `
const CACHE = ${JSON.stringify(`natatorio-shell-${version}`)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names
    .filter((name) => name.startsWith('natatorio-shell-') && name !== CACHE)
    .map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Non-GET requests go straight to the network: Safari can drop a File body when a service worker re-sends a multipart POST (Discussion #142).
  if (request.method !== 'GET') return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('/index.html'))));
    return;
  }
  if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(url.pathname)).then((cached) => cached || fetch(request)));
  }
});
`
}
