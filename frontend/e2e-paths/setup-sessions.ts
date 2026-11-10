import { devices, expect, test, type APIRequest, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { ADMIN, fakeLocation, INSIDE, STAFF } from '../e2e/flows/flow.ts'
import { createMember, signInApi, tinker, tinkerJson, type Member, type MemberOptions } from './setup.ts'
import { checkInApi } from './setup-end-of-visit.ts'
import { staffSignInApi } from './setup-staff.ts'

// Helpers of the Staff sessions and people path tests (staff-sessions.spec.ts, cross-device-sessions.spec.ts): S-01 active
// sessions, S-02 person and session, S-03 find a person and the assisted Check In. Data is made through tinker on the test stack.

/** The dashboard paths run once, on desktop Chrome (the front desk is desktop only, E-171). */
export function onlyDesktop() {
  test.skip(test.info().project.name !== 'desktop', 'the front desk dashboard is desktop only (E-171)')
}

const DB = '\\Illuminate\\Support\\Facades\\DB'

// ------------------------------------------------------------------------------------------------------- the desk

export type Who = 'staff' | 'admin'

/** Signs the page in as the front desk through the API (the cookies are the page's own), then opens the dashboard at `path`. */
export async function deskPage(page: Page, baseURL: string | undefined, who: Who = 'staff', path = '/staff') {
  await staffSignInApi(page.request, baseURL!, who === 'staff' ? STAFF : ADMIN)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** A request context signed in as the desk, apart from the page. */
export async function deskApi(request: APIRequest, baseURL: string | undefined, who: Who = 'staff'): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL })
  await staffSignInApi(context, baseURL!, who === 'staff' ? STAFF : ADMIN)
  return context
}

// ----------------------------------------------------------------------------------------------------- the phone

/** A phone (Pixel 7 profile) in a new context of the same browser, with the faked location inside the gym. */
export async function phoneFor(browser: Browser, baseURL: string | undefined) {
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7']
  const context = await browser.newContext({ ...pixel, baseURL })
  const page = await context.newPage()
  await fakeLocation(page, INSIDE)
  return { context, page }
}

