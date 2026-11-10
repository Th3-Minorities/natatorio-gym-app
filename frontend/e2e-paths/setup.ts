import { execFileSync } from 'node:child_process'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { api } from '../e2e/flows/flow.ts'

// Shared setup for the #152 path tests (e2e-paths/*.spec.ts). Data is built straight in the database of the running
// stack with `php artisan tinker`, so every test makes its own users and never depends on the seeded ones.
// Stack: project KIM_PROJECT (default kim), proxy port APP_PORT (default 8096), subnet TEST_SUBNET.

const DOCKER = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'
const WORKTREE = process.env.KIM_WORKTREE ?? 'C:/r/e152'
const TEST_NET = process.env.KIM_TEST_NET ?? 'C:/Users/bamba/OneDrive/Desktop/natatorio-gym-app/docs/meetings/private/bug-listener/test-net.yml'

/** Runs PHP in the app container of the stack and returns what it printed. */
export function tinker(php: string): string {
  const env = {
    ...process.env,
    APP_PORT: process.env.APP_PORT ?? '8096',
    TEST_SUBNET: process.env.TEST_SUBNET ?? '10.77.116.0/24',
  }
  const args = ['compose', '-p', process.env.KIM_PROJECT ?? 'kim', '-f', `${WORKTREE}/docker-compose.yml`, '-f', `${WORKTREE}/docker-compose.override.yml`,
    '-f', TEST_NET, '--profile', 'development', 'exec', '-T', 'app', 'php', 'artisan', 'tinker', `--execute=${php}`]
  return execFileSync(DOCKER, args, { env, encoding: 'utf8', timeout: 90_000 }).trim()
}

/** Runs PHP that ends with `echo json_encode(...)` and parses the last printed line. */
export function tinkerJson<T>(php: string): T {
  const lines = tinker(php).split(/\r?\n/).filter(Boolean)
  const last = lines.at(-1) ?? ''
  try { return JSON.parse(last) as T } catch { throw new Error(`tinker did not print JSON: ${lines.join('\n')}`) }
}

/** Clears the cache-backed rate limiters (lookup, sign-in lockout, Check In throttle). */
export function flushCache() {
  tinker('Illuminate\\Support\\Facades\\Cache::flush();')
}

// ---------------------------------------------------------------------------------------------------- members

export type MemberOptions = {
  kind?: 'paid' | 'athlete' | 'manual'
  /** Student or employee, for paid and manual members. */
  group?: 'student' | 'employee'
  sport?: string
  locale?: 'es' | 'en'
  /** current: this term. ended: a term that is over. future: the next term. revoked: this term, revoked. none: no authorization row. */
  authorization?: 'current' | 'ended' | 'future' | 'revoked' | 'none'
  /** A false photo means authorizations.photo_path is null (the term photo is missing). */
  photo?: boolean
  photoPending?: boolean
}
export type Member = { id: number; email: string; password: string; name: string; authorizationId: number | null }

