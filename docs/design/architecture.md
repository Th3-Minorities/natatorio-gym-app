# Architecture and Deployment

This document shows how the system is built and where it runs. It replaces the Supabase and Vercel picture of the proposal (`docs/capstone_proposal/diagrams/01_architecture.png`) with the current stack: a React PWA, a Laravel backend and PostgreSQL, all in `docker-compose` (`docs/context.md` section 2). It covers the outside systems, the containers, development versus production, the demo environment, and the path of one Check In from the phone to the database. Inside the diagrams, items that still wait for CTI say "pending CTI answer" in words. The table "Pending CTI items" after diagram 4 maps them to their question IDs (`docs/decisions/cti.md`). Dashed lines and dashed boxes mean pending or proposed.

## Diagrams

### 1. System context

**Type:** Context diagram. **Use it to:** agree on which outside systems the team must connect to, and which of them wait on CTI.

Only the Administrator brings in WooCommerce data, by uploading an Export Orders file. There is no API link in the MVP.

```mermaid
flowchart LR
  U["User<br/>paid member or athlete<br/>mostly on a phone"]
  G["Gym account<br/>Staff without PIN<br/>Administrator with PIN"]
  SYS["UPRM Weight Gym platform<br/>PWA and Laravel API"]
  GEO["Browser Geolocation API<br/>on the User's phone"]
  WOO["UPRM WooCommerce store"]
  FILE["Export Orders file"]
  LISTS["Department athlete lists"]
  MAIL["CTI outgoing mail<br/>SMTP or relay<br/>pending CTI answer about mail"]
  NAME["UPRM subdomain and HTTPS certificate<br/>pending CTI answer about the name"]

  U -->|"register, Check In, Gym ID"| SYS
  U -->|"gives location permission"| GEO
  GEO -->|"position and accuracy, only at Check In"| SYS
  G -->|"verify, correct, manage"| SYS
  WOO -->|"Administrator runs Export Orders"| FILE
  FILE -->|"uploaded by the Administrator"| SYS
  WOO -.->|"API or webhooks, Stretch only"| SYS
  LISTS -->|"entered by the Administrator each term"| SYS
  SYS -->|"athlete links, password reset"| MAIL
  MAIL -->|"email"| U
  NAME -.-|"how users reach it"| SYS

  classDef pending stroke-dasharray: 5 5
  class MAIL,NAME pending
```

**About this diagram:** the mail box waits on M-07 and the name box on M-03. The dashed WooCommerce link is REQ-F-32 (Stretch, M-12).

Notes:

- Location goes from the Geolocation API to the PWA, which sends it to the backend with the Check In. Coordinates are not stored, only the result of the check (REQ-NF-03, REQ-NF-11).
- Mail carries two kinds of athlete links: the athlete registration link and, since E-58, the "I am an athlete" link that a signed-in User gets at the institutional email of the roster record. Both use the same single-use link mechanism.
- If CTI has no outgoing mail (M-07 answer C), the mail box disappears: athletes are registered in person by Staff (REQ-F-77) and there is no password reset (REQ-F-06, REQ-F-75). The "I am an athlete" link (E-58) cannot be sent either; E-58 does not say what replaces it without mail.
- Payments stay in WooCommerce. The system never talks to the payment side (REQ-F-28, REQ-F-29).

### 2. Containers on one host

**Type:** Container diagram. **Use it to:** write the `docker-compose` file, the proxy rules and the volume setup.

The same `docker-compose` file runs on a member's PC and on the CTI VM. Only the proxy publishes a port. Every other container is on the internal compose network.

