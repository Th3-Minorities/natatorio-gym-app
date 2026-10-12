# Software Requirements Specification

**Project:** UPRM Weight Gym Operations and Member-Access Platform

**Version:** 0.1 draft, not approved

**Authors:** Carlos J. Pepin Delgado, Pierre G Vales Torres, Viviana V Ramos Vivoni

**Organization:** Department of Computer Science and Engineering, University of Puerto Rico at Mayagüez (UPRM)

**Date:** 2026-10-11

## Contents

- Revision History
- 1. Introduction
- 2. Overall Description
- 3. System Features
- 4. Data Requirements
- 5. External Interface Requirements
- 6. Quality Attributes
- 7. Internationalization and Localization Requirements
- 8. Other Requirements
- Appendix A: Glossary
- Appendix B: Analysis Models
- Summary of Open Items

## Revision History

| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Carlos J. Pepin Delgado | 2026-10-11 | First draft based on the proposal and the later changes | 0.1 |

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the December release of the UPRM Weight Gym Operations and Member-Access Platform. It is for the development team: it says what to build and how to test it.

The baseline is the proposal (`docs/capstone_proposal/main.tex`), in force until further notice. `docs/context.md` lists what changes it and why. If this document and the proposal differ, this document wins, and the difference must appear in `context.md`.

### 1.2 Document Conventions

- IDs: `REQ-F-NN` for functional requirements and `REQ-NF-NN` for nonfunctional requirements. An ID is never reused or renumbered. A new requirement takes the next free number.
- Each requirement has these fields:
  - **Proposal priority:** MVP, Secondary or Stretch according to the scope table (`main.tex:293-310`); "N/A" if it is not in that table.
  - **Final priority:** TBD throughout the document. Maps to High, Medium or Low (must, should, may). Team approval is missing.
  - **Status:** **Clear** (can be built and tested with what is known) or **Pending** (information is missing; the field says what is missing and who answers).
  - **Source:** `main.tex:N` (proposal line); **Team** (team decision, in `context.md`); **Later change** (requested after the proposal, in `context.md`); **Review** (came from the requirements review after the proposal).
- "New, pending decision": a requirement that is not in the proposal and that nobody has approved.
- TBD: missing information. The "Summary of Open Items" section collects every TBD.

### 1.3 Project Scope

The system is a PWA for the Weight Gym in the UPRM Natatorio Complex. It replaces the paper log and the manual payment check (`main.tex:102`). It joins in one flow: accounts, authorization by paid membership or by athlete roster, Check In with location, 60-minute sessions, Gym ID, estimated occupancy, schedules and notices, facility information and utilization analytics (`main.tex:120, 198`).

Out of scope (`main.tex:116, 328`): payment processing (stays in WooCommerce), other facilities such as the pool, medical records, and capacity-based admission while UPRM has no official policy.

Delivery: demo in December before professors, with the project "complete" (Later change).

**TBD (team and professor):** Does "complete" for December mean meeting the 5 objectives of the proposal (`main.tex:123-192`), including the Administrator tools and analytics? The proposal only commits MVP and Secondary, and does not promise Stretch (`main.tex:295`). Until this is answered, the final priority of every requirement is TBD.

### 1.4 References

| Document | Location | Note |
|---|---|---|
| Capstone proposal, "UPRM Weight Gym Operations and Member-Access Platform", Pepin, Vales, Ramos, September 29, 2026 | `docs/capstone_proposal/main.tex` | Current baseline. `v0/` is frozen |
| Current context and decisions | `docs/context.md` | What changes the proposal and why |
| Open questions | `docs/decisions.md` | Questions for CTI, the gym, the team and the professor |
| Software Requirements Specification (SRS) Template, in the `software-documentation` repository | https://github.com/gusonkuntarto/software-documentation/blob/main/Software%20Requirements%20Specification%20(SRS)%20Template.docx | Source of the structure of this document (sections 1 to 8 and appendices) |
| WCAG 2.2, W3C, December 12, 2024 | https://www.w3.org/TR/WCAG22/ | Cited in `main.tex:594` |
| Geolocation, W3C | https://www.w3.org/TR/geolocation/ | Cited in `main.tex:596` |

## 2. Overall Description

### 2.1 Product Perspective

New product. Today the gym logs on paper, and staff check payment (WooCommerce) or athlete status (department lists) by hand (`main.tex:102, 111`). There is no count of active users and no usage metrics.

Related systems:

| System | Relationship |
|---|---|
| UPRM WooCommerce | Source of truth for payments. The system imports orders from Export Orders and does not process payments (`main.tex:369-371`) |
| Department athlete lists | Designated Staff digitize them each semester into the roster (Later change) |
| User's browser | Provides location through the Geolocation API (`main.tex:499-503`) |
| Outgoing mail server | Sends verification links. TBD whether it exists in production (see 5.4) |
| CTI VM | Hosts the system in production (Team) |

### 2.2 User Classes and Characteristics

| Class | Who | What they do |
|---|---|---|
| User, paid member | Person with a semester membership paid in WooCommerce. Some have no institutional email (Team) | Creates an account, does Check In, shows the Gym ID, sees occupancy and facility information |
| User, athlete | Student on the athlete roster for the semester. Does not buy a membership (`main.tex:206`) | Same as the paid member |
| Staff | Gym staff, including students at the front desk (`main.tex:118`) | Sees active sessions, verifies Gym IDs, does Staff-assisted Check In and permitted corrections |
| Designated roster Staff | Staff members with a separate permission (Later change) | Digitizes and changes the athlete roster each semester |
| Administrator | Athletic Activities administration | Manages Staff access, academic terms, imports, schedules, notices, information and analytics |
| Developer | Project team | Outside the gym roles; no routine access to production data (`main.tex:437, 509`) |

Estimated use: about 150 people per day (`main.tex:104`). Main use is from the phone (`main.tex:198`).

### 2.3 Operating Environment

- Client: PWA in the browser. Matrix: iPhone with Safari, Android with Chrome, Windows with Chrome and Edge; macOS and Firefox as secondary (`main.tex:464`).
- Production server: CTI VM, Ubuntu 26 or Rocky 10, after CTI evaluation (Team, stated by CTI).
- Domain: UPRM subdomain (`main.tex:332`).
- Development: `docker-compose` on each member's PC; phone tests through an HTTPS tunnel (Team).
- **TBD (CTI):** whether the VM has a public IP or is only reachable from the campus network; whether it allows containers (Docker or Podman); who sets up the subdomain and the certificate.
- **TBD (gym):** which devices staff use at the front desk.

### 2.4 Design and Implementation Constraints

