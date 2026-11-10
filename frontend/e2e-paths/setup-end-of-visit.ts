import { expect, type APIRequest, type APIRequestContext } from '@playwright/test'
import { ADMIN, api, INSIDE, STAFF } from '../e2e/flows/flow.ts'
import { rawApi, tinker, tinkerJson, type Member } from './setup.ts'

// Helpers of the End of a visit path tests (end-of-visit.spec.ts). The staff check-out screen is not built, so the desk is the API.

export type Desk = { context: APIRequestContext; baseURL: string }

/** A request context signed in as the front desk (Staff by default, Administrator with 'admin'), apart from the phone's cookies. */
export async function deskSignIn(request: APIRequest, baseURL: string | undefined, who: 'staff' | 'admin' | { email: string; password: string } = 'staff'): Promise<Desk> {
  const context = await request.newContext({ baseURL })
  const credentials = who === 'staff' ? STAFF : who === 'admin' ? ADMIN : who
  await api(context, 'post', '/api/staff/sign-in', baseURL!, { email: credentials.email, password: credentials.password })
  return { context, baseURL: baseURL! }
}

/** POST /api/staff/sessions/{id}/check-out, answering whatever status comes back. */
export function checkOutRaw(desk: Desk, id: number | string) {
  return rawApi(desk.context, 'post', `/api/staff/sessions/${id}/check-out`, desk.baseURL)
}

/** The desk checks the visit out and signs out, and the check-out must succeed. */
export async function deskCheckOut(request: APIRequest, baseURL: string | undefined, id: number | string, who: 'staff' | 'admin' = 'staff') {
  const desk = await deskSignIn(request, baseURL, who)
  try {
    const answer = await checkOutRaw(desk, id)
    expect(answer.status, JSON.stringify(answer.body)).toBe(200)
    return answer
  } finally { await desk.context.dispose() }
}

/** Check In through the API as the signed-in member, from inside the gym. Returns the new session id. */
export async function checkInApi(context: APIRequestContext, baseURL: string | undefined): Promise<number> {
  const { body } = await api(context, 'post', '/api/user/check-in', baseURL!, INSIDE)
  return body.session.id
}

export type SessionRow = { status: string; started: number; ends: number; ended: number | null; by: number | null }

/** The stored row of a visit, with times as epoch seconds. */
export function sessionRow(id: number): SessionRow {
  return tinkerJson<SessionRow>(`
$r = \\Illuminate\\Support\\Facades\\DB::selectOne("select status, extract(epoch from started_at)::bigint as started, extract(epoch from ends_at)::bigint as ends,
  extract(epoch from ended_at)::float as ended, checked_out_by_staff_account_id as by from facility_sessions where id = ?", [${id}]);
echo json_encode(['status' => $r->status, 'started' => (int) $r->started, 'ends' => (int) $r->ends, 'ended' => $r->ended === null ? null : (float) $r->ended, 'by' => $r->by === null ? null : (int) $r->by]);`)
}

/** Audit log entries other than staff sign-in and sign-out: a check-out must add none (E-129). */
export function auditEntries(): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\AuditLogEntry::where('action', 'not like', 'staff.sign_%')->count());`)
}

/** R-TERM: the visit began at 11:30 p. m. on the last day of the past term, so the term end closed it at midnight. */
export function moveVisitToPastTermEnd(sessionId: number) {
  tinker(`
$term = \\App\\Models\\AcademicTerm::where('name', 'Término pasado')->firstOrFail();
$x = \\Illuminate\\Support\\Carbon::parse($term->ends_on->toDateString().' 23:30', 'America/Puerto_Rico');
\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->where('id', ${sessionId})->update(['started_at' => $x, 'ends_at' => $x->copy()->addHours(2)]);`)
}

/** A closure dated by the test: `from` and `to` are minutes from now; `created` minutes from now too (default: now). */
export function addClosureAt(from: number, to: number, created = 0): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\ScheduleSlot::factory()->dated()->create(['starts_at' => now()->addMinutes(${from}), 'ends_at' => now()->addMinutes(${to}),
    'created_at' => now()->addMinutes(${created}), 'text_es' => 'p152-closure-ev'])->id);`)
}

/** The moment a closure takes effect (the later of starts_at and created_at), epoch milliseconds. */
export function closureEffective(id: number): number {
  return tinkerJson<number>(`$s = \\App\\Models\\ScheduleSlot::findOrFail(${id}); echo json_encode(max($s->starts_at->getTimestamp(), $s->created_at->getTimestamp()) * 1000);`)
}

/** Moves an athletes-only period so it began a minute ago. */
export function startPeriodNow(id: number) {
  tinker(`\\App\\Models\\ScheduleSlot::where('id', ${id})->update(['starts_at' => now()->subMinute()]);`)
}

/** A throwaway Staff account with the password "password". It stays in the table, deactivated or not. */
export function createStaffAccount(): { id: number; email: string; password: string } {
  const email = `p152-desk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
  const id = tinkerJson<number>(`echo json_encode(\\App\\Models\\StaffAccount::factory()->create(['email' => '${email}'])->id);`)
  return { id, email, password: 'password' }
}

/** The time as the phone writes it ("9:28 a. m."), Puerto Rico time. */
export function phoneTime(epochMs: number, locale: 'es' | 'en' = 'es'): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-PR' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Puerto_Rico' })
    .format(new Date(epochMs)).replace(/[  ]/g, ' ')
}

/** Minutes after midnight of a phone time ("11:30 p. m." or "11:30 PM"). */
export function minutesOfDay(text: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*([ap])/i.exec(text.trim())
  if (!match) throw new Error(`not a phone time: ${text}`)
  return ((Number(match[1]) % 12) + (match[3].toLowerCase() === 'p' ? 12 : 0)) * 60 + Number(match[2])
}

export type { Member }
