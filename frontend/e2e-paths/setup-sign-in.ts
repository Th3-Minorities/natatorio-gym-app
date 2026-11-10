import { tinker, tinkerJson } from './setup.ts'

// Test data for the User sign in path tests, created through tinker on the test stack (never in the seeder).

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const php = (text: string) => `base64_decode('${b64(text)}')`
const HASH = '\\Illuminate\\Support\\Facades\\Hash'
const DB = '\\Illuminate\\Support\\Facades\\DB'

export type TestUser = { id: number; email: string; password: string }
export type UserOptions = { email?: string; password?: string | null; locale?: 'es' | 'en'; deleted?: boolean }

let counter = 0
export const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** A fresh User with only an email and a password (no waiver, no authorization). */
export function createUser(options: UserOptions = {}): TestUser {
  const email = options.email ?? `si152-${unique()}@example.com`
  const password = options.password === undefined ? 'una frase larga de prueba' : options.password
  const hashed = password === null ? 'null' : `${HASH}::make(${php(password)})`
  const deleted = options.deleted ? `, 'deleted_at' => now()` : ''
  const id = tinkerJson<number>(`$u = \\App\\Models\\User::factory()->create(['email' => ${php(email)}, 'password' => ${hashed}, 'locale' => '${options.locale ?? 'es'}'${deleted}]); echo json_encode($u->id);`)
  return { id, email, password: password ?? '' }
}

/** Marks the account as deleted, like the deletion flow does. */
export function softDelete(user: Pick<TestUser, 'id'>) {
  tinker(`\\App\\Models\\User::where('id', ${user.id})->update(['deleted_at' => now()]);`)
}

/** Deletes the server-side session rows of the account but keeps the remember token (a short session that expired). */
export function expireSession(user: Pick<TestUser, 'id'>) {
  tinker(`${DB}::table('sign_in_sessions')->where('user_id', ${user.id})->delete();`)
}

/** Moves the reset token of the email back in time, so the link is `seconds` old. */
export function ageResetToken(email: string, seconds: number) {
  tinker(`${DB}::table('password_reset_tokens')->where('email', ${php(email)})->update(['created_at' => now()->subSeconds(${seconds})]);`)
}

/** Clears the sign-in waits but keeps the failure and lockout counters (the lockout number that makes waits longer). */
export function clearLockWaits() {
  tinker(`${DB}::table('cache')->where('key', 'like', '%user-sign-in:locked_until:%')->delete();`)
}

/** Number of emails Mailpit holds for an address. */
export async function mailCount(request: import('@playwright/test').APIRequestContext, address: string): Promise<number> {
  const found = await (await request.get(`/mailpit/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=50`)).json()
  return found.messages.length
}
