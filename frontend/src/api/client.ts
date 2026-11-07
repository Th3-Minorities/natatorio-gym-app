// The one place screens call the API from (docs/design/api-conventions.md).
// Errors come back as a code only; screens show them with errorText() and fieldErrorText() from ../i18n.

/** An API error: the stable code, the HTTP status (0 when the request never reached the server) and extras. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  /** Field rules for validation_failed, like { email: ['required'] }. */
  readonly details?: Record<string, string[]>
  /** Seconds to wait, from Retry-After, after too many tries (REQ-F-07). */
  readonly retryAfter?: number

  constructor(code: string, status: number, details?: Record<string, string[]>, retryAfter?: number) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.retryAfter = retryAfter
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** A request the screen made by itself, like a refresh. It does not keep a staff sign-in alive (E-130). */
  autoRefresh?: boolean
}

const CSRF_COOKIE = 'XSRF-TOKEN'

function csrfToken(): string | null {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(`${CSRF_COOKIE}=`))
  const value = cookie?.slice(CSRF_COOKIE.length + 1)
  return value ? decodeURIComponent(value) : null
}

/** Sanctum sets the CSRF cookie that every POST, PUT, PATCH and DELETE must send back (section 6). */
async function refreshCsrfCookie(): Promise<void> {
  await send('/sanctum/csrf-cookie', 'GET', {})
}

async function send(path: string, method: string, headers: Record<string, string>, body?: string): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { method, headers: { Accept: 'application/json', ...headers }, body })
  } catch {
    throw new ApiError('offline', 0)
  }
}

async function toError(response: Response): Promise<ApiError> {
  // Anything that is not our JSON error, like the proxy's 502 page, means the API is not reachable.
  const body = await response.json().catch(() => null)
  const error = body?.error
  if (typeof error?.code !== 'string') return new ApiError('offline', response.status)

  const retryAfter = Number(response.headers.get('Retry-After'))
  return new ApiError(error.code, response.status, error.details, retryAfter > 0 ? retryAfter : undefined)
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const changesData = method !== 'GET'
  const body = options.body === undefined ? undefined : JSON.stringify(options.body)

  const attempt = async () => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.autoRefresh) headers['X-Auto-Refresh'] = '1'
    if (changesData) {
      if (csrfToken() === null) await refreshCsrfCookie()
      headers['X-XSRF-TOKEN'] = csrfToken() ?? ''
    }
    return send(path, method, headers, body)
  }

  let response = await attempt()
  if (response.status === 419 && changesData) {
    // The CSRF token expired: get a new one and try once more.
    await refreshCsrfCookie()
    response = await attempt()
  }

  if (!response.ok) throw await toError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
