import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { StaffSessionContext, type ActiveTerm, type StaffSession } from '../useStaffSession'
import { TermStatus } from './TermStatus'

// The term chip of A-15 (Figma 100:841): months in the account language, the year once or on both dates.

function show(locale: string, active_term: ActiveTerm | null) {
  const session: StaffSession = {
    state: { status: 'signedIn', account: { name: 'Lorena Ortiz', email: 'lorena@example.com', role: 'admin', locale, active_term } },
    signIn: async () => {},
    signOut: async () => {},
    retry: async () => {},
    reportError: () => {},
  }
  render(
    <StaffSessionContext.Provider value={session}>
      <I18nProvider locale={locale}>
        <TermStatus />
      </I18nProvider>
    </StaffSessionContext.Provider>,
  )
}

describe('the term chip', () => {
  it('names the year once when the term ends in the year it starts', () => {
    show('es', { name: 'Fall 2026', starts_on: '2026-08-10', ends_on: '2026-12-18' })
    expect(screen.getByText('Agosto - diciembre 2026')).toBeInTheDocument()
  })

  it('names both years when the term crosses into the next one', () => {
    show('es', { name: 'Winter', starts_on: '2026-12-01', ends_on: '2027-05-15' })
    expect(screen.getByText('Diciembre 2026 - mayo 2027')).toBeInTheDocument()
  })

  it('does the same in English', () => {
    show('en', { name: 'Fall 2026', starts_on: '2026-08-10', ends_on: '2026-12-18' })
    expect(screen.getByText('August - December 2026')).toBeInTheDocument()
  })

  it('names both years in English when the term crosses into the next one', () => {
    show('en', { name: 'Winter', starts_on: '2026-12-01', ends_on: '2027-05-15' })
    expect(screen.getByText('December 2026 - May 2027')).toBeInTheDocument()
  })
})
