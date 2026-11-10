import { execFileSync } from 'node:child_process'
import { inflateRawSync } from 'node:zlib'
import type { APIRequestContext, Browser, BrowserContext, Page, PlaywrightWorkerArgs } from '@playwright/test'

type Playwright = PlaywrightWorkerArgs['playwright']
import { fakeLocation, INSIDE } from '../e2e/flows/flow.ts'
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

// ------------------------------------------------------------------------------------- A-04 and A-05 (built screens)

export type AuditRow = { action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null }

/** Audit entries about one record (subject table and id), oldest first. */
export function auditOf(table: 'academic_terms' | 'roster_records', id: number): AuditRow[] {
  return tinkerJson<AuditRow[]>(`
echo json_encode(\\App\\Models\\AuditLogEntry::where('subject_table', '${table}')->where('subject_id', ${id})->orderBy('id')->get()
  ->map(fn ($e) => ['action' => $e->action, 'before' => $e->before_values, 'after' => $e->after_values, 'reason' => $e->reason])->all());`)
}

export function termIdOf(name: string): number | null {
  return tinkerJson<number | null>(`echo json_encode(${Term}::where('name', '${name}')->value('id'));`)
}

export type RosterRow = { id: number; name: string; sport: string; student_number: string; institutional_email: string; removed: boolean }

const rosterSelect = `fn ($r) => ['id' => $r->id, 'name' => $r->name, 'sport' => $r->sport, 'student_number' => $r->student_number, 'institutional_email' => $r->institutional_email, 'removed' => $r->removed_at !== null]`

export function rosterByNumber(number: string): RosterRow | null {
  return tinkerJson<RosterRow | null>(`$r = ${Roster}::where('student_number', '${number}')->first(); echo json_encode($r ? (${rosterSelect})($r) : null);`)
}

export function rosterById(id: number): RosterRow {
  return tinkerJson<RosterRow>(`echo json_encode((${rosterSelect})(${Roster}::findOrFail(${id})));`)
}

/** The roster record behind a member made with kind: 'athlete'. */
export function rosterOf(member: Pick<Member, 'id'>): RosterRow {
  return tinkerJson<RosterRow>(`echo json_encode((${rosterSelect})(${Roster}::findOrFail(${Authorization}::where('user_id', ${member.id})->firstOrFail()->roster_record_id)));`)
}

export function authorizationStatus(member: Pick<Member, 'id'>): string {
  return tinkerJson<string>(`echo json_encode(${Authorization}::where('user_id', ${member.id})->orderByDesc('id')->value('status'));`)
}

export function rosterCounts(): { total: number; active: number; withdrawn: number } {
  return tinkerJson<{ total: number; active: number; withdrawn: number }>(
    `echo json_encode(['total' => ${Roster}::count(), 'active' => ${Roster}::whereNull('removed_at')->count(), 'withdrawn' => ${Roster}::whereNotNull('removed_at')->count()]);`)
}

/** Every roster record, as the download must list them. */
export function allRoster(): RosterRow[] {
  return tinkerJson<RosterRow[]>(`echo json_encode(${Roster}::orderBy('name')->orderBy('id')->get()->map(${rosterSelect})->all());`)
}

