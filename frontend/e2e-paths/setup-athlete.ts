import { execFileSync } from 'node:child_process'
import { expect, type APIRequestContext } from '@playwright/test'
import { linkIn } from '../e2e/mail.ts'
import { tinker as run } from './setup-registration.ts'
import { composeArgs, DOCKER, stackEnv } from './setup.ts'

// Test data for the athlete registration path tests (ids AR-xx): roster records, email links and
// the Mailpit messages they produce. Everything is made with tinker on the test stack, never in the seeder.

const BS = String.fromCharCode(92)
const cls = (...parts: string[]) => parts.join(BS)
const [Roster, Link, User, Authorization, Term] = ['RosterRecord', 'EmailLink', 'User', 'Authorization', 'AcademicTerm'].map((name) => cls('App', 'Models', name))

export const tinker = run

function json<T>(php: string): T {
  const lines = run(php).split(/\r?\n/).filter(Boolean)
  const last = lines.at(-1) ?? ''
  try { return JSON.parse(last) as T } catch { throw new Error(`tinker did not print JSON: ${lines.join('\n')}`) }
}

export type Athlete = { id: number; number: string; email: string; name: string; masked: string }

export type AthleteOptions = {
  /** A removed roster record (removed_at set). */
  removed?: boolean
  /** An account with the roster email already exists. */
  account?: boolean
  /** A fixed student number (must be free). */
  number?: string
}

/** A fresh unclaimed roster record with its own student number and email, so the 300 s and daily link limits never clash. */
export function createAthlete(options: AthleteOptions = {}): Athlete {
  const fixed = options.number ? `'${options.number}'` : 'null'
  const { id, number } = json<{ id: number; number: string }>(`
$number = ${fixed};
if ($number === null) { do { $number = '802'.str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT); } while (${Roster}::where('student_number', $number)->exists()); }
$record = ${Roster}::factory()->create(['student_number' => $number, 'institutional_email' => 'ar'.$number.'@upr.example', 'name' => 'Atleta '.$number${options.removed ? ", 'removed_at' => now()" : ''}]);
${options.account ? `${User}::factory()->create(['email' => 'ar'.$number.'@upr.example']);` : ''}
echo json_encode(['id' => $record->id, 'number' => $number]);`)
  const email = `ar${number}@upr.example`
  return { id, number, email, name: `Atleta ${number}`, masked: `a***${number.at(-1)}@upr.example` }
}

/** Marks the record as claimed: an account and an athlete authorization in the current term. */
export function claim(athlete: Pick<Athlete, 'id'>) {
  run(`
$record = ${Roster}::find(${athlete.id});
${Authorization}::factory()->athlete($record)->create(['user_id' => ${User}::factory()->create()->id, 'academic_term_id' => ${Term}::current()->id]);`)
}

export function removeRecord(athlete: Pick<Athlete, 'id'>) {
  run(`${Roster}::where('id', ${athlete.id})->update(['removed_at' => now()]);`)
}

export function createAccountFor(email: string) {
  run(`${User}::factory()->create(['email' => '${email}']);`)
}

export type LinkOptions = {
  /** Seconds from now to expiry (negative: already expired). Default 24 hours. */
  expiresIn?: number
  used?: boolean
}

/** An email link with a known token for the record, made straight in the database (no email). */
export function createLink(athlete: Pick<Athlete, 'id'>, token: string, options: LinkOptions = {}) {
  run(`
$link = new ${Link}();
$link->forceFill(['purpose' => 'athlete_registration', 'token_hash' => hash('sha256', '${token}'), 'roster_record_id' => ${athlete.id},
  'expires_at' => now()->addSeconds(${options.expiresIn ?? 86400})${options.used ? ", 'used_at' => now()" : ''}])->save();`)
}

export const linkToken = () => Array.from({ length: 64 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

/** Moves the expiry of every link of the record to `seconds` from now (negative: in the past). */
export function setLinkExpiry(athlete: Pick<Athlete, 'id'>, seconds: number) {
  run(`foreach (${Link}::where('roster_record_id', ${athlete.id})->get() as $link) { $link->expires_at = now()->addSeconds(${seconds}); $link->save(); }`)
}

/** Makes every link of the record `seconds` older, or only the oldest one. */
export function ageLinks(athlete: Pick<Athlete, 'id'>, seconds: number, only: 'all' | 'oldest' = 'all') {
  run(`
$links = ${Link}::where('roster_record_id', ${athlete.id})->orderBy('id')->get();
${only === 'oldest' ? '$links = $links->take(1);' : ''}
foreach ($links as $link) { $link->created_at = $link->created_at->copy()->subSeconds(${seconds}); $link->save(); }`)
}

/** Sets the creation time of every link of the record to `seconds` ago. */
export function setLinkAge(athlete: Pick<Athlete, 'id'>, seconds: number) {
  run(`foreach (${Link}::where('roster_record_id', ${athlete.id})->get() as $link) { $link->created_at = now()->subSeconds(${seconds}); $link->save(); }`)
}

export function markLinksUsed(athlete: Pick<Athlete, 'id'>) {
  run(`foreach (${Link}::where('roster_record_id', ${athlete.id})->get() as $link) { $link->used_at = now(); $link->save(); }`)
}

export type LinkRow = { used: boolean; count: number }

/** How many links the record has and whether any was used. */
export function linkRows(athlete: Pick<Athlete, 'id'>): LinkRow {
  return json<LinkRow>(`$links = ${Link}::where('roster_record_id', ${athlete.id})->get(); echo json_encode(['count' => $links->count(), 'used' => $links->whereNotNull('used_at')->isNotEmpty()]);`)
}

/** Users with the address (0 or 1). */
export function usersWith(email: string): number {
  return json<number>(`echo json_encode(${User}::where('email', '${email}')->count());`)
}

// ------------------------------------------------------------------------------------------------------------ mail

export type Mail = { id: string; subject: string; to: string; html: string; text: string }

/** Every email Mailpit caught for the address, newest first. */
export async function mailsTo(request: APIRequestContext, address: string): Promise<Mail[]> {
  const found = await (await request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=50`)).json()
  const mails: Mail[] = []
  for (const summary of found.messages ?? []) {
    const message = await (await request.get(`/mailpit/api/v1/message/${summary.ID}`)).json()
    mails.push({ id: summary.ID, subject: message.Subject, to: message.To?.[0]?.Address ?? '', html: message.HTML ?? '', text: message.Text ?? '' })
  }
  return mails
}

/** Waits until the address has at least `count` emails, then returns them newest first. */
export async function waitForMails(request: APIRequestContext, address: string, count = 1): Promise<Mail[]> {
  let mails: Mail[] = []
  await expect(async () => {
    mails = await mailsTo(request, address)
    expect(mails.length).toBeGreaterThanOrEqual(count)
  }).toPass({ timeout: 60_000 })
  return mails
}

/** The path and query of the registration link inside an email. */
export const athleteLink = (mail: Mail) => linkIn(mail.html, '/register/athlete')

export const tokenOf = (link: string) => new URL(link, 'http://x').searchParams.get('token') ?? ''

// ----------------------------------------------------------------------------------------------------- the stack

/** Stops or starts one service of the test stack (the mail catcher, to make sending fail). Never touches the volumes. */
export function service(action: 'stop' | 'start', name: string) {
  execFileSync(DOCKER, composeArgs(action, name), { env: stackEnv, encoding: 'utf8', timeout: 120_000 })
}