- Frontend: PWA with React, TypeScript and Vite, one codebase for phone and desktop (`main.tex:348`).
- Backend: Laravel (PHP 8.3 or higher). Decided, not reopened.
- Database: PostgreSQL in a container. The single active session rule uses an exclusion constraint, which MySQL does not have. **TBD (CTI):** whether CTI accepts PostgreSQL or requires MySQL.
- Containers: `docker-compose` with proxy, PHP, PostgreSQL and scheduled tasks. All use the same images with a pinned version, never `latest`.
- Single origin: PWA at `/` and API at `/api` under the same name (Proposed). **TBD (CTI):** whether it can be a single name.
- Production on a CTI VM. CTI does not manage the server or the application.
- No SAML: the system has its own accounts.
- No Supabase or Vercel. Confirmation of Supabase is still open (team question in `decisions.md`).
- Minimum cost for the gym; rely on CTI where possible.
- No offline Check In (`main.tex:460`).
- No external services with student data without approval (Team).

### 2.5 Assumptions and Dependencies

| Depends on | What is assumed | If it fails | TBD and who answers |
|---|---|---|---|
| CTI | Provides a VM with containers, subdomain and HTTPS | No production in December | Date, approval requirements, public IP: CTI |
| CTI | There is outgoing mail (SMTP or relay) from the VM | No verification or password recovery links (REQ-F-06, REQ-F-12, REQ-F-15) | Whether it exists, sender address, SPF and DKIM, or whether an external provider is allowed: CTI |
| CTI | CTI accepts PostgreSQL | REQ-F-17, REQ-F-36 and REQ-NF-02 need another design | CTI |
| Gym | Validates access, renewal, permission, exception, privacy, retention and account recovery rules (`main.tex:332`) | Pending requirements cannot be closed | See Summary of Open Items |
| Gym | Provides the athlete lists, schedules, rules and equipment information (`main.tex:332`) | No data for the roster or the information section | Gym |
| WooCommerce | The team keeps authorized access to Orders and Export Orders (`main.tex:369`) | No import | API access: CTI |
| Professor or advisor | Accepts the stack change from the proposal | It would have to be justified or reverted | Whether approval is needed, rubric and deliverables: professor |
| Team and user | Define what "complete" means and the final priority | No definition of done | See 1.3 |
| Gym and CTI | Someone looks after the system after December (accounts, roles, support) | Nobody operates the system; if the team operates it, it conflicts with REQ-NF-23 | Decided later: gym, CTI. Not in the proposal |

**Internal contradiction in the proposal (TBD, team and professor).** The scope table lists roster management, Staff and Administrator permissions, schedules and closures, and analytics as Secondary (`main.tex:305`). But Objective 4 requires the Administrator to manage athlete authorizations, schedules, closures and Staff access (`main.tex:177`), and Objective 5 gives analytics a metric, criterion and date (`main.tex:184-190`). It is not decided whether those Secondary items are committed by the objectives.

## 3. System Features

### 3.1 Accounts and Sign In

#### 3.1.1 Description

Each person has one account that lasts across semesters. The account is separate from the authorization (`main.tex:202, 355-357`). Acceptance criterion (Objective 1, `main.tex:140-144`): every case in the controlled dataset returns the expected decision.

#### 3.1.2 Stimulus/Response Sequences

1. The User enters email and password. The system signs the User in and ends any other session of that account on another device.
2. The previous device tries a protected action. The system rejects it and asks the User to sign in.

#### 3.1.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-01 | The system shall keep one account per person, which persists across semesters. | MVP | TBD | Clear | main.tex:202, 355 |
| REQ-F-02 | The User shall be able to create their own account and sign in with email and password. The system shall not use external authentication (SAML). | MVP | TBD | Clear. Note: `main.tex:120` says "institutional login"; v1 of the proposal must correct it (team) | main.tex:202; Team |
| REQ-F-03 | The system shall allow only one authenticated session per account. Signing in on another device shall end the previous one. | MVP | TBD | Pending: whether it applies to Staff and Administrator (team, gym); cookies inside the installed PWA on iPhone not verified (team) | main.tex:202, 363 |
| REQ-F-04 | The system shall accept protected actions only from the device of the current authenticated session. | MVP | TBD | Clear | main.tex:363 |
| REQ-F-05 | The system shall allow account recovery when the User loses or changes their phone, under the rule of REQ-F-03. | N/A | TBD | Pending: process and role of staff (gym) | main.tex:328, 332 |
| REQ-F-06 | The User shall be able to reset their password on their own with a link sent to their email. | N/A (New, pending decision) | TBD | Pending: whether it is wanted (team, gym); requires outgoing mail (CTI) | Review |
| REQ-F-07 | The system shall limit failed sign-in attempts. | N/A (New, pending decision) | TBD | Pending: whether it is included and with what number of attempts and wait time (team) | Review |
| REQ-F-08 | The system shall end the authenticated session after a period of inactivity. | N/A (New, pending decision) | TBD | Pending: whether it is included and with what time (team) | Review |
| REQ-F-09 | The system shall allow deleting an account or its data. | N/A (New, pending decision) | TBD | Pending: who requests it, what is deleted and what is retained (gym, UPRM) | Review |

#### 3.1.4 Error Handling

- Wrong credentials: the system rejects the sign in and does not say whether the email exists.
- No connection: no sign in (REQ-NF-26).

### 3.2 Paid Member Registration

#### 3.2.1 Description

The paid member registers with the Authorization Number received from the WooCommerce purchase (`main.tex:204`). Acceptance criterion: Objective 1 (`main.tex:140-144`), cases of valid, expired and missing membership.

#### 3.2.2 Stimulus/Response Sequences

1. The User enters the Authorization Number. The system looks it up in the imported records.
2. If it is valid and not claimed, the User creates the password and uploads a photo. The system creates the account with the payment email.
3. If it is not valid, is already claimed or cannot be verified, the system denies the registration.

#### 3.2.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-10 | The system shall validate the Authorization Number against the local membership records imported from WooCommerce. | MVP | TBD | Pending: Authorization Number format (length, whether it is random, whether it is single use) (gym, CTI) | main.tex:204, 371 |
| REQ-F-11 | The paid member's account email shall be the payment email from the WooCommerce record. | MVP | TBD | Pending: whether the member can change it when creating the account (gym) | main.tex:204; Team |
| REQ-F-12 | The system shall verify the paid member's email before creating the account. | N/A (the proposal does not require it) | TBD | Pending: whether it is verified and with what flow; the earlier decision said "it is verified" with no flow (team); requires outgoing mail (CTI) | Team |
| REQ-F-13 | On registration, the User (paid member or athlete) shall create a password and upload a current photo. | MVP | TBD | Clear | main.tex:202, 204, 206 |

#### 3.2.4 Error Handling

- Authorization Number that does not exist, is expired, refunded, cancelled or already claimed: registration denied (REQ-F-17, REQ-F-18, REQ-F-27).

