// Small helpers S-01, S-02 and S-03 share (#26).

/** "CR" for Camila Rivera Santiago: the placeholder Figma draws until the photo loads (121:3059). */
export function initials(name: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Minutes between two moments, never below zero. */
export function minutesBetween(from: string, to: number = Date.now()): number {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / 60_000))
}
