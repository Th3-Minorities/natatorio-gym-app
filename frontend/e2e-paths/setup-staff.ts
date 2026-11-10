import { spawnSync } from 'node:child_process'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { tinker, tinkerJson } from './setup.ts'
import { unique } from './setup-sign-in.ts'

// Test data and helpers for the Staff accounts path tests (staff-accounts.spec.ts), made through tinker on the test stack
// (never in the seeder). Every test makes its own accounts, so the seeded admin@example.com and staff@example.com keep their
// password "password".

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const php = (text: string) => `base64_decode('${b64(text)}')`
const DB = '\\Illuminate\\Support\\Facades\\DB'

export const LONG_PASSWORD = 'una frase larga de prueba'

export type StaffPerson = { id: number; email: string; name: string; password: string; role: 'staff' | 'admin' }
export type StaffOptions = {
  role?: 'staff' | 'admin'
  /** invited: no password yet. deactivated: a password and deactivated_at. */
  state?: 'active' | 'invited' | 'deactivated'
  locale?: 'es' | 'en'
  name?: string
  email?: string
  password?: string
}

/** A fresh staff account, built straight in the table. */
export function createStaff(options: StaffOptions = {}): StaffPerson {
  const token = unique()
  const email = options.email ?? `sa152-${token}@example.com`
  const name = options.name ?? `Persona ${token}`
  const password = options.password ?? LONG_PASSWORD
  const role = options.role ?? 'staff'
  const state = options.state ?? 'active'
  const id = tinkerJson<number>(`
$a = \\App\\Models\\StaffAccount::factory()->create(['name' => ${php(name)}, 'email' => ${php(email)}, 'role' => '${role}', 'locale' => '${options.locale ?? 'es'}',
  'password' => ${state === 'invited' ? 'null' : php(password)}, 'deactivated_at' => ${state === 'deactivated' ? 'now()' : 'null'}]);
echo json_encode($a->id);`)
  return { id, email, name, password, role }
}

/** An invitation link with a token this test knows (the real mail is only sent by the invite and resend calls). Replaces older links. */
export function inviteLink(id: number): string {
  const token = `sa152${unique()}${unique()}`
  tinker(`
\\App\\Models\\EmailLink::where('purpose', 'staff_invite')->where('staff_account_id', ${id})->delete();
\\App\\Models\\EmailLink::create(['purpose' => 'staff_invite', 'token_hash' => hash('sha256', '${token}'), 'staff_account_id' => ${id}, 'expires_at' => now()->addDays(7)]);`)
  return `/staff/invitacion?token=${token}`
}

/** Moves the expiry of the account's invitation to `seconds` from now (negative: in the past). */
export function setInviteExpiry(id: number, seconds: number) {
  tinker(`\\App\\Models\\EmailLink::where('purpose', 'staff_invite')->where('staff_account_id', ${id})->update(['expires_at' => now()->addSeconds(${seconds})]);`)
}

/** A reset link with a token this test knows, made through the broker the app uses (no mail). */
export function resetLink(email: string): string {
  const token = tinkerJson<string>(`
$a = \\App\\Models\\StaffAccount::whereRaw('lower(email) = lower(?)', [${php(email)}])->firstOrFail();
echo json_encode(\\Illuminate\\Support\\Facades\\Password::broker('staff_accounts')->createToken($a));`)
  return `/staff/restablecer?token=${token}&email=${encodeURIComponent(email)}`
}

/** Moves the reset token of the email back in time, so the link is `minutes` old. */
export function ageStaffReset(email: string, minutes: number) {
  tinker(`${DB}::table('staff_password_reset_tokens')->where('email', ${php(email)})->update(['created_at' => now()->subMinutes(${minutes})]);`)
}

/** Rewrites the idle time of every open sign-in of the account in the session table (sign_in_sessions), as if the last activity was `seconds` ago. Returns how many were changed. */
export function idleStaffSession(id: number, seconds: number): number {
  const changed = tinkerJson<number>(`
$n = 0; $now = now()->getTimestamp();
foreach (${DB}::table('sign_in_sessions')->where('last_activity', '>', $now - 10800)->get() as $row) {
  $data = json_decode(base64_decode($row->payload), true);
  if (! is_array($data)) continue;
  $mine = false;
  foreach ($data as $key => $value) { if (str_starts_with((string) $key, 'login_staff_') && (int) $value === ${id}) $mine = true; }
  if (! $mine) continue;
  $data['staff_last_activity_at'] = $now - ${seconds};
  ${DB}::table('sign_in_sessions')->where('id', $row->id)->update(['payload' => base64_encode(json_encode($data))]);
  $n++;
}
echo json_encode($n);`)
  expect(changed, 'open staff sign-ins rewritten in the session table (sign_in_sessions)').toBeGreaterThan(0)
  return changed
}

/** Clears the staff sign-in waits but keeps the failure counters and the lockout numbers (which make the next wait longer). */
export function clearStaffLockWaits() {
  tinker(`${DB}::table('cache')->where('key', 'like', '%staff-sign-in:locked_until:%')->delete();`)
}

/** Forgets the lockout numbers, as a day without lockouts does. */
export function clearStaffLockouts() {
  tinker(`${DB}::table('cache')->where('key', 'like', '%staff-sign-in:lockouts:%')->delete();`)
}

export type AuditRow = { action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; count: number }

/** The newest audit entry with this action for the account (as subject), and how many there are. */
export function audit(action: string, subjectId: number): AuditRow {
  return tinkerJson<AuditRow>(`
$q = \\App\\Models\\AuditLogEntry::where('action', '${action}')->where('subject_table', 'staff_accounts')->where('subject_id', ${subjectId});
$last = (clone $q)->orderByDesc('id')->first();
echo json_encode(['action' => $last?->action, 'before' => $last?->before_values, 'after' => $last?->after_values, 'count' => $q->count()]);`)
}