```mermaid
flowchart TD
  PH["User phone<br/>browser or installed PWA"]
  FD["Front desk computer<br/>browser with the gym account<br/>device still to confirm with the gym"]

  subgraph HOST["docker-compose on one host: member PC or CTI VM, containers allowed is pending CTI answer"]
    subgraph PXC["proxy container: nginx or Caddy, not decided"]
      PX["HTTPS end and routing<br/>one name for app and API, proposed<br/>pending CTI answer about the name"]
      ST["PWA static files<br/>React, TypeScript, Vite build<br/>served at /"]
    end
    APP["app container<br/>Laravel on PHP-FPM<br/>API at /api"]
    SCH["scheduler container<br/>same image as app<br/>scheduled tasks"]
    DB[("db container<br/>PostgreSQL<br/>pending CTI answer about PostgreSQL")]
    DV[("database volume<br/>disk encryption pending CTI answer")]
    PV[("private photos volume<br/>disk encryption pending CTI answer")]
  end

  MAIL["Mail<br/>development: fake mail server container<br/>production: CTI SMTP or relay, pending CTI answer"]
  BK["Backups outside the host<br/>place and retention pending CTI answer"]

  PH -->|"HTTPS"| PX
  FD -->|"HTTPS"| PX
  PX -->|"/ and app routes"| ST
  PX -->|"/api"| APP
  APP -->|"SQL"| DB
  DB --- DV
  APP -->|"save and stream photos, role checked"| PV
  SCH -->|"SQL"| DB
  SCH -.->|"discard old term photos, retention not set"| PV
  APP -->|"SMTP"| MAIL
  DV -.->|"pending CTI answer about backups"| BK
  PV -.->|"pending CTI answer about backups"| BK

  classDef pending stroke-dasharray: 5 5
  class MAIL,BK pending
```

**About this diagram:** pending items are M-02 (containers), M-03 (name), M-09 (PostgreSQL), M-13 (disk encryption), M-07 (mail) and M-06 (backups). The proxy choice is D1. The front desk device is gym question G-06. Photo retention is REQ-NF-04.

Notes:

- The proxy has no route to the photos volume. A photo is read only through a Laravel route that checks the role (REQ-NF-20). Uploads are JPEG, PNG or HEIC up to 10 MB, saved as JPEG without location metadata (REQ-NF-24).
- The service worker in the PWA does not cache `/api` responses, so stale data is never shown as current (`design-notes.md`, REQ-NF-26). Screens poll `/api` every 20 to 30 seconds (REQ-F-43).
- The scheduler only does cleanup and retention. Session expiry is computed by the backend at query time, from backend time (REQ-NF-01, REQ-F-38).

### 3. Development on each member's PC

**Type:** Deployment diagram. **Use it to:** set up the stack on each member's PC and test location on a real phone.

Each member runs the full stack with Docker Desktop. The desktop browser uses `localhost`. Phones reach the PC through an HTTPS tunnel, because the Geolocation API needs HTTPS (REQ-NF-12).

```mermaid
flowchart LR
  subgraph PC["Member PC with Docker Desktop"]
    BR["Desktop browser<br/>localhost"]
    subgraph DEV["docker-compose, development settings"]
      PX1["proxy"]
      APP1["app<br/>boundary: any test place"]
      SCH1["scheduler"]
      DB1[("PostgreSQL<br/>fake data only")]
      FM["fake mail server<br/>web inbox"]
    end
    TC["tunnel client<br/>cloudflared or ngrok agent<br/>each member chooses"]
  end
  EDGE["Tunnel provider<br/>public HTTPS URL<br/>Cloudflare Quick Tunnel or ngrok"]
  PHONE["Test phone<br/>iPhone or Android"]

  BR -->|"HTTP on localhost"| PX1
  PHONE -->|"HTTPS"| EDGE
  TC -->|"opens outbound tunnel"| EDGE
  EDGE -->|"requests through the tunnel"| TC
  TC -->|"HTTP"| PX1
  PX1 --> APP1
  APP1 --> DB1
  SCH1 --> DB1
  APP1 -->|"SMTP"| FM
  BR -.->|"read test emails"| FM
```

**About this diagram:** the free test boundary comes from REQ-NF-29. The tunnel choice is D7.

Notes:

- Tested on Windows 11 with a Samsung phone: Quick Tunnel gives HTTPS, location works, WebSocket works, SSE does not (`context.md` section 5). ngrok was not tested with the app.
- The tunnel provider ends HTTPS and can see the traffic. Only fake data goes through it (REQ-NF-07, REQ-NF-09).
- Do not publish ports 5000 or 7000 (`context.md` section 3).

### 4. Production and demo

**Type:** Deployment diagram. **Use it to:** plan the CTI VM setup, the image build and the separate demo environment.

Production runs on a CTI VM with a UPRM subdomain and HTTPS. The December demo runs in a separate environment with the classroom boundary, so the classroom boundary never reaches production (REQ-NF-29, team decision E-42). Where the demo runs is not decided (D5).

```mermaid
flowchart LR
  PHN["User phones<br/>campus Wi-Fi or mobile data"]
  DESK["Front desk computer<br/>device still to confirm with the gym"]
  BUILD["Image build in one place<br/>pinned versions, linux/amd64<br/>place not decided"]

  subgraph VM["CTI VM: Ubuntu 26 or Rocky 10. Approval and early access pending CTI answer"]
    subgraph PROD["docker-compose, production. Docker or Podman pending CTI answer"]
      PX2["proxy<br/>HTTPS for the UPRM subdomain<br/>name and certificate pending CTI answer"]
      APP2["app<br/>gym boundary<br/>refuses to start if over 50 m from the gym"]
      SCH2["scheduler"]
      DB2[("PostgreSQL<br/>pending CTI answer")]
      PV2[("photos volume<br/>disk encryption pending CTI answer")]
    end
  end

  subgraph DEMO["Demo environment, December. Host not decided"]
    DEMOAPP["Same images, own database and volumes<br/>classroom boundary<br/>never production settings"]
  end

  SMTP["CTI SMTP or relay<br/>sender, SPF, DKIM<br/>pending CTI answer about mail"]
  BK2["Backup copies outside the VM<br/>pending CTI answer about backups"]

  PHN -->|"HTTPS, reach from the internet pending CTI answer"| PX2
  DESK -->|"HTTPS"| PX2
  PX2 --> APP2
  APP2 --> DB2
  APP2 --> PV2
  SCH2 --> DB2
  APP2 -->|"SMTP"| SMTP
  DB2 -.->|"pending"| BK2
  PV2 -.->|"pending"| BK2
  BUILD -.-> PROD
  BUILD -.-> DEMOAPP

  classDef pending stroke-dasharray: 5 5
  class SMTP,BK2,BUILD,DEMO pending
```

**About this diagram:** pending CTI items are M-01 (reach from the internet), M-02, M-03, M-04, M-05, M-06, M-07, M-09 and M-13; see the table below. The demo host is D5 and the build place is D8.

Notes:

- The 50 m startup check is how REQ-NF-29 is enforced (`design-notes.md`, team decision E-16). How the app knows it is production is D6.
- Server credentials live in protected configuration outside the repository. Development and production settings are separate (`context.md` section 3).
- Whoever has administrator access to the VM can read the database and the photos volume. That conflicts with REQ-NF-23 if team members run the server (M-16, gym G-01).
- If the gym account password and PIN are lost, the paper recovery code from the install command sets new ones from the gym account sign-in screen (E-60, REQ-F-89). If the paper is lost too, only running the install command on the server remains, so it needs someone with server access (M-16).

### Pending CTI items on these diagrams

