// k6 load test of Check In on the local setup (issue #83). Objectives 2 and 3, REQ-NF-15, REQ-NF-42, REQ-NF-50.
//
// Each virtual user is one seeded account from users.csv. All of them sign in once in setup(), before the timed part,
// so sign-in time stays out of the Check In numbers. Then each user does Check In (round one, spread evenly over the
// run), reads the occupancy, and 60 seconds later tries again (round two, must return the same session).
//   peak   = 50 Check Ins over 5 minutes
//   stress = 100 Check Ins over 5 minutes (double)
//   burst  = 50 users at the same moment, each sending two Check In requests in parallel (one batch). Exactly one of the
//            pair must answer 201 and the other 200 with the same session id (REQ-F-37). There is no second round.
// The numbers are a team decision (peak 50 Check Ins in 5 minutes, stress double; to be recorded as a decision), not an SRS target.
//
// Thresholds:
//   Check In p95 under 3000 ms and Check In and occupancy error rate under 1%: team thresholds, the SRS has no target for them
//   every check passes (rate==1): REQ-NF-42 and REQ-NF-50, one session per User
//
// Run it from the repo root on a fresh local setup (PowerShell; the stack must be up). BASE_URL is required: the proxy
// address as the k6 container sees it, http://proxy on the compose network below.
//   docker compose exec app php artisan migrate:fresh --seed --force
//   docker compose exec app php artisan db:seed --class=LoadTestSeeder --force
//   docker run --rm -i --network <compose project>_default -v ${PWD}/tests/load:/load `
//     -e PROFILE=peak -e BASE_URL=http://proxy -e K6_WEB_DASHBOARD=true `
//     -e K6_WEB_DASHBOARD_EXPORT=/load/results/peak.html grafana/k6 run /load/check-in.js
// Use PROFILE=stress for the double run. The HTML report is saved in tests/load/results/.
// After a run, sessions per user (must return no rows):
//   docker compose exec db psql -U natatorio natatorio_gym -c "SELECT user_id, count(*) FROM facility_sessions
//     WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'load-%') GROUP BY user_id HAVING count(*) <> 1"
// Needs the gym open for members at run time (the LoadTestSeeder opens today; not Saturday 8-12, athletes only).
// Run within 90 minutes of seeding: the seeded visit that is inside at the start expires 2 hours after it began (it began
// 20 minutes before seeding), and teardown compares the occupancy with the count read in setup().

import http from 'k6/http'
import exec from 'k6/execution'
import { check, sleep } from 'k6'

const PROFILES = { peak: 50, stress: 100, burst: 50 }
const PROFILE = __ENV.PROFILE || 'peak'
const USERS = PROFILES[PROFILE]
const BURST = PROFILE === 'burst'
const RUN_SECONDS = Number(__ENV.RUN_SECONDS || 300)
const REPEAT_AFTER = Number(__ENV.REPEAT_AFTER || 60)
const BASE = __ENV.BASE_URL
const LOCATION = {
  latitude: Number(__ENV.LATITUDE || 18.211),
  longitude: Number(__ENV.LONGITUDE || -67.141),
  accuracy: 10,
}
// Sanctum starts a cookie session only for a request from a listed front-end address.
const HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json', Origin: __ENV.ORIGIN || 'http://localhost' }

const accounts = open('./users.csv').trim().split('\n').slice(1).map((line) => {
  const [email, password] = line.split(',')
  return { email, password }
})

if (!BASE) throw new Error('BASE_URL is required, for example http://proxy')
if (!USERS) throw new Error(`PROFILE must be one of ${Object.keys(PROFILES).join(', ')}`)