export type StaffRow = { role: string; status: string; locale: string }

export function staffRow(id: number): StaffRow {
  return tinkerJson<StaffRow>(`$a = \\App\\Models\\StaffAccount::findOrFail(${id}); echo json_encode(['role' => $a->role, 'status' => $a->status(), 'locale' => $a->locale]);`)
}

export function staffCountByEmail(email: string): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\StaffAccount::whereRaw('lower(email) = lower(?)', [${php(email)}])->count());`)
}

/** True when the app container can reach the password leak service (the check behind "uncompromised"). */
export function leakServiceReachable(): boolean {
  return tinkerJson<boolean>(`
try { $r = \\Illuminate\\Support\\Facades\\Http::timeout(8)->get('https://api.pwnedpasswords.com/range/21BD1'); echo json_encode($r->successful()); }
catch (\\Throwable $e) { echo json_encode(false); }`)
}

/** Runs an artisan command in the app container. */
export function artisan(...args: string[]): { status: number | null; output: string } {
  const worktree = process.env.KIM_WORKTREE ?? 'C:/r/e152'
  const testNet = process.env.KIM_TEST_NET ?? 'C:/Users/bamba/OneDrive/Desktop/natatorio-gym-app/docs/meetings/private/bug-listener/test-net.yml'
  const env = { ...process.env, APP_PORT: process.env.APP_PORT ?? '8096', TEST_SUBNET: process.env.TEST_SUBNET ?? '10.77.116.0/24' }
  const compose = ['compose', '-p', process.env.KIM_PROJECT ?? 'kim', '-f', `${worktree}/docker-compose.yml`, '-f', `${worktree}/docker-compose.override.yml`,
    '-f', testNet, '--profile', 'development', 'exec', '-T', 'app', 'php', 'artisan', ...args]
  const done = spawnSync('C:/Program Files/Docker/Docker/resources/bin/docker.exe', compose, { env, encoding: 'utf8', timeout: 90_000 })
  return { status: done.status, output: `${done.stdout}${done.stderr}` }
}

// ------------------------------------------------------------------------------------------------------------ API

/** A JSON call with the cookies of a request context, any of get, post and patch. Answers whatever status comes back. */
export async function staffApi(request: APIRequestContext, method: 'get' | 'post' | 'patch', path: string, baseURL: string, data?: object) {
  const cookies = async () => (await request.storageState()).cookies
  if (method !== 'get' && !(await cookies()).some((cookie) => cookie.name === 'XSRF-TOKEN')) {
    await request.get('/api/sanctum/csrf-cookie', { headers: { Referer: `${baseURL}/` } })
  }
  const token = (await cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  const headers = { Accept: 'application/json', Referer: `${baseURL}/`, 'X-XSRF-TOKEN': decodeURIComponent(token) }
  const response = await request.fetch(path, { method: method.toUpperCase(), headers, data })
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status(), body, headers: response.headers() }
}

/** Signs a request context in as a staff account and requires it to work. */
export async function staffSignInApi(request: APIRequestContext, baseURL: string, who: Pick<StaffPerson, 'email' | 'password'>) {
  const answer = await staffApi(request, 'post', '/api/staff/sign-in', baseURL, { email: who.email, password: who.password })
  expect(answer.status, JSON.stringify(answer.body)).toBe(200)
  return answer
}

/** Invites through the API as the signed-in Administrator of the context. Returns the new account. */
export async function inviteApi(request: APIRequestContext, baseURL: string, input: { name: string; email: string; role?: 'staff' | 'admin' }) {
  const answer = await staffApi(request, 'post', '/api/staff/accounts', baseURL, { role: 'staff', ...input })
  expect(answer.status, JSON.stringify(answer.body)).toBe(201)
  return answer.body.account as { id: number; name: string; email: string; role: string; status: string }
}

// ------------------------------------------------------------------------------------------------------------ mail

type MailSummary = { ID: string; Subject: string }

/** The newest messages Mailpit holds for an address, newest first. */
export async function mailsTo(request: APIRequestContext, address: string): Promise<MailSummary[]> {
  const found = await (await request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=50`)).json()
  return found.messages
}

/** Waits for a mail to the address whose link to `path` differs from `previous`, and returns the link (path and query). */
export async function waitForLink(page: Page, address: string, path: string, previous: string[] = []): Promise<{ link: string; subject: string; html: string }> {
  let result: { link: string; subject: string; html: string } | null = null
  await expect(async () => {
    for (const mail of await mailsTo(page.request, address)) {
      const message = await (await page.request.get(`/mailpit/api/v1/message/${mail.ID}`)).json()
      const match = String(message.HTML).match(new RegExp(`https?://[^\\s"<>]+${path}\\?[^\\s"<>]+`))
      if (!match) continue
      const url = new URL(match[0].replaceAll('&amp;', '&'))
      const link = url.pathname + url.search
      if (previous.includes(link)) continue
      result = { link, subject: message.Subject, html: message.HTML }
      return
    }
    throw new Error(`no new ${path} link for ${address}`)
  }).toPass({ timeout: 60_000 })
  return result!
}

// ---------------------------------------------------------------------------------------------------- passwords

/** A password of the given length that is on no leaked list (a random suffix). */
export function uniquePassword(length = 14): string {
  const tail = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  return `Zq-${tail}`.padEnd(length, 'x').slice(0, length)
}
