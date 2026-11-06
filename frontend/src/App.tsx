import { useEffect, useState } from 'react'
import { useMessages, type Messages } from './i18n'

// Test page for issue #48: proves the PWA reaches the API on the same origin.
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

function text(health: Health, texts: Messages['health']): string {
  switch (health.kind) {
    case 'waiting':
      return texts.waiting
    case 'connected':
      return texts.connected
    case 'error':
      return texts.error(health.code)
    case 'offline':
      return texts.offline
  }
}

export default function App() {
  const texts = useMessages().health
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
      <p>{text(health, texts)}</p>
    </main>
  )
}