export const options = {
  scenarios: {
    check_in: {
      executor: 'per-vu-iterations',
      vus: USERS,
      iterations: 1,
      maxDuration: BURST ? '5m' : `${RUN_SECONDS + REPEAT_AFTER + 120}s`,
    },
  },
  setupTimeout: '10m',
  thresholds: {
    'http_req_duration{name:check_in}': ['p(95)<3000'],
    'http_req_failed{name:check_in}': ['rate<0.01'],
    'http_req_failed{name:occupancy}': ['rate<0.01'],
    checks: ['rate==1'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

function xsrfHeaders(jar) {
  const token = jar.cookiesForURL(BASE)['XSRF-TOKEN']
  return { ...HEADERS, 'X-XSRF-TOKEN': decodeURIComponent(token[0]) }
}

// Signs in with its own cookie jar and returns the cookies, so a virtual user can carry the session into the timed part.
function signIn(account) {
  const jar = new http.CookieJar()
  http.get(`${BASE}/api/sanctum/csrf-cookie`, { headers: HEADERS, jar, tags: { name: 'csrf' } })
  const response = http.post(`${BASE}/api/user/sign-in`, JSON.stringify(account), {
    headers: xsrfHeaders(jar),
    jar,
    tags: { name: 'sign_in' },
  })
  check(response, { 'signed in': (r) => r.status === 200 })

  return jar.cookiesForURL(BASE)
}

// Logs the status and start of the body of an unexpected answer, so a failed run says what went wrong.
function expect(response, ok, label) {
  if (!ok(response)) console.warn(`${label}: ${response.status} ${String(response.body).slice(0, 120)}`)
  return check(response, { [label]: ok })
}

function sleepUntil(epochMs) {
  const wait = (epochMs - Date.now()) / 1000
  if (wait > 0) sleep(wait)
}

function checkIn(round) {
  const jar = http.cookieJar()

  return http.post(`${BASE}/api/user/check-in`, JSON.stringify(LOCATION), {
    headers: xsrfHeaders(jar),
    tags: { name: 'check_in', round },
  })
}

// Two identical Check In requests sent at once by the same signed-in user.
function checkInTwice() {
  const request = ['POST', `${BASE}/api/user/check-in`, JSON.stringify(LOCATION), {
    headers: xsrfHeaders(http.cookieJar()),
    tags: { name: 'check_in', round: 'burst' },
  }]

  return http.batch([request, request])
}

function occupancy(params = {}) {
  return http.get(`${BASE}/api/user/occupancy`, { headers: HEADERS, tags: { name: 'occupancy' }, ...params })
}

// Signs in every account before the timed part. The seeded data already has people inside: the baseline is read here.
export function setup() {
  const sessions = accounts.slice(0, USERS).map(signIn)
  const jar = new http.CookieJar()
  Object.entries(sessions[0]).forEach(([name, values]) => jar.set(BASE, name, values[0]))

  return { sessions, inside: occupancy({ jar }).json('count') }
}

export default function (data) {
  const index = exec.vu.idInTest - 1
  const start = exec.scenario.startTime
  const jar = http.cookieJar()
  Object.entries(data.sessions[index]).forEach(([name, values]) => jar.set(BASE, name, values[0]))

  if (BURST) return burst()

  sleepUntil(start + ((index * RUN_SECONDS) / USERS) * 1000)
  const first = checkIn('1')
  expect(first, (r) => r.status === 201, 'round 1 creates a session')
  const sessionId = first.status === 201 ? first.json('session.id') : null
  const count = occupancy()
  expect(count, (r) => r.status === 200 && r.json('count') >= 1, 'occupancy answers')

  sleepUntil(start + (((index * RUN_SECONDS) / USERS) + REPEAT_AFTER) * 1000)
  const second = checkIn('2')
  expect(second, (r) => r.status === 200 && r.json('session.id') === sessionId, 'round 2 returns the same session')
}

// Every virtual user starts together, so the 50 pairs of requests reach the server at the same moment.
function burst() {
  const [a, b] = checkInTwice()
  const created = [a, b].filter((r) => r.status === 201)
  const repeated = [a, b].filter((r) => r.status === 200)
  const same = created.length === 1 && repeated.length === 1 && created[0].json('session.id') === repeated[0].json('session.id')
  if (!same) console.warn(`burst: ${a.status} ${String(a.body).slice(0, 80)} | ${b.status} ${String(b.body).slice(0, 80)}`)
  check(a, { 'burst pair: one 201, one 200, same session': () => same })
  expect(occupancy(), (r) => r.status === 200 && r.json('count') >= 1, 'occupancy answers')
}

// After the run the occupancy must be the baseline plus the users.
export function teardown(data) {
  const jar = new http.CookieJar()
  Object.entries(signIn(accounts[0])).forEach(([name, values]) => jar.set(BASE, name, values[0]))
  const response = occupancy({ jar })
  console.log(`occupancy: ${data.inside} before, ${response.json('count')} after ${USERS} users`)
  check(response, { 'occupancy rose by the users': (r) => r.json('count') === data.inside + USERS })
}
