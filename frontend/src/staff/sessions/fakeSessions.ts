// Test data for S-01, S-02 and S-03 (#26). Only the test files import this module. Fake people only.

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const camilaVisit = {
  id: 11,
  started_at: minutesAgo(74),
  name: 'Camila Rivera Santiago',
  type: 'athlete',
  sport: 'Baloncesto femenino',
  has_photo: true,
}

export const luisVisit = {
  id: 12,
  started_at: minutesAgo(38),
  name: 'Luis Méndez',
  type: 'student',
  sport: null,
  has_photo: true,
}

export const camila = {
  user_id: 7,
  name: 'Camila Rivera Santiago',
  student_number: '802612345',
  type: 'athlete',
  sport: 'Baloncesto femenino',
  authorization: { current: true, term: 'Agosto - diciembre 2026' },
  waiver: { accepted_at: '2026-08-12T14:00:00Z', version: '3' },
  photo_pending: false,
  has_photo: true,
  active_session: null as null | { id: number; started_at: string },
}

export const camilaDetail = {
  session: { id: 11, started_at: camilaVisit.started_at, status: 'active', ended_at: null, end_reason: null },
  person: {
    ...camila,
    emergency_contact: { name: 'Marisol Santiago', phone: '787-555-0146' },
    active_session: { id: 11, started_at: camilaVisit.started_at },
  },
}

export function sessions(list: object[]) {
  return () => new Response(JSON.stringify({ sessions: list }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
