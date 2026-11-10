import type { ReactNode } from 'react'
import { useDateFormat } from '../../format/dateTime'
import { useMessages } from '../../i18n'
import { PersonPhoto } from './StaffParts'

// The identity block of S-02 and S-03 (Figma 121:3317, 4283:1139): photo, name, student number, type, sport and
// authorization, term and waiver. Only what Staff may see (REQ-NF-19); the emergency contact is S-02's extra.

export type Person = {
  user_id: number
  name: string | null
  student_number: string | null
  type: 'athlete' | 'student' | 'employee' | 'manual' | null
  sport: string | null
  authorization: { current: boolean; term: string | null }
  waiver: { accepted_at: string; version: string } | null
  photo_pending: boolean
  has_photo: boolean
  active_session: { id: number; started_at: string } | null
  masked_email?: string | null
}

export function PersonCard({ person, photo, extra, onPhotoSettled, showLoadingCaption }: {
  person: Person
  photo: string | null
  extra?: ReactNode
  onPhotoSettled?: (loaded: boolean) => void
  showLoadingCaption?: boolean
}) {
  const texts = useMessages()
  const t = texts.sessionDetail
  const dates = useDateFormat()
  const authorization = person.authorization.current ? t.authorizationActive : t.authorizationNone

  return (
    <section className="person-card" aria-label={person.name ?? t.photo}>
      <PersonPhoto key={photo} src={photo} name={person.name} size="large" onSettled={onPhotoSettled} showLoadingCaption={showLoadingCaption} />
      <div className="person-card__body">
        <h2 className="person-card__name">{person.name}</h2>
        {person.student_number && <p className="person-card__muted">{t.studentNumber(person.student_number)}</p>}
        {person.type && <span className="team-chip team-chip--invited-outline">{texts.activeSessions.types[person.type]}</span>}
        <p className="person-card__line person-card__line--strong">
          {person.sport ? `${person.sport} · ${authorization}` : authorization}
        </p>
        {person.authorization.term && <p className="person-card__muted">{t.term(person.authorization.term)}</p>}
        {person.waiver && <p className="person-card__line">{t.waiver(dates.date(person.waiver.accepted_at), person.waiver.version)}</p>}
        {extra}
      </div>
    </section>
  )
}
