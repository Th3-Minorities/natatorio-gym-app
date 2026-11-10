import { tinker, tinkerJson } from './setup.ts'

// Helpers of the Gym ID and occupancy path tests (gym-id-occupancy.spec.ts). Occupancy is global, so a test that needs an
// exact count first voids every counted visit (and puts them back afterwards), then adds throwaway visits.

/** The count the occupancy endpoint reports right now, read through the same service. */
export function occupancyNow(): number {
  return tinkerJson<number>(`echo json_encode(app(\\App\\Services\\FacilitySessions::class)->occupancy(now()));`)
}

export type Occupancy = { voided: number[]; sessions: number[]; users: number[] }

/**
 * Makes the occupancy exactly `n`: every counted visit becomes void, then `n` throwaway open visits are added.
 * Call release() in a finally block.
 */
export function setOccupancy(n: number): Occupancy {
  return tinkerJson<Occupancy>(`
$voided = \\App\\Models\\FacilitySession::where('status', 'active')->where('ends_at', '>', now())->pluck('id')->all();
\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->whereIn('id', $voided)->update(['status' => 'void', 'ended_at' => \\Illuminate\\Support\\Facades\\DB::raw('started_at')]);
$rows = ${n} > 0 ? \\App\\Models\\FacilitySession::factory()->startedMinutesAgo(10)->count(${n})->create() : collect();
echo json_encode(['voided' => $voided, 'sessions' => $rows->pluck('id')->all(), 'users' => $rows->pluck('user_id')->all()]);`)
}

/** Deletes the throwaway visits and users, and re-opens the visits setOccupancy() voided. */
export function release(state: Occupancy) {
  tinker(`
\\App\\Models\\FacilitySession::whereIn('id', ${JSON.stringify(state.sessions)})->delete();
\\App\\Models\\User::whereIn('id', ${JSON.stringify(state.users)})->delete();
\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->whereIn('id', ${JSON.stringify(state.voided)})->where('status', 'void')->update(['status' => 'active', 'ended_at' => null]);`)
}

/** Adds one throwaway open visit for a fresh user and returns it (for aging); release() it with the returned ids. */
export function addVisit(): { session: number; user: number } {
  return tinkerJson<{ session: number; user: number }>(`
$s = \\App\\Models\\FacilitySession::factory()->startedMinutesAgo(10)->create();
echo json_encode(['session' => $s->id, 'user' => $s->user_id]);`)
}

export function dropVisit(visit: { session: number; user: number }) {
  tinker(`\\App\\Models\\FacilitySession::where('id', ${visit.session})->delete(); \\App\\Models\\User::where('id', ${visit.user})->delete();`)
}

/** R-AGE: moves a visit so it began `interval` ago (SQL interval text), keeping the two-hour rule between start and end. */
export function ageVisit(sessionId: number, interval: string) {
  tinker(`\\Illuminate\\Support\\Facades\\DB::statement("UPDATE facility_sessions SET started_at = date_trunc('second', now()) - interval '${interval}', ends_at = date_trunc('second', now()) - interval '${interval}' + interval '2 hours' WHERE id = ${sessionId}");`)
}

/** Ages the open visit of a user (all active ones). */
export function ageUserVisit(userId: number, interval: string) {
  tinker(`\\Illuminate\\Support\\Facades\\DB::statement("UPDATE facility_sessions SET started_at = date_trunc('second', now()) - interval '${interval}', ends_at = date_trunc('second', now()) - interval '${interval}' + interval '2 hours' WHERE user_id = ${userId} AND status = 'active'");`)
}

/** A staff correction written straight to the database (the staff screens are not built): ended early or void. */
export function endUserVisit(userId: number, status: 'ended_early' | 'void') {
  const ended = status === 'void' ? 'started_at' : "date_trunc('second', now())"
  tinker(`\\Illuminate\\Support\\Facades\\DB::statement("UPDATE facility_sessions SET status = '${status}', ended_at = ${ended} WHERE user_id = ${userId} AND status = 'active'");`)
}

export function closeDue() {
  tinker(`app(\\App\\Services\\FacilitySessions::class)->closeDue();`)
}

/** An account with no waiver, no authorization and one open visit (GI-04). Returns the email. */
export function createWaiverlessVisitor(): { id: number; email: string; password: string } {
  const email = `p152-nowaiver-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
  const id = tinkerJson<number>(`
$user = \\App\\Models\\User::factory()->create(['email' => '${email}']);
\\App\\Models\\FacilitySession::factory()->startedMinutesAgo(5)->create(['user_id' => $user->id]);
echo json_encode($user->id);`)
  return { id, email, password: 'password' }
}

export function dropUser(id: number) {
  tinker(`\\App\\Models\\FacilitySession::where('user_id', ${id})->delete(); \\App\\Models\\User::where('id', ${id})->delete();`)
}

/** Puts a real JPEG at the path the term photo of createMember() points to, so /api/user/photo answers 200. */
export function ensurePhotoFile() {
  tinker(`
$disk = \\Illuminate\\Support\\Facades\\Storage::disk('local');
if (! $disk->exists('photos/p152.jpg')) $disk->put('photos/p152.jpg', base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='));`)
}

/** Hours and minutes in Puerto Rico now, to decide whether a needs-clock path can run. */
export function puertoRicoClock(): { hour: number; minute: number } {
  return tinkerJson<{ hour: number; minute: number }>(`$n = now('America/Puerto_Rico'); echo json_encode(['hour' => $n->hour, 'minute' => $n->minute]);`)
}
