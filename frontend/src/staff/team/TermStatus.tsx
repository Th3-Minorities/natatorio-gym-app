import { useId } from 'react'
import { useLocale, useMessages } from '../../i18n'
import { useStaffSession, type ActiveTerm } from '../useStaffSession'
import './staffTeam.css'

// The active term as the Administrator pages show it: a chip with the term and "Acceso del equipo", or the
// "Sin término activo" banner (Figma 100:841 and 100:1297). It reads the term from the staff session.

/** "Agosto - diciembre 2026": the months of the first and last day and their year. Two years: "Diciembre 2026 - mayo 2027". */
function termLabel(term: ActiveTerm, locale: string): string {
  const month = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const first = month(term.starts_on)
  const [startYear, endYear] = [term.starts_on.slice(0, 4), term.ends_on.slice(0, 4)]
  const start = `${first.charAt(0).toLocaleUpperCase(locale)}${first.slice(1)}`
  return startYear === endYear
    ? `${start} - ${month(term.ends_on)} ${endYear}`
    : `${start} ${startYear} - ${month(term.ends_on)} ${endYear}`
}

export function TermStatus() {
  const texts = useMessages().staffTeam
  const locale = useLocale()
  const titleId = useId()
  const { state } = useStaffSession()
  if (state.status !== 'signedIn') return null
  const term = state.account.active_term

  if (!term) {
    return (
      <section className="state" aria-labelledby={titleId}>
        <span className="team-chip team-chip--invited-outline">{texts.noTermChip}</span>
        <h2 className="state__title" id={titleId}>
          {texts.noTermTitle}
        </h2>
        <p className="state__detail">{texts.noTermText}</p>
      </section>
    )
  }

  return (
    <div className="team-term">
      <span className="team-chip team-chip--invited-outline">{termLabel(term, locale)}</span>
      <span className="team-term__text">{texts.termAccess}</span>
    </div>
  )
}
