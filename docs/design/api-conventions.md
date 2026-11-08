# API Conventions

Rules every backend route follows, so errors and routes look the same across features. Set up in GitHub issue #47. Requirements: REQ-NF-10, REQ-NF-12.

## 1. Routes

- Every backend route is under `/api`. The proxy sends `/api` to Laravel and everything else to the PWA (architecture.md, D2). Routes go in `backend/routes/api.php`, written without the prefix: `Route::get('/health', ...)` answers at `/api/health`.
- Laravel packages that add their own paths (Sanctum, Fortify) must be moved under `/api` with their prefix setting (D2).
- Paths use lowercase nouns with hyphens: `/api/check-ins`, `/api/schedule-slots/{id}`.
- Requests and responses are JSON. The PWA sends `Accept: application/json`.
- Dates and times in JSON are ISO 8601 in UTC, ending in `Z`, which is Laravel's default (`2026-10-27T01:00:00.000000Z`). The PWA converts them to Puerto Rico time before showing them, in the format of REQ-NF-38 (`5 nov 2026, 8:30 a. m.` in Spanish, `Nov 5, 2026, 8:30 AM` in English).
- `/api` responses are never cached by the service worker (REQ-NF-26).

### Health check

`GET /api/health` answers `200 {"status":"ok"}` when Laravel is running and can reach the database. If the database does not answer, it returns `503` with the code `database_unavailable`. It shows no versions or other internals.

```powershell
curl http://localhost:8080/api/health
```

## 2. Error format

Every error from an `/api` route has this shape, whatever caused it. It carries a code and no text (E-154):

```json
{
  "error": {
    "code": "validation_failed",
    "details": { "email": ["required"], "password": ["min"] }
  }
}
```

| Field | Always there | Meaning |
|---|---|---|
| `code` | Yes | Stable, snake_case, no dots. Start with the feature when it helps: `check_in_location_denied`. The PWA decides what to do and what to show based on this. Once released, a code never changes meaning or name |
| `details` | No | Extra data. For `validation_failed`, it maps each field to a list of rule codes in snake_case, such as `required` or `min`. It holds no text |
| `debug` | Only with `APP_DEBUG=true` | Exception class, message and file, for developers. Never on in production |

The API sends no text for the person. The PWA holds the only texts, in `frontend/src/i18n/es.ts` and `en.ts`, under `errors.<code>` and `validation.<rule>`, and shows them in the account language. If the PWA gets a code it has no text for, it shows the general `bad_request` text, or `server_error` for a 5xx status. For an unknown rule it shows a general "check this field" text.

The backend translates only what does not pass through the PWA, such as emails (REQ-NF-35), using the `locale` of the account it sends to.

The HTTP status still matters (401, 404, 422 and so on). The `code` says exactly which case it is.

### Codes Laravel raises by itself

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Malformed request |
| 401 | `unauthenticated` | Not signed in |
| 403 | `forbidden` | Signed in, but not allowed (a Policy said no) |
| 404 | `not_found` | Unknown route or record |
| 405 | `method_not_allowed` | Wrong HTTP method for the route |
| 409 | `conflict` | The data changed in a way that blocks the action |
| 413 | `payload_too_large` | The file or body is too large |
| 419 | `session_expired` | The CSRF token or session expired (Sanctum cookies) |
| 422 | `validation_failed` | A form field is wrong. See `details` |
| 429 | `too_many_requests` | An attempt limit was hit. The `Retry-After` header says how long to wait |
| 503 | `service_unavailable` | The service is down for a moment |
| 500 | `server_error` | A bug or an unexpected failure. The response never shows internals |

### Adding a code for a feature

When a feature has an error the PWA must handle on its own, throw an `ApiException` with a new code:

```php
use App\Exceptions\ApiException;

throw new ApiException('authorization_number_invalid', 422);
```

- Pick a code that names the case, not the screen: `authorization_number_invalid`, not `registration_error`.
- Pass the code as a plain string, as the first argument.
- Add the text to both `frontend/src/i18n/es.ts` and `en.ts`, under `errors.<code>`. A frontend test reads the codes in `backend/app`, `backend/routes` and `backend/bootstrap` and fails if a code has no text in both files. A backend test fails if a code is not snake_case or not a plain string.
- A new validation rule works the same way: add `validation.<rule>` to both files.
- `ApiException` errors are expected, so they are not written to the error log.
- List the new code in the OpenAPI contract for that route.
- Do not use `abort(404, 'text')` to send text to the person: the API sends no text. Use `ApiException`.

The code is in `backend/app/Exceptions/ApiErrorRenderer.php`, and the tests are in `backend/tests/Feature/ApiErrorFormatTest.php`.

## 3. Database work: Laravel defaults versus our data model

Laravel ships its own tables and names. Some of them clash with `data-model.md`. Check this list before writing the first real migration:

