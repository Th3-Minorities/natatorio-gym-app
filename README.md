# Natatorio Gym App

## Local containers

Install Docker Desktop and start it. From the repository root, run:

```powershell
docker compose --profile development up -d --build --wait
```

The proxy is at <http://localhost:8080>. Its published port is bound to this computer's localhost only, not to the local network or public internet. The Mailpit inbox is at <http://localhost:8080/mailpit/>. The PHP API and PWA files are supplied by issues #47 and #48; this infrastructure issue does not add their application code.

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

## Test on a phone

Install `cloudflared`, then run this in a second terminal while the stack is up:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Open the HTTPS URL printed by `cloudflared` on the phone. The tunnel forwards requests to the localhost-only proxy and is for fake development data only. It is not part of Docker Compose. Production needs separate HTTPS and network configuration before the proxy is exposed.