// Saves the test plan evidence (#81, docs/testing/test-plan.md): the backend, unit and browser test results as JUnit
// files, the demo screenshots, and a summary with the date and the commit. It keeps going when a step fails, so the
// summary shows every result. Each browser project runs alone on a database reseeded just before it (migrate:fresh),
// with the gym open as in CI, because the tests consume seeded data (the paid registration test claims an order), as do
// the demo screenshots. That wipes the database. Run it from frontend/ with the stack up: npm run evidence

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const FRONTEND = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${ROOT}docs/testing/evidence/`
const RESULTS = `${OUT}results/`
const SHOTS = `${OUT}screenshots/`

rmSync(RESULTS, { recursive: true, force: true })
rmSync(SHOTS, { recursive: true, force: true })
mkdirSync(RESULTS, { recursive: true })
mkdirSync(SHOTS, { recursive: true })

// The browser test User, as CI sets it (backend/.env.example).
const env = { ...process.env, E2E_USER_EMAIL: process.env.E2E_USER_EMAIL ?? 'user@example.com', E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD ?? 'test-user-password-129' }

// The projects of playwright.config.ts, in its order.
const BROWSER_PROJECTS = ['chromium', 'msedge', 'firefox', 'webkit', 'android', 'iphone']

// What CI adds after seeding (.github/workflows/frontend.yml): the seeded hours are Monday to Friday, 6:00 to 22:00, so the
// flow tests need one special-hours row around now. It is not in the demo seed.
const OPEN_GYM = "App\\Models\\ScheduleSlot::factory()->create(['type' => 'special_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null, 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(), 'text_es' => 'Horario abierto de las pruebas de flujo.']);"

// docker is a real executable, so it skips the shell and its quoting rules; npx is a .cmd file on Windows and needs it.
function run(label, command, args, cwd, extraEnv = {}) {
  console.log(`\n== ${label}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command !== 'docker', env: { ...env, ...extraEnv } })
  return { label, passed: result.status === 0 }
}

function reseed(label) {
  const seeded = run(`${label}: fresh seed`, 'docker', ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'migrate:fresh', '--seed', '--force'], ROOT).passed
  const open = run(`${label}: open the gym`, 'docker', ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'tinker', `--execute=${OPEN_GYM}`], ROOT).passed
  return seeded && open
}

function browserRun(project) {
  const label = `Browser tests (Playwright), ${project}`
  const seeded = reseed(label)
  const result = run(label, 'npx', ['playwright', 'test', `--project=${project}`, '--workers=1', '--reporter=list,junit'], FRONTEND, {
    PLAYWRIGHT_JUNIT_OUTPUT_NAME: `${RESULTS}browser-${project}.xml`,
  })
  return { label, passed: seeded && result.passed }
}

function screenshotRun() {
  const label = 'Demo screenshots'
  const seeded = reseed(label)
  const result = run(label, 'npx', ['playwright', 'test', '--config=playwright.evidence.config.ts'], FRONTEND)
  return { label, passed: seeded && result.passed }
}

const steps = [
  run('Backend tests', 'docker', ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'test', '--log-junit', 'storage/logs/evidence-backend.xml'], ROOT),
  run('Unit tests (Vitest)', 'npx', ['vitest', 'run', '--reporter=default', '--reporter=junit', `--outputFile=${RESULTS}frontend.xml`], FRONTEND),
  ...BROWSER_PROJECTS.map(browserRun),
  screenshotRun(),
]

// The backend writes inside the container's storage, which is the backend/ folder on this machine.
const backendReport = `${ROOT}backend/storage/logs/evidence-backend.xml`
if (existsSync(backendReport)) renameSync(backendReport, `${RESULTS}backend.xml`)

// The reports get committed: keep this computer's name and folders out of them. Playwright's hostname is the
// project name, which the file name already says.
for (const file of readdirSync(RESULTS).filter((name) => name.endsWith('.xml'))) {
  const xml = readFileSync(`${RESULTS}${file}`, 'utf8')
  const clean = [ROOT, ROOT.replaceAll('\\', '/')]
    .reduce((text, folder) => text.split(folder).join(''), xml)
    .replace(/\bhostname="[^"]*"/g, 'hostname=""')
  writeFileSync(`${RESULTS}${file}`, clean)
}

/**
 * Totals of a JUnit file, from the outermost tag that has them: Vitest and Playwright put them on <testsuites>,
 * PHPUnit on its first <testsuite>, which holds every other one.
 */
function totals(file) {
  if (!existsSync(file)) return null
  const xml = readFileSync(file, 'utf8')
  const top = [...xml.matchAll(/<testsuites?\b[^>]*>/g)].map((match) => match[0]).find((tag) => /\btests="\d+"/.test(tag)) ?? ''
  const read = (name) => Number(new RegExp(`\\b${name}="(\\d+)"`).exec(top)?.[1] ?? 0)
  return { tests: read('tests'), failures: read('failures') + read('errors'), skipped: read('skipped') }
}

const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout.trim()
const now = new Intl.DateTimeFormat('es-PR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Puerto_Rico' }).format(new Date())
const browserTotals = BROWSER_PROJECTS.map((project) => totals(`${RESULTS}browser-${project}.xml`)).filter(Boolean)
const sumOf = (key) => browserTotals.reduce((sum, count) => sum + count[key], 0)
const rows = [
  ['Backend (PHPUnit)', 'backend.xml', totals(`${RESULTS}backend.xml`)],
  ['Unit (Vitest)', 'frontend.xml', totals(`${RESULTS}frontend.xml`)],
  ['Browser (Playwright)', `browser-*.xml (${browserTotals.length} of ${BROWSER_PROJECTS.length} projects)`, browserTotals.length ? { tests: sumOf('tests'), failures: sumOf('failures'), skipped: sumOf('skipped') } : null],
].map(([name, file, count]) =>
  count
    ? `| ${name} | ${count.tests} | ${count.tests - count.failures - count.skipped} | ${count.failures} | ${count.skipped} | \`results/${file}\` |`
    : `| ${name} | no report | | | | |`,
)
const shots = existsSync(SHOTS) ? readdirSync(SHOTS).filter((file) => file.endsWith('.png')).sort() : []

writeFileSync(
  `${OUT}summary.md`,
  [
    '# Test evidence',
    '',
    `Run on ${now} (Puerto Rico time), branch \`${git(['branch', '--show-current'])}\`, commit \`${git(['rev-parse', '--short', 'HEAD'])}\`, with \`npm run evidence\`, reseeding the database before each browser project. Issue #81; the cases are in \`../test-plan.md\`.`,
    '',
    '| Suite | Tests | Passed | Failed | Skipped | Report |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Steps',
    '',
    ...steps.map((step) => `- ${step.label}: ${step.passed ? 'passed' : 'failed or had failures'}`),
    '',
    '## Demo screenshots',
    '',
    ...(shots.length ? shots.map((file) => `- [${file}](screenshots/${file})`) : ['None were taken.']),
    '',
  ].join('\n'),
)

console.log(`\nSaved in ${OUT}`)
process.exitCode = steps.every((step) => step.passed) ? 0 : 1