### 3.3 Athlete Registration

#### 3.3.1 Description

The athlete registers with their student number, which the system looks up in the roster that designated Staff digitized (`main.tex:206`; Later change). The student number is not secret; so the account is created after opening a link sent to the institutional email in the roster (Team). Acceptance criterion: Objective 1, cases of valid and invalid athlete and user with no match (`main.tex:142`).

#### 3.3.2 Stimulus/Response Sequences

1. The User enters their student number. The system looks it up in the roster for the current semester.
2. The User confirms the associated institutional email. The system sends a link to that email.
3. The User opens the link, creates the password and uploads the photo. The system creates the account and marks the roster record as claimed.

#### 3.3.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-14 | The athlete shall be able to register with their student number, which the system looks up in the roster for the current semester, and shall confirm the associated institutional email. | MVP | TBD | Clear | main.tex:206 |
| REQ-F-15 | The system shall create the athlete's account only after the link sent to the institutional email in the roster is opened. | MVP | TBD | Pending: requires outgoing mail in production (CTI) | Team; main.tex:206 |
| REQ-F-16 | The system shall give the same visible response whether or not the student number is in the roster. | N/A | TBD | Pending: proposed, needs confirmation (team) | Team |
| REQ-F-17 | Each roster record and each Authorization Number shall be claimable by only one account, also under simultaneous requests. | MVP | TBD | Clear | main.tex:206, 371, 462, 511 |

#### 3.3.4 Error Handling

- Number not found: same response as if it existed (REQ-F-16, if confirmed).
- Expired or already used link: the account is not created. Link validity period: TBD (team).
- Record already claimed: registration denied.

### 3.4 Authorization, Academic Terms and Renewal

#### 3.4.1 Description

The authorization says whether the person has access in the current academic term. A User can have several authorizations over time (`main.tex:356, 361`). Acceptance criterion (Objective 1, `main.tex:144`): every User with a valid authorization is approved and every User without one is denied.

#### 3.4.2 Stimulus/Response Sequences

1. The end of the configured term arrives. The system marks the authorizations of that term as expired, disables Check In and shows "Renew".
2. The paid member enters a new Authorization Number. The system creates the authorization for the new term.
3. Designated Staff add the athlete to the roster for the new semester. The system gives the athlete authorization for that term.

#### 3.4.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-18 | If a WooCommerce or roster record cannot be verified, the system shall deny the registration, renewal or Check In that depends on it. | MVP | TBD | Clear | main.tex:513 |
| REQ-F-19 | The system shall store the authorization separately from the account, and a User shall be able to have several authorizations over time. | MVP | TBD | Clear | main.tex:350, 356 |
| REQ-F-20 | The User shall be able to move between paid-member and athlete authorization without losing the account or the Check In history. | MVP | TBD | Pending: which email stays on the account and how a roster record is linked to an existing account with a different email (gym, team) | main.tex:202, 356, 406 |
| REQ-F-21 | The Administrator shall be able to create and edit academic terms with a start date and an end date. | N/A | TBD | Pending: who provides the dates of each semester and who enters them (gym) | main.tex:350, 361 |
| REQ-F-22 | Each authorization shall expire at the end of its configured academic term, regardless of the purchase date. | MVP | TBD | Clear | main.tex:361 |
| REQ-F-23 | When the authorization expires, the system shall keep the account, disable Check In and show the expired status with the Renew option. | MVP | TBD | Clear | main.tex:204 |
| REQ-F-24 | The paid member shall be able to renew with a new Authorization Number on the same account. | MVP | TBD | Clear | main.tex:320 |
| REQ-F-25 | The athlete shall renew through the roster for the new semester, with no purchase or Authorization Number. | MVP | TBD | Clear | main.tex:206, 218, 321 |
| REQ-F-26 | The User shall upload a current photo at each renewal and shall not be able to replace it during an active authorization. The photo is stored with the authorization. | MVP | TBD | Clear | main.tex:202, 426 |
| REQ-F-27 | A refunded or cancelled WooCommerce order, once imported, shall remove the authorization that depended on it. | MVP | TBD | Clear | main.tex:371, 456 |

#### 3.4.4 Error Handling

- No academic term configured for the current date: no new authorization is created. Message to the Administrator: TBD (team).
- Authorization removed during an active session: effect on that session TBD (gym).

### 3.5 WooCommerce Import

#### 3.5.1 Description

WooCommerce remains the source of payments. The system copies only what is needed to authorize (`main.tex:369-371`). Acceptance criterion (`main.tex:456`): re-importing does not create duplicates, and corrected, refunded or cancelled orders update the authorization.

#### 3.5.2 Stimulus/Response Sequences

1. The Administrator uploads an Export Orders file. The system creates or updates one local record per order.
2. The Administrator uploads the same file again. The system confirms the same records without duplicating them.
3. An order appears as refunded or cancelled. The system removes the authorization (REQ-F-27).

#### 3.5.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-28 | The Administrator shall be able to load membership data from a WooCommerce Export Orders file. | MVP | TBD | Pending: file format and columns (team, with an authorized export) | main.tex:369, 371 |
| REQ-F-29 | The import shall copy only name, email, student number when applicable, membership details, Authorization Number, order reference, status, academic term and last synchronization time. It shall not copy billing or address data. | MVP | TBD | Clear | main.tex:204, 371 |
| REQ-F-30 | Processing the same order more than once shall update or confirm the same record, without creating duplicates. | MVP | TBD | Clear | main.tex:371, 456 |
| REQ-F-31 | The Administrator shall be able to run a controlled re-import or reconciliation when WooCommerce corrects, refunds or cancels orders. | MVP | TBD | Clear | main.tex:371 |
| REQ-F-32 | The system shall be able to synchronize with WooCommerce through approved API or webhook access, updating the same local records. | Stretch | TBD | Pending: whether there is API access and what restrictions CTI sets (CTI) | main.tex:307, 371 |

#### 3.5.4 Error Handling

- Row with data that cannot be verified: gives no authorization (REQ-F-18). How it is reported to the Administrator: TBD (team).
- File with an unexpected format: nothing is imported. Message detail: TBD (team).

### 3.6 Check In and Facility Session

#### 3.6.1 Description

The User does Check In from their phone. The system checks authorization and location and creates a 60-minute facility session (`main.tex:210, 365`). Location is a Check In condition, not proof of presence, and the User is not tracked (`main.tex:210`). Acceptance criterion (Objective 2, `main.tex:151-155`): every valid Check In creates exactly one active session and one Gym ID; invalid ones create no session; duplicates follow the session rule; every session stops counting after 60 minutes.

#### 3.6.2 Stimulus/Response Sequences

1. The User taps Check In with no active session. The system asks for location, compares it with the boundary and creates the session.
2. The User taps Check In with an active session. The system returns the current session and Gym ID, without asking for location.
3. 60 minutes pass. The session stops being active with no User action.

