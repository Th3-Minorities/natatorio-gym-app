# Design notes carried over from the SRS

These are design or implementation choices that were in the SRS v0.4. They are not requirements, so they live here. Each line says where it came from. `Proposal:LINE` means a line of `docs/capstone_proposal/main.tex` (v0, frozen), the submitted capstone proposal.

## Database and containers

- The single active session rule uses a PostgreSQL exclusion constraint, which MySQL does not have. This is why PostgreSQL is required (SRS v0.4, 2.4; see `context.md` section 2).
- All containers use the same images with a pinned version, never `latest`, in development and production (SRS v0.4, 2.4 and the Portability line of 6.4).
- The active session check and the session creation are one protected backend operation (SRS v0.4, REQ-F-36, second sentence).

## Data

- The term photo is stored with the authorization, not with the account (SRS v0.4, REQ-F-26). The release of an added authorization deletes the photo with the authorization (team.md, E-57). The import undo that did the same was removed (team.md, E-127).
- Paid memberships come from the store's REST API, not from a file (team.md, E-127). The read-only key lives only in the server's environment file. The Authorization Number is a 6-character code that can include letters, unique across all orders (team.md, E-128).
- There is no PIN state: Staff and Administrators have personal staff accounts (team.md, E-114), which replaced the PIN version and last-activity rules of E-56.
- Behind the proxy, the backend reads the real client IP address from the proxy header, for the audit log (SRS v0.4, 5.3 and REQ-NF-39).

## PWA and location

- The service worker does not cache responses from `/api` (SRS v0.4, REQ-NF-27).
- Production refuses to start if the configured boundary is more than 50 meters from the gym coordinates. This is how REQ-NF-29 is enforced (SRS v0.4, REQ-NF-29).

## Logical data model (SRS v0.4, 4.1)

Based on Proposal:350, 354-359, 426 and the team decisions. Diagrams and constraints: `docs/design/data-model.md`.

| Entity | Contains | Related to |
|---|---|---|
| User | Persistent identity, email, password, chosen language | Authorizations, sign-in sessions, facility sessions, waiver acceptance |
| Staff account | Name, email, password hash, role (staff or admin), language, deactivation time. One per Staff member and Administrator, never deleted (team.md, E-114) | Audit log entries, manual entries |
| Academic term | Name, start date, end date (a summer term is possible) | Authorizations, memberships |
| Authorization | Type (paid, athlete or manual), term, status, photo for the term, photo pending mark (team.md, E-118), reason (manual, or "removed from roster", team.md, E-93) | User, term, membership, roster record or none (manual) |
| Imported membership | A copy of one store order: the fields of REQ-F-29, claim status, the sync run that created it (team.md, E-127) | WooCommerce order, store sync run, authorization |
| Roster record | Name, sport, student number, institutional email, removal time. One record per athlete, not one per term (team.md, E-116) | Authorization |
| Sign-in session | Device with an open sign-in session | User (one at a time, REQ-F-03) or staff account (no limit) |
| Facility session | Start, end (start plus 2 hours), status (active, expired, checked out, ended early, closed, void), whether it was assisted, the staff account for a manual entry (team.md, E-115, E-119) | User |
| Schedule slot | Type (regular hours, special hours, closure, athletes only), start, end, text in Spanish and English | None |
| Notice, facility information | Text in Spanish and English, dates | None |
| Waiver acceptance | Full name, email, emergency contact name and phone, acceptance time. Open: the data that proves acceptance (team), and a signature if the gym needs one (gym.md, G-21) | User |
| Audit log entry | Staff account, time, IP address, device and browser, action, affected record, values before and after | Staff account |
| Setting | Contact number for people who cannot register; the store address (team.md, E-126) | None |
