import { tinker, tinkerJson, type Member } from './setup.ts'

// Helpers of the Terms and athlete roster path tests (terms-roster.spec.ts, ids TR-xx). The Administrator screens for terms and the
// roster are not built, so terms and roster records are changed with tinker. A term shift moves the dates of the current term for the
// whole stack: every test snapshots the terms first and restores them in finally.

const Term = '\\App\\Models\\AcademicTerm'
const Roster = '\\App\\Models\\RosterRecord'
const Authorization = '\\App\\Models\\Authorization'
const QueryException = '\\Illuminate\\Database\\QueryException'
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

export type TermRow = { name: string; starts_on: string; ends_on: string }

export const CURRENT = 'Término actual'
export const NEXT = 'Próximo término'
export const PAST = 'Término pasado'

// -------------------------------------------------------------------------------------------------------- dates

/** Today's date in Puerto Rico (the app time zone), as YYYY-MM-DD. */
export function todayPR(): string {
  return tinkerJson<string>(`echo json_encode(today()->toDateString());`)
}

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const month = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The chip of the term on A-15: "Septiembre - diciembre 2026", or "Septiembre 2026 - febrero 2027" across two years. */
export function chipLabel(term: Pick<TermRow, 'starts_on' | 'ends_on'>): string {
  const [from, to] = [term.starts_on.slice(0, 4), term.ends_on.slice(0, 4)]
  return from === to
    ? `${capital(month(term.starts_on))} - ${month(term.ends_on)} ${to}`
    : `${capital(month(term.starts_on))} ${from} - ${month(term.ends_on)} ${to}`
}

// -------------------------------------------------------------------------------------------------------- terms

export function snapshotTerms(): TermRow[] {
  return tinkerJson<TermRow[]>(`echo json_encode(${Term}::orderBy('id')->get()->map(fn ($t) => ['name' => $t->name, 'starts_on' => $t->starts_on->toDateString(), 'ends_on' => $t->ends_on->toDateString()])->all());`)
}

/**
 * Sets the dates of the named terms. A move that would overlap another term (or end before it starts) is retried after the
 * others have moved, so the caller does not have to order the changes. Throws when a change never fits.
 */
export function setTerms(changes: TermRow[]) {
  const left = tinkerJson<string[]>(`
$pending = json_decode(base64_decode('${b64(JSON.stringify(changes))}'), true);
for ($round = 0; $round < 4 && $pending; $round++) {
  foreach ($pending as $i => $c) {
    try {
      ${Term}::where('name', $c['name'])->firstOrFail()->update(['starts_on' => $c['starts_on'], 'ends_on' => $c['ends_on']]);
      unset($pending[$i]);
    } catch (${QueryException} $e) {}
  }
}
echo json_encode(array_values(array_map(fn ($c) => $c['name'], $pending)));`)
  if (left.length > 0) throw new Error(`terms could not be moved: ${left.join(', ')}`)
}

/** Gives the terms back their dates, whatever order the shift left them in. */
export const restoreTerms = (rows: TermRow[]) => setTerms(rows)

/** Renames a term. A name longer than the column fails in the database. */
export function renameTerm(from: string, to: string): string {
  return tinkerJson<string>(`
try { ${Term}::where('name', '${from}')->firstOrFail()->update(['name' => '${to}']); echo json_encode('saved'); }
catch (${QueryException} $e) { echo json_encode((string) ($e->errorInfo[0] ?? $e->getCode())); }`)
}

/** Inserts a term; answers 'saved' or the SQLSTATE of the refusal (23P01 overlap, 23514 start after end). */
export function insertTerm(name: string, startsOn: string, endsOn: string): { state: string; id: number | null } {
  return tinkerJson<{ state: string; id: number | null }>(`
try { $t = ${Term}::create(['name' => '${name}', 'starts_on' => '${startsOn}', 'ends_on' => '${endsOn}']); echo json_encode(['state' => 'saved', 'id' => $t->id]); }
catch (${QueryException} $e) { echo json_encode(['state' => (string) ($e->errorInfo[0] ?? $e->getCode()), 'id' => null]); }`)
}

/** The app never deletes a term; a test removes the throwaway ones it made. */
export function dropTermsNamed(prefix: string) {
  tinker(`\\Illuminate\\Support\\Facades\\DB::table('academic_terms')->where('name', 'like', '${prefix}%')->delete();`)
}

// ------------------------------------------------------------------------------------------------------ roster

/** Inserts a roster record with a student number; answers 'saved' or the SQLSTATE (23505 unique, 22001 too long). */
export function insertRoster(number: string): { state: string; id: number | null } {
  return tinkerJson<{ state: string; id: number | null }>(`
try { $r = ${Roster}::factory()->create(['student_number' => '${number}']); echo json_encode(['state' => 'saved', 'id' => $r->id]); }
catch (${QueryException} $e) { echo json_encode(['state' => (string) ($e->errorInfo[0] ?? $e->getCode()), 'id' => null]); }`)
}

export function dropRoster(id: number) {
  tinker(`${Roster}::where('id', ${id})->delete();`)
}

/** The student number of a removed record of the seed. */
export function removedSeedNumber(): string {
  return tinkerJson<string>(`echo json_encode(${Roster}::whereNotNull('removed_at')->orderBy('id')->value('student_number'));`)
}

/** What the dashboard's Retirar button will do (REQ-F-49): the record is removed and the authorization revoked. */
export function withdraw(member: Pick<Member, 'id'>) {
  tinker(`
$a = ${Authorization}::where('user_id', ${member.id})->firstOrFail();
${Roster}::where('id', $a->roster_record_id)->update(['removed_at' => now()]);
$a->update(['status' => 'revoked', 'reason' => 'removed from roster']);`)
}

/** What Reinstalar will do: the record and the authorization come back. */
export function reinstate(member: Pick<Member, 'id'>) {
  tinker(`
$a = ${Authorization}::where('user_id', ${member.id})->firstOrFail();
${Roster}::where('id', $a->roster_record_id)->update(['removed_at' => null]);
$a->update(['status' => 'active', 'reason' => null]);`)
}

/** Gives the athlete a second active authorization in the same term (the term's one active authorization is taken). */
export function addSecondAuthorization(member: Pick<Member, 'id'>) {
  tinker(`
$first = ${Authorization}::where('user_id', ${member.id})->firstOrFail();
${Authorization}::factory()->manual()->create(['user_id' => ${member.id}, 'academic_term_id' => $first->academic_term_id, 'status' => 'active', 'photo_path' => 'photos/p152.jpg']);`)
}

/** Tries to set the member's revoked authorization back to active; answers 'saved' or the SQLSTATE. */
export function tryReactivate(member: Pick<Member, 'id'>): string {
  return tinkerJson<string>(`
try { ${Authorization}::where('user_id', ${member.id})->where('status', 'revoked')->firstOrFail()->update(['status' => 'active']); echo json_encode('saved'); }
catch (${QueryException} $e) { echo json_encode((string) ($e->errorInfo[0] ?? $e->getCode())); }`)
}

/** Starts the member's visit last night at 11:30 p. m., Puerto Rico time (inside a term that ended yesterday). */
export function startVisitLastNight(member: Pick<Member, 'id'>) {
  tinker(`
$x = today()->subDay()->setTime(23, 30);
\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->where('user_id', ${member.id})->where('status', 'active')->update(['started_at' => $x, 'ends_at' => $x->copy()->addHours(2)]);`)
}