#### 3.6.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-33 | Before creating a session, the system shall verify that the User has a current authorization and that the device location is within the gym boundary. | MVP | TBD | Clear (boundary and accuracy in REQ-NF-28) | main.tex:210, 458 |
| REQ-F-34 | The system shall ask for location only when a new session must be created. | MVP | TBD | Clear | main.tex:416 |
| REQ-F-35 | The system shall not create a session if the location is outside the boundary, if location permission is denied, if accuracy is insufficient, if there is no current authorization or if there is no connection. | MVP | TBD | Clear | main.tex:458, 460, 573 |
| REQ-F-36 | A valid Check In shall create exactly one 60-minute session. The active session check and the creation shall be one protected backend operation. | MVP | TBD | Clear | main.tex:155, 210, 365, 416 |
| REQ-F-37 | If the User already has an active session, another Check In shall return the current session and Gym ID without creating another session. | MVP | TBD | Clear | main.tex:365, 416 |
| REQ-F-38 | The session shall expire after 60 minutes according to backend time, with no checkout or User action, and shall stop counting toward occupancy. | MVP | TBD | Clear | main.tex:210, 350, 365 |
| REQ-F-39 | After the session expires, a valid Check In shall be able to create a new session. | MVP | TBD | Clear | main.tex:365 |

#### 3.6.4 Error Handling

- Each rejection in REQ-F-35 shows its cause (outside the boundary, permission denied, accuracy, authorization, connection). Texts: TBD (team).
- Simultaneous requests from the same User: at most one session (REQ-NF-02).

### 3.7 Gym ID and Occupancy

#### 3.7.1 Description

The Gym ID is the credential the User shows while their session is active (`main.tex:210`). Estimated occupancy is the number of active sessions, not a physical headcount (`main.tex:214`). The proposal asked for optional real-time updates (`main.tex:350`); now the screens poll every 20 to 30 seconds (Team, Proposed). Acceptance criterion (Objective 3, `main.tex:162-166`): reported occupancy equals the number of active sessions in every tested state, and User, Staff and Administrator see the same value.

#### 3.7.2 Stimulus/Response Sequences

1. A Check In, an expiration or a Staff correction happens. The system recalculates occupancy.
2. An occupancy screen queries the backend. The system returns the current value.

#### 3.7.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-40 | The Gym ID shall show name, photo, authorization, Check In status and active-session indicators. | MVP | TBD | Pending: what the "live indicators" show without real time (team, gym) | main.tex:153, 210 |
| REQ-F-41 | Estimated occupancy shall equal the number of active sessions and shall be recalculated after each Check In, expiration or Staff correction. | MVP | TBD | Clear | main.tex:164-166, 214 |
| REQ-F-42 | User, Staff and Administrator shall see the same occupancy value. | MVP | TBD | Pending: with periodic polling two screens can differ by up to one interval; the Objective 3 criterion must be rewritten to measure after an update (team) | main.tex:166, 214 |
| REQ-F-43 | The occupancy and active session screens shall update by polling the backend every 20 to 30 seconds. | N/A (replaces the optional real time of main.tex:350) | TBD | Pending: confirm the interval (team) | Team |

#### 3.7.4 Error Handling

- No connection: the screen does not show a stored Gym ID or occupancy as if they were current (REQ-NF-27).

### 3.8 Staff Operations

#### 3.8.1 Description

Staff supervise use and handle exceptions (`main.tex:210-212, 218`). Acceptance criterion (Objective 4, `main.tex:177`): Staff can perform the defined supervision and correction tasks. The Objective 2 test plan includes Staff-assisted Check In (`main.tex:573`), although the scope table does not name it; here it is treated as de facto MVP.

#### 3.8.2 Stimulus/Response Sequences

1. Staff open the session view. The system shows the active sessions with Check In time, authorization and Gym ID.
2. An authorized User arrives without a phone. Staff look the User up with an approved identification method, check photo and authorization in the backend and create the session. The system records the Staff member and the time.
3. Staff correct a session. The system applies the correction, recalculates occupancy and records it in the audit log.

#### 3.8.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-44 | Staff shall be able to see active sessions with Check In time, authorization and Gym ID. | MVP | TBD | Clear | main.tex:218, 322 |
| REQ-F-45 | Staff shall be able to verify a Gym ID against backend data, not only against the User's screen. | MVP | TBD | Clear | main.tex:210 |
| REQ-F-46 | Staff shall be able to do a Staff-assisted Check In for an authorized User who is present without a phone: locate the account, check photo and authorization in the backend and create the same 60-minute session. Staff shall not be able to bypass authorization or create a second active session. | De facto MVP (test plan, main.tex:573; not in the scope table) | TBD | Pending: which identification Staff accept (gym) | main.tex:212, 573 |
| REQ-F-47 | The system shall record each Staff-assisted Check In as an exception, with Staff member and time. | De facto MVP (main.tex:573) | TBD | Clear | main.tex:212, 573 |
| REQ-F-48 | Authorized Staff shall be able to make permitted session corrections. | MVP | TBD | Pending: list of permitted corrections (gym) | main.tex:210, 218 |

#### 3.8.4 Error Handling

- Staff-assisted Check In for a User with no current authorization or with an active session: rejected, no new session.
- Correction outside the permitted list: rejected.

### 3.9 Athlete Roster by Designated Staff

#### 3.9.1 Description

Change from the proposal: the Administrator no longer maintains the roster (`main.tex:206, 218`). Each semester the department has a list of athletes. Only designated staff members, with a separate permission, digitize and change it. A record entered this way is preapproved (Later change). Athlete authorization is MVP (`main.tex:303`) but roster management is Secondary (`main.tex:305`): without a roster athletes cannot register (TBD, team).

#### 3.9.2 Stimulus/Response Sequences

1. Designated Staff create, import or edit roster records for the semester. The system stores them as preapproved and records them in the audit log.
2. A Staff member without the permission tries to open the tool. The system denies it.

#### 3.9.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-49 | Only Staff with the roster permission shall be able to create, import and change the athlete roster for each semester. | Secondary (as an Administrator tool, main.tex:305) | TBD | Pending: who designates those people (gym); whether the tool moves up to MVP (team); format of the lists (gym) | main.tex:206, 218; Later change |
| REQ-F-50 | A record entered by designated Staff shall be preapproved, with no Administrator approval. | Secondary | TBD | Pending: whether a report or periodic review of what was entered is needed (gym) | Later change |
| REQ-F-51 | Each roster record shall have at least student number, name, institutional email and academic term. | Secondary | TBD | Pending: final list of fields (sport, photo or others) (gym) | main.tex:206; Team |

#### 3.9.4 Error Handling