let counter = 0
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** A fresh User with a waiver and, by default, a paid student authorization in the current term with a photo. */
export function createMember(options: MemberOptions = {}): Member {
  const { kind = 'paid', group = 'student', sport = 'Voleibol', locale = 'es', authorization = 'current', photo = true, photoPending = false } = options
  const token = unique()
  const email = `p152-${token}@example.com`
  const name = `Prueba ${token}`
  const termName = { current: 'Término actual', ended: 'Término pasado', future: 'Próximo término', revoked: 'Término actual', none: '' }[authorization]
  const php = `
$email = '${email}'; $name = '${name}';
$user = \\App\\Models\\User::factory()->create(['email' => $email, 'locale' => '${locale}']);
\\App\\Models\\WaiverAcceptance::factory()->create(['user_id' => $user->id, 'email' => $email, 'full_name' => $name]);
$authId = null;
if ('${authorization}' !== 'none') {
  $term = \\App\\Models\\AcademicTerm::where('name', '${termName}')->firstOrFail();
  $attributes = ['user_id' => $user->id, 'academic_term_id' => $term->id, 'photo_path' => ${photo ? "'photos/p152.jpg'" : 'null'},
    'photo_pending_at' => ${photoPending ? 'now()' : 'null'}, 'status' => '${authorization === 'revoked' ? 'revoked' : 'active'}'];
  if ('${authorization}' === 'revoked') $attributes['reason'] = 'p152 revoked';
  if ('${kind}' === 'paid') {
    $order = \\App\\Models\\ImportedMembership::factory()->create(['import_id' => \\App\\Models\\Import::query()->value('id'), 'academic_term_id' => $term->id,
      'member_group' => '${group}', 'email' => $email, 'name' => $name]);
    $auth = \\App\\Models\\Authorization::factory()->paid($order)->create($attributes);
  } elseif ('${kind}' === 'athlete') {
    $record = \\App\\Models\\RosterRecord::factory()->create(['institutional_email' => $email, 'name' => $name, 'sport' => '${sport}']);
    $auth = \\App\\Models\\Authorization::factory()->athlete($record)->create($attributes);
  } else {
    $auth = \\App\\Models\\Authorization::factory()->manual()->create([...$attributes, 'member_group' => '${group}']);
  }
  $authId = $auth->id;
}
echo json_encode(['id' => $user->id, 'authorizationId' => $authId]);`
  const { id, authorizationId } = tinkerJson<{ id: number; authorizationId: number | null }>(php)
  return { id, email, password: 'password', name, authorizationId }
}

/** Sets or clears photo_pending_at on the member's authorization. */
export function setPhotoPending(member: Pick<Member, 'id'>, pending: boolean) {
  tinker(`\\App\\Models\\Authorization::where('user_id', ${member.id})->update(['photo_pending_at' => ${pending ? 'now()' : 'null'}]);`)
}

/** Signs the member in through the API (fast), so the page starts with the session cookie. */
export async function signInApi(request: APIRequestContext, baseURL: string, member: Pick<Member, 'email' | 'password'>) {
  return api(request, 'post', '/api/user/sign-in', baseURL, { email: member.email, password: member.password })
}

/** A JSON API call that does not require a 2xx answer: returns status, body and headers. */
export async function rawApi(request: APIRequestContext, method: 'get' | 'post', path: string, baseURL: string, data?: object) {
  if (method === 'post' && !(await request.storageState()).cookies.some((cookie) => cookie.name === 'XSRF-TOKEN')) {
    await request.get('/api/sanctum/csrf-cookie', { headers: { Referer: `${baseURL}/` } })
  }
  const token = (await request.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  const headers = { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': decodeURIComponent(token) }
  const response = await request[method](path, { headers, data })
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status(), body, headers: response.headers() }
}

// ----------------------------------------------------------------------------------------------------- visits

export function sessionCount(member: Pick<Member, 'id'>, activeOnly = false): number {
  const where = activeOnly ? `->where('status', 'active')` : ''
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\FacilitySession::where('user_id', ${member.id})${where}->count());`)
}

/** Moves the member's open visit back in time (start and end), as if it began `minutes` ago. */
export function backdateOpenVisit(member: Pick<Member, 'id'>, minutes: number) {
  tinker(`\\Illuminate\\Support\\Facades\\DB::table('facility_sessions')->where('user_id', ${member.id})->where('status', 'active')->update(['started_at' => now()->subMinutes(${minutes}), 'ends_at' => now()->subMinutes(${minutes})->addHours(2)]);`)
}

// -------------------------------------------------------------------------------------------- schedule and terms

const MARK = 'p152-'

/** Removes leftovers of an interrupted run and makes sure the gym is open now (a special hours row, marked p152-). */
export function resetSchedule() {
  tinker(`
\\App\\Models\\ScheduleSlot::where('text_es', 'like', '${MARK}%')->delete();
$open = \\App\\Models\\ScheduleSlot::where('type', 'special_hours')->where('starts_at', '<=', now())->where('ends_at', '>', now()->addHours(3))->exists();
if (! $open) \\App\\Models\\ScheduleSlot::factory()->create(['type' => 'special_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null,
  'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(2), 'text_es' => '${MARK}open']);`)
}

/** Removes the rows a test added (periods, closures, hours); the open special hours row stays so the next run finds the gym open. */
export function dropMarkedSlots() {
  tinker(`\\App\\Models\\ScheduleSlot::where('text_es', 'like', '${MARK}%')->where('text_es', '<>', '${MARK}open')->delete();`)
}

/** An athletes-only period from `start` to `end` minutes from now. Returns its id. */
export function addPeriod(start: number, end: number): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\ScheduleSlot::factory()->create(['type' => 'athletes_only', 'weekday' => null, 'start_time' => null, 'end_time' => null,
    'starts_at' => now()->addMinutes(${start}), 'ends_at' => now()->addMinutes(${end}), 'text_es' => '${MARK}period'])->id);`)
}

/** A closure that began 5 minutes ago and ends in an hour. Returns its id. */
export function addClosure(): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\ScheduleSlot::factory()->dated()->create(['starts_at' => now()->subMinutes(5), 'ends_at' => now()->addHour(),
    'created_at' => now()->subMinutes(5), 'text_es' => '${MARK}closure'])->id);`)
}