- **`users` migration.** Laravel's default (`0001_01_01_000000_create_users_table.php`) adds `name`, `email_verified_at` and `remember_token`, and a plain unique index on `email`. Our model has no name and no email verification, and it needs `locale`, `current_session_id`, `last_signed_in_at`, `deleted_at` and a unique index on `lower(email)`. Nothing is in production yet, so edit that migration in place instead of adding a second one that alters it.
- **Sessions table.** Laravel calls it `sessions`. Our model calls it `sign_in_sessions`, so it is never confused with `facility_sessions` (the gym visits, open until check-out or 2 hours, E-115). Rename it in the migration **and** set `SESSION_TABLE=sign_in_sessions`, or sign in breaks. Never name a table plain `sessions`.
- **Framework tables we keep.** `migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` and `password_reset_tokens`. `data-model.md` lists most of them. Laravel also creates `cache_locks` and `job_batches`. Do not reuse these names for our own tables.
- **No `personal_access_tokens`.** That table is for Sanctum API tokens. We use Sanctum cookies (context.md), so do not publish that migration.
- **Time zones.** Laravel runs in `America/Puerto_Rico` (`config/app.php`, REQ-NF-37), so `today()`, `now()` and scheduled task times are Puerto Rico times. Puerto Rico has no daylight saving time. Do not change it back to UTC: from 8 PM to midnight, UTC is already the next day. The PostgreSQL connection uses the same zone (`config/database.php`), because Laravel sends dates without a zone: if the two ever differ, every `timestamptz` is saved hours off. `TimezoneTest` checks both. Laravel also writes a date in the zone of the Carbon it receives, without converting, so a UTC date from the API (`...Z`) would be saved 4 hours late. Every model uses the `SavesDatesInAppTimezone` trait to convert first (`ModelDatesTest` checks that each model has it). The trait does not cover a Carbon passed as a query value, as in `where('starts_at', '>', $carbon)`: convert it first with `->setTimezone(config('app.timezone'))`. In the database, `$table->timestamps()` makes `timestamp` columns without a time zone in PostgreSQL. The model says `timestamptz`, so use `timestampsTz()`, `timestampTz()` and `softDeletesTz()`.
- **Model names.** Laravel guesses the table from the model class. Every model in the data model guesses right (checked: `FacilityInformation` becomes `facility_information`, `AuditLogEntry` becomes `audit_log_entries`). A new model with a different name may not, so set `$table` when in doubt.
- **`settings`.** Its key is `name`, a string. The model needs `$primaryKey = 'name'`, `$incrementing = false` and `$keyType = 'string'`.
- **`btree_gist`.** The Docker init scripts turn it on in a fresh local database. The CTI database will not run those scripts, so the first migration that needs it must also run `CREATE EXTENSION IF NOT EXISTS btree_gist`.
- **Tests.** Tests run on their own database, `natatorio_gym_test`, never on the development one. `tests/TestCase.php` stops any test run whose database name does not end in `_test`.

## 4. Commands

Run them from the repository root while the containers are up:

| What | Command |
|---|---|
| Install PHP packages | `docker compose exec app composer install` |
| Run migrations | `docker compose exec app php artisan migrate` |
| Fresh database with fake data | `docker compose exec app php artisan migrate:fresh --seed` |
| Seed fake data only | `docker compose exec app php artisan db:seed` |
| All tests | `docker compose exec app php artisan test` |
| One test | `docker compose exec app php artisan test --filter test_health_check_answers_ok_when_the_database_is_reachable` |
| Lint (code style) | `docker compose exec app composer lint` |
| Fix code style | `docker compose exec app vendor/bin/pint` |
| Create the first Administrator | `docker compose exec app php artisan staff:create-admin --name="Ana Rivera" --email="ana@example.com"` |
| Clear a sign-in lockout | `docker compose exec app php artisan cache:clear` |

The seeder is empty for now. Each feature adds its own seeder with fake data only, never real student or payment data (context.md, team rules).

## 5. CI

`.github/workflows/backend.yml` runs on every pull request and on every push to `main`. It builds the same images, starts the containers, then runs lint, migrations, the seeder and the tests. At the end it calls `/api/health` through the proxy. If any step fails, the PR shows a red check.

## 6. Staff sign-in, roles and the audit log

Set up in GitHub issue #16. Requirements: REQ-F-07, REQ-F-52, REQ-F-88, REQ-NF-10, REQ-NF-39.

### Staff sign-in