- Repeated student number in the same term: rejected. Exact behavior: TBD (team).

### 3.10 Administration and Permissions

#### 3.10.1 Description

Roles User, Staff, designated roster Staff and Administrator, with least access per role (`main.tex:198, 437`). Acceptance criterion (Objective 4, `main.tex:173-177`): every tested action is allowed or denied according to the assigned role. The criterion says the Administrator manages athlete authorizations; with the roster change it must be rewritten (TBD, team).

#### 3.10.2 Stimulus/Response Sequences

1. The Administrator assigns or removes a role or the roster permission. The system applies the change and records it in the audit log.
2. A User or Staff member requests an action outside their role. The system denies it.

#### 3.10.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-52 | The system shall allow or deny each action according to a permission matrix for User, Staff, designated roster Staff and Administrator, enforced in the backend. | Secondary | TBD | Pending: final matrix (gym, team) | main.tex:175-177, 305 |
| REQ-F-53 | The Administrator shall be able to grant and remove Staff access, including the roster permission. | Secondary | TBD | Pending: whether the roster permission is granted by the Administrator or by the department (gym) | main.tex:177, 218; Later change |
| REQ-F-54 | The Administrator shall be able to manage athlete authorizations. | Secondary | TBD | Pending: whether the Administrator keeps this function alongside designated Staff and how the Objective 4 criterion ends up (team, gym) | main.tex:177, 218 |

#### 3.10.4 Error Handling

- Action not allowed: the backend rejects it even if the interface shows it.

### 3.11 Facility Information and Notices

#### 3.11.1 Description

Today rules and instructions are communicated in person or on paper (`main.tex:218`). The assessment with the gym asked for notices of schedule changes, closures, maintenance and other updates (`main.tex:104`). Acceptance criterion (Objective 4, `main.tex:177`): the Administrator can manage schedules and closures.

#### 3.11.2 Stimulus/Response Sequences

1. The Administrator publishes a schedule, a closure or a notice. The User sees it in the PWA.

#### 3.11.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-55 | The Administrator shall be able to manage schedules, special hours and closures, and the User shall be able to see them. | Secondary | TBD | Clear | main.tex:218 |
| REQ-F-56 | The Administrator shall be able to publish maintenance notices and other operational updates, and the User shall be able to see them. | N/A (need in main.tex:104) | TBD | Clear | main.tex:104 |
| REQ-F-57 | The Administrator shall be able to manage facility information: rules, towel, footwear (including the Crocs and flip-flop restriction), available machines and approved equipment instructions. The User shall be able to see it. | Secondary | TBD | Clear | main.tex:218 |
| REQ-F-58 | Texts the gym writes (rules, notices, closures, information) shall have a Spanish and an English version. | N/A | TBD | Pending: who writes the English version (gym) | Later change |
| REQ-F-59 | The User shall be able to open equipment instructions with a QR code. | Stretch | TBD | Clear | main.tex:218, 307 |

#### 3.11.4 Error Handling

- Text with no version in the chosen language: behavior TBD (team).

### 3.12 Membership and Safety Records

#### 3.12.1 Description

Digital records that replace paper, only if Athletic Activities determines them necessary (`main.tex:220`). The system is not a medical records system (`main.tex:328`).

#### 3.12.2 Stimulus/Response Sequences

1. The User accepts a waiver or enters an emergency contact. The system stores it with restricted access.

#### 3.12.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-60 | The system shall be able to store or reference waivers, emergency contacts, required documents and safety-related medical warnings, only those Athletic Activities determines necessary. | Secondary | TBD | Pending: which ones the department requires (gym) | main.tex:220, 466 |

#### 3.12.4 Error Handling

- Access by a role without permission: denied (REQ-NF-19).

### 3.13 Utilization Analytics

#### 3.13.1 Description

The Administrator reviews use based on Check Ins and sessions (`main.tex:220`). Priority in the proposal: Secondary (`main.tex:305`). Objective 5 gives it a metric and criterion (`main.tex:184-190`). That contradiction is unresolved (see 2.5). Acceptance criterion (`main.tex:188`): every final metric equals its expected value on controlled historical datasets.

#### 3.13.2 Stimulus/Response Sequences

1. The Administrator chooses a period. The system calculates and shows the metrics for that period.

#### 3.13.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-61 | The Administrator shall be able to see visits by hour, day, week and month. | Secondary | TBD | Clear | main.tex:186-188, 220 |
| REQ-F-62 | The Administrator shall be able to see the high- and low-use periods. | Secondary | TBD | Clear | main.tex:188, 220 |
| REQ-F-63 | The Administrator shall be able to see estimated occupancy over time. | Secondary | TBD | Clear | main.tex:188, 220 |
| REQ-F-64 | The Administrator shall be able to see average and maximum occupancy summaries. | Secondary | TBD | Clear | main.tex:188, 220 |
| REQ-F-65 | The Administrator shall be able to see use by paid members versus athletes. | Secondary | TBD | Clear | main.tex:188, 220 |

#### 3.13.4 Error Handling

- Period with no data: the system shows zero, not an error.

### 3.14 PWA Installation

#### 3.14.1 Description

Chrome does not always show the install prompt, and on iPhone the app is installed by hand from Share (Team, tested).

#### 3.14.2 Stimulus/Response Sequences

1. The User taps "Install" in a Chromium-based browser. The browser shows its install dialog.
2. The User is on iPhone. The PWA shows how to install from Share.

#### 3.14.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-66 | The PWA shall have its own "Install" button in Chromium-based browsers and a help text for installing on iPhone. | N/A | TBD | Pending: whether it goes into the MVP (team); cookies inside the installed PWA on iPhone not verified (team) | Team |

#### 3.14.4 Error Handling

- Browser without support for the install event: the button does not appear.

### 3.15 Future Features

#### 3.15.1 Description

Stretch: only if the committed scope is complete and tested (`main.tex:295, 307`).

#### 3.15.2 Stimulus/Response Sequences

N/A: these features have no design.

#### 3.15.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-67 | The system shall be able to limit admission by capacity, only when UPRM has an official capacity policy. | Stretch | TBD | Pending: UPRM policy (gym) | main.tex:116, 307 |
| REQ-F-68 | The system shall be able to extend to other facilities, such as the Natatorio. | Stretch | TBD | Pending: rules of those facilities (gym) | main.tex:307 |
| REQ-F-69 | The system shall be able to predict occupancy when there is enough history. | Stretch | TBD | Pending: how much history is enough (team) | main.tex:307 |

#### 3.15.4 Error Handling

N/A: no design.

## 4. Data Requirements

### 4.1 Logical Data Model

Based on `main.tex:350, 354-359, 426`. No diagram in this version.