export function endSlot(id: number) {
  tinker(`\\App\\Models\\ScheduleSlot::where('id', ${id})->update(['ends_at' => now()]);`)
}

export function deleteSlot(id: number) {
  tinker(`\\App\\Models\\ScheduleSlot::where('id', ${id})->delete();`)
}

export type HoursBackup = unknown[]

/**
 * Replaces today's opening hours with one regular row that closes `minutes` from now (negative: closed that many minutes ago),
 * after removing the special hours rows and today's other weekly rows. Returns the removed rows for restoreHours(), or null
 * when the clock is too close to midnight for a same-day end time.
 */
export function setHoursEndingIn(minutes: number): HoursBackup | null {
  return tinkerJson<HoursBackup | null>(`
$end = now()->addMinutes(${minutes});
if (! $end->isSameDay(now()) || (now()->hour === 0 && now()->minute < 5)) { echo json_encode(null); return; }
$rows = \\App\\Models\\ScheduleSlot::where('type', 'special_hours')->orWhere(fn ($q) => $q->where('weekday', now()->dayOfWeek))->get()->map->getAttributes()->all();
\\App\\Models\\ScheduleSlot::whereIn('id', array_column($rows, 'id'))->delete();
\\App\\Models\\ScheduleSlot::factory()->create(['type' => 'regular_hours', 'weekday' => now()->dayOfWeek, 'start_time' => '00:00', 'end_time' => $end->format('H:i'), 'text_es' => '${MARK}hours']);
echo json_encode($rows);`)
}

export function restoreHours(rows: HoursBackup) {
  const json = JSON.stringify(rows).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  tinker(`
\\App\\Models\\ScheduleSlot::where('text_es', '${MARK}hours')->delete();
foreach (json_decode('${json}', true) as $row) \\Illuminate\\Support\\Facades\\DB::table('schedule_slots')->insert($row);`)
}

/** Moves the end of the current term (`days` from today, negative for the past). Returns the old date to restore. */
export function setCurrentTermEnd(days: number): string {
  return tinkerJson<string>(`
$term = \\App\\Models\\AcademicTerm::where('name', 'Término actual')->firstOrFail();
$old = $term->ends_on->toDateString();
$term->update(['ends_on' => today()->addDays(${days})->toDateString()]);
echo json_encode($old);`)
}

export function restoreCurrentTermEnd(date: string) {
  tinker(`\\App\\Models\\AcademicTerm::where('name', 'Término actual')->update(['ends_on' => '${date}']);`)
}

// ------------------------------------------------------------------------------------------------ browser tools

/** Collects the URLs of the requests the page sends with a method to a path, from now on. */
export function countRequests(page: Page, method: string, pathPart: string) {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.method() === method && request.url().includes(pathPart)) seen.push(request.url())
  })
  return seen
}

/** The text is visible on the page. */
export async function seeText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text, { exact: typeof text === 'string' }).first()).toBeVisible()
}
