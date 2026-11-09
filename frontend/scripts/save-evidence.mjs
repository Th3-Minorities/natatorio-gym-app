// Saves the test plan evidence (#81, docs/testing/test-plan.md): the backend, unit and browser test results as JUnit
// files, the demo screenshots, and a summary with the date and the commit. It keeps going when a step fails, so the
// summary shows every result. Run it from frontend/ on a fresh seed, with the stack up: npm run evidence

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

function run(label, command, args, cwd, extraEnv = {}) {
  console.log(`\n== ${label}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...env, ...extraEnv } })
  return { label, passed: result.status === 0 }
}

const steps = [
  run('Backend tests', 'docker', ['compose', 'exec', '-T', 'app', 'php', 'artisan', 'test', '--log-junit', 'storage/logs/evidence-backend.xml'], ROOT),
  run('Unit tests (Vitest)', 'npx', ['vitest', 'run', '--reporter=default', '--reporter=junit', `--outputFile=${RESULTS}frontend.xml`], FRONTEND),
  run('Browser tests (Playwright)', 'npx', ['playwright', 'test', '--workers=1', '--reporter=list,junit'], FRONTEND, {
    PLAYWRIGHT_JUNIT_OUTPUT_NAME: `${RESULTS}browser.xml`,
  }),
  run('Demo screenshots', 'npx', ['playwright', 'test', '--config=playwright.evidence.config.ts'], FRONTEND),
]

// The backend writes inside the container's storage, which is the backend/ folder on this machine.
const backendReport = `${ROOT}backend/storage/logs/evidence-backend.xml`
if (existsSync(backendReport)) renameSync(backendReport, `${RESULTS}backend.xml`)

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
const rows = [
  ['Backend (PHPUnit)', 'backend.xml'],
  ['Unit (Vitest)', 'frontend.xml'],
  ['Browser (Playwright)', 'browser.xml'],
].map(([name, file]) => {
  const count = totals(`${RESULTS}${file}`)
  return count
    ? `| ${name} | ${count.tests} | ${count.tests - count.failures - count.skipped} | ${count.failures} | ${count.skipped} | \`results/${file}\` |`
    : `| ${name} | no report | | | | |`
})
const shots = existsSync(SHOTS) ? readdirSync(SHOTS).filter((file) => file.endsWith('.png')).sort() : []

writeFileSync(
  `${OUT}summary.md`,
  [
    '# Test evidence',
    '',
    `Run on ${now} (Puerto Rico time), branch \`${git(['branch', '--show-current'])}\`, commit \`${git(['rev-parse', '--short', 'HEAD'])}\`, with \`npm run evidence\` on a fresh seed. Issue #81; the cases are in \`../test-plan.md\`.`,
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