/** A student number no roster record has. */
export function freeNumber(): string {
  for (;;) {
    const number = `7${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
    if (rosterByNumber(number) === null) return number
  }
}

/** Throwaway roster records (no account), named with accents, tagged by the email prefix `p152-bulk-`. */
export function addBulkRoster(count: number): number {
  return tinkerJson<number>(`
$names = ['Peña Núñez', "O'Brien & Hijos", 'Ñandú Rivera', 'Müller Saéz', 'García Ángel'];
for ($i = 0; $i < ${count}; $i++) {
  ${Roster}::factory()->create(['name' => $names[$i % 5].' '.$i, 'sport' => 'Natación p152', 'student_number' => '71'.str_pad((string) $i, 7, '0', STR_PAD_LEFT),
    'institutional_email' => 'p152-bulk-'.$i.'@upr.example']);
}
echo json_encode(${Roster}::where('institutional_email', 'like', 'p152-bulk-%')->count());`)
}

export function dropBulkRoster() {
  tinker(`${Roster}::where('institutional_email', 'like', 'p152-bulk-%')->delete();`)
}

/** Removes the throwaway records a test added by name prefix. */
export function dropRosterNamed(prefix: string) {
  tinker(`${Roster}::where('name', 'like', '${prefix}%')->delete();`)
}

/** Gives the member an active manual authorization in the named term (the member keeps any other authorization). */
export function grantInTerm(member: Pick<Member, 'id'>, termName: string) {
  tinker(`
$term = ${Term}::where('name', '${termName}')->firstOrFail();
${Authorization}::factory()->manual()->create(['user_id' => ${member.id}, 'academic_term_id' => $term->id, 'status' => 'active', 'photo_path' => 'photos/p152.jpg', 'member_group' => 'student']);`)
}

/** Removes the authorizations a member has in the named term, so the term can be dropped. */
export function dropAuthorizationsIn(termName: string) {
  tinker(`${Authorization}::whereIn('academic_term_id', ${Term}::where('name', '${termName}')->pluck('id'))->delete();`)
}

// -------------------------------------------------------------------------------------------------- a phone, for X rows


export type PhoneKind = 'android' | 'iphone'
export type Phone = { context: BrowserContext; page: Page; close: () => Promise<void> }

/** A phone next to the dashboard: Pixel 7 in Chromium, or iPhone 13 in WebKit, with the location at the gym. */
export async function openPhone(browser: Browser, playwright: Playwright, baseURL: string | undefined, kind: PhoneKind): Promise<Phone> {
  const owner = kind === 'iphone' ? await playwright.webkit.launch() : browser
  const context = await owner.newContext({ ...playwright.devices[kind === 'iphone' ? 'iPhone 13' : 'Pixel 7'], baseURL, serviceWorkers: 'block' })
  const page = await context.newPage()
  await fakeLocation(page, INSIDE)
  return { context, page, close: async () => { await context.close(); if (kind === 'iphone') await owner.close() } }
}

// ------------------------------------------------------------------------------------------------ calls and files


/** Any-method JSON call with the request's own cookies (XSRF header, Referer), answering status and body whatever they are. */
export async function call(request: APIRequestContext, method: 'get' | 'post' | 'patch' | 'delete', path: string, baseURL: string, data?: object) {
  if (method !== 'get' && !(await request.storageState()).cookies.some((cookie) => cookie.name === 'XSRF-TOKEN')) {
    await request.get('/api/sanctum/csrf-cookie', { headers: { Referer: `${baseURL}/` } })
  }
  const token = (await request.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  const headers = { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': decodeURIComponent(token) }
  const response = await request[method](path, { headers, data })
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status(), body: body as any }
}

/** One file of a zip archive (a .docx is one), read from its central directory. */
export function zipEntry(archive: Buffer, wanted: string): Buffer {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  let count = archive.readUInt16LE(end + 10)
  let offset = archive.readUInt32LE(end + 16)
  while (count-- > 0) {
    const method = archive.readUInt16LE(offset + 10)
    const size = archive.readUInt32LE(offset + 20)
    const [name, extra, comment] = [archive.readUInt16LE(offset + 28), archive.readUInt16LE(offset + 30), archive.readUInt16LE(offset + 32)]
    const local = archive.readUInt32LE(offset + 42)
    if (archive.toString('utf8', offset + 46, offset + 46 + name) === wanted) {
      const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28)
      const data = archive.subarray(start, start + size)
      return method === 0 ? data : inflateRawSync(data)
    }
    offset += 46 + name + extra + comment
  }
  throw new Error(`${wanted} is not in the archive`)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** The text runs of a Word file, in order, with XML entities decoded. */
export function docxTexts(file: Buffer): string[] {
  const xml = zipEntry(file, 'word/document.xml').toString('utf8')
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name]))
}

const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'

/** The text of a PDF, one string per page. */
export function pdfPages(path: string): string[] {
  const text = execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', path, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const pages = text.split('\f')
  if (pages.at(-1)?.trim() === '') pages.pop()
  return pages
}

/** An athlete authorization of the member's roster record in the named term, so a withdrawal has two to revoke. */
export function addAthleteAuthorization(member: Pick<Member, 'id'>, termName: string) {
  tinker(`
$first = ${Authorization}::where('user_id', ${member.id})->firstOrFail();
$term = ${Term}::where('name', '${termName}')->firstOrFail();
${Authorization}::factory()->athlete(${Roster}::findOrFail($first->roster_record_id))->create(['user_id' => ${member.id}, 'academic_term_id' => $term->id, 'status' => 'active', 'photo_path' => 'photos/p152.jpg']);`)
}

/** Status and reason of every authorization of the member, newest term first, as [term name, status, reason]. */
export function authorizationsOf(member: Pick<Member, 'id'>): [string, string, string | null][] {
  return tinkerJson<[string, string, string | null][]>(`
echo json_encode(${Authorization}::where('user_id', ${member.id})->with('academicTerm')->get()->sortByDesc(fn ($a) => $a->academicTerm->starts_on)
  ->map(fn ($a) => [$a->academicTerm->name, $a->status, $a->reason])->values()->all());`)
}