| Entity | Contains | Related to |
|---|---|---|
| User | Persistent identity, email, password, chosen language | Authorizations, authenticated sessions, facility sessions, roles |
| Academic term | Name, start date, end date | Authorizations, roster records, memberships |
| Authorization | Type (paid or athlete), term, status, photo for the term | User, term, membership or roster record |
| Imported membership | Fields of REQ-F-29 | WooCommerce order, authorization |
| Roster record | Fields of REQ-F-51, claim status | Term, authorization |
| Authenticated session | Device with an open session | User (one at a time, REQ-F-03) |
| Facility session | Start, end (start plus 60 minutes), whether it was assisted, Staff member who created it | User |
| Role and permission | User, Staff, roster permission, Administrator | User |
| Schedule, closure, notice, facility information | Text in Spanish and English, dates | None |
| Waiver, emergency contact, safety record | Per REQ-F-60 | User |
| Audit log entry | Actor, action, affected record, time | User (actor) |

### 4.2 Data Dictionary

| Element | Definition | Format or values |
|---|---|---|
| Session duration | Time a session counts as active | 60 minutes (`main.tex:365`) |
| Authorization Number | Number issued with the membership purchase | TBD (gym, CTI) |
| Student number | Student identifier at UPRM | TBD (gym) |
| Time | Every stored and calculated time | Time zone `America/Puerto_Rico` for day, week, month and term boundaries (REQ-NF-37) |
| Photo | Image of the User per term | Types and maximum size TBD (REQ-NF-24) |

The full dictionary is written in the design phase.

### 4.3 Reports

| Report | Content | Who sees it |
|---|---|---|
| Utilization analytics | REQ-F-61 to REQ-F-65 | Administrator |
| Audit log | REQ-NF-39 | TBD (gym) |
| Import result | Orders created, updated and rejected | Administrator. Detail TBD (team) |

Visual design and export of reports: TBD (team).

### 4.4 Data Acquisition, Integrity, Retention, and Disposal

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-01 | The database shall be the source of truth, and backend time shall decide the expiration of sessions and authorizations. | N/A | TBD | Clear | main.tex:350 |
| REQ-NF-02 | Claim uniqueness and the single active session rule shall be enforced in the database, not only in the frontend. | N/A | TBD | Clear. Depends on CTI accepting PostgreSQL (CTI) | main.tex:462, 511 |
| REQ-NF-03 | Location shall be used only for Check In and shall not be stored as movement history. The validation result may be stored. | N/A | TBD | Clear | main.tex:210, 511 |
| REQ-NF-04 | The system shall discard photos from earlier terms, unless UPRM requires keeping them. | N/A | TBD | Pending: UPRM rule (gym, UPRM) | main.tex:511 |
| REQ-NF-05 | The system shall apply retention rules by data type: photos, waivers, emergency contacts, safety data, Check Ins and audit. | N/A | TBD | Pending: periods by type (gym, UPRM) | main.tex:328, 466 |
| REQ-NF-06 | There shall be backups of the database and the files, and a tested restore before each milestone. | N/A | TBD | Pending: what is backed up, how often, where (outside the VM) and for how long (CTI, team) | main.tex:468, 513; Review |
| REQ-NF-07 | Real WooCommerce data shall be used only to test the integration: with permission, only the needed fields, outside git and synced folders, and deleted when the test ends. | N/A | TBD | Pending: how many records, on which machines and for how long (team, CTI) | Later change |
| REQ-NF-08 | Development shall use fake data. | N/A | TBD | Clear | Later change |
| REQ-NF-09 | Student data shall not be sent to external services without approval. | N/A | TBD | Pending: who approves (CTI) | Team |

## 5. External Interface Requirements

### 5.1 User Interfaces

Screens by role (detailed design in a separate specification, TBD):

- User: registration, sign in, Check In, Gym ID, occupancy, schedules, notices, facility information, renewal.
- Staff: active sessions, Gym ID verification, Staff-assisted Check In, corrections.
- Designated Staff: roster tool.
- Administrator: roles, terms, import, schedules, notices, information, analytics.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-10 | The interface shall be a mobile-first PWA with one codebase for phone and desktop. | N/A | TBD | Clear | main.tex:198, 348 |

### 5.2 Software Interfaces

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-11 | Location shall be obtained with the browser's standard Geolocation API, and Check In shall handle the permission state and the reported accuracy. | N/A | TBD | Clear | main.tex:499-503 |

- WooCommerce: input through an Export Orders file (REQ-F-28). Format (for example CSV): TBD until an authorized export is seen. API or webhook: Stretch (REQ-F-32).
- PostgreSQL: system database (2.4).

### 5.3 Hardware Interfaces

N/A: the system does not connect to its own hardware. It uses the phone's location through the browser (REQ-NF-11).

### 5.4 Communications Interfaces

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-12 | All traffic shall go over HTTPS, also in development tests on the phone. The Geolocation API requires it. | N/A | TBD | Clear | main.tex:332; Team |

- Outgoing mail: needed for REQ-F-06, REQ-F-12 and REQ-F-15. In development, a fake mail server. In production: TBD (CTI). Options under discussion: CTI SMTP or relay, or an external provider only with approval. Still unknown: the sender address and who sets up SPF and DKIM in DNS.

## 6. Quality Attributes

### 6.1 Usability

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-13 | The User, Staff and Administrator interfaces shall meet the applicable WCAG 2.2 level AA criteria. | N/A | TBD | Clear | main.tex:490-494 |
| REQ-NF-14 | Gym ID states and other key states shall be shown with text or an icon in addition to color. | N/A | TBD | Clear | main.tex:494 |

### 6.2 Performance

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-15 | The system shall serve about 150 people per day. | N/A | TBD | Pending: number of members and simultaneous Check Ins at peak hour (gym) | main.tex:104 |
| REQ-NF-16 | The PWA shall meet a performance target on phones (for example, load time). | N/A | TBD | Pending: metric and value (team). The proposal only names the topic (main.tex:433) | main.tex:433 |

### 6.3 Security

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-17 | Each role shall have only the access it needs. Staff shall not have full administrative access. | N/A | TBD | Clear | main.tex:509 |
| REQ-NF-18 | Server credentials shall be in protected configuration, outside the repository. | N/A | TBD | Clear | main.tex:509 |
| REQ-NF-19 | Staff shall see only the sensitive data essential for Check In. | N/A | TBD | Clear | main.tex:466 |
| REQ-NF-20 | Photos and documents shall be stored in private storage, accessible only through the backend according to role. | N/A | TBD | Clear | main.tex:466, 511 |
| REQ-NF-21 | The system shall store only the personal data listed in the data dictionary. | N/A | TBD | Clear | main.tex:466 |
| REQ-NF-22 | The developer role shall be outside the gym roles. | N/A | TBD | Clear | main.tex:437 |
| REQ-NF-23 | Developers shall not have routine access to safety or emergency data in production. | N/A | TBD | Pending: if the team manages the VM, it has access; still unknown who manages the VM and who looks after the system (CTI, gym) | main.tex:437, 509 |
| REQ-NF-24 | Uploaded photos shall have allowed types and a maximum size, and the system shall strip location metadata. | N/A | TBD | Pending: types and size (team) | Review |
| REQ-NF-25 | The system shall show a privacy notice in Spanish and English before collecting personal data. | N/A | TBD | Pending: text (gym, UPRM) | Team |

