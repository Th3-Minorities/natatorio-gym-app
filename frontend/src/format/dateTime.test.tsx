import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { formatDate, formatDateTime, formatTime, useDateFormat } from './dateTime'

// REQ-NF-38 (E-152): the short form of each language, as in the Figma wireframes.
// REQ-NF-37: in Puerto Rico time. The API sends UTC (docs/design/api-conventions.md).

const NOV_5_830_AM = '2026-11-05T12:30:00Z'
const LATER_DAY = new Date('2026-11-09T15:00:00Z')

describe('formatDateTime', () => {
  it('writes a past day as in Figma, in Spanish and in English', () => {
    expect(formatDateTime(NOV_5_830_AM, 'es', LATER_DAY)).toBe('5 nov 2026, 8:30 a. m.')
    expect(formatDateTime(NOV_5_830_AM, 'en', LATER_DAY)).toBe('Nov 5, 2026, 8:30 AM')
  })

  it('writes a time from today as "Hoy" or "Today"', () => {
    const now = new Date('2026-11-05T15:00:00Z')

    expect(formatDateTime('2026-11-05T14:42:00Z', 'es', now)).toBe('Hoy, 10:42 a. m.')
    expect(formatDateTime('2026-11-05T14:42:00Z', 'en', now)).toBe('Today, 10:42 AM')
  })

  it('decides "today" in Puerto Rico, not in UTC, between 8 PM and midnight', () => {
    // 9:30 PM on November 5 in Puerto Rico is already November 6 in UTC.
    const visit = '2026-11-06T01:30:00Z'

    expect(formatDateTime(visit, 'es', new Date('2026-11-06T02:00:00Z'))).toBe('Hoy, 9:30 p. m.')
    expect(formatDateTime(visit, 'es', new Date('2026-11-06T12:00:00Z'))).toBe('5 nov 2026, 9:30 p. m.')
  })

  it("reads Laravel's dates with six decimals", () => {
    expect(formatDateTime('2026-11-05T12:30:00.000000Z', 'es', LATER_DAY)).toBe('5 nov 2026, 8:30 a. m.')
  })

  it('accepts a Date', () => {
    expect(formatDateTime(new Date(NOV_5_830_AM), 'en', LATER_DAY)).toBe('Nov 5, 2026, 8:30 AM')
  })

  it('refuses a value that is not a date, instead of showing "Invalid Date"', () => {
    expect(() => formatDateTime('not a date', 'es')).toThrow(RangeError)
  })
})

describe('formatDate and formatTime', () => {
  it('give the date or the time alone, as in Figma', () => {
    expect(formatDate('2026-08-12T16:00:00Z', 'es')).toBe('12 ago 2026')
    expect(formatDate('2026-08-12T16:00:00Z', 'en')).toBe('Aug 12, 2026')
    expect(formatTime('2026-11-05T13:28:00Z', 'es')).toBe('9:28 a. m.')
    expect(formatTime('2026-11-05T13:28:00Z', 'en')).toBe('9:28 AM')
  })

  it('writes midnight and noon as 12', () => {
    expect(formatTime('2026-11-05T04:00:00Z', 'es')).toBe('12:00 a. m.')
    expect(formatTime('2026-11-05T16:00:00Z', 'en')).toBe('12:00 PM')
  })

  it('uses plain spaces, so every browser shows the same text', () => {
    // Some browsers put a narrow no-break space before AM/PM.
    expect(formatDateTime(NOV_5_830_AM, 'en', LATER_DAY)).not.toMatch(/[  ]/)
    expect(formatTime(NOV_5_830_AM, 'es')).not.toMatch(/[  ]/)
  })
})

function Probe({ value }: { value: string }) {
  const dates = useDateFormat()
  return <p>{dates.dateTime(value, LATER_DAY)}</p>
}

describe('useDateFormat', () => {
  it('formats in the account language', () => {
    render(
      <I18nProvider locale="en">
        <Probe value={NOV_5_830_AM} />
      </I18nProvider>,
    )

    expect(screen.getByText('Nov 5, 2026, 8:30 AM')).toBeInTheDocument()
  })

  it('is Spanish by default', () => {
    render(<Probe value={NOV_5_830_AM} />)

    expect(screen.getByText('5 nov 2026, 8:30 a. m.')).toBeInTheDocument()
  })
})
