import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { flushCache, tinker as sharedTinker } from './setup.ts'

// Test data for the paid registration path tests, created through tinker on the test stack (never in the seeder).
// The docker call lives in setup.ts; this wrapper refuses to run without TEST_PROJECT so a missing variable can never
// send a test to the default test stack.

export const tinkerAvailable = () => !process.env.CI && !!process.env.TEST_PROJECT

export function tinker(php: string): string {
  if (!process.env.TEST_PROJECT) throw new Error('TEST_PROJECT is not set')
  return sharedTinker(php)
}

// PHP class names in tinker code, built with a real backslash (no escaping to get wrong).
const BS = String.fromCharCode(92)
const cls = (...parts: string[]) => parts.join(BS)
const [Term, Membership, Import, User, Setting] = ['AcademicTerm', 'ImportedMembership', 'Import', 'User', 'Setting'].map((name) => cls('App', 'Models', name))

export const flushLimiter = () => { if (!process.env.TEST_PROJECT) throw new Error('TEST_PROJECT is not set'); flushCache() }

export type OrderOptions = { email?: string; name?: string; status?: string; paidAt?: 'term-start' | 'before-term-start'; term?: 'next' }

const unique = () => Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')

/** A fresh unclaimed order in the current term; returns its Authorization Number (max 20 chars, upper case). */
export function createOrder(prefix: string, options: OrderOptions = {}) {
  const number = `${prefix}${unique()}`.toUpperCase().slice(0, 20)
  const email = options.email ?? `${number.toLowerCase()}@example.com`
  const name = options.name ?? `Prueba ${number}`
  const extra: string[] = []
  if (options.status) extra.push(`'order_status'=>'${options.status}'`)
  if (options.paidAt === 'term-start') extra.push(`'paid_at'=>$t->starts_on->copy()->startOfDay()`)
  if (options.paidAt === 'before-term-start') extra.push(`'paid_at'=>$t->starts_on->copy()->startOfDay()->subSecond()`)
  if (options.term === 'next') extra.push(`'academic_term_id'=>${Term}::where('name','Próximo término')->value('id')`)
  tinker(
    `$t=${Term}::where('name','Término actual')->first(); ${Membership}::factory()->create(['import_id'=>${Import}::value('id'),'academic_term_id'=>$t->id,'authorization_number'=>'${number}','email'=>'${email}','name'=>'${name}',${extra.join(',')}]);`,
  )
  return { number, email, name }
}

export function createUser(email: string) {
  tinker(`${User}::factory()->create(['email'=>'${email}']);`)
}

export function setStoreUrl(url: string | null) {
  tinker(url ? `${Setting}::updateOrCreate(['name'=>'store_url'],['value'=>'${url}']);` : `${Setting}::where('name','store_url')->delete();`)
}

// Image fixtures that need a real encoder (Pillow): a small JPEG and an 8 MB, 6000x4000 JPEG with EXIF orientation and GPS.

const PY = `
import sys, os, random
from PIL import Image
out = sys.argv[1]
Image.new('RGB', (64, 64), (30, 120, 200)).save(os.path.join(out, 'small.jpg'), 'JPEG')
random.seed(7)
noise = Image.frombytes('RGB', (1500, 1000), bytes(random.getrandbits(8) for _ in range(1500 * 1000 * 3)))
big = noise.resize((6000, 4000), Image.BICUBIC)
exif = Image.Exif()
exif[0x0112] = 6
exif[0x010F] = 'E2E'
try:
    exif[0x8825] = {1: 'N', 2: (18.0, 12.0, 0.0), 3: 'W', 4: (67.0, 8.0, 0.0)}
except Exception:
    pass
for quality in (92, 85, 75, 65, 55, 45):
    big.save(os.path.join(out, 'big.jpg'), 'JPEG', quality=quality, exif=exif.tobytes())
    if os.path.getsize(os.path.join(out, 'big.jpg')) < 9 * 1024 * 1024:
        break
`

export function fixtures() {
  const dir = join(tmpdir(), 'registration-fixtures')
  if (!existsSync(join(dir, 'big.jpg'))) {
    mkdirSync(dir, { recursive: true })
    execFileSync('python', ['-I', '-c', PY, dir], { timeout: 180_000 })
  }
  return { smallJpeg: readFileSync(join(dir, 'small.jpg')), bigJpegPath: join(dir, 'big.jpg') }
}

/** Dimensions and whether the file still carries EXIF, read from the JPEG markers. */
export function jpegInfo(data: Buffer) {
  let offset = 2
  let exif = false
  while (offset + 4 < data.length) {
    if (data[offset] !== 0xff) break
    const marker = data[offset + 1]
    const length = data.readUInt16BE(offset + 2)
    if (marker === 0xe1 && data.toString('latin1', offset + 4, offset + 8) === 'Exif') exif = true
    if (marker >= 0xc0 && marker <= 0xc3) return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7), exif, jpeg: data[0] === 0xff && data[1] === 0xd8 }
    offset += 2 + length
  }
  return { height: 0, width: 0, exif, jpeg: data[0] === 0xff && data[1] === 0xd8 }
}

export const clearSessions = () => { tinker(`${cls('Illuminate', 'Support', 'Facades', 'DB')}::table('sign_in_sessions')->delete();`) }

/** The end date of "Término actual" as stored, so a test can restore it. */
export const termEnd = () => tinker(`echo ${Term}::where('name','Término actual')->first()->getRawOriginal('ends_on');`).trim()

export function setTermEnd(value: 'today' | 'yesterday' | string) {
  const date = value === 'today' ? 'now()->toDateString()' : value === 'yesterday' ? 'now()->subDay()->toDateString()' : `'${value}'`
  tinker(`${Term}::where('name','Término actual')->update(['ends_on'=>${date}]);`)
}