/** Presses the hold button with the pointer for `ms` milliseconds. */
export async function hold(page: Page, ms = 1100) {
  const button = page.locator('.check-in-hold')
  await expect(button).toBeVisible()
  await button.scrollIntoViewIfNeeded()
  const box = (await button.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

// ----------------------------------------------------------------------------------------------------- the people

let counter = 0
export const token = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** A member whose waiver name is exactly `name`, so a search can find only the people a test made. */
export function createNamed(name: string, options: MemberOptions = {}): Member {
  const member = createMember(options)
  tinker(`${DB}::table('waiver_acceptances')->where('user_id', ${member.id})->update(['full_name' => '${name.replace(/'/g, "\\'")}']);`)
  return { ...member, name }
}

/** An athlete's student number (9 digits). */
export function studentNumber(member: Pick<Member, 'id'>): string {
  return tinkerJson<string>(`echo json_encode(\\App\\Models\\Authorization::where('user_id', ${member.id})->with('rosterRecord')->first()->rosterRecord->student_number);`)
}

/** A roster record nobody claimed: no account, so S-03 cannot find it. Returns its student number. */
export function unclaimedRoster(): string {
  return tinkerJson<string>(`echo json_encode(\\App\\Models\\RosterRecord::factory()->create()->student_number);`)
}

/** The person's own phone, as an API context signed in as the member. */
export async function phoneApi(request: APIRequest, baseURL: string | undefined, member: Member) {
  const context = await request.newContext({ baseURL })
  await signInApi(context, baseURL!, member)
  return context
}

/** The member checks in from inside the gym through the API (their phone). Returns the visit id and the open context. */
export async function visitFor(request: APIRequest, baseURL: string | undefined, member: Member) {
  const context = await phoneApi(request, baseURL, member)
  const id = await checkInApi(context, baseURL)
  return { id, context }
}

/** A throwaway member with an open visit (through the API); the phone context is closed at once. */
export async function memberInside(request: APIRequest, baseURL: string | undefined, options: MemberOptions = {}, name?: string) {
  const member = name ? createNamed(name, options) : createMember(options)
  const { id, context } = await visitFor(request, baseURL, member)
  await context.dispose()
  return { member, id }
}

// ----------------------------------------------------------------------------------------------------- the rows

export type VisitRow = { status: string; assisted: boolean; type: string; by: number | null; user: number; ended: boolean }

export function visit(id: number): VisitRow {
  return tinkerJson<VisitRow>(`$s = \\App\\Models\\FacilitySession::findOrFail(${id});
echo json_encode(['status' => $s->status, 'assisted' => (bool) $s->assisted, 'type' => $s->authorization_type, 'by' => $s->checked_out_by_staff_account_id, 'user' => $s->user_id, 'ended' => $s->ended_at !== null]);`)
}

export function visitsOf(member: Pick<Member, 'id'>): { id: number; status: string; assisted: boolean }[] {
  return tinkerJson(`echo json_encode(\\App\\Models\\FacilitySession::where('user_id', ${member.id})->orderBy('id')->get()->map(fn ($s) => ['id' => $s->id, 'status' => $s->status, 'assisted' => (bool) $s->assisted])->all());`)
}

export function openVisitId(member: Pick<Member, 'id'>): number | null {
  return tinkerJson<number | null>(`echo json_encode(\\App\\Models\\FacilitySession::where('user_id', ${member.id})->where('status', 'active')->value('id'));`)
}

export function auditCount(action: string): number {
  return tinkerJson<number>(`echo json_encode(\\App\\Models\\AuditLogEntry::where('action', '${action}')->count());`)
}

export function pendingAt(member: Pick<Member, 'id'>): string | null {
  return tinkerJson<string | null>(`echo json_encode(\\App\\Models\\Authorization::where('user_id', ${member.id})->value('photo_pending_at'));`)
}

/** Removes the term photo of the member's authorization (the visit already started). */
export function dropPhoto(member: Pick<Member, 'id'>) {
  tinker(`\\App\\Models\\Authorization::where('user_id', ${member.id})->update(['photo_path' => null]);`)
}

/** Revokes the member's authorization while the visit stays open (S-02 of a person who lost access). */
export function revokeAuthorization(member: Pick<Member, 'id'>) {
  tinker(`\\App\\Models\\Authorization::where('user_id', ${member.id})->update(['status' => 'revoked', 'reason' => 'p152 revoked']);`)
}

/** Ends the open visit in the past: it began `minutes` ago and ended `endedMinutes` ago (a visit from earlier). */
export function endVisitEarlier(id: number, minutes: number, endedMinutes: number) {
  tinker(`${DB}::statement("UPDATE facility_sessions SET status = 'checked_out', started_at = date_trunc('second', now()) - interval '${minutes} minutes',
    ends_at = date_trunc('second', now()) - interval '${minutes} minutes' + interval '2 hours', ended_at = date_trunc('second', now()) - interval '${endedMinutes} minutes' WHERE id = ${id}");`)
}

// -------------------------------------------------------------------------------------------------------- screen

export const heading1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
export const rowOf = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text })
export const dialog = (page: Page) => page.getByRole('dialog')
export const staffCount = (page: Page) => page.locator('.staff-occupancy__count strong')
export const staffLevel = (page: Page) => page.locator('.staff-occupancy__level')
export const listTitle = (page: Page) => page.locator('.sessions-panel__title')
export const message = (page: Page) => page.locator('.sessions-message')
export const searchBox = (page: Page) => page.getByLabel('Buscar por nombre')
export const findBox = (page: Page) => page.getByLabel('Nombre del socio o número de estudiante')
export const POLL_WAIT = 45_000
export const level = (count: number) => (count < 40 / 3 ? 'Baja' : count <= 80 / 3 ? 'Moderada' : 'Alta')

export const TIME = /\d{1,2}:\d{2}\s[ap]\.\s?m\./
