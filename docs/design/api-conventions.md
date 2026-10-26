# API Conventions

Rules every backend route follows, so errors and routes look the same across features. Set up in GitHub issue #47. Requirements: REQ-NF-10, REQ-NF-12.

## 1. Routes

- Every backend route is under `/api`. The proxy sends `/api` to Laravel and everything else to the PWA (architecture.md, D2). Routes go in `backend/routes/api.php`, written without the prefix: `Route::get('/health', ...)` answers at `/api/health`.
- Laravel packages that add their own paths (Sanctum, Fortify) must be moved under `/api` with their prefix setting (D2).
- Paths use lowercase nouns with hyphens: `/api/check-ins`, `/api/schedule-slots/{id}`.
- Requests and responses are JSON. The PWA sends `Accept: application/json`.
- Dates and times in JSON are ISO 8601 in UTC, ending in `Z`, which is Laravel's default (`2026-10-27T01:00:00.000000Z`). The PWA converts them to Puerto Rico time before showing them, in the format of REQ-NF-38 (`2026-10-13 3:05 PM`).
- `/api` responses are never cached by the service worker (REQ-NF-26).

### Health check

`GET /api/health` answers `200 {"status":"ok"}` when Laravel is running and can reach the database. If the database does not answer, it returns `503` with the code `database_unavailable`. It shows no versions or other internals.

```powershell
curl http://localhost:8080/api/health
```

## 2. Error format

Every error from an `/api` route has this shape, whatever caused it:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Algunos campos necesitan corrección.",
    "details": { "email": ["The email field is required."] }
  }
}
```

| Field | Always there | Meaning |
|---|---|---|
| `code` | Yes | Stable, snake_case, no dots. Start with the feature when it helps: `check_in_location_denied`. The PWA decides what to do based on this, never on `message`. Once released, a code never changes meaning or name |
| `message` | Yes | Short text for the person. For now it uses the app language (`APP_LOCALE`, Spanish by default). The language of each account comes with the language feature. Field messages in `details` are still in English until someone adds Spanish validation texts |
| `details` | No | Extra data. For `validation_failed`, the list of messages for each field |
| `debug` | Only with `APP_DEBUG=true` | Exception class, message and file, for developers. Never on in production |

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
| 500 | `server_error` | A bug or an unexpected failure. The message never shows internals |

### Adding a code for a feature

When a feature has an error the PWA must handle on its own, throw an `ApiException` with a new code:

```php
use App\Exceptions\ApiException;

throw new ApiException('authorization_number_invalid', 422, __('registration.number_invalid'));
```

- Pick a code that names the case, not the screen: `authorization_number_invalid`, not `registration_error`.
- Add the code with its text to both `backend/lang/es/errors.php` and `backend/lang/en/errors.php`. With no message in the `ApiException`, the text comes from there. Pass the code as a plain string, as the first argument. A test reads `backend/app`, `backend/routes` and `backend/bootstrap` and fails if a code is not snake_case, has no text in both files, or is not a plain string.
- If a text is missing anyway, the person never sees the raw key `errors.<code>`: the message falls back to the general `bad_request` text (or `server_error` for a 5xx status).
- `ApiException` errors are expected, so they are not written to the error log.
- List the new code in the OpenAPI contract for that route.
- Do not use `abort(404, 'text')` to send text to the person: the text is hidden on purpose. Use `ApiException`.

The code is in `backend/app/Exceptions/ApiErrorRenderer.php`, and the tests are in `backend/tests/Feature/ApiErrorFormatTest.php`.

## 3. Database work: Laravel defaults versus our data model

Laravel ships its own tables and names. Some of them clash with `data-model.md`. Check this list before writing the first real migration:

- **`users` migration.** Laravel's default (`0001_01_01_000000_create_users_table.php`) adds `name`, `email_verified_at` and `remember_token`, and a plain unique index on `email`. Our model has no name and no email verification, and it needs `locale`, `current_session_id`, `deleted_at` and a unique index on `lower(email)`. Nothing is in production yet, so edit that migration in place instead of adding a second one that alters it.
- **Sessions table.** Laravel calls it `sessions`. Our model calls it `sign_in_sessions`, so it is never confused with `facility_sessions` (the 60-minute gym visits). Rename it in the migration **and** set `SESSION_TABLE=sign_in_sessions`, or sign in breaks. Never name a table plain `sessions`.
- **Framework tables we keep.** `migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` and `password_reset_tokens`. `data-model.md` lists most of them. Laravel also creates `cache_locks` and `job_batches`. Do not reuse these names for our own tables.
- **No `personal_access_tokens`.** That table is for Sanctum API tokens. We use Sanctum cookies (context.md), so do not publish that migration.
- **Time zones.** Laravel runs in `America/Puerto_Rico` (`config/app.php`, REQ-NF-37), so `today()`, `now()` and scheduled task times are Puerto Rico times. Puerto Rico has no daylight saving time. Do not change it back to UTC: from 8 PM to midnight, UTC is already the next day. The PostgreSQL connection uses the same zone (`config/database.php`), because Laravel sends dates without a zone: if the two ever differ, every `timestamptz` is saved hours off. `TimezoneTest` checks both. In the database, `$table->timestamps()` makes `timestamp` columns without a time zone in PostgreSQL. The model says `timestamptz`, so use `timestampsTz()`, `timestampTz()` and `softDeletesTz()`.
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

The seeder is empty for now. Each feature adds its own seeder with fake data only, never real student or payment data (context.md, team rules).

## 5. CI

`.github/workflows/backend.yml` runs on every pull request and on every push to `main`. It builds the same images, starts the containers, then runs lint, migrations, the seeder and the tests. At the end it calls `/api/health` through the proxy. If any step fails, the PR shows a red check.
