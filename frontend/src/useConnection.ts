import { useEffect, useState } from 'react'

type Health = { kind: 'waiting' | 'connected' | 'offline' } | { kind: 'error'; code: string }

export function useConnection() {
  const [health, setHealth] = useState<Health>({ kind: navigator.onLine ? 'waiting' : 'offline' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stopped = false
    let generation = 0
    let controller: AbortController | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    async function check() {
      const current = ++generation
      controller?.abort()
      clearTimeout(timeout)
      if (!navigator.onLine) {
        setHealth({ kind: 'offline' })
        return
      }
      controller = new AbortController()
      const signal = controller.signal
      const deadline = new Promise<Health>((resolve) => {
        timeout = setTimeout(() => {
          resolve({ kind: 'offline' })
          controller?.abort()
        }, 10_000)
      })
      const request = async (): Promise<Health> => {
        try {
          const response = await fetch('/api/health', {
            headers: { Accept: 'application/json' }, cache: 'no-store', signal,
          })
          const body = await response.json()
          if (response.status === 200 && body?.status === 'ok') return { kind: 'connected' }
          if (typeof body?.error?.code === 'string') return { kind: 'error', code: body.error.code }
        } catch {
          // Network errors, timeouts and HTML proxy errors all mean no API connection.
        }
        return { kind: 'offline' }
      }
      const result = await Promise.race([request(), deadline])
      if (!stopped && current === generation) {
        clearTimeout(timeout)
        setHealth(result)
      }
    }

    const offline = () => {
      generation++
      controller?.abort()
      clearTimeout(timeout)
      setHealth({ kind: 'offline' })
    }
    void check()
    const poll = setInterval(() => { void check() }, 25_000)
    window.addEventListener('online', check)
    window.addEventListener('offline', offline)
    return () => {
      stopped = true
      generation++
      controller?.abort()
      clearTimeout(timeout)
      clearInterval(poll)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', offline)
    }
  }, [attempt])

  return { health, retry: () => setAttempt((value) => value + 1) }
}
