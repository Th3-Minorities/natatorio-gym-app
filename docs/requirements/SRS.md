# Software Requirements Specification

**Project:** UPRM Weight Gym Operations and Member-Access Platform

**Version:** 0.5 draft, not approved

**Authors:** Carlos J. Pepin Delgado, Pierre G Vales Torres, Viviana V Ramos Vivoni

**Organization:** Department of Computer Science and Engineering, University of Puerto Rico at Mayagüez (UPRM)

**Date:** 2026-10-14

## Contents

- Overview
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
- Appendix B: Merged and Removed Requirements
- Summary of Open Items

## Overview

**What the system does.** A phone-first web app (PWA) for the UPRM Weight Gym. It replaces the paper log and the manual payment check. People create one account, prove they may use the gym (a paid WooCommerce membership or the athlete roster), and do Check In from their phone inside the gym. A Check In opens a 60-minute facility session and shows a Gym ID that Staff can verify. The app shows estimated occupancy, schedules, notices, facility information and usage statistics.

**Who uses it.**

- **User:** a person with an account. Either a **paid member** (bought a term membership in WooCommerce) or an **athlete** (on the department's roster for the term).
- **Gym account:** one shared account for the gym, not one per employee. Used **without the PIN** it acts as **Staff** (front desk). Used **with the PIN** it acts as **Administrator** (Athletic Activities administration). The PIN is a secret number only the administration knows. It stays open only in the browser where it was typed.
- **Developer:** the project team. Outside the gym roles.

**What each role can do.** The backend enforces this table (REQ-F-52).

| Action | User | Staff (no PIN) | Administrator (PIN) |
|---|---|---|---|
| Register, sign in, Check In, show the Gym ID, renew, delete own account | Yes | No | No |
| See occupancy, schedules, notices, facility information | Yes | Yes | Yes |
| See facility analytics | Yes | Yes | Yes |
| See active sessions and verify a Gym ID | No | Yes | Yes |
| Staff-assisted Check In; end a session early or void it | No | Yes | Yes |
| See a User's waiver and emergency contact | No | Yes | Yes |
| Register in person an athlete already on the roster (only if there is no outgoing mail, REQ-F-77) | No | Yes | Yes |
| Athlete roster, academic terms, WooCommerce import and undo | No | No | Yes |
| Schedules, closures, athletes-only slots, notices, facility information | No | No | Yes |
| Grant or revoke an authorization by hand; release a claimed Authorization Number | No | No | Yes |
| Delete a User's account when the User asks (REQ-F-09) | No | No | Yes |
| See the audit log; change the PIN and the gym account password | No | No | Yes |

**Still open.** Pending requirements: REQ-F-06, F-10, F-15, F-28, F-32, F-49, F-51, F-52, F-58, F-67, F-68, F-69, F-73, F-75, F-77, F-82, REQ-NF-04, NF-05, NF-06, NF-07, NF-09, NF-23, NF-25, NF-28, NF-31, NF-46, NF-47. Details: Summary of Open Items.

## Revision History

| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Carlos J. Pepin Delgado | 2026-10-11 | First draft based on the proposal and the later changes | 0.1 |
| Carlos J. Pepin Delgado | 2026-10-13 | Team answers of 2026-10-13: scope and final priority, registration flows, one gym account with a PIN, no refunds, athletes-only periods, waiver, audit log, quality targets | 0.2 |
| Carlos J. Pepin Delgado | 2026-10-14 | Follow-up answers: audit log retention, photo comparison, in-person athlete registration, PIN timeout, athletes-only notice, analytics open to all roles | 0.3 |
| Carlos J. Pepin Delgado | 2026-10-14 | Design-readiness decisions E-31 to E-47 (`team.md`) | 0.4 |
| Carlos J. Pepin Delgado | 2026-10-14 | Shortened: merged duplicate requirements (Appendix B), moved design details to `docs/design/design-notes.md` and team rules to `context.md`, added the Overview, plain Source labels | 0.5 |

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the December release of the UPRM Weight Gym Operations and Member-Access Platform. It is for the development team and the professor: it says what to build and how to test it.

The baseline is the proposal, in force until further notice. `docs/context.md` lists what changes it and why. If this document and the proposal differ, this document wins, and the difference must appear in `context.md`.

### 1.2 Document Conventions

- IDs: `REQ-F-NN` (functional) and `REQ-NF-NN` (nonfunctional). An ID is never reused or renumbered. A new requirement takes the next free number. A merged or removed requirement is listed in Appendix B with the place where its rule lives now.
- **Proposal priority:** MVP, Secondary or Stretch from the proposal scope table (Proposal:293-310); N/A if it is not in that table.
- **Final priority:** MVP is High, Secondary is Medium, Stretch is Low. Exceptions: a Secondary or N/A row that an MVP flow needs is High; any other N/A row is Medium. High and Medium are committed for December; High is built first. Low is built only if the rest is complete and tested.
- **Status:** **Clear** (can be built and tested now) or **Pending** (information is missing; the cell names who answers and the question ID in `docs/decisions/`).
- **Source:** **Proposal:LINE** (a line of the proposal, see 1.4); **Team decision** (recorded in `context.md` or `docs/decisions/team.md`); **Review gap** (found in the requirements review, not in the proposal).
- **Proposed:** a rule the team suggests that still needs confirmation.
- Terms: "term" means academic term (the proposal says "semester"). "Sign-in session" is the login on a device. "Session" alone is the 60-minute facility session.

### 1.3 Project Scope

The system is a PWA for the Weight Gym in the UPRM Natatorio Complex. It replaces the paper log and the manual payment check (Proposal:102). It joins accounts, authorization by paid membership or athlete roster, Check In with location, 60-minute sessions, Gym ID, estimated occupancy, schedules and notices, facility information and utilization analytics (Proposal:120, 198).

Out of scope (Proposal:116, 328): payment processing (stays in WooCommerce), other facilities such as the pool, medical records, and capacity-based admission while UPRM has no official policy.

Delivery: demo in December before professors, with the project "complete". "Complete" means all 5 objectives of the proposal (Proposal:123-192) are met, without Stretch (Team decision, E-01). So the roster tool, the gym permissions, schedules and closures, and analytics are committed, although the scope table calls them Secondary (Proposal:305). The roster tool and the Install button (REQ-F-66) move up to the MVP.

Stretch features, built only if the committed scope is complete and tested (Proposal:295, 307):

| ID | Requirement | Final priority | Status |
|---|---|---|---|
| REQ-F-67 | The system shall be able to limit admission by capacity, only when UPRM has an official capacity policy. | Low | Pending: UPRM capacity policy (gym) |
| REQ-F-68 | The system shall be able to extend to other facilities, such as the Natatorio. | Low | Pending: rules of those facilities (gym) |
| REQ-F-69 | The system shall be able to predict occupancy when there is enough history. | Low | Pending: how much history is enough (team) |

### 1.4 References

`Proposal:LINE` means a line of `docs/capstone_proposal/main.tex` (v0, frozen), the submitted capstone proposal.

| Document | Location | Note |
|---|---|---|
| Capstone proposal, "UPRM Weight Gym Operations and Member-Access Platform", Pepin, Vales, Ramos, September 29, 2026 | `docs/capstone_proposal/main.tex` | Current baseline. `v0/` is frozen |
| Current context and decisions | `docs/context.md` | What changes the proposal and why |
| Open questions and team decisions | `docs/decisions/` (`cti.md`, `gym.md`, `team.md`) | Questions for CTI, the gym, the team and the professor |
| Design notes | `docs/design/design-notes.md` | Design details moved out of this document |
| SRS Template, `software-documentation` repository | https://github.com/gusonkuntarto/software-documentation/blob/main/Software%20Requirements%20Specification%20(SRS)%20Template.docx | Structure of this document |
| WCAG 2.2, W3C, December 12, 2024 | https://www.w3.org/TR/WCAG22/ | Cited in Proposal:594 |
| Geolocation, W3C | https://www.w3.org/TR/geolocation/ | Cited in Proposal:596 |

## 2. Overall Description

### 2.1 Product Perspective

New product. Today the gym logs on paper, and staff check payment (WooCommerce) or athlete status (department lists) by hand (Proposal:102, 111). There is no count of active users and no usage metrics.

| Related system | Relationship |
|---|---|
| UPRM WooCommerce | Source of truth for payments. The system imports Export Orders files and does not process payments (Proposal:369-371) |
| Department athlete lists | Administrators digitize them each term into the roster (Team decision) |
| User's browser | Provides location through the Geolocation API (Proposal:499-503) |
| Outgoing mail server | Sends athlete registration links and password reset links. Pending: CTI, M-07 |
| CTI VM | Hosts the system in production |

### 2.2 User Classes and Characteristics

User types and roles: see the Overview. Some paid members have no institutional email. Athletes do not buy a membership (Proposal:206). Front desk Staff include students (Proposal:118). Estimated use: about 150 people per day (Proposal:104), mostly from the phone (Proposal:198).

### 2.3 Operating Environment

- Client: PWA in the browser. iPhone with Safari, Android with Chrome, Windows with Chrome and Edge; macOS and Firefox as secondary (Proposal:464).
- Production: CTI VM, Ubuntu 26 or Rocky 10, after CTI evaluation. UPRM subdomain (Proposal:332).
- Development: `docker-compose` on each member's PC; phone tests through an HTTPS tunnel.
- Pending (CTI, M-01, M-02, M-03): public IP or campus only; containers allowed; who sets up the subdomain and certificate.
- Pending (gym, G-06): front desk devices. The team understands there is a desktop computer at the front desk.

### 2.4 Design and Implementation Constraints

- Frontend: PWA with React, TypeScript and Vite, one codebase for phone and desktop (Proposal:348).
- Backend: Laravel (PHP 8.3 or higher). Decided, not reopened.
- Database: PostgreSQL in a container. Pending: CTI accepts PostgreSQL (M-09). Why PostgreSQL: `docs/design/design-notes.md`.
- Containers: `docker-compose` with proxy, PHP, PostgreSQL and scheduled tasks.
- Single origin: PWA at `/` and API at `/api` under one name (Proposed; CTI, M-03).
- Production on a CTI VM. CTI does not manage the server or the application.
- No SAML: the system has its own accounts.
- CTI services only. No Supabase and no Vercel (Team decision, E-07).
- One shared gym account with a single PIN. No per-person gym accounts.
- No street address is collected or stored anywhere.
- Minimum cost for the gym; rely on CTI where possible.
- No offline Check In (Proposal:460).

### 2.5 Assumptions and Dependencies

| Depends on | What is assumed | If it fails | Question |
|---|---|---|---|
| CTI | VM with containers, subdomain and HTTPS | No production in December | M-01 to M-05 |
| CTI | Outgoing mail from the VM. Only the email-link athlete flow (REQ-F-15) is built | No athlete links and no password reset. Then, and only then, the in-person flow (REQ-F-77) is built | M-07 |
| CTI | CTI accepts PostgreSQL | REQ-F-17 and REQ-F-36 need another design | M-09 |
| Gym | Validates the access, renewal, PIN, exception, privacy, retention and recovery rules (Proposal:332) | Pending requirements cannot be closed | G-09 |
| Gym | Provides athlete lists, schedules, athletes-only periods, rules, equipment information and a contact number (Proposal:332) | No data for the roster, schedules or information | G-10, G-25, G-28 |
| WooCommerce | The team keeps authorized access to Orders and Export Orders (Proposal:369) | No import | M-12 |
| WooCommerce | The store sells memberships only while a term runs. No summer membership unless a summer term is configured | Orders dated outside every term are rejected (REQ-F-22) | G-26 |
| WooCommerce | Memberships are never refunded or cancelled; they only expire at the end of the term | Removed REQ-F-27 would come back | None |
| Professor | Accepts the stack change from the proposal | It would have to be justified or reverted | P-01, P-03 |
| Gym and CTI | Someone looks after the system after December | Nobody operates it; if the team does, it conflicts with REQ-NF-23 | G-01, M-16 |

## 3. System Features

### 3.1 Accounts and Sign In

Each person has one account that lasts across terms, separate from the authorization (Proposal:202, 355-357). Acceptance criterion (Objective 1, Proposal:140-144): every case in the controlled dataset returns the expected decision.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-01 | The system shall keep one account per person, which persists across terms. | MVP | High | Clear | Proposal:202, 355 |
| REQ-F-02 | The User shall be able to create their own account and sign in with email and password. The system shall not use external authentication (SAML). | MVP | High | Clear. `Proposal:120` says "institutional login"; v1 of the proposal must correct it | Proposal:202; Team decision |
| REQ-F-03 | A User account (paid member or athlete) shall have at most one sign-in session. Signing in on another device ends the previous one, and the old device can no longer perform protected actions. There is no inactivity timeout: the sign-in session lasts until the User signs out or signs in elsewhere. A User who loses or changes the phone signs in on the new one; there is no staff process. The rule does not apply to the gym account. | MVP | High | Clear. To test: cookies in the installed PWA on iPhone (E-17) | Proposal:202, 363; Team decision |
| REQ-F-06 | The User shall be able to reset their password with a link sent to the account email. | N/A | High | Pending: CTI, M-07 | Review gap |
| REQ-F-07 | After 10 failed sign-in attempts, counted per account and per IP address, the system shall make that account or IP address wait, and the wait shall grow with each lockout. The rejection says when to try again. | N/A | High | Clear. Exact waits: design | Review gap |
| REQ-F-09 | A User with no active authorization shall be able to delete their account from the app. An Administrator can do the same deletion when the User asks. The system deletes the personal data and photos and keeps only anonymous Check In counts. Audit log entries that mention the user stay until the end of their term (REQ-NF-39), and distinct-people counts already computed (REQ-F-61) do not change. | N/A | Medium | Clear | Review gap; Team decision |

Errors not covered above: wrong credentials are rejected without saying whether the email exists; a deletion request with an active authorization is rejected with the reason.

### 3.2 Paid Member Registration

The paid member registers with the Authorization Number, the 6-digit value in the "Payment Description" of the WooCommerce receipt email (Proposal:204). The account email is always the payment email of that order. There is no email verification: the number reached the payer by email, and that is the check (E-09). Because 6 digits can be guessed, REQ-F-71 to REQ-F-75 add protections. Acceptance criterion: Objective 1 (Proposal:140-144), cases of valid, expired and missing membership.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-10 | The system shall validate the Authorization Number against the membership records imported from WooCommerce. | MVP | High | Pending: is the number unique across orders? (team and gym, E-30, G-19) | Proposal:204, 371 |
| REQ-F-11 | The paid member's account email shall be the payment email of the WooCommerce record. The member shall not type or change it. | MVP | High | Clear | Proposal:204; Team decision |
| REQ-F-13 | On registration, the User (paid member or athlete) shall create a password and upload a current photo as a file. The account and the claim of the Authorization Number or roster record are saved together, in one step, only after the photo is saved. If the photo fails, nothing is claimed and the number or record stays free. | MVP | High | Clear | Proposal:202, 204, 206; Team decision |
| REQ-F-70 | As soon as a valid, unclaimed Authorization Number is entered, the system shall show the payment email of that order masked (for example `c***@upr.edu`). | N/A | High | Clear | Team decision |
| REQ-F-71 | The system shall limit failed Authorization Number lookups per IP address: when that limit is hit, lookups from that IP address pause for a time. A global limit on failed lookups never blocks registrations: it only slows each lookup and writes an alert entry in the audit log for the Administrator. | N/A | High | Clear. Values: design | Team decision (E-53) |
| REQ-F-72 | The system shall show the same message when an Authorization Number is invalid and when it is already claimed, with the contact number of REQ-F-73. | N/A | High | Clear | Team decision |
| REQ-F-73 | When an Authorization Number or a student number does not match a valid record, the system shall show the contact number of someone who can help. | N/A | High | Pending: the number (gym, G-25) | Team decision |
| REQ-F-74 | An Administrator shall be able to release an Authorization Number claimed by mistake. If that claim created the account, the account is deleted together with its photo. If the number was added to an account that already existed (for example a renewal), only that authorization is removed and the account stays. In both cases the number can be claimed again. | N/A | Medium | Clear | Team decision (E-52) |
| REQ-F-75 | If someone else claimed a member's Authorization Number, the real owner shall be able to take the account back with the password reset (REQ-F-06), because the account email is the payment email. | N/A | High | Pending: CTI, M-07 | Team decision |

Errors not covered above: an Authorization Number from an ended term cannot be used to register.

### 3.3 Athlete Registration

The athlete registers with the student number, looked up in the roster that Administrators enter (Proposal:206). The student number is not secret, so the account is created only after the athlete opens a link sent to the institutional email in the roster. Acceptance criterion: Objective 1, cases of valid and invalid athlete and user with no match (Proposal:142).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-15 | The athlete shall register with their student number, which the system looks up in the current-term roster. The system sends a link to the institutional email in that roster record and creates the account only after the link is opened. This is the only athlete flow built unless CTI confirms there is no outgoing mail (then REQ-F-77). | MVP | High | Pending: CTI, M-07 | Proposal:206; Team decision |
| REQ-F-17 | Each roster record and each Authorization Number shall be claimable by only one account, also under simultaneous requests. The database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (CTI, M-09) | Proposal:206, 371, 462, 511 |
| REQ-F-76 | If the student number is not in the current-term roster, the system shall say that the person does not appear as a registered athlete and must go to the Department of Athletic Activities to be registered or to check for an error, with the contact number of REQ-F-73. | N/A | High | Clear | Team decision |
| REQ-F-77 | Only if CTI confirms there is no outgoing mail: Staff shall be able to register in person an athlete who is in the current-term roster, after checking identification. Staff cannot register a person who is not on the roster or add roster records. | N/A | High | Pending: built only if CTI confirms no mail (M-07) | Team decision |

Errors not covered above: an expired or already used link creates no account (link validity: design); a roster record that is already claimed is refused with the contact number.

### 3.4 Authorization, Academic Terms and Renewal

The authorization says whether the person has access in the current term. A User can have several authorizations over time (Proposal:356, 361). Term dates come from the UPRM academic calendar. An athlete on the current-term roster has nothing to renew; a paid member renews with a new Authorization Number. Acceptance criterion (Objective 1, Proposal:144): every User with a valid authorization is approved and every User without one is denied.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-18 | If a WooCommerce or roster record cannot be verified, the system shall deny the registration, renewal or Check In that depends on it. | MVP | High | Clear | Proposal:513 |
| REQ-F-19 | The authorization shall be stored separately from the account, and a User can have several authorizations over time. | MVP | High | Clear | Proposal:350, 356 |
| REQ-F-20 | The User shall be able to move between paid-member and athlete authorization without losing the account or the Check In history, by adding the new authorization from inside the existing account (REQ-F-23, REQ-F-80). The account email does not change, no new account is created, and staff do not merge accounts. | MVP | High | Clear | Proposal:202, 356, 406; Team decision |
| REQ-F-21 | The Administrator shall be able to create and edit academic terms with a start date and an end date from the UPRM academic calendar. Terms never overlap: on save, the system rejects dates that overlap another term. Gaps between terms are allowed. | N/A | High | Clear | Proposal:350, 361; Team decision (E-48) |
| REQ-F-22 | Each authorization shall expire at the end of its term, whatever the purchase date. An order belongs to the term that contains its payment date. An order dated outside every term gives no authorization and is listed in the import result. An athlete authorization also ends when the athlete is removed from the roster (REQ-F-49). | MVP | High | Clear. Gym to confirm the store sells only while a term runs (G-26) | Proposal:361; Team decision |
| REQ-F-23 | When the authorization expires, the system shall keep the account and disable Check In. A User with no active authorization sees: the status ("expired" or "not on the roster"), the Authorization Number field (to renew or to become a paid member), the contact number of REQ-F-73, and the schedules, notices, facility information and analytics. This User cannot do Check In. | MVP | High | Clear | Proposal:204; Team decision (E-50) |
| REQ-F-25 | The athlete shall renew through the roster for the new term, with no purchase or Authorization Number. | MVP | High | Clear | Proposal:206, 218, 321 |
| REQ-F-26 | The User shall upload a current photo for each term (at registration and at each renewal) and shall not be able to replace it during an active authorization. An athlete is asked for the new photo the first time they sign in during a new term, before Check In is allowed. | MVP | High | Clear | Proposal:202, 426; Team decision |
| REQ-F-78 | When a User enters an Authorization Number whose payment email matches an existing account, the system shall attach the new authorization to that account and shall not create a new one. This is how a paid member renews. | N/A | High | Clear | Proposal:320; Team decision |
| REQ-F-80 | A signed-in User shall be able to enter a student number ("I am an athlete"). If it is in the current-term roster and unclaimed, the system links the roster record to the account; otherwise it shows the message of REQ-F-76. | N/A | High | Clear | Team decision |
| REQ-F-87 | An Administrator shall be able to grant an authorization by hand to an existing account, valid until the end of a chosen term, and to revoke an authorization. It is used for order errors and gives access without a WooCommerce payment record. Proposed: a reason is required and is logged (REQ-NF-39). | N/A | Medium | Clear (reason Proposed) | Team decision |

Errors not covered above: with no term configured for the current date, no new authorization is created (message to the Administrator: design).

### 3.5 WooCommerce Import

WooCommerce stays the source of payments; the system copies only what is needed to authorize (Proposal:369-371). There are no refunds or cancellations, so the import handles only new and corrected orders. Acceptance criterion, adapted from Proposal:456: re-importing creates no duplicates, and corrected orders update the authorization. The proposal's mention of refunded and cancelled orders no longer applies.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-28 | The Administrator shall be able to load membership data from a WooCommerce Export Orders file. A file with an unexpected format imports nothing. The import result lists orders created, updated and rejected. | MVP | High | Pending: file format and columns (team, E-55) | Proposal:369, 371 |
| REQ-F-29 | The import shall copy only name, email, student number when present, membership details, Authorization Number, order reference, status, payment date, term (from the payment date) and last synchronization time. It shall not copy billing or address data. | MVP | High | Clear | Proposal:204, 371 |
| REQ-F-30 | Processing the same order more than once shall update or confirm the same record, without duplicates. | MVP | High | Clear | Proposal:371, 456 |
| REQ-F-31 | The Administrator shall be able to re-import a corrected file (reconciliation) and to undo any import at any time. Undo deletes the membership records that import brought and the authorizations that depend on them. Proposed: accounts and photos stay, and people claim again when the corrected file is imported. | MVP | High | Clear (effect on accounts Proposed) | Proposal:371; Team decision |
| REQ-F-32 | The system shall be able to synchronize with WooCommerce through approved API or webhook access, updating the same local records. | Stretch | Low | Pending: CTI, M-12 | Proposal:307, 371 |

### 3.6 Check In and Facility Session

The User does Check In from the phone. Location is a Check In condition, not proof of presence, and the User is not tracked (Proposal:210). Acceptance criterion (Objective 2, Proposal:151-155): every valid Check In creates exactly one active session and one Gym ID; invalid ones create no session; duplicates follow the session rule; every session stops counting after 60 minutes.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-33 | The system shall create a session only if the User has a current authorization, location permission is given, the location is inside the gym boundary with enough accuracy, there is a connection, and the gym is open by its published schedule and closures. Otherwise no session is created and the app shows the cause (outside the boundary, permission denied, accuracy, authorization, connection, gym closed, athletes-only period). | MVP | High | Clear. Boundary and accuracy: REQ-NF-28. Texts: design | Proposal:210, 458, 460, 573; Team decision |
| REQ-F-36 | A valid Check In shall create exactly one 60-minute session. A User never has two active sessions, also under simultaneous requests; the database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (CTI, M-09) | Proposal:155, 210, 365, 416, 462, 511 |
| REQ-F-37 | If the User already has an active session, another Check In shall return the current session and Gym ID without asking for location or creating a session. Location is asked only when a new session must be created. | MVP | High | Clear | Proposal:365, 416 |
| REQ-F-38 | The session shall expire 60 minutes after it starts, by backend time, with no checkout. It then stops counting toward occupancy, and a new valid Check In can create a new session. Expiry never makes anyone leave the gym: for athletes the 60 minutes are only a counting rule, with no time limit in the gym. | MVP | High | Clear | Proposal:210, 350, 365; Team decision |
| REQ-F-82 | During an athletes-only period, the system shall reject Check In by paid members, including Staff-assisted Check In, with a notice. Athletes can do Check In. | N/A | Medium | Pending: list of periods (gym, G-28) | Team decision (E-49) |
| REQ-F-83 | If an athletes-only period starts during a User's active session, the system shall show a notice with the start time of the period, at Check In and while the session is active. The session is never cut. | N/A | Medium | Clear | Team decision |

### 3.7 Gym ID and Occupancy

The Gym ID is the credential the User shows (Proposal:210). Estimated occupancy is the number of active sessions, not a headcount (Proposal:214). Screens poll the backend; live updates (SSE or WebSockets) are a later improvement, only if CTI allows them and time remains. Acceptance criterion (Objective 3, Proposal:162-166, rewritten for polling): REQ-F-41 and REQ-F-42 hold in every tested state. If live updates are built, the original criterion applies.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-40 | The Gym ID shall show name, photo, authorization, Check In status, minutes left in the session, and a moving element such as a clock so Staff can tell a live screen from a screenshot. For a paid member, after 60 minutes it shows "expired" with text and an icon. For an athlete, it does not expire while the term authorization is active. It has no code or QR. | MVP | High | Clear | Proposal:153, 210; Team decision |
| REQ-F-41 | Estimated occupancy shall equal the number of active sessions and shall be recalculated after each Check In, expiration or Staff correction. Athletes count only during their 60-minute session, so athletes who stay longer are not counted. | MVP | High | Clear | Proposal:164-166, 214; Team decision |
| REQ-F-42 | User, Staff and Administrator screens shall show the same occupancy value, compared after each screen has updated. | MVP | High | Clear | Proposal:166, 214 |
| REQ-F-43 | The occupancy and active session screens shall update by polling the backend every 20 to 30 seconds. | N/A | High | Clear | Team decision |

### 3.8 Staff Operations

Staff supervise use and handle exceptions (Proposal:210-212, 218). Acceptance criterion (Objective 4, Proposal:177): Staff can perform the defined supervision and correction tasks.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-44 | Staff shall be able to see active sessions with Check In time, authorization and Gym ID. | MVP | High | Clear | Proposal:218, 322 |
| REQ-F-45 | Staff shall verify a Gym ID against backend data, not only the User's screen: they search the person by name in the active sessions list and compare the photo. For an athlete whose 60 minutes ended, Staff check the roster. | MVP | High | Clear | Proposal:210; Team decision |
| REQ-F-46 | Staff shall be able to do a Staff-assisted Check In for an authorized User who is present without a phone. It creates the same 60-minute session and cannot bypass authorization, create a second active session, or be done for a paid member during an athletes-only period. To find a paid member, Staff search the person by name; no receipt or payment confirmation is needed. An athlete gives the student number. In both cases Staff compare the stored photo with the person. | N/A (in the Objective 2 test plan, Proposal:573) | High | Clear | Proposal:212, 573; Team decision (E-49, E-54) |
| REQ-F-48 | Staff shall be able to end a session early and to void a session created by mistake. A void keeps the record, and the session stops counting in occupancy and analytics. Staff cannot extend a session or create one without authorization. | MVP | High | Clear | Proposal:210, 218; Team decision |

### 3.9 Athlete Roster

Change from the proposal: Administrators (PIN holders) digitize the department's athlete lists each term. There is no separate roster permission and no review step; the audit log records every change.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-49 | Only Administrators shall be able to create, import and change the athlete roster for each term. If an athlete is removed mid-term, the athlete's Gym ID stops being valid at once, the athlete keeps counting in occupancy until the current session ends, and the athlete cannot do another Check In. | Secondary | High | Pending: format of the lists (gym, G-10) | Proposal:206, 218; Team decision |
| REQ-F-51 | Each roster record shall have at least student number, name, institutional email and term. A repeated student number in the same term is rejected. | Secondary | High | Pending: final list of fields (gym, G-10) | Proposal:206; Team decision |

### 3.10 Gym Account, PIN and Permissions

The roles and the PIN table are in the Overview. Acceptance criterion (Objective 4, Proposal:173-177, rewritten): every tested action is allowed or denied as in that table. Staff can do the session tasks; Administrators can manage the roster, schedules, closures and the PIN. The proposal's "Staff access" management is done by changing the gym account password (REQ-F-88).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-52 | There shall be one shared gym account. The backend shall allow or deny each action as in the Overview role table, even if the interface shows the action. User accounts cannot perform any gym action, and each role has only the access it needs. | Secondary | High | Pending: gym confirms the table (G-09) | Proposal:175-177, 305, 509; Team decision |
| REQ-F-88 | The team shall create the gym account, its password and the first PIN once, with an install command on the server, and give them to the Administrator. After that, the Administrator changes the password and the PIN from the app, using the current PIN. Changing the password is how access is withdrawn when an employee leaves. | N/A | High | Clear | Team decision (E-40) |

### 3.11 Facility Information, Schedules and Notices

Today rules and instructions are given in person or on paper (Proposal:218). The gym asked for notices of schedule changes, closures and maintenance (Proposal:104). Acceptance criterion (Objective 4, Proposal:177): the Administrator can manage schedules and closures.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-55 | The Administrator shall be able to publish and edit, and every User shall be able to see: (a) schedules, special hours and closures; (b) athletes-only slots; (c) maintenance notices and other updates; (d) facility information: rules, towel, footwear (including the Crocs and flip-flop restriction), available machines and approved equipment instructions. | Secondary | Medium | Clear | Proposal:104, 218; Team decision |
| REQ-F-58 | Texts the gym writes (rules, notices, closures, information) shall have a Spanish and an English version. If there is no English version, the Spanish text is shown. The team translates the initial texts and the gym approves them. | N/A | Medium | Pending: English for notices after December (gym, G-27) | Team decision |
| REQ-F-59 | The User shall be able to open equipment instructions with a QR code. | Stretch | Low | Clear | Proposal:218, 307 |

### 3.12 Membership and Safety Records

Digital records that replace paper, only as Athletic Activities needs them (Proposal:220). The system is not a medical records system (Proposal:328).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-60 | When the account is created, the User shall accept a liability waiver and give an emergency contact (name and phone). The system stores them with full name and email from the payment record (paid member) or the roster (athlete). Without the waiver the account is not created. The waiver is accepted once and stays valid while the account exists, even if the text changes. No street address, documents or medical warnings are collected. Proposed: the User can edit the emergency contact at any time, and Staff see the current value. | Secondary | Medium | Clear. Gym to confirm no documents or medical warnings (G-21) | Proposal:220, 466; Team decision |

### 3.13 Utilization Analytics

Analytics are facility statistics with aggregated counts only, no names. This changes the proposal, where only the Administrator reviews them (Proposal:220). Acceptance criterion (Objective 5, Proposal:188): every metric equals its expected value on controlled historical datasets.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-61 | Every signed-in role (User, Staff, Administrator), without the PIN, shall be able to see for a chosen period: (a) visits by hour, day, week and month; (b) high- and low-use periods; (c) estimated occupancy over time; (d) average and maximum occupancy; (e) use by paid members versus athletes; (f) distinct people, counting repeat visits once. Voided sessions do not count. A period with no data shows zero, not an error. | Secondary | Medium | Clear | Proposal:186-188, 220; Team decision |

### 3.14 PWA Installation

Chrome does not always show the install prompt, and on iPhone the app is installed by hand from Share (tested by the team).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-66 | The PWA shall have its own "Install" button in Chromium-based browsers and a help text for installing on iPhone. In browsers without the install event, the button does not appear. | N/A | High | Clear. To test: cookies in the installed PWA on iPhone (E-17) | Team decision |

## 4. Data Requirements

The logical data model is in `docs/design/design-notes.md`.

### 4.1 Data Dictionary

Only items not defined by a requirement.

| Element | Definition | Format or values |
|---|---|---|
| Authorization Number | Number issued with the membership purchase, shown as "Authorization Number" in the Payment Description of the receipt email | 6 digits (from one sample receipt). Unique across orders: not verified (E-30) |
| Receipt email fields | The receipt also has a Reference Number (15 hexadecimal characters), an account number, a transaction date and an amount | Not used for registration. The account number shall not be stored |
| Student number | Student identifier at UPRM | TBD (gym) |

### 4.2 Reports

| Report | Content | Who sees it |
|---|---|---|
| Utilization analytics | REQ-F-61 | Every signed-in role |
| Audit log | REQ-NF-39 | Administrator |
| Import result | REQ-F-28, REQ-F-22. Layout: design | Administrator |
| Roster changes per term | Roster changes from the audit log. Optional | Pending: gym, G-30 |

### 4.3 Data Acquisition, Integrity, Retention, and Disposal

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-01 | The database shall be the source of truth, and backend time shall decide the expiration of sessions and authorizations. | N/A | High | Clear | Proposal:350 |
| REQ-NF-03 | Location shall be used only for Check In and shall not be stored as movement history. The validation result may be stored. | N/A | High | Clear | Proposal:210, 511 |
| REQ-NF-04 | The system shall discard photos from earlier terms, unless UPRM requires keeping them. | N/A | Medium | Pending: gym and UPRM, G-03 | Proposal:511 |
| REQ-NF-05 | The system shall apply retention rules by data type: photos, waivers, emergency contacts, Check Ins and audit log. Each audit log entry, IP address included, is kept until the end of the term in which it happened, also when it mentions a deleted user. | N/A | Medium | Pending: every period except the audit log (gym and UPRM, G-03, M-15) | Proposal:328, 466; Team decision |
| REQ-NF-06 | There shall be backups of the database and the files, kept outside the VM, and a tested restore before each milestone. | N/A | Medium | Pending: CTI and team, M-06 | Proposal:468, 513 |
| REQ-NF-07 | Real WooCommerce data shall be used only to test the integration: with permission, only the needed fields, outside git and synced folders, and deleted when the test ends. Development uses fake data. | N/A | Medium | Pending: CTI and team, M-17 | Team decision |
| REQ-NF-09 | Student data shall not be sent to external services without approval. | N/A | High | Pending: CTI, M-11 | Team decision |

## 5. External Interface Requirements

### 5.1 User Interfaces

Screens by role follow the Overview table. Detailed screen design: design phase.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-10 | The interface shall be a mobile-first PWA with one codebase for phone and desktop. | N/A | High | Clear | Proposal:198, 348 |

### 5.2 Software Interfaces

- WooCommerce: Export Orders file (REQ-F-28); format TBD until an authorized export is seen. API or webhook: Stretch (REQ-F-32).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-11 | Location shall come from the browser's standard Geolocation API, and Check In shall handle the permission state and the reported accuracy. | N/A | High | Clear | Proposal:499-503 |

### 5.3 Communications Interfaces

- Outgoing mail: needed for athlete registration (REQ-F-15) and password reset (REQ-F-06, REQ-F-75). Development uses a fake mail server. Production: CTI SMTP or relay, sender address, SPF and DKIM (Pending: CTI, M-07). No external mail provider was chosen. If CTI confirms there is no mail, REQ-F-77 is built and there is no password reset.
- Real client IP address behind the proxy: `docs/design/design-notes.md`.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-12 | All traffic shall go over HTTPS, also in development tests on the phone. The Geolocation API requires it. | N/A | High | Clear | Proposal:332 |

## 6. Quality Attributes

### 6.1 Usability

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-13 | The User, Staff and Administrator interfaces shall meet the applicable WCAG 2.2 level AA criteria. | N/A | High | Clear | Proposal:490-494 |
| REQ-NF-14 | Gym ID states and other key states shall be shown with text or an icon, not only with color. | N/A | High | Clear | Proposal:494 |

### 6.2 Performance

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-15 | The system shall serve about 150 people per day. This is an assumption: the real numbers are unknown, and measuring them is one purpose of the app. | N/A | High | Clear. Number for the Check In concurrency test: design (G-05) | Proposal:104 |
| REQ-NF-16 | The Check In button shall be usable in under 3 seconds on mobile data on a mid-range phone. | N/A | High | Clear. Test phone and network: design | Proposal:433; Team decision |

### 6.3 Security

Attempt limits: REQ-F-07 (sign in), REQ-F-71 (Authorization Number lookups), REQ-NF-48 (PIN).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-19 | From the Staff dashboard, Staff shall be able to see a User's photo, authorization, waiver acceptance and emergency contact, and no other sensitive data. | N/A | High | Clear | Proposal:466; Team decision |
| REQ-NF-20 | Photos shall be stored in private storage, reachable only through the backend according to role. | N/A | High | Clear | Proposal:466, 511 |
| REQ-NF-21 | The system shall store only these personal data: account email, password, chosen language, the fields of REQ-F-29 and REQ-F-51, the term photo, the waiver and emergency contact (REQ-F-60), and the audit log fields (REQ-NF-39). | N/A | High | Clear | Proposal:466 |
| REQ-NF-23 | Developers shall be outside the gym roles and shall not have routine access to safety or emergency data in production. | N/A | High | Pending: who manages the VM and looks after the system (CTI and gym, M-16, G-01) | Proposal:437, 509 |
| REQ-NF-24 | Uploaded photos shall be JPEG, PNG or HEIC, up to 10 MB. The server converts them to JPEG and strips location metadata. | N/A | High | Clear | Review gap; Team decision |
| REQ-NF-25 | The system shall show a privacy notice in Spanish and English before collecting personal data. The team drafts it. | N/A | High | Pending: gym approves the text (G-24) | Team decision |
| REQ-NF-48 | The PIN shall be stored hashed, PIN attempts shall be limited, and only PIN holders can change it. An entered PIN is active only in the browser where it was typed. It closes after 15 minutes without a tap or key press by a person (automatic polling does not count), with a warning after 10 minutes that it closes in 5 minutes. The warning has a "Keep going" button that resets the full 15 minutes; the button takes keyboard focus and is read by screen readers (WCAG 2.2.1). | N/A | High | Clear. Attempt limit and wait: design | Proposal:177, 218; Team decision (E-51) |

### 6.4 Other Quality Attributes

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-26 | Sign in, authorization, facility sessions, the one-device rule and Gym ID verification shall require a connection. Without one, no session is created, and the app does not show a stored Gym ID or occupancy as if it were current. | N/A | High | Clear | Proposal:460; Review gap |
| REQ-NF-28 | The location boundary, the accepted accuracy and the gym coordinates shall be set with tests inside and around the gym on iPhone and Android. | N/A | High | Pending: the team measures the values | Proposal:435, 458 |
| REQ-NF-29 | The location boundary shall be configurable per environment. In production it shall never be more than 50 meters from the gym coordinates (REQ-NF-28). The December demo runs in a separate environment with the classroom boundary. | N/A | High | Clear. The 50 meters can change after the gym is measured; the classroom must be farther than 50 meters from the gym | Review gap; Team decision |
| REQ-NF-30 | The main flows shall pass on iPhone with Safari, Android with Chrome, and Windows with Chrome and Edge; macOS and Firefox as a secondary check. | N/A | High | Clear | Proposal:464 |
| REQ-NF-31 | Availability: an uptime target and a manual procedure for when the system fails. | N/A | Medium | Pending: gym, G-07, G-01 | Review gap |

## 7. Internationalization and Localization Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-33 | The interface shall be in Spanish by default, with a button that switches all texts to English. | N/A | High | Clear | Team decision |
| REQ-NF-34 | All frontend and backend texts, including emails and API error messages, shall be in translation files from the start. | N/A | High | Clear | Team decision |
| REQ-NF-35 | Emails shall be sent in the language chosen by the User. | N/A | High | Clear | Team decision |
| REQ-NF-36 | The page language attribute shall change together with the texts (WCAG 3.1.1). | N/A | High | Clear | Review gap |
| REQ-NF-37 | Expiration, term boundaries and analytics (day, week, month) shall use the `America/Puerto_Rico` time zone. | N/A | High | Clear | Review gap |
| REQ-NF-38 | Dates and times shall be shown as an ISO date plus 12-hour time with AM/PM, the same in both languages. Example: `2026-10-13 3:05 PM`. | N/A | High | Clear | Team decision |

## 8. Other Requirements

### 8.1 Audit

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-39 | The system shall record in the audit log each: Staff correction, Staff-assisted Check In (as an exception), in-person athlete registration, roster change, term or schedule change, import and import undo, release of a claimed Authorization Number, manual grant or revoke of an authorization (with its reason), PIN change, gym account password change, and each alert from the global lookup limit (REQ-F-71). Each entry has the account, time, IP address, device and browser, and the values before and after. Only Administrators can see the log. The shared account means the log cannot name the person; the gym checks the shift schedule. Retention: REQ-NF-05. | N/A | High | Clear | Proposal:212, 513; Team decision |

### 8.2 Testing

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-40 | There shall be automated unit or database tests for authorization and sessions. | N/A | High | Clear | Proposal:515 |
| REQ-NF-41 | There shall be integration tests from sign in to session creation. | N/A | High | Clear | Proposal:515 |
| REQ-NF-42 | Tests shall show that simultaneous Check In requests and repeated Authorization Number or roster claims produce at most one session or one claim. | N/A | High | Clear | Proposal:462, 573 |
| REQ-NF-43 | Location and PWA behavior shall be tested on real phones. | N/A | High | Clear | Proposal:515 |
| REQ-NF-44 | Each test plan case shall be linked to an objective and shall use controlled datasets. | N/A | High | Clear | Proposal:515, 573-575 |

### 8.3 Legal, Intellectual Property and Privacy

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-46 | Ownership and license of the team's work shall follow UPRM and Capstone policies before a long-term institutional deployment. User and institutional data are not intellectual property of the project. | N/A | Medium | Pending: professor and UPRM, P-05 | Proposal:334-338 |
| REQ-NF-47 | Handling of student data shall comply with the laws and policies UPRM determines apply. FERPA probably applies to UPRM (indication, not confirmed). | N/A | High | Pending: UPRM through CTI, M-15 | Team decision |

## Appendix A: Glossary

| Term | Definition |
|---|---|
| Academic term (term) | Period of the UPRM academic calendar with configured start and end dates. The proposal says "semester". A summer term exists only if configured |
| Accuracy | How precise the phone's reported location is, in meters. Check In needs enough accuracy (REQ-NF-28) |
| Administrator | Way of using the gym account with the PIN |
| API | Application Programming Interface: how the frontend talks to the backend, under `/api` |
| Athletes-only period | Schedule slot when only athletes can do Check In |
| Athletic Activities | UPRM Department of Athletic Activities, owner of the need |
| Audit log | Record of gym actions with time, IP address, device and what changed |
| Authorization | Permission to use the gym in one term: from a paid order, the roster, or granted by hand |
| Authorization Number | 6-digit number issued with the membership purchase in WooCommerce and sent by email to the payer. Used to register and renew |
| Boundary | Area around the gym inside which Check In is allowed |
| Check In | Action with which the User opens a facility session |
| Claim | Linking an Authorization Number or roster record to one account. Each can be claimed once |
| CSV | Comma-Separated Values: text file with values separated by commas |
| CTI | UPRM technology area. Meaning of the acronym not verified |
| DKIM | DomainKeys Identified Mail: signature that proves an email came from an authorized domain |
| DNS | Domain Name System: translates domain names to addresses |
| Estimated occupancy | Number of active facility sessions. Not a headcount |
| Export Orders | WooCommerce feature that exports orders to a file |
| Facility session (session) | 60-minute period created by a valid Check In (Proposal:358) |
| FERPA | Family Educational Rights and Privacy Act: U.S. federal law that protects students' education records |
| Gym account | The one shared account the gym uses. Without the PIN it acts as Staff; with the PIN, as Administrator |
| Gym ID | Screen in the PWA with name, photo, authorization, Check In status, minutes left and a moving clock. No code or QR |
| HTTPS | Encrypted HTTP |
| Manual authorization | Authorization an Administrator grants by hand, until the end of a chosen term, for order errors (REQ-F-87) |
| MVP | Minimum Viable Product: scope validated first (Proposal:295) |
| Paid member | User with a term membership paid in WooCommerce |
| PIN | Secret number, known only to the gym administration, that unlocks the Administrator actions of the gym account |
| PWA | Progressive Web App: web app that can be installed on the phone |
| Reconciliation | Importing a corrected Export Orders file so local records match WooCommerce again |
| Release | Administrator action that frees a claimed Authorization Number so it can be claimed again |
| Renew | Getting an authorization for a new term on the same account |
| Roster | List of authorized athletes for a term |
| SAML | Security Assertion Markup Language: signing in through an external provider |
| Secondary | Scope planned after the MVP in the proposal (Proposal:295). Committed for December (1.3) |
| Sign-in session | A device signed in to an account. Not the same as a facility session |
| SMTP | Simple Mail Transfer Protocol: protocol for sending email |
| SPF | Sender Policy Framework: DNS record that says which servers can send email for a domain |
| Staff | Gym staff, including front desk students, using the gym account without the PIN |
| Staff-assisted Check In | Check In that Staff do for a User who is present without a phone |
| Stretch | Scope done only if the committed scope is complete and tested (Proposal:295) |
| TBD | To Be Determined: missing information |
| UPRM | University of Puerto Rico at Mayagüez |
| User | Person with an account: paid member or athlete |
| VM | Virtual Machine |
| Void | Staff correction for a session created by mistake. The record stays, and the session stops counting in occupancy and analytics |
| Waiver | Liability waiver the User accepts once, when the account is created |
| WCAG | Web Content Accessibility Guidelines |
| WooCommerce | Commerce system on WordPress that UPRM uses to charge for memberships |

## Appendix B: Merged and Removed Requirements

IDs that are no longer rows. Old references resolve here.

| ID | What happened | Where the rule lives now |
|---|---|---|
| REQ-F-04 | Merged: protected actions only from the current device | REQ-F-03 |
| REQ-F-05 | Merged: recovery after a lost or changed phone | REQ-F-03, REQ-F-06 |
| REQ-F-08 | Removed: no inactivity timeout for sign-in sessions | REQ-F-03 |
| REQ-F-12 | Removed: no email verification for paid members | 3.2, REQ-F-11 |
| REQ-F-14 | Merged: athlete registers with student number and confirms the email | REQ-F-15 |
| REQ-F-16 | Removed: same response for any student number; replaced by a clear message | REQ-F-76 |
| REQ-F-24 | Merged: paid member renews with a new Authorization Number | REQ-F-78 |
| REQ-F-27 | Removed: refunds and cancellations do not exist | 2.5 |
| REQ-F-34 | Merged: location asked only for a new session | REQ-F-37 |
| REQ-F-35 | Merged: reasons a Check In creates no session | REQ-F-33 |
| REQ-F-39 | Merged: new Check In allowed after expiry | REQ-F-38 |
| REQ-F-47 | Merged: Staff-assisted Check In logged as an exception | REQ-NF-39 |
| REQ-F-50 | Removed: no designated roster Staff and no review step | REQ-F-49, REQ-NF-39 |
| REQ-F-53 | Merged: only PIN holders change the PIN | REQ-NF-48 |
| REQ-F-54 | Removed: Administrator manages athlete authorizations | REQ-F-49, REQ-F-87 |
| REQ-F-56 | Merged: maintenance notices | REQ-F-55 (c) |
| REQ-F-57 | Merged: facility information | REQ-F-55 (d) |
| REQ-F-62 | Merged: high- and low-use periods | REQ-F-61 (b) |
| REQ-F-63 | Merged: occupancy over time | REQ-F-61 (c) |
| REQ-F-64 | Merged: average and maximum occupancy | REQ-F-61 (d) |
| REQ-F-65 | Merged: paid members versus athletes | REQ-F-61 (e) |
| REQ-F-79 | Merged: Authorization Number field when there is no active authorization | REQ-F-23 |
| REQ-F-81 | Merged: athletes have no time limit; occupancy undercounts them | REQ-F-38, REQ-F-40, REQ-F-41 |
| REQ-F-84 | Merged: mark a slot as athletes only | REQ-F-55 (b) |
| REQ-F-85 | Merged: Staff see waiver and emergency contact | REQ-NF-19 |
| REQ-F-86 | Merged: distinct people | REQ-F-61 (f) |
| REQ-NF-02 | Merged: uniqueness and one active session enforced in the database | REQ-F-17, REQ-F-36 |
| REQ-NF-08 | Merged: development uses fake data | REQ-NF-07; `context.md` section 3 |
| REQ-NF-17 | Merged: each role has only the access it needs | REQ-F-52 |
| REQ-NF-18 | Moved: server credentials outside the repository (team rule) | `context.md` section 3 |
| REQ-NF-22 | Merged: developer role outside the gym roles | REQ-NF-23 |
| REQ-NF-27 | Merged: no stale data shown as current; the service worker detail moved | REQ-NF-26; `docs/design/design-notes.md` |
| REQ-NF-32 | Moved: reproducible migrations, separate development and production configuration (team rule) | `context.md` section 3 |
| REQ-NF-45 | Moved: changes enter `main` through reviewed pull requests (team rule) | `context.md` section 3 |

## Summary of Open Items

| Open item | Who answers | Question | Blocks |
|---|---|---|---|
| Outgoing mail (critical) | CTI | M-07 | REQ-F-06, F-15, F-75, F-77, NF-35 |
| PostgreSQL accepted | CTI | M-09 | REQ-F-17, F-36 |
| VM: public IP, containers, subdomain, HTTPS, approval, early access | CTI | M-01 to M-05 | 2.3, 2.4, REQ-NF-12 |
| WooCommerce API | CTI | M-12 | REQ-F-32 |
| External services approval | CTI | M-11 | REQ-NF-09 |
| Storage and disk encryption | CTI | M-13 | REQ-NF-20 |
| Backups | CTI, team | M-06 | REQ-NF-06 |
| FERPA | UPRM through CTI | M-15 | REQ-NF-47 |
| Real data limits | CTI, team | M-17 | REQ-NF-07 |
| Server administrator access | CTI | M-16 | REQ-NF-23 |
| Authorization Number uniqueness | Team, gym | E-30, E-55, G-19 | REQ-F-10 |
| Export Orders example: columns, how the term is read | Team (Carlos) | E-55 | REQ-F-28, F-29 |
| Contact number | Gym | G-25 | REQ-F-72, F-73, F-76 |
| Store sells only during terms; summer | Gym | G-26 | REQ-F-21, F-22 |
| Athletes-only periods | Gym | G-28 | REQ-F-55, F-82 |
| Who holds the PIN | Gym | G-29 | None (operations) |
| Role and PIN table | Gym | G-09 | REQ-F-52 |
| Roster lists | Gym | G-10 | REQ-F-49, F-51 |
| Roster change report | Gym | G-30 | 4.2 |
| Safety records | Gym | G-21 | REQ-F-60 |
| English for later notices | Gym | G-27 | REQ-F-58 |
| Privacy notice approval | Gym | G-24 | REQ-NF-25 |
| Retention periods | Gym, UPRM | G-03 | REQ-NF-04, NF-05 |
| Front desk devices | Gym | G-06 | 2.3 |
| Busiest hour | Gym | G-05 | REQ-NF-15 |
| Availability | Gym | G-07 | REQ-NF-31 |
| Who looks after the system | Gym | G-01 | REQ-NF-23, NF-31 |
| Location boundary values | Team | None (measure at the gym) | REQ-NF-28 |
| Cookies on iPhone | Team | E-17 | REQ-F-03, F-66 |
| Rubric, deliverables, stack approval | Professor | P-01 to P-03 | 1.3, 2.4 |
| License | Professor, UPRM | P-05 | REQ-NF-46 |
| Stretch inputs | Gym, team | None | REQ-F-67 to F-69 |
| Design details: sign-in waits, lookup limits, PIN attempt limit, link validity, concurrency test number, error texts, import result layout, unconfigured term message | Team | Design phase | REQ-F-07, F-15, F-21, F-28, F-33, F-71, NF-15, NF-48 |