Staff and Administrators sign in with their own staff account (data-model.md, D13). Laravel keeps it on a separate guard, `staff`, on the `staff_accounts` table, so a staff sign-in and a User sign-in never mix. Staff sign-in does not use Fortify, which stays free for the User sign-in (#15).

The PWA calls `GET /api/sanctum/csrf-cookie` first and then sends the `X-XSRF-TOKEN` header on every POST. Sanctum starts a cookie session only when the page calling the API is on the same address as the API. By default (`config/sanctum.php`, `stateful`) that means the address the request came to, which covers the dev server, the phone tunnel and the UPRM subdomain, plus `APP_URL` and the usual localhost addresses. Setting `SANCTUM_STATEFUL_DOMAINS` replaces that whole list, so leave it unset. A page on another site gets no session, and its sign-in answers `419 session_expired`.

| Route | Who | Answer |
|---|---|---|
| `POST /api/staff/sign-in` | Anyone | `200` with `name`, `email`, `role` and `locale` |
| `POST /api/staff/sign-out` | Staff, Administrator | `204` |
| `GET /api/staff/me` | Staff, Administrator | `200` with `name`, `email`, `role` and `locale` |

The sign-in matches the email in any case.

| Status | Code | When |
|---|---|---|
| 422 | `staff_credentials_invalid` | Wrong email or password, an invited account with no password yet, or the email and password of a User account. They get the same answer on purpose, so nobody can test which emails exist |
| 403 | `staff_account_deactivated` | At sign-in, with the right password, for an account an Administrator deactivated |
| 401 | `staff_account_deactivated` | On any later request, when the account was deactivated while signed in |
| 401 | `staff_session_expired` | 2 hours without activity for Staff, 20 minutes for an Administrator |
| 429 | `too_many_requests` | 10 failed tries for that email or IP. `Retry-After` gives the seconds to wait |

### Attempt limit

After 10 failed sign-ins for one email, or from one IP, that email or IP waits (REQ-F-07). The first wait is 1 minute, then 5, then 15, then 60 for each later lockout. Failures older than an hour start again from zero, and the waits go back to 1 minute a day after the last lockout. The counters live in the `cache` table and expire on their own (E-91). A right password resets the count of the email but not the count of the IP, so one valid account cannot reset the count for guessing others.

### Inactivity and automatic refreshes

A staff sign-in ends after 2 hours without activity, an Administrator sign-in after 20 minutes (E-130). Every request counts as activity unless it carries the header `X-Auto-Refresh: 1`. The PWA sends that header on each request the screen makes by itself, like polling, and never on a request a person started with a tap or a key.

When a sign-in times out, the next request gets `401 staff_session_expired`, and the audit log gets a `staff.sign_out` entry with `{"ended_by": "timeout"}`. If no request at all reaches the server, Laravel's own session lifetime (`SESSION_LIFETIME`, 120 minutes) ends the sign-in without an entry, as with a closed browser.

### Roles on routes

Put every gym route in a group with these three middleware, in this order:

```php
Route::middleware(['auth:staff', 'staff.active', 'role:admin'])->group(function () {
    // Administrator actions
});
```

- `auth:staff`: a staff account is signed in. Otherwise `401 unauthenticated`.
- `staff.active`: the account is still active and the sign-in has not timed out.
- `role:staff,admin` or `role:admin`: pick it from the role table in the SRS overview. Any other role gets `403 forbidden`.

`RouteProtectionTest` fails when an `/api` route lacks these checks and is not on its list of public routes. Add a route to that list only when anyone may call it without signing in.

### Audit log

Gym features write entries with `App\Services\AuditLog`:

```php
public function revoke(Request $request, Authorization $authorization, AuditLog $log)
{
    $before = $authorization->only('status');
    // change the authorization
    $log->record('authorization.revoke', $authorization, $before, $authorization->only('status'), $request->input('reason'));
}
```

The service adds the signed-in staff account, the time, the IP address and the browser. It throws an error when no staff account is signed in, because an entry with no account means a system alert. For alerts the system raises by itself, like the global lookup limit (REQ-F-71), use `recordSystem()`. Name actions `area.verb` in snake_case, like `staff.sign_in`. The model refuses to update or delete an entry (E-108). The retention job (#71) deletes old entries with a query delete, which skips that check.

### Real client IP

nginx passes requests straight to PHP, so Laravel sees the address that connected to nginx. `TRUSTED_PROXIES` lists the proxies in front of nginx that may set the client IP with `X-Forwarded-For`, comma separated. Empty, the default, means no proxy is in front, and Laravel ignores the header. On your own computer every request comes from the Docker gateway (an address like `172.19.0.1`), so audit entries show that address. The phone tunnel should pass on the phone's IP once you add that gateway to `TRUSTED_PROXIES` in your `.env`; nobody has checked it on a phone yet. The production value depends on CTI's answer to M-01 (architecture.md, gaps 5).

### First Administrator

`php artisan staff:create-admin --name="..." --email="..."` creates the first Administrator and prints its password once (REQ-F-88). The account is in Spanish unless you add `--locale=en`. The command refuses when an active Administrator already exists or when another staff account uses the email. Without `--name` or `--email` it asks for them, except with `--no-interaction`. The install script (#66) runs it. The development seeder already creates `admin@example.com`, so on a seeded database the command refuses.

## 7. Staff accounts, invitations and password reset

Set up in GitHub issue #84. Requirements: REQ-F-88, REQ-NF-10.

### Staff accounts screen

Only an Administrator calls these routes (`auth:staff`, `staff.active`, `role:admin`). Each route that changes an account answers with that account as `{"account": {...}}`, with `id`, `name`, `email`, `role` (`staff` or `admin`) and `status` (`active`, `invited` or `deactivated`). Accounts are never deleted.

| Route | Body | Answer |
|---|---|---|
| `GET /api/staff/accounts` | | `200` with `accounts`: active first, then invited, then deactivated, each group by name |
| `POST /api/staff/accounts` | `name`, `email`, `role` | `201` with the new invited account. It sends the invitation email |
| `POST /api/staff/accounts/{id}/invitation` | | `204`. It sends a new invitation email |
| `PATCH /api/staff/accounts/{id}/role` | `role` | `200` |
| `POST /api/staff/accounts/{id}/deactivate` | | `200`. The account's open sign-ins end at their next request with `401 staff_account_deactivated` |
| `POST /api/staff/accounts/{id}/reactivate` | | `200` |

| Status | Code | When |
|---|---|---|
| 422 | `validation_failed` with `email: ["unique"]` | Another staff account has the email, in any case. Two invitations for one email at the same moment get the same answer |
| 409 | `staff_account_not_invited` | Resending to an account that is not invited |
| 409 | `staff_role_own_account` | An Administrator changing their own role |
| 409 | `staff_deactivate_own_account` | An Administrator deactivating their own account |
| 409 | `staff_last_administrator` | The change would leave no active Administrator |
| 409 | `staff_account_status_changed` | The account changed while the screen showed it, for example someone else deactivated it. The PWA reloads the list |
| 429 | `too_many_requests` | More than 10 invitations or resends in a minute by one Administrator, because each one sends an email |

The audit log gets `staff.invite`, `staff.invite_resend`, `staff.role_change`, `staff.deactivate` and `staff.reactivate`. The `staff.invite` entry keeps the name and role but not the email, which is already on the account.

### Invitation link

The email links to `/staff/invitacion?token=...`. The link works once and lasts 7 days. A new invitation replaces the old link, so only the newest email works. The database keeps only a SHA-256 hash of the token.

| Route | Body | Answer |
|---|---|---|
| `POST /api/staff/invitation/validate` | `token` | `200` with `name`, `email` and `role`, for the "Crear tu contraseña" page |
| `POST /api/staff/invitation/accept` | `token`, `password`, `password_confirmation` | `204`. The account becomes active and the person signs in on N-11 |

An unknown, used or expired link, or a link for a deactivated account, gets `422 staff_invite_link_invalid`. They all get the same answer, so the link reveals nothing more. Accepting writes `staff.invite_accept`, with the invited account as the one acting.

### Forgotten password

| Route | Body | Answer |
|---|---|---|
| `POST /api/staff/password/email` | `email` | `200 {"status": "received"}` for any email |
| `POST /api/staff/password/validate` | `email`, `token` | `204` |
| `POST /api/staff/password/reset` | `email`, `token`, `password`, `password_confirmation` | `204` |

- The email links to `/staff/restablecer?token=...&email=...`. It uses Laravel's password broker `staff_accounts`, on the `staff_password_reset_tokens` table. The link lasts 60 minutes, and a second email for the same account within 60 seconds is not sent.
- The server sends the email after it answers, so neither the answer nor its timing says whether the email has an account.
- Only active accounts with a password get an email. Invited people use their invitation. Deactivated people ask an Administrator.
- A wrong, used or expired link gets `422 staff_reset_link_invalid`. A link from the User reset (#15) gets the same answer, because the two keep their tokens in different tables.
- A reset writes `staff.password_reset`, and ends every sign-in of that account, on every device. Each staff sign-in keeps a fingerprint of the password (an HMAC of the password hash with the app key). When the password changes, the next request from an old sign-in gets `401 unauthenticated`.

### Password rules

A new password, from an invitation or a reset, needs at least 10 characters and must not appear in a known data leak (`uncompromised()`). There are no other composition rules. Laravel sends only the first 5 characters of the password's SHA-1 hash to the leak service. If the service does not answer, the password is accepted. A failure comes back as `validation_failed` with `password: ["password"]` for either reason, or `["confirmed"]` when the two do not match.

### Attempt limits

These routes are public, so each one has its own limit per IP, per minute: 10 for `password/email`, `password/reset` and `invitation/accept`, and 30 for the two `validate` routes. Over the limit, the answer is `429 too_many_requests` with `Retry-After`.
