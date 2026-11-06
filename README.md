# Natatorio Gym App

To find a document or read an ID like `REQ-F-12`, `E-31` or `S-01`, start with [docs/README.md](docs/README.md).

## Local containers

Install Docker Desktop and start it. From the repository root, run:

```powershell
docker compose --profile development up -d --build --wait
```

The proxy is at <http://localhost:8080>. Its published port is bound to this computer's localhost only, not to the local network or public internet. The Mailpit inbox is at <http://localhost:8080/mailpit/>. It only answers on `localhost` or `127.0.0.1`, so the phone tunnel cannot reach it. The proxy image builds the PWA from `frontend/`, so the page at `/` is the PWA. After you change the frontend, run the same command again to rebuild it, or use the dev server below.

Mailpit is only for local development. Before production, disable the `development` profile and set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` and `MAIL_SCHEME` in protected environment configuration for the CTI SMTP server or relay. Do not commit production credentials. Use an external mail provider only after approval, since account email addresses would leave the CTI VM. The CTI mail settings are still pending.

To use different local settings, copy `.env.example` to `.env` and edit it before starting the stack. The default database password is for local development only. Do not use it for production.

The database password and the `btree_gist` extension only apply when the database volume is first created. If you change the password in `.env` later, or your volume is older than the extension, the database keeps the old settings. To start over, run `docker compose --profile development down --volumes` and start the stack again. This deletes all local database data and uploaded photos, so only do it with fake data.

Stop the containers and keep the database:

```powershell
docker compose --profile development down
```

Include `--profile development` when stopping the stack so Compose also stops Mailpit. This removes the containers and network, but keeps the PostgreSQL and private-photo data volumes and downloaded images. Images may still appear in Docker Desktop; they are not running containers.

If you started the stack before private photos moved to `/var/www/private`, PHP cannot write to your old photo volume. Delete it once (it only holds fake data): `docker volume rm natatorio-gym-app_private_photos`.

Delete both data volumes too:

```powershell
docker compose --profile development down --volumes
```

## Backend (Laravel API)

The API is in `backend/`. You do not install PHP or Composer on your computer: they run inside the `app` container. Run every command below from the repository root while the stack is up.

Commands in the `app` container run as the `www-data` user, the same user that answers web requests. That way no command creates a file the API cannot write, such as a log file. If a command ever needs root, add `-u root`: `docker compose exec -u root app ...`.

- **Your setup is older than this rule** (you ran the commands below before as root): give the files back to `www-data` once, with the stack up:

  ```powershell
  docker compose exec -u root app chown -R www-data:www-data .
  ```

- **Docker installed directly on Linux** (not Docker Desktop): the repository folder belongs to your user, so `www-data` cannot write to it. Run this once, from the repository root, before step 1:

  ```bash
  chmod -R a+rwX backend
  ```

  This opens the folder to every user, which is fine on a development computer and in CI. The CTI production server needs more care: there, give the folder to the right owner instead of opening it to everyone. That belongs to the deployment issue.

  Local development directly on Linux is not tested yet: this setup was tested with Docker Desktop on Windows and in CI on Linux. Two things to expect. Files you add later (new files from your editor or `git pull`) are not writable by `www-data` until you run the `chmod` again. And files the containers create, such as `vendor/` or files from `php artisan make:...`, belong to `www-data`, so you may need `sudo` to edit or delete them on your computer.

### First run, step by step

Step 1 sets up a fresh clone and starts the stack each day.

1. Start Docker Desktop. Then, from the repository root, start the containers:

   ```powershell
   docker compose --profile development up -d --build --wait
   ```

   With the default `APP_ENV=local`, the app installs missing PHP packages, creates `backend/.env` and its key if needed, and runs pending migrations as `www-data` before PHP-FPM starts. Restarts keep the key and data. The first install can take several minutes. Set `APP_ENV=production` in the stack environment to skip this setup in production.

2. Open <http://localhost:8080> for the PWA. Check the API at <http://localhost:8080/api/health> or run this command. You should see `{"status":"ok"}`:

   ```powershell
   curl.exe http://localhost:8080/api/health
   ```

3. Run the tests. They should all pass:

   ```powershell
   docker compose exec app php artisan test
   ```

The tests use their own database, `natatorio_gym_test`, so they never wipe your development data.

Note: if your database volume is older than issue #47, create the test database once. New volumes create it during startup. In Git Bash, run `export MSYS_NO_PATHCONV=1` first:

```powershell
docker compose exec db sh /docker-entrypoint-initdb.d/02-test-database.sh
```

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

## Frontend (React PWA)

The PWA is in `frontend/`. Install Node 22 (the version in `frontend/.nvmrc`; `nvm use` picks it). Other versions are refused on purpose, so everyone builds with the same one. Run these from `frontend/`:

```powershell
npm ci            # once, and after package-lock.json changes
npm run dev       # dev server at http://localhost:5173, reloads on save
npm run lint
npm test          # page tests
npm run test:e2e  # browser test through the proxy at http://localhost:8080
```

The dev server sends `/api` to the proxy, so the stack must be up. The browser only sees one origin, which keeps login cookies working. Before the first `test:e2e`, run `npx playwright install chromium` once.

GitHub runs `.github/workflows/frontend.yml` on every pull request: lint, build, page tests, and the browser test against the full stack.

## Test on a phone

Install `cloudflared`, then run this in a second terminal while the stack is up:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Open the HTTPS URL printed by `cloudflared` on the phone. Anyone with that URL can reach the app while the tunnel runs, so use it with fake development data only. The Mailpit inbox is blocked through the tunnel. It is not part of Docker Compose. Production needs separate HTTPS and network configuration before the proxy is exposed.