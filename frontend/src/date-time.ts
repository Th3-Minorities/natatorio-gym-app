const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: 'numeric', minute: '2-digit', hour12: true,
})

export function formatDateTime(value: string | Date): string {
  const parts = formatter.formatToParts(typeof value === 'string' ? new Date(value) : value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} ${part('dayPeriod')}`
}