Attempt limit and inactivity: REQ-F-07 and REQ-F-08.

### 6.4 Safety

N/A as a product requirement: the system does not control doors, machines or admission, and it is not a medical records system (`main.tex:116, 328`). The medical warnings in REQ-F-60 are informational. What staff do if the system stops working is in REQ-NF-31.

### 6.5 Other Quality Attributes

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-26 | Sign in, authorization, sessions, the one-device rule and Gym ID verification shall require a connection. Without a connection no session is created. | N/A | TBD | Clear | main.tex:460 |
| REQ-NF-27 | The service worker shall not cache responses from `/api`. | N/A | TBD | Clear | Review |
| REQ-NF-28 | The location boundary and the accepted accuracy shall be set with tests inside and outside the gym on iPhone and Android. | N/A | TBD | Pending: values; access and schedule to test at the gym (gym, team) | main.tex:435, 458 |
| REQ-NF-29 | The location boundary shall be configurable per environment, and the classroom demo configuration shall not be deployable to production. | N/A | TBD | Pending: how this is prevented (team) | Review |
| REQ-NF-30 | The main flows shall pass on iPhone with Safari, Android with Chrome, and Windows with Chrome and Edge; macOS and Firefox as a secondary check. | N/A | TBD | Clear | main.tex:464 |
| REQ-NF-31 | Availability: uptime target and manual procedure if the system fails. | N/A | TBD | Pending: target and procedure (gym); who looks after the system (gym, CTI) | Review |
| REQ-NF-32 | Database migrations shall be reproducible, and the development configuration shall be separate from the production configuration. | N/A | TBD | Clear | main.tex:515 |

Portability: same Docker images with a pinned version in development and production (2.4).

## 7. Internationalization and Localization Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-33 | The interface shall be in Spanish by default, with a button that switches all texts to English. | N/A | TBD | Clear | Later change |
| REQ-NF-34 | All frontend and backend texts, including emails and API error messages, shall be in translation files from the start. | N/A | TBD | Clear | Later change |
| REQ-NF-35 | Emails shall be sent in the language chosen by the User. | N/A | TBD | Clear | Later change |
| REQ-NF-36 | The page language attribute shall change together with the texts (WCAG 3.1.1). | N/A | TBD | Clear | Review |
| REQ-NF-37 | Expiration, end of term and analytics shall use the `America/Puerto_Rico` time zone. | N/A | TBD | Clear | Review |
| REQ-NF-38 | Dates and times shall have a defined format per language. | N/A | TBD | Pending: format (team) | Review |

Gym texts in two languages: REQ-F-58.

## 8. Other Requirements

### 8.1 Audit

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-39 | The system shall record actor, action, affected record and time of each Staff correction, Staff-assisted Check In, roster change and role assignment. | N/A | TBD | Pending: who sees it and how long it is kept (gym, team) | main.tex:212, 513 |

### 8.2 Testing

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-40 | There shall be automated unit or database tests for authorization and sessions. | N/A | TBD | Clear | main.tex:515 |
| REQ-NF-41 | There shall be integration tests from sign in to session creation. | N/A | TBD | Clear | main.tex:515 |
| REQ-NF-42 | Simultaneous Check In requests and repeated Authorization Number or roster claims shall produce at most one session or one claim. | N/A | TBD | Clear | main.tex:462, 573 |
| REQ-NF-43 | Location and PWA behavior shall be tested on real phones. | N/A | TBD | Clear | main.tex:515 |
| REQ-NF-44 | Each test plan case shall be linked to an objective and shall use controlled datasets. | N/A | TBD | Clear | main.tex:515, 573-575 |

### 8.3 Development Process

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-45 | Changes shall enter `main` through branches and pull requests reviewed by at least one member who is not the author. | N/A | TBD | Clear | main.tex:515; repo rules |

### 8.4 Legal, Intellectual Property and Privacy

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-46 | Ownership and license of the team's work shall follow UPRM and Capstone policies before a long-term institutional deployment. User and institutional data are not intellectual property of the project. | N/A | TBD | Pending: terms (professor, UPRM) | main.tex:334-338 |
| REQ-NF-47 | Handling of student data shall comply with the laws and policies UPRM determines apply. FERPA probably applies to UPRM (indication, not confirmed). | N/A | TBD | Pending: whether gym data counts as an education record and which rules apply (UPRM: Registrar or compliance officer, through CTI) | Team |

## Appendix A: Glossary

| Term | Definition |
|---|---|
| Administrator | Athletic Activities administration role. Manages Staff, terms, imports, schedules, notices, information and analytics |
| API | Application Programming Interface: interface the frontend uses to talk to the backend. Here, under `/api` |
| Athletic Activities | UPRM Department of Athletic Activities, owner of the need |
| Authorization Number | Number issued with the membership purchase in WooCommerce. The paid member uses it to register and renew |
| Check In | Action with which the User opens a facility session |
| Staff-assisted Check In | Check In that Staff do for a User who is present without a phone |
| CSV | Comma-Separated Values: text file with values separated by commas |
| CTI | UPRM technology area. Meaning of the acronym not verified |
| DKIM | DomainKeys Identified Mail: signature that proves an email came from an authorized domain |
| DNS | Domain Name System: system that translates domain names to addresses |
| Export Orders | WooCommerce feature that exports orders to a file |
| FERPA | Family Educational Rights and Privacy Act: U.S. federal law that protects students' education records |
| Gym ID | Credential in the PWA with name, photo, authorization and Check In status. Staff verify it against the backend |
| HTTPS | Hypertext Transfer Protocol Secure: encrypted HTTP |
| Paid member | User with a semester membership paid in WooCommerce |
| MVP | Minimum Viable Product: scope validated first (`main.tex:295`) |
| Estimated occupancy | Number of active facility sessions. It is not a physical headcount |
| PWA | Progressive Web App: web application that can be installed on the phone |
| Roster | List of authorized athletes for an academic term |
| SAML | Security Assertion Markup Language: standard for signing in through an external provider |
| Secondary | Scope planned after the MVP is stable (`main.tex:295`) |
| Service worker | Browser script that lets the PWA be installed and cache files |
| Authenticated session | Device signed in to an account |
| Facility session | 60-minute period created by a valid Check In (facility session, `main.tex:358`) |
| SMTP | Simple Mail Transfer Protocol: protocol for sending email |
| SPF | Sender Policy Framework: DNS record that says which servers can send email for a domain |
| Staff | Gym staff, including front desk students |
| Designated roster Staff | Staff with the separate permission to digitize and change the roster |
| Stretch | Scope done only if the committed scope is complete and tested (`main.tex:295`) |
| TBD | To Be Determined: missing information |
| Academic term | Semester with configured start and end dates |
| UPRM | University of Puerto Rico at Mayagüez |
| User | Person with an account: paid member or athlete |
| VM | Virtual Machine |
| WCAG | Web Content Accessibility Guidelines: W3C accessibility guidelines |
| WooCommerce | Commerce system on WordPress that UPRM uses to charge for memberships |

