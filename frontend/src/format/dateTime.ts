import { messages, useLocale, type Locale } from '../i18n'

// REQ-NF-38 (E-152): dates and times in the short form of each language, as in the Figma wireframes.
// Spanish "5 nov 2026, 8:30 a. m.", English "Nov 5, 2026, 8:30 AM"; a time from today shows "Hoy" or "Today".
// REQ-NF-37: always in Puerto Rico time, whatever the device's time zone.

const TIME_ZONE = 'America/Puerto_Rico'

// Puerto Rico regional formats, which give exactly the forms drawn in Figma.
const INTL_LOCALE: Record<Locale, string> = { es: 'es-PR', en: 'en-US' }

type DateInput = string | Date

function toDate(value: DateInput): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value = `${value}T12:00:00-04:00`
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a date: ${String(value)}`)
  }
  return date
}

/** Some browsers put a narrow no-break space before AM/PM; plain spaces look the same everywhere. */
function plainSpaces(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

function format(value: DateInput, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return plainSpaces(new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: TIME_ZONE }).format(toDate(value)))
}

/** The calendar day in Puerto Rico, to compare days (2026-11-05). */
function puertoRicoDay(value: DateInput): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(toDate(value))
}

/** "5 nov 2026" or "Nov 5, 2026". */
export function formatDate(value: DateInput, locale: Locale): string {
  return format(value, locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "9:28 a. m." or "9:28 AM". */
export function formatTime(value: DateInput, locale: Locale): string {
  return format(value, locale, { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** "2:00–4:00 p. m." or "2:00–4:00 PM", as drawn in the Check In notices (Figma 4097:267). */
export function formatTimeRange(start: DateInput, end: DateInput, locale: Locale): string {
  const range = new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIME_ZONE })
    .formatRange(toDate(start), toDate(end))
  return plainSpaces(range).replace(/\s*–\s*/, '–')
}

/** "Hoy" or "Today" for a time from today in Puerto Rico, otherwise the short date. */
export function formatDay(value: DateInput, locale: Locale, now: Date = new Date()): string {
  return puertoRicoDay(value) === puertoRicoDay(now) ? messages[locale].dates.today : formatDate(value, locale)
}

/** "5 nov 2026, 8:30 a. m.", or "Hoy, 10:42 a. m." for a time from today in Puerto Rico. */
export function formatDateTime(value: DateInput, locale: Locale, now: Date = new Date()): string {
  return `${formatDay(value, locale, now)}, ${formatTime(value, locale)}`
}

/** The three formats in the account language, for screens. */
export function useDateFormat() {
  const locale = useLocale()
  return {
    date: (value: DateInput) => formatDate(value, locale),
    time: (value: DateInput) => formatTime(value, locale),
    dateTime: (value: DateInput, now?: Date) => formatDateTime(value, locale, now),
    day: (value: DateInput, now?: Date) => formatDay(value, locale, now),
    timeRange: (start: DateInput, end: DateInput) => formatTimeRange(start, end, locale),
  }
}
