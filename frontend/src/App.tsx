import { useEffect, useState } from 'react'

// Test page for issue #48: proves the PWA reaches the API on the same origin.
// The texts move to translation files with the app base issue.
type Health =
  | { kind: 'waiting' }
  | { kind: 'connected' }
  | { kind: 'error'; code: string }
  | { kind: 'offline' }

async function checkHealth(): Promise<Health> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } })
    const body = await response.json()

    if (response.status === 200 && body?.status === 'ok') {
      return { kind: 'connected' }
    }

    // Only the stable code decides what to show, never the message (docs/design/api-conventions.md).
    if (typeof body?.error?.code === 'string') {
      return { kind: 'error', code: body.error.code }
    }
  } catch {
    // No answer, or an answer that is not JSON, like the proxy's 502 page.
  }

  return { kind: 'offline' }
}

function text(health: Health): string {
  switch (health.kind) {
    case 'waiting':
      return 'Comprobando la API...'
    case 'connected':
      return 'API: conectada'
    case 'error':
      return `API: error (${health.code})`
    case 'offline':
      return 'API: sin conexión'
  }
}

export default function App() {
  const [health, setHealth] = useState<Health>({ kind: 'waiting' })

  useEffect(() => {
    // Ignore a late answer after the page is gone (StrictMode runs effects twice in development).
    let ignore = false

    checkHealth().then((result) => {
      if (!ignore) {
        setHealth(result)
      }
    })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <main>
      <p>{text(health)}</p>
    </main>
  )
}