| ID | Question | Where it shows | If the answer is bad |
|---|---|---|---|
| M-01 | Can phones on mobile data reach the VM? | Diagram 4, phone to proxy | Campus only: no Check In on mobile data. Hosting plan changes. Automatic certificates (D1, Caddy) would not work either |
| M-02 | Containers on the VM: Docker, Podman or none | Diagrams 2 and 4, host box | No containers: deployment redesigned on CTI services |
| M-03 | Who makes the subdomain and certificate; app and API on one name | Diagrams 1, 2 and 4, proxy | Two names: cookie login design changes (cross-site cookies, CORS) |
| M-04 | What CTI needs to approve the VM, and how long | Diagram 4, VM box | Late approval: no production in December. CTI conditions become new requirements |
| M-05 | Early access to the VM | Diagram 4, VM box | First real deployment happens close to the demo. Demo option D5 A is at risk |
| M-06 | Where backups go and for how long | Diagrams 2 and 4, backup box | REQ-NF-06 stays Pending. A copy kept only on the VM is lost with the VM |
| M-07 | Outgoing mail: CTI relay, external provider or none | Diagrams 1, 2 and 4, mail box | None: REQ-F-77 is built, no password reset, no "I am an athlete" link (E-58). External provider: needs approval (M-11) |
| M-09 | PostgreSQL accepted | Diagrams 2 and 4, database | MySQL required: REQ-F-17 and REQ-F-36 need a new design |
| M-13 | Data on the VM disk, disk encryption | Diagrams 2 and 4, volumes | Disk not encrypted: team decides whether to encrypt files itself |

Also relevant, not in the list asked for this issue: M-11 (external services approval, affects the tunnel and an external mail provider), M-12 (WooCommerce API, Stretch only) and M-16 (who administers the server).

### 5. Request path: one Check In

**Type:** Sequence diagram. **Use it to:** write the Check In endpoint, its tests, and the PWA calls.

From the phone to the database. Endpoint paths are examples only; the API contract is separate work (OpenAPI, `context.md` section 2). Responses go back through the proxy; the diagram skips that hop.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant PWA as PWA on phone
  participant GEO as Geolocation API
  participant PX as Proxy
  participant API as Laravel app
  participant DB as PostgreSQL

  U->>PWA: Tap Check In
  PWA->>PX: GET /api/facility-session/current over HTTPS with session cookie
  PX->>API: Forward
  API->>DB: Find the active facility session of this User
  alt Active session exists
    API-->>PWA: Current session and Gym ID, no location asked
  else No active session
    PWA->>GEO: Ask for position
    GEO->>U: Permission prompt, first time only
    GEO-->>PWA: Position and accuracy, or an error
    PWA->>PX: POST /api/check-in with position and accuracy
    PX->>API: Forward with the client IP header
    API->>API: Is this the User's current device
    API->>DB: Read authorizations, academic_terms, schedule_slots
    API->>API: Check boundary and accuracy against server settings
    alt A check fails
      API-->>PWA: No session, with the cause
    else All checks pass
      API->>DB: Insert into facility_sessions in one transaction
      alt Exclusion constraint finds another active session
        DB-->>API: Conflict
        API->>DB: Read the existing active session
        API-->>PWA: Existing session and Gym ID
      else Insert works
        DB-->>API: New session, end is start plus 60 minutes
        API-->>PWA: New session and Gym ID
      end
    end
  end
  PWA->>U: Show the Gym ID
  Note over API,DB: Coordinates are not saved, only the result
