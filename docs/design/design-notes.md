# Design notes carried over from the SRS

These are design or implementation choices that were in the SRS v0.4. They are not requirements, so they live here. Each line says where it came from. `Proposal:LINE` means a line of `docs/capstone_proposal/main.tex` (v0, frozen), the submitted capstone proposal.

## Database and containers

- The single active session rule uses a PostgreSQL exclusion constraint, which MySQL does not have. This is why PostgreSQL is required (SRS v0.4, 2.4; see `context.md` section 2).
- All containers use the same images with a pinned version, never `latest`, in development and production (SRS v0.4, 2.4 and the Portability line of 6.4).
- The active session check and the session creation are one protected backend operation (SRS v0.4, REQ-F-36, second sentence).

## Data

- The term photo is stored with the authorization, not with the account (SRS v0.4, REQ-F-26). Import undo and the release of an added authorization delete the photo with the authorization (team.md, E-57).
- The PIN state and the last person activity live in the browser's session data. The gym account has a PIN version; changing the PIN raises it, which closes the PIN in every browser (team.md, E-56).
- Behind the proxy, the backend reads the real client IP address from the proxy header, for the audit log (SRS v0.4, 5.3 and REQ-NF-39).

## PWA and location

- The service worker does not cache responses from `/api` (SRS v0.4, REQ-NF-27).
- Production refuses to start if the configured boundary is more than 50 meters from the gym coordinates. This is how REQ-NF-29 is enforced (SRS v0.4, REQ-NF-29).

## Logical data model (SRS v0.4, 4.1)

Based on Proposal:350, 354-359, 426 and the team decisions. Diagrams and constraints: `docs/design/data-model.md`.

| Entity | Contains | Related to |
|---|---|---|
| User | Persistent identity, email, password, chosen language | Authorizations, sign-in sessions, facility sessions, waiver acceptance |
| Gym account | One shared account, password hash, PIN hash, PIN version, recovery code hash, language for every computer (team.md, E-64) | Audit log entries, sign-in sessions |
| Academic term | Name, start date, end date (a summer term is possible) | Authorizations, roster records, memberships |
| Authorization | Type (paid, athlete or manual), term, status, photo for the term, reason (manual, or "removed from roster", team.md, E-93) | User, term, membership, roster record or none (manual) |
| Imported membership | Fields of REQ-F-29, claim status, import it came from | WooCommerce order, import, authorization |
| Roster record | Fields of REQ-F-51, claim status | Term, authorization |
| Sign-in session | Device with an open sign-in session; for the gym account, the session data holds whether the PIN is active in that browser, its PIN version and the last person activity | User (one at a time, REQ-F-03) or gym account (no limit) |
| Facility session | Start, end (start plus 60 minutes), status (active, expired, ended early, void), whether it was assisted | User |
| Schedule slot | Type (regular hours, special hours, closure, athletes only), start, end, text in Spanish and English | None |
| Notice, facility information | Text in Spanish and English, dates | None |
| Waiver acceptance | Full name, email, emergency contact name and phone, acceptance time | User |
| Audit log entry | Gym account, time, IP address, device and browser, action, affected record, values before and after | Gym account |
| Setting | Contact number for people who cannot register | None |
