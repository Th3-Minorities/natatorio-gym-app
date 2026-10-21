# Natatorio Gym App

## Local containers

Install Docker Desktop and start it. From the repository root, run:

```powershell
docker compose --profile development up -d --build --wait
```

The proxy is at <http://localhost:8080>. Its published port is bound to this computer's localhost only, not to the local network or public internet. The Mailpit inbox is at <http://localhost:8080/mailpit/>. The PWA files are supplied by issue #48.

Mailpit is only for local development. Before production, disable the `development` profile and set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` and `MAIL_SCHEME` in protected environment configuration for the CTI SMTP server or relay. Do not commit production credentials. Use an external mail provider only after approval, since account email addresses would leave the CTI VM. The CTI mail settings are still pending.

To use different local settings, copy `.env.example` to `.env` and edit it before starting the stack. The default database password is for local development only. Do not use it for production.

Stop the containers and keep the database:

```powershell
docker compose --profile development down
```

Include `--profile development` when stopping the stack so Compose also stops Mailpit. This removes the containers and network, but keeps the PostgreSQL and private-photo data volumes and downloaded images. Images may still appear in Docker Desktop; they are not running containers.

Delete both data volumes too:

```powershell
docker compose --profile development down --volumes
```

## Backend (Laravel API)

The API is in `backend/`. You do not install PHP or Composer on your computer: they run inside the `app` container. Run every command below from the repository root while the stack is up.

### First run, step by step

Do this once on your computer. After that, step 1 is all you need each day.

1. Start Docker Desktop. Then, from the repository root, start the containers:

   ```powershell
   docker compose --profile development up -d --build --wait
   ```

2. Install the PHP packages. They go in `backend/vendor/`, which is not in git:

   ```powershell
   docker compose exec app composer install
   ```

3. Create `backend/.env` (not in git) and give it a secret key:

   ```powershell
   docker compose exec app sh -c "cp -n .env.example .env && php artisan key:generate"
   ```

4. Create the tables:

   ```powershell
   docker compose exec app php artisan migrate
   ```

5. Restart the scheduler. It was waiting for the packages from step 2:

   ```powershell
   docker compose restart scheduler
   ```

6. Only if your database volume is older than issue #47: create the test database. A new volume creates it by itself. In Git Bash, run `export MSYS_NO_PATHCONV=1` first, or Git Bash rewrites the path:

   ```powershell
   docker compose exec db sh /docker-entrypoint-initdb.d/02-test-database.sh
   ```

7. Check that the API answers through the proxy. You should see `{"status":"ok"}`. You can also open <http://localhost:8080/api/health> in the browser:

   ```powershell
   curl.exe http://localhost:8080/api/health
   ```

8. Run the tests. They should all pass:

   ```powershell
   docker compose exec app php artisan test
   ```

The tests use their own database, `natatorio_gym_test`, so they never wipe your development data.

### Slow on Windows

On Windows, each API request can take 7 to 20 seconds, and the tests about a minute. The cause is Docker Desktop reading the PHP files from a Windows folder; the code itself is fast (one measurement: Laravel started in 7.8 s from the Windows folder and in 0.17 s from inside the container). A repo inside OneDrive is likely slower still. CI runs on Linux and is not affected. Possible fixes for later: turn on OPcache in the PHP image, keep `backend/vendor/` in a Docker volume, or keep the repo in the WSL file system instead of a Windows folder.

### Everyday commands

| What | Command |
|---|---|
| Run all tests | `docker compose exec app php artisan test` |
| Run one test | `docker compose exec app php artisan test --filter test_health_check_answers_ok_when_the_database_is_reachable` |
| Check code style | `docker compose exec app composer lint` |
| Fix code style | `docker compose exec app vendor/bin/pint` |
| Run new migrations | `docker compose exec app php artisan migrate` |
| Start the database over with fake data | `docker compose exec app php artisan migrate:fresh --seed` |
| After someone changes `composer.json` | `docker compose exec app composer install` |

Run the tests and the style check before you open a PR. CI runs the same ones.

### CI

GitHub runs `.github/workflows/backend.yml` on every pull request and on every push to `main`. Nothing to set up. It builds the same containers, then runs the style check, the migrations, the seeder and the tests, and calls `/api/health` through the proxy. The result shows as a check on the PR. Click "Details" to see which step failed.

API rules, the error format and notes for database work are in `docs/design/api-conventions.md`. Read it before you add a route or a migration.

## Test on a phone

Install `cloudflared`, then run this in a second terminal while the stack is up:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Open the HTTPS URL printed by `cloudflared` on the phone. The tunnel forwards requests to the localhost-only proxy and is for fake development data only. It is not part of Docker Compose. Production needs separate HTTPS and network configuration before the proxy is exposed.