```

**About this diagram:** the first branch is REQ-F-37, the device check REQ-F-03, the boundary check REQ-NF-29, the cause on failure REQ-F-33, and not saving coordinates REQ-NF-03.

Notes:

- The database, not the PWA, guarantees one active session per User, also under simultaneous requests (REQ-F-36, REQ-NF-42). This needs PostgreSQL (M-09).
- Schedule and athletes-only checks use `schedule_slots` (REQ-F-33, REQ-F-82). If an athletes-only period starts inside the 60 minutes, the response carries its start time (REQ-F-83).

## Design decisions to confirm

All are **Proposed**. The team decides in the PR review.

### D1: Proxy, nginx or Caddy

`context.md` lists "nginx or Caddy". Both can serve the static PWA files and pass `/api` to PHP-FPM.

- **A. nginx.** Widely used with Laravel, and `context.md` already names it for the static files. It does not get certificates by itself: the certificate comes from CTI, or the team adds certbot and a renewal job.
- **B. Caddy.** Gets and renews certificates by itself, with a short config. That only works if the VM is reachable from the internet (or DNS can be changed by the team) and UPRM allows that kind of certificate (M-01, M-03). If CTI hands over a certificate, this advantage is gone.

Recommendation: wait for M-03. If CTI gives the certificate, A, because it is the most familiar option. If the team must get it and the VM is public, B. Development does not depend on this choice, since the tunnel gives HTTPS.

### D2: All backend routes under `/api`

Laravel packages add their own paths by default: Sanctum's CSRF cookie route and Fortify's sign in, registration and password reset routes are not under `/api`.

- **A. Move them under `/api`** with the route prefix setting of each package. The proxy needs two rules: `/api` to Laravel, everything else to the PWA (with `index.html` as fallback for app routes).
- **B. Keep the defaults** and list each path in the proxy. More rules, and paths like `/login` can clash with PWA routes.

Recommendation: A. One simple rule, and it matches the glossary ("API under `/api`"). Confirm the prefix settings when the project is set up.

### D3: How scheduled tasks run

- **A. A scheduler container** from the same image as `app`, running Laravel's scheduler loop. Same in development and production.
- **B. Cron on the host** calling the app container every minute. Needs access to the host cron, and differs between a PC and the VM.
- **C. Cron inside the app container.** Two processes in one container, harder to restart one alone.

Recommendation: A. It is what `context.md` already lists as a container, and it behaves the same everywhere.

### D4: Sending email during the request or through a queue

- **A. During the request.** No extra container. If SMTP fails, the user sees an error at once and can try again. The request takes a bit longer.
- **B. Queue in the database plus a worker container.** Fast response and retries. One more container, and failed jobs must be watched by someone.

Recommendation: A. Email is only for athlete registration links, "I am an athlete" links (E-58) and password resets, a small volume. Switch to B if the CTI relay turns out slow (M-07).

### D5: Where the demo environment runs

- **A. A second compose project on the CTI VM** with its own name, database and volumes. Shows the real deployment. Needs a second subdomain (M-03), room on the VM (M-04), access in time (M-05), and reach from the classroom (M-01).
- **B. A member's laptop with a tunnel** in the classroom. No CTI dependency. Depends on the classroom network and the tunnel; it is not the production setup.

Recommendation: A if the VM is ready in time, with B prepared as a fallback in any case.

### D6: How the app knows it must enforce the gym boundary

The 50 m startup check must run in production and must not block development or the demo (REQ-NF-29).

- **A. Run the check when the environment name is `production`.** Demo uses another name. Simple. A wrong name in production turns the check off without notice.
- **B. Run the check only when a flag is on.** Forgetting the flag in production turns the check off without notice.
- **C. Always run the check, unless a flag that allows a non-gym boundary is on.** Development and demo set the flag. Forgetting it makes the app refuse to start, which is noticed at once.

Recommendation: C. A mistake fails safe: the classroom boundary cannot reach production by a missing setting.

### D7: Tunnel for phone tests

- **A. Cloudflare Quick Tunnel.** No account, already tested (location and WebSocket work, SSE does not). The URL changes every run, so the app URL settings (and Sanctum's list of first-party domains, to confirm during setup) must change every run.
- **B. ngrok free plan.** Fixed URL, so settings are set once. Limits of 20,000 requests and 1 GB per month (`context.md` section 5). Not tested with the app yet. One phone polling every 25 seconds uses about 144 requests per hour.

Recommendation: let each member choose, and keep the tunnel host in one `.env` value so both work. B is easier for daily work because of the fixed URL; A is the fallback when the ngrok quota runs out.

### D8: Where production images are built

`context.md` says images are built in one place, never on each laptop.

- **A. Build on the VM** from a tagged commit. No registry. The VM needs the build tools and internet access to download base images (M-04).
- **B. Build in GitHub Actions** and push to a private registry; the VM pulls by tag. Repeatable and always `linux/amd64`. Needs a registry token on the VM and outbound access to the registry (M-04).

Recommendation: A for December, because it has fewer parts. Move to B if the team wants automatic builds later.

## Gaps and questions

1. **REQ-NF-12 says "all traffic" goes over HTTPS.** In development the desktop browser uses plain HTTP on `localhost` (browsers treat `localhost` as secure, so location still works), and the tunnel client talks plain HTTP to the proxy on the same PC. Inside the compose network, proxy to app is not encrypted either. Suggest the SRS say "all traffic between the client and the server". Confidence 8: based on the tested tunnel setup in `context.md` section 5; the `localhost` rule is from browser behavior, not checked in this project.
2. **REQ-NF-09 and the tunnel.** The tunnel provider ends HTTPS and can read the traffic. That is fine with fake data only, but the real-data import test (REQ-NF-07, M-17) must not go through a tunnel. The SRS does not say this. Confidence 8.
3. **REQ-NF-29 does not say where the demo runs or what data it uses.** Real student data in a classroom demo would conflict with REQ-NF-07. Suggest "demo uses fake data" unless the gym says otherwise. See D5 and D6.
4. **REQ-NF-01 depends on a correct clock.** Backend time decides expiry, so the VM clock must be synced. No CTI question asks about time sync. Suggest adding it to M-04.
5. **Real client IP for the audit log (REQ-NF-39).** If CTI puts its own proxy in front of the VM (M-01 answer C), the real IP passes two proxies, and Laravel must trust both. The trusted proxy list depends on M-01.
6. **REQ-NF-06 has no frequency or recovery target.** It says "backups" and "a tested restore", not how often or how much data may be lost. The database and the photos volume should be copied together so they match.

## Traceability

| Requirement | Where it appears |
|---|---|
| REQ-NF-10 | 2. Containers on one host (one PWA build served at `/` to phone and desktop) |
| REQ-NF-12 | 2. Containers on one host, 3. Development on each member's PC (tunnel), 4. Production and demo (proxy HTTPS), Gaps 1 |
| REQ-NF-20 | 2. Containers on one host (private photos volume, reached only through the app) |
| REQ-NF-29 | 3. Development on each member's PC, 4. Production and demo, 5. Request path: one Check In, D5, D6 |
| REQ-NF-01 | 2. Containers on one host notes, Gaps 4 |
| REQ-NF-03 | 1. System context notes, 5. Request path: one Check In |
| REQ-NF-04 | 2. Containers on one host (scheduler to photos, pending) |
| REQ-NF-06 | 2. Containers on one host and 4. Production and demo (backup box, M-06), Gaps 6 |
| REQ-NF-07 | 3. Development on each member's PC (fake data), Gaps 2 and 3 |
| REQ-NF-09 | 3. Development on each member's PC notes, Gaps 2 |
| REQ-NF-11 | 1. System context, 5. Request path: one Check In |
| REQ-NF-23 | 4. Production and demo notes |
| REQ-NF-24 | 2. Containers on one host notes |
| REQ-NF-26 | 2. Containers on one host notes |
| REQ-NF-39 | 5. Request path: one Check In (client IP header), Gaps 5 |
| REQ-NF-42 | 5. Request path: one Check In notes |
| REQ-F-03 | 5. Request path: one Check In |
| REQ-F-06, REQ-F-15, REQ-F-75, REQ-F-77 | 1. System context (mail, M-07) |
| REQ-F-28, REQ-F-29 | 1. System context (Export Orders file) |
| REQ-F-32 | 1. System context (dashed API link, Stretch) |
| REQ-F-33, REQ-F-82, REQ-F-83 | 5. Request path: one Check In |
| REQ-F-36, REQ-F-37 | 5. Request path: one Check In |
| REQ-F-38 | 2. Containers on one host notes |
| REQ-F-43 | 2. Containers on one host notes |
| REQ-F-89 (E-60 recovery code) | 4. Production and demo notes |
| E-58 ("I am an athlete" link by mail) | 1. System context (mail), M-07 row, D4 |

E-56 (PIN state in the browser session), E-57 (photos on import undo) and E-59 (Staff see the roster) change no diagram in this file.
