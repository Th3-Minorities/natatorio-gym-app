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

/** text: the words after the chip; A-15 says "Acceso del equipo", A-05 "Lista continua entre términos". */
export function TermStatus({ text }: { text?: string } = {}) {
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
      <span className="team-term__text">{text ?? texts.termAccess}</span>
    </div>
  )
}

/** Only the active term's chip, as the A-04 and A-05 modals draw it at the top (Figma 101:1737, 101:1084). */
export function TermChip({ className }: { className?: string }) {
  const locale = useLocale()
  const { state } = useStaffSession()
  const term = state.status === 'signedIn' ? state.account.active_term : null
  if (!term) return null
  return <span className={['team-chip team-chip--invited-outline', className].filter(Boolean).join(' ')}>{termLabel(term, locale)}</span>
}
