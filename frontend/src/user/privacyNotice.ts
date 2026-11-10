// The last privacy notice response, kept so the account page can show it offline (N-08).
export type Privacy = { version: string; draft: boolean; store_url: string | null; contact_number: string }

const KEY = 'privacy-notice'

export function storedPrivacy(): Privacy | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return null
    const notice = value as Record<string, unknown>
    return typeof notice.version === 'string' && typeof notice.draft === 'boolean' ? notice as Privacy : null
  } catch { return null }
}

export function storePrivacy(notice: Privacy) {
  try { localStorage.setItem(KEY, JSON.stringify(notice)) } catch { /* The notice still shows until the page reloads. */ }
}