## Appendix B: Analysis Models

Use cases by role:

| Role | Use case | Requirements |
|---|---|---|
| User | Register as paid member | REQ-F-10 to REQ-F-13, REQ-F-17 |
| User | Register as athlete | REQ-F-13 to REQ-F-17 |
| User | Sign in | REQ-F-02 to REQ-F-04 |
| User | Renew | REQ-F-23 to REQ-F-26 |
| User | Check In and show Gym ID | REQ-F-33 to REQ-F-40 |
| User | See occupancy, schedules, notices and information | REQ-F-41 to REQ-F-43, REQ-F-55 to REQ-F-57 |
| Staff | See sessions and verify Gym ID | REQ-F-44, REQ-F-45 |
| Staff | Staff-assisted Check In | REQ-F-46, REQ-F-47 |
| Staff | Correct session | REQ-F-48 |
| Designated Staff | Maintain the roster | REQ-F-49 to REQ-F-51 |
| Administrator | Manage Staff and permissions | REQ-F-52 to REQ-F-54 |
| Administrator | Configure terms | REQ-F-21 |
| Administrator | Import and reconcile WooCommerce | REQ-F-28 to REQ-F-31 |
| Administrator | Publish schedules, notices and information | REQ-F-55 to REQ-F-58 |
| Administrator | See analytics | REQ-F-61 to REQ-F-65 |

## Summary of Open Items

| TBD | What is missing | Who answers | Blocks |
|---|---|---|---|
| Final priority | Approve must, should, may for each requirement | Team | All |
| "Complete" in December | Whether it means the 5 objectives with Administrator and analytics | Team, professor | All (1.3) |
| Scope table versus objectives | Whether the Secondary items of Objectives 4 and 5 are committed | Team, professor | REQ-F-49 to REQ-F-65 |
| Outgoing mail | CTI SMTP or relay, sender address, SPF and DKIM, or external provider | CTI | REQ-F-06, REQ-F-12, REQ-F-15, REQ-NF-35 |
| PostgreSQL | Whether CTI accepts it or requires MySQL | CTI | REQ-F-17, REQ-F-36, REQ-NF-02 |
| VM | Public IP, containers, subdomain, HTTPS, single name | CTI | 2.3, 2.4, REQ-NF-12 |
| Authorization Number format | Length, whether it is random, whether it is single use | Gym, CTI | REQ-F-10 |
| Paid member email | Whether it can be changed; whether it is verified and how | Gym, team | REQ-F-11, REQ-F-12 |
| Uniform response | Confirm same response whether or not it is in the roster | Team | REQ-F-16 |
| Single device | Whether it applies to Staff and Administrator | Team, gym | REQ-F-03 |
| Cookies on iPhone | Test the installed PWA on iPhone | Team | REQ-F-03, REQ-F-66 |
| Account recovery | Process when the phone is lost | Gym | REQ-F-05 |
| New account security | Password recovery, attempt limit, inactivity, account deletion | Team, gym, UPRM | REQ-F-06 to REQ-F-09 |
| Type change | Which email stays and how the roster is linked | Gym, team | REQ-F-20 |
| Academic terms | Who provides and enters the dates | Gym | REQ-F-21 |
| Export Orders | File format and columns | Team | REQ-F-28 |
| WooCommerce API | Whether there is access and with what restrictions | CTI | REQ-F-32 |
| Gym ID indicators | What they show without real time | Team, gym | REQ-F-40 |
| Periodic polling | Confirm 20 to 30 s and rewrite the Objective 3 criterion | Team | REQ-F-42, REQ-F-43 |
| Staff-assisted Check In | Accepted identification | Gym | REQ-F-46 |
| Staff corrections | List of permitted corrections | Gym | REQ-F-48 |
| Roster Staff | Who designates; periodic review; fields and format of the lists; whether it moves up to MVP | Gym, team | REQ-F-49 to REQ-F-51, REQ-F-53 |
| Permission matrix | Final matrix and Objective 4 criterion | Gym, team | REQ-F-52, REQ-F-54 |
| English texts | Who writes the gym's English version | Gym | REQ-F-58 |
| Safety records | Which ones the department requires | Gym | REQ-F-60 |
| Install button | Whether it goes into the MVP | Team | REQ-F-66 |
| Retention and FERPA | Periods by data type, old photos, whether FERPA applies | Gym, UPRM (through CTI) | REQ-NF-04, REQ-NF-05, REQ-NF-47 |
| Backups | What, how often, where, retention | CTI, team | REQ-NF-06 |
| Real data | How many records, on which machines, how long | Team, CTI | REQ-NF-07 |
| External services | Who approves | CTI | REQ-NF-09 |
| Capacity | Members and simultaneous Check Ins at peak hour | Gym | REQ-NF-15 |
| PWA performance | Metric and value | Team | REQ-NF-16 |
| Production access | Who manages the VM and who looks after the system | CTI, gym | REQ-NF-23, REQ-NF-31, 2.5 |
| Photos | Types and maximum size | Team | REQ-NF-24 |
| Privacy notice | Text in Spanish and English | Gym, UPRM | REQ-NF-25 |
| Location boundary | Values and access to the gym to measure | Gym, team | REQ-NF-28 |
| Demo configuration | How to keep it from reaching production | Team | REQ-NF-29 |
| Availability | Target and manual procedure | Gym | REQ-NF-31 |
| Date format | Format per language | Team | REQ-NF-38 |
| Audit | Who sees it and how long it is kept | Gym, team | REQ-NF-39 |
| License | Ownership and license terms | Professor, UPRM | REQ-NF-46 |
| Stretch | Capacity policy, other facilities, history to predict | Gym, team | REQ-F-67 to REQ-F-69 |
| Authorization removed with an active session | Whether the session continues or ends | Gym | REQ-F-27 |
| Design details | Link validity period, error texts, import report, repeated roster entry, untranslated text, unconfigured term | Team | REQ-F-15, REQ-F-21, REQ-F-28, REQ-F-35, REQ-F-49, REQ-F-58 |
