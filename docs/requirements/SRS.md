# Software Requirements Specification

**Project:** UPRM Weight Gym Operations and Member-Access Platform

**Version:** 0.4 draft, not approved

**Authors:** Carlos J. Pepin Delgado, Pierre G Vales Torres, Viviana V Ramos Vivoni

**Organization:** Department of Computer Science and Engineering, University of Puerto Rico at Mayagüez (UPRM)

**Date:** 2026-10-14

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
| Carlos J. Pepin Delgado | 2026-10-13 | Applied the team answers from the Q&A of 2026-10-13: scope and final priority, registration flows, one gym account with a PIN, no refunds, athletes-only periods, waiver, audit log, quality targets | 0.2 |
| Carlos J. Pepin Delgado | 2026-10-14 | Follow-up answers: audit log retention and photo comparison confirmed, in-person athlete registration by Staff, PIN session timeout, athletes-only notice within the session, analytics open to all roles | 0.3 |
| Carlos J. Pepin Delgado | 2026-10-14 | Design-readiness review decisions: PIN scope and activity, Gym ID lookup, order to term, manual authorization, Check In only while open, waiver once, athlete photo per term, Gym ID after 60 minutes, gym account setup, registration flows, demo environment, atomic registration, roster removal, import undo, deleted users in the audit log, terminology | 0.4 |

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the December release of the UPRM Weight Gym Operations and Member-Access Platform. It is for the development team: it says what to build and how to test it.

The baseline is the proposal (`docs/capstone_proposal/main.tex`), in force until further notice. `docs/context.md` lists what changes it and why. If this document and the proposal differ, this document wins, and the difference must appear in `context.md`.

### 1.2 Document Conventions

- IDs: `REQ-F-NN` for functional requirements and `REQ-NF-NN` for nonfunctional requirements. An ID is never reused or renumbered. A new requirement takes the next free number. A removed requirement keeps its ID, with Status "Removed" and the reason.
- Each requirement has these fields:
  - **Proposal priority:** MVP, Secondary or Stretch according to the scope table (`main.tex:293-310`); "N/A" if it is not in that table.
  - **Final priority:** High, Medium or Low (Team, Q&A 2026-10-13). Rule: MVP is High, Secondary is Medium, Stretch is Low. High and Medium are both committed for December (see 1.3); High is built first. Low is done only if the committed scope is complete and tested. For a row with proposal priority N/A: High if an MVP flow needs it, otherwise Medium. Removed rows say N/A.
  - **Status:** **Clear** (can be built and tested with what is known), **Pending** (information is missing; the field says what is missing and who answers) or **Removed** (kept only so the ID is not reused).
  - **Source:** `main.tex:N` (proposal line); **Team** (team decision, in `context.md`); **Later change** (requested after the proposal, in `context.md`); **Review** (came from the requirements review after the proposal). "Q&A 2026-10-13" marks what the team answered on that date.
- **Proposed:** a rule the team suggests that still needs confirmation. **Interpretation:** the team's reading of a note, to be confirmed.
- Terms used: "term" means academic term (the proposal says "semester"). "Sign-in session" is the login session on a device. "Facility session" or "session" is the 60-minute gym session.
- TBD: missing information. The "Summary of Open Items" section collects every TBD.

### 1.3 Project Scope

The system is a PWA for the Weight Gym in the UPRM Natatorio Complex. It replaces the paper log and the manual payment check (`main.tex:102`). It joins in one flow: accounts, authorization by paid membership or by athlete roster, Check In with location, 60-minute sessions, Gym ID, estimated occupancy, schedules and notices, facility information and utilization analytics (`main.tex:120, 198`).

Out of scope (`main.tex:116, 328`): payment processing (stays in WooCommerce), other facilities such as the pool, medical records, and capacity-based admission while UPRM has no official policy.

Delivery: demo in December before professors, with the project "complete" (Later change).

Stretch features, built only if the committed scope is complete and tested (`main.tex:295, 307`). They have no design yet.

| ID | Requirement | Final priority | Status |
|---|---|---|---|
| REQ-F-67 | The system shall be able to limit admission by capacity, only when UPRM has an official capacity policy. | Low | Pending: UPRM policy (gym) |
| REQ-F-68 | The system shall be able to extend to other facilities, such as the Natatorio. | Low | Pending: rules of those facilities (gym) |
| REQ-F-69 | The system shall be able to predict occupancy when there is enough history. | Low | Pending: how much history is enough (team) |

"Complete" means all 5 objectives of the proposal (`main.tex:123-192`) are met, without Stretch (Team, Q&A 2026-10-13). So the roster tool, the gym permissions, schedules and closures, and analytics are committed. The roster tool moves up to the MVP, because athletes cannot register without it. The Install button and the iPhone help text (REQ-F-66) are also in the MVP.

### 1.4 References

| Document | Location | Note |
|---|---|---|
| Capstone proposal, "UPRM Weight Gym Operations and Member-Access Platform", Pepin, Vales, Ramos, September 29, 2026 | `docs/capstone_proposal/main.tex` | Current baseline. `v0/` is frozen |
| Current context and decisions | `docs/context.md` | What changes the proposal and why |
| Open questions | `docs/decisions/` (`cti.md`, `gym.md`, `team.md`) | Questions for CTI, the gym, the team and the professor |
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
| Department athlete lists | Administrators (PIN holders) digitize them each term into the roster (Later change; Q&A 2026-10-13) |
| User's browser | Provides location through the Geolocation API (`main.tex:499-503`) |
| Outgoing mail server | Sends athlete registration links and password reset links. TBD whether CTI offers it in production (see 5.3) |
| CTI VM | Hosts the system in production (Team) |

### 2.2 User Classes and Characteristics

| Class | Who | What they do |
|---|---|---|
| User, paid member | Person with a term membership paid in WooCommerce. Some have no institutional email (Team) | Creates an account, does Check In, shows the Gym ID, sees occupancy and facility information |
| User, athlete | Student on the athlete roster for the term. Does not buy a membership (`main.tex:206`). Has no time limit in the gym (Q&A 2026-10-13) | Same as the paid member, and can do Check In during athletes-only periods. Paid members and athletes see the facility analytics |
| Staff | Gym staff, including students at the front desk (`main.tex:118`). They use the shared gym account without the PIN | See active sessions, verify Gym IDs, do Staff-assisted Check In and session corrections, see the waiver and emergency contact, register an athlete in person (only without outgoing mail), see the facility analytics |
| Administrator | Athletic Activities administration. They use the same shared gym account and know the PIN | Everything Staff do, plus the actions that need the PIN (3.10), including changing the gym account password and the PIN |
| Developer | Project team | Outside the gym roles; no routine access to production data (`main.tex:437, 509`) |

There is one shared gym account, not one account per person (Q&A 2026-10-13). "Staff" and "Administrator" are two ways of using it: without the PIN and with the PIN. The team creates the gym account, its password and the first PIN once, with an install command on the server, and gives them to the Administrator. After that the Administrator changes the password and the PIN from the app, using the current PIN. Changing the password is also how access is withdrawn when an employee leaves (Q&A 2026-10-14).

Estimated use: about 150 people per day (`main.tex:104`). Main use is from the phone (`main.tex:198`).

### 2.3 Operating Environment

- Client: PWA in the browser. Matrix: iPhone with Safari, Android with Chrome, Windows with Chrome and Edge; macOS and Firefox as secondary (`main.tex:464`).
- Production server: CTI VM, Ubuntu 26 or Rocky 10, after CTI evaluation (Team, stated by CTI).
- Domain: UPRM subdomain (`main.tex:332`).
- Development: `docker-compose` on each member's PC; phone tests through an HTTPS tunnel (Team).
- **TBD (CTI):** whether the VM has a public IP or is only reachable from the campus network; whether it allows containers (Docker or Podman); who sets up the subdomain and the certificate.
- **TBD (gym):** front desk devices. The team understands the gym has a desktop computer at the front desk. The gym must confirm whether it is shared and whether staff also use phones.

### 2.4 Design and Implementation Constraints

- Frontend: PWA with React, TypeScript and Vite, one codebase for phone and desktop (`main.tex:348`).
- Backend: Laravel (PHP 8.3 or higher). Decided, not reopened.
- Database: PostgreSQL in a container. The single active session rule uses an exclusion constraint, which MySQL does not have. **TBD (CTI):** whether CTI accepts PostgreSQL or requires MySQL.
- Containers: `docker-compose` with proxy, PHP, PostgreSQL and scheduled tasks. All use the same images with a pinned version, never `latest`.
- Single origin: PWA at `/` and API at `/api` under the same name (Proposed). **TBD (CTI):** whether it can be a single name.
- Production on a CTI VM. CTI does not manage the server or the application.
- No SAML: the system has its own accounts.
- CTI services only. No Supabase and no Vercel (Team, Q&A 2026-10-13).
- One shared gym account with a single PIN for sensitive actions. No per-person gym accounts (Q&A 2026-10-13).
- No street address is collected or stored anywhere (Q&A 2026-10-13).
- Minimum cost for the gym; rely on CTI where possible.
- No offline Check In (`main.tex:460`).
- No external services with student data without approval (Team).

### 2.5 Assumptions and Dependencies

| Depends on | What is assumed | If it fails | TBD and who answers |
|---|---|---|---|
| CTI | Provides a VM with containers, subdomain and HTTPS | No production in December | Date, approval requirements, public IP: CTI |
| CTI | There is outgoing mail (SMTP or relay) from the VM. Only the email-link athlete flow (REQ-F-15) is built | No athlete registration links and no password reset (REQ-F-06, REQ-F-15). Then, and only then, the in-person flow (REQ-F-77) is built: Staff register athletes already in the roster | Whether it exists, sender address, SPF and DKIM: CTI. An external mail provider was not chosen |
| CTI | CTI accepts PostgreSQL | REQ-F-17, REQ-F-36 and REQ-NF-02 need another design | CTI |
| Gym | Validates access, renewal, PIN, exception, privacy, retention and account recovery rules (`main.tex:332`) | Pending requirements cannot be closed | See Summary of Open Items |
| Gym | Provides the athlete lists, schedules, the athletes-only periods, rules, equipment information and a contact number for people who cannot register (`main.tex:332`; Q&A 2026-10-13) | No data for the roster, schedules or the information section | Gym |
| WooCommerce | The team keeps authorized access to Orders and Export Orders (`main.tex:369`) | No import | API access: CTI |
| WooCommerce | The store only sells memberships while a term is running. The store controls this, not this system. There is no summer membership unless a summer term is configured (Q&A 2026-10-14) | Orders dated outside every term are rejected by the import (REQ-F-22) | Gym to confirm |
| WooCommerce | Memberships are not refunded or cancelled. They only expire at the end of the term (Q&A 2026-10-13) | Removed REQ-F-27 would have to come back | None |
| Professor or advisor | Accepts the stack change from the proposal | It would have to be justified or reverted | Whether approval is needed, rubric and deliverables: professor |
| Gym and CTI | Someone looks after the system after December (gym account, PIN, support) | Nobody operates the system; if the team operates it, it conflicts with REQ-NF-23 | Gym. Not in the proposal |

**Scope table versus objectives (resolved).** The scope table lists roster management, Staff and Administrator permissions, schedules and closures, and analytics as Secondary (`main.tex:305`), while Objectives 4 and 5 give them acceptance tests (`main.tex:177, 184-190`). The team decided that "complete" means all 5 objectives (1.3), so those items are committed (Q&A 2026-10-13).

## 3. System Features

### 3.1 Accounts and Sign In

#### 3.1.1 Description

Each person has one account that lasts across terms. The account is separate from the authorization (`main.tex:202, 355-357`). Acceptance criterion (Objective 1, `main.tex:140-144`): every case in the controlled dataset returns the expected decision.

#### 3.1.2 Stimulus/Response Sequences

1. The User enters email and password. The system signs the User in and ends any other sign-in session of that account on another device.
2. The previous device tries a protected action. The system rejects it and asks the User to sign in.
3. The User loses or changes the phone. The User signs in on the new phone with the password, and the old sign-in session ends. If the User forgot the password, the User resets it by email (REQ-F-06).
4. The User has no active authorization and asks to delete the account. The system deletes the personal data and photos and keeps anonymous Check In counts.

#### 3.1.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-01 | The system shall keep one account per person, which persists across terms. | MVP | High | Clear | main.tex:202, 355 |
| REQ-F-02 | The User shall be able to create their own account and sign in with email and password. The system shall not use external authentication (SAML). | MVP | High | Clear. Note: `main.tex:120` says "institutional login"; v1 of the proposal must correct it (team) | main.tex:202; Team |
| REQ-F-03 | The system shall allow only one sign-in session per User account (paid member or athlete). Signing in on another device shall end the previous one. The rule does not apply to the gym account. The sign-in session lasts until the User signs out or signs in on another device. | MVP | High | Clear. Still to test: cookies inside the installed PWA on iPhone (team) | main.tex:202, 363; Q&A 2026-10-13 |
| REQ-F-04 | The system shall accept protected actions only from the device of the current sign-in session. | MVP | High | Clear | main.tex:363 |
| REQ-F-05 | The system shall allow account recovery when the User loses or changes their phone, under the rule of REQ-F-03. | N/A | High | Clear. Covered by REQ-F-03 (sign in on the new phone) and REQ-F-06 (forgotten password). No staff process | main.tex:328, 332; Q&A 2026-10-13 |
| REQ-F-06 | The User shall be able to reset their password on their own with a link sent to the account email. | N/A | High | Pending: requires outgoing mail in production (CTI) | Review; Q&A 2026-10-13 |
| REQ-F-07 | The system shall limit failed sign-in attempts: after 10 failed attempts the account or IP address must wait, and the wait grows with each lockout. Attempts are counted per account and per IP address. | N/A | High | Clear. Exact waits set in design (team) | Review; Q&A 2026-10-13 |
| REQ-F-08 | The system shall end the sign-in session after a period of inactivity. | N/A | N/A | Removed: no inactivity timeout. The sign-in session lasts until sign out or sign in on another device (REQ-F-03) | Review; Q&A 2026-10-13 |
| REQ-F-09 | The User shall be able to request the deletion of their account from the app, only when the User has no active authorization. The system shall delete the personal data and photos and keep only anonymous Check In counts for analytics. Audit log entries that mention the deleted user stay intact until the end of their term and are then deleted by the normal retention rule (REQ-NF-05). Counts of distinct people already computed (REQ-F-86) do not change. | N/A | Medium | Clear. Retention of other data: REQ-NF-05 | Review; Q&A 2026-10-13, 2026-10-14 |

#### 3.1.4 Error Handling

- Wrong credentials: the system rejects the sign in and does not say whether the email exists.
- Too many failed attempts: the system rejects the sign in and says when to try again (REQ-F-07).
- Deletion request with an active authorization: rejected, with the reason.
- No connection: no sign in (REQ-NF-26).

### 3.2 Paid Member Registration

#### 3.2.1 Description

The paid member registers with the Authorization Number received from the WooCommerce purchase (`main.tex:204`). The account email is always the payment email in the WooCommerce record; the member does not type it. There is no email verification step: the Authorization Number arrives by email to the payer, and that serves as the check (Q&A 2026-10-13). Acceptance criterion: Objective 1 (`main.tex:140-144`), cases of valid, expired and missing membership.

The Authorization Number is the 6-digit value in the "Payment Description" of the receipt email. Registration uses only this number (Q&A 2026-10-13). Because a 6-digit number can be guessed, registration has the protections of REQ-F-71 to REQ-F-75.

#### 3.2.2 Stimulus/Response Sequences

1. The User enters the Authorization Number. The system looks it up in the imported records.
2. If it is valid and not claimed, the system shows the payment email masked (for example `c***@upr.edu`) right away and asks the User to create a password and upload a photo. After the photo is saved, the system creates the account with the payment email and claims the number in one operation. If the photo fails, nothing is claimed and the number stays free.
3. If the payment email already has an account, the system attaches the new authorization to that account and does not create a new one (renewal, REQ-F-78).
4. If the number is not valid or is already claimed, the system shows the same message for both cases, with the contact number (REQ-F-72, REQ-F-73).

#### 3.2.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-10 | The system shall validate the Authorization Number against the local membership records imported from WooCommerce. | MVP | High | Pending: whether the Authorization Number is unique across orders. It may be a card approval code that can repeat; not verified. Confirm with a real export (team, gym) | main.tex:204, 371; Q&A 2026-10-13 |
| REQ-F-11 | The paid member's account email shall be the payment email from the WooCommerce record. The member shall not type or change it during registration. | MVP | High | Clear | main.tex:204; Team; Q&A 2026-10-13 |
| REQ-F-12 | The system shall verify the paid member's email before creating the account. | N/A | N/A | Removed: no email verification. The Authorization Number arrives by email to the payer, which serves as the check | Team; Q&A 2026-10-13 |
| REQ-F-13 | On registration, the User (paid member or athlete) shall create a password and upload a current photo as a file. The system shall save the account and the claim of the Authorization Number or roster record together, in one operation, only after the photo was saved. If the photo fails, nothing is claimed and the number or record stays free. The Authorization Number is still checked as soon as it is typed, and the masked email is shown then. | MVP | High | Clear | main.tex:202, 204, 206; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-70 | During paid member registration, the system shall show the payment email of the matched record masked (for example `c***@upr.edu`). | N/A | High | Clear | Team; Q&A 2026-10-13 |
| REQ-F-71 | The system shall limit failed Authorization Number lookups per IP address and shall also apply a global limit on failed lookups. | N/A | High | Clear. Values set in design (team) | Team; Q&A 2026-10-13 |
| REQ-F-72 | The system shall show the same message when an Authorization Number is invalid and when it is already claimed. The message shall include the contact number of REQ-F-73. | N/A | High | Clear | Team; Q&A 2026-10-13 |
| REQ-F-73 | When an Authorization Number or a student number does not match a valid record, the system shall show the contact number of someone who can help. | N/A | High | Pending: the number (gym) | Team; Q&A 2026-10-13 |
| REQ-F-74 | An Administrator (with the PIN) shall be able to release an Authorization Number claimed by mistake, so it can be claimed again. The action is recorded in the audit log. | N/A | Medium | Clear | Team; Q&A 2026-10-13 |
| REQ-F-75 | If someone else claimed a member's Authorization Number, the real owner shall be able to take the account back with the password reset (REQ-F-06), because the account email is the payment email. Signing in ends the other device's sign-in session (REQ-F-03). | N/A | High | Pending: requires outgoing mail (CTI) | Team; Q&A 2026-10-13 |

#### 3.2.4 Error Handling

- Authorization Number that does not exist, is expired or is already claimed: registration denied with the same message and the contact number (REQ-F-17, REQ-F-18, REQ-F-72).
- Too many failed lookups from one IP address, or globally: lookups paused for a time (REQ-F-71).

### 3.3 Athlete Registration

#### 3.3.1 Description

The athlete registers with their student number, which the system looks up in the roster that Administrators digitized (`main.tex:206`; Later change). The student number is not secret: someone could claim another athlete's number first. So the account is created only after the athlete opens a link sent to the institutional email in the roster (Team; Q&A 2026-10-13). An athlete who is not in the roster gets a clear message (REQ-F-76). Acceptance criterion: Objective 1, cases of valid and invalid athlete and user with no match (`main.tex:142`).

#### 3.3.2 Stimulus/Response Sequences

1. The User enters their student number. The system looks it up in the roster for the current term.
2. If it is in the roster and not claimed, the system sends a link to the institutional email in the roster.
3. The User opens the link, creates the password and uploads the photo. After the photo is saved, the system creates the account and marks the roster record as claimed in one operation. If the photo fails, nothing is claimed.
4. If it is not in the roster, the system shows the message of REQ-F-76.
5. Only if CTI confirms there is no outgoing mail (and REQ-F-77 is built), the athlete goes to the gym. Staff (gym account, no PIN needed) check identification, find the athlete's record in the roster and create the account (REQ-F-77). If the athlete is not in the roster, Staff cannot add them; the athlete waits until a PIN holder adds them to the roster.

#### 3.3.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-14 | The athlete shall be able to register with their student number, which the system looks up in the roster for the current term, and shall confirm the associated institutional email. | MVP | High | Clear | main.tex:206 |
| REQ-F-15 | The system shall create the athlete's account only after the link sent to the institutional email in the roster is opened. | MVP | High | Pending: requires outgoing mail in production (CTI). This is the only athlete registration flow built unless CTI confirms there is no outgoing mail (then REQ-F-77) | Team; main.tex:206; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-16 | The system shall give the same visible response whether or not the student number is in the roster. | N/A | N/A | Removed: replaced by a clear message for athletes not in the roster (REQ-F-76) | Team; Q&A 2026-10-13 |
| REQ-F-17 | Each roster record and each Authorization Number shall be claimable by only one account, also under simultaneous requests. | MVP | High | Clear | main.tex:206, 371, 462, 511 |
| REQ-F-76 | If the student number is not in the roster for the current term, the system shall say that the person does not appear as a registered athlete and must go to the Department of Athletic Activities to be registered or to check for an error. The message shall include the contact number of REQ-F-73. | N/A | High | Clear (contact number pending, see REQ-F-73) | Team; Q&A 2026-10-13 |
| REQ-F-77 | If CTI offers no outgoing mail, Staff (gym account, no PIN needed) shall be able to register an athlete in person: check identification, find the athlete's record in the current-term roster and create the account. Staff shall not be able to register a person who is not in the roster or add records to the roster; only PIN holders add roster records (REQ-F-49). The action is recorded in the audit log. | N/A | High | Pending: built only if CTI confirms there is no outgoing mail (CTI). Not built otherwise | Team; Q&A 2026-10-13, 2026-10-14 |

#### 3.3.4 Error Handling

- Number not found in the roster: message of REQ-F-76.
- Expired or already used link: the account is not created. Link validity period: TBD (team, design).
- Record already claimed: registration denied, with the contact number.

### 3.4 Authorization, Academic Terms and Renewal

#### 3.4.1 Description

The authorization says whether the person has access in the current academic term. A User can have several authorizations over time (`main.tex:356, 361`). Acceptance criterion (Objective 1, `main.tex:144`): every User with a valid authorization is approved and every User without one is denied.

Term dates come from the UPRM academic calendar and the Administrator enters them (Q&A 2026-10-13). An order belongs to the term that contains its payment date. The team assumes the WooCommerce store only sells memberships while a term is running; the store controls this, not this system. There is no summer membership unless a summer term is configured; without one, accounts stay expired between terms (Q&A 2026-10-14; gym to confirm).

An athlete in the current-term roster has nothing to renew: authorization is automatic while the athlete is on the roster. A paid member renews with a new Authorization Number. For order errors, an Administrator can grant or revoke an authorization by hand (REQ-F-87). This gives access without a WooCommerce payment record, which the proposal does not have.

#### 3.4.2 Stimulus/Response Sequences

1. The end of the configured term arrives. The system marks the authorizations of that term as expired, disables Check In and shows the Authorization Number field to renew.
2. The paid member enters a new Authorization Number. The system finds the existing account with the same payment email and attaches the new authorization to it.
3. An Administrator adds the athlete to the roster for the new term. The system gives the athlete authorization for that term. The first time the athlete signs in during the new term, the app asks for the new photo before Check In is allowed.
4. An athlete becomes a paid member. The athlete pays in WooCommerce and enters the Authorization Number in the field the account shows when there is no active authorization. The authorization is attached to the same account.
5. A paid member becomes an athlete. The member signs in and chooses "I am an athlete" and enters the student number. If it is in the current-term roster and unclaimed, the system links it to the account. The account email stays as it is.
6. An order error leaves a member without access. An Administrator enters the PIN, grants an authorization to the existing account until the end of a chosen term and writes a reason. The system records it in the audit log (REQ-F-87).
7. An Administrator removes an athlete from the roster mid-term. The athlete's Gym ID stops being valid at once, the current session keeps counting until its 60 minutes end, and the athlete cannot do another Check In (REQ-F-49).

#### 3.4.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-18 | If a WooCommerce or roster record cannot be verified, the system shall deny the registration, renewal or Check In that depends on it. | MVP | High | Clear | main.tex:513 |
| REQ-F-19 | The system shall store the authorization separately from the account, and a User shall be able to have several authorizations over time. | MVP | High | Clear | main.tex:350, 356 |
| REQ-F-20 | The User shall be able to move between paid-member and athlete authorization without losing the account or the Check In history. The User signs in to the existing account and adds the new authorization from inside it (REQ-F-79, REQ-F-80). The account email does not change, no new account is created, and staff do not merge accounts. | MVP | High | Clear | main.tex:202, 356, 406; Q&A 2026-10-13 |
| REQ-F-21 | The Administrator shall be able to create and edit academic terms with a start date and an end date, taken from the UPRM academic calendar. | N/A | High | Clear | main.tex:350, 361; Q&A 2026-10-13 |
| REQ-F-22 | Each authorization shall expire at the end of its configured academic term, regardless of the purchase date. An order belongs to the term that contains its payment date. An order dated outside every term shall be rejected: it gives no authorization and appears in the import result for the Administrator. An athlete authorization also ends when the athlete is removed from the roster (REQ-F-49). | MVP | High | Clear. Gym to confirm that the store only sells memberships while a term runs | main.tex:361; Q&A 2026-10-14 |
| REQ-F-23 | When the authorization expires, the system shall keep the account, disable Check In and show the expired status with the Renew option. | MVP | High | Clear | main.tex:204 |
| REQ-F-24 | The paid member shall be able to renew with a new Authorization Number on the same account. | MVP | High | Clear | main.tex:320 |
| REQ-F-25 | The athlete shall renew through the roster for the new term, with no purchase or Authorization Number. The first time the athlete signs in during a new term, the app shall ask for the new photo before Check In is allowed. | MVP | High | Clear | main.tex:206, 218, 321; Q&A 2026-10-14 |
| REQ-F-26 | The User shall upload a current photo at each renewal and shall not be able to replace it during an active authorization. The photo is stored with the authorization. For athletes, the new photo is asked the first time they sign in during a new term, before Check In is allowed. | MVP | High | Clear | main.tex:202, 426; Q&A 2026-10-14 |
| REQ-F-27 | A refunded or cancelled WooCommerce order, once imported, shall remove the authorization that depended on it. | MVP | N/A | Removed: there are no refunds or cancellations. Memberships only expire at the end of the term | main.tex:371, 456; Q&A 2026-10-13 |
| REQ-F-78 | When a User enters an Authorization Number whose payment email matches an existing account, the system shall attach the new authorization to that account and shall not create a new one. | N/A | High | Clear | Team; Q&A 2026-10-13 |
| REQ-F-79 | When the account has no active authorization, the account screen shall show the Authorization Number field. | N/A | High | Clear | Team; Q&A 2026-10-13 |
| REQ-F-80 | A signed-in User shall be able to enter a student number ("I am an athlete"). If it is in the current-term roster and unclaimed, the system shall link the roster record to the account. | N/A | High | Clear | Team; Q&A 2026-10-13 |
| REQ-F-87 | An Administrator (with the PIN) shall be able to grant an authorization by hand to an existing account, valid only until the end of a chosen term, and to revoke an authorization. It is used for order errors. Proposed: a reason is required, and the action is recorded in the audit log with time, IP address and reason. | N/A | Medium | Clear (reason and log rules Proposed) | Team; Q&A 2026-10-14 |

#### 3.4.4 Error Handling

- No academic term configured for the current date: no new authorization is created. Message to the Administrator: TBD (team, design).
- Student number entered with "I am an athlete" that is not in the roster or is already claimed: not linked; message of REQ-F-76.

### 3.5 WooCommerce Import

#### 3.5.1 Description

WooCommerce remains the source of payments. The system copies only what is needed to authorize (`main.tex:369-371`). There are no refunds or cancellations; the import only handles new and corrected orders (Q&A 2026-10-13). An order belongs to the term that contains its payment date; an order dated outside every term is rejected and listed in the import result (REQ-F-22). Any import can be undone (REQ-F-31). Acceptance criterion, adapted from `main.tex:456`: re-importing does not create duplicates, and corrected orders update the authorization. The proposal criterion also names refunded and cancelled orders; that part no longer applies.

#### 3.5.2 Stimulus/Response Sequences

1. The Administrator uploads an Export Orders file. The system creates or updates one local record per order.
2. The Administrator uploads the same file again. The system confirms the same records without duplicating them.
3. An order was corrected in WooCommerce. The Administrator imports it again. The system updates the same record.
4. An order is dated outside every configured term. The system rejects it and lists it in the import result.
5. The Administrator undoes an import. The system deletes the membership records that import brought and the authorizations that depend on them, keeps the accounts and photos, and records the undo in the audit log.

#### 3.5.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-28 | The Administrator shall be able to load membership data from a WooCommerce Export Orders file. | MVP | High | Pending: file format and columns (team, with an authorized export; gym) | main.tex:369, 371 |
| REQ-F-29 | The import shall copy only name, email, student number when applicable, membership details, Authorization Number, order reference, status, payment date, academic term (set from the payment date) and last synchronization time. It shall not copy billing or address data. | MVP | High | Clear | main.tex:204, 371 |
| REQ-F-30 | Processing the same order more than once shall update or confirm the same record, without creating duplicates. | MVP | High | Clear | main.tex:371, 456 |
| REQ-F-31 | The Administrator shall be able to run a controlled re-import or reconciliation when WooCommerce corrects orders. The Administrator shall be able to undo any import at any time. Undo deletes the membership records that import brought and the authorizations that depend on them. Accounts and photos of people who already registered stay; they can claim again when the corrected file is imported (Proposed). The undo is recorded in the audit log. | MVP | High | Clear (undo effect on accounts Proposed) | main.tex:371; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-32 | The system shall be able to synchronize with WooCommerce through approved API or webhook access, updating the same local records. | Stretch | Low | Pending: whether there is API access and what restrictions CTI sets (CTI) | main.tex:307, 371 |

#### 3.5.4 Error Handling

- Row with data that cannot be verified: gives no authorization (REQ-F-18). How it is reported to the Administrator: TBD (team, design).
- Order dated outside every term: rejected, no authorization, listed in the import result (REQ-F-22).
- File with an unexpected format: nothing is imported. Message detail: TBD (team, design).

### 3.6 Check In and Facility Session

#### 3.6.1 Description

The User does Check In from their phone. The system checks authorization and location and creates a 60-minute facility session (`main.tex:210, 365`). Location is a Check In condition, not proof of presence, and the User is not tracked (`main.tex:210`). For athletes the 60 minutes are a counting rule, not a time limit in the gym (Q&A 2026-10-13). During an athletes-only period, paid members cannot do Check In (REQ-F-82). Acceptance criterion (Objective 2, `main.tex:151-155`): every valid Check In creates exactly one active session and one Gym ID; invalid ones create no session; duplicates follow the session rule; every session stops counting after 60 minutes.

#### 3.6.2 Stimulus/Response Sequences

1. The User taps Check In with no active session. The system asks for location, compares it with the boundary and creates the session.
2. The User taps Check In with an active session. The system returns the current session and Gym ID, without asking for location.
3. 60 minutes pass. The session stops being active with no User action.
4. A paid member taps Check In during an athletes-only period. The system rejects it and shows a notice. An athlete can do Check In.
5. A User does Check In, or has an active session, and an athletes-only period starts within that 60-minute session. The system shows a notice with the start time of the period. The session is not cut (REQ-F-83).

#### 3.6.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-33 | Before creating a session, the system shall verify that the User has a current authorization, that the device location is within the gym boundary, and that the gym is open according to its published schedule and closures. | MVP | High | Clear (boundary and accuracy in REQ-NF-28) | main.tex:210, 458; Q&A 2026-10-14 |
| REQ-F-34 | The system shall ask for location only when a new session must be created. | MVP | High | Clear | main.tex:416 |
| REQ-F-35 | The system shall not create a session if the location is outside the boundary, if location permission is denied, if accuracy is insufficient, if there is no current authorization, if there is no connection, or if the gym is closed by its published schedule or a published closure. A closed-gym rejection shows a notice. | MVP | High | Clear | main.tex:458, 460, 573; Q&A 2026-10-14 |
| REQ-F-36 | A valid Check In shall create exactly one 60-minute session. The active session check and the creation shall be one protected backend operation. | MVP | High | Clear | main.tex:155, 210, 365, 416 |
| REQ-F-37 | If the User already has an active session, another Check In shall return the current session and Gym ID without creating another session. | MVP | High | Clear | main.tex:365, 416 |
| REQ-F-38 | The session shall expire after 60 minutes according to backend time, with no checkout or User action, and shall stop counting toward occupancy. For a paid member, the Gym ID then shows "expired" (REQ-F-40). The expiry does not make anyone leave the gym. | MVP | High | Clear | main.tex:210, 350, 365; Q&A 2026-10-14 |
| REQ-F-39 | After the session expires, a valid Check In shall be able to create a new session. | MVP | High | Clear | main.tex:365 |
| REQ-F-81 | For athletes, the 60-minute session shall be a counting rule only; athletes have no time limit in the gym. Athletes shall be able to see their account and the facility analytics (3.13), like every other role. Occupancy counts an athlete only during the 60-minute session, so it undercounts athletes who stay longer: occupancy is an estimate. | N/A | Medium | Clear | Team; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-82 | During an athletes-only period (REQ-F-84), the system shall reject Check In by paid members and show them a notice. Athletes shall be able to do Check In. | N/A | Medium | Pending: list of athletes-only periods (gym) | Team; Q&A 2026-10-13 |
| REQ-F-83 | When a User does Check In, or while the User's session is active, and an athletes-only period starts at any time within that 60-minute session, the system shall show a notice with the start time of the period. The session shall never be cut. There is no separate lead-time setting: the window is the session length. | N/A | Medium | Clear | Team; Q&A 2026-10-13, 2026-10-14 |

#### 3.6.4 Error Handling

- Each rejection in REQ-F-35 and REQ-F-82 shows its cause (outside the boundary, permission denied, accuracy, authorization, connection, gym closed by schedule or closure, athletes-only period). Texts: TBD (team, design).
- Simultaneous requests from the same User: at most one session (REQ-NF-02).

### 3.7 Gym ID and Occupancy

#### 3.7.1 Description

The Gym ID is the credential the User shows while their session is active (`main.tex:210`). Estimated occupancy is the number of active sessions, not a physical headcount (`main.tex:214`). The proposal asked for optional real-time updates (`main.tex:350`). The screens poll the backend every 20 to 30 seconds first. Live updates (SSE or WebSockets) are a later improvement, only if CTI allows them and time remains (Team, Q&A 2026-10-13). SSE did not work through the development tunnel; it was not tested on the CTI VM.

Acceptance criterion (Objective 3, `main.tex:162-166`), rewritten for polling: reported occupancy equals the number of active sessions in every tested state, and User, Staff and Administrator screens show the same value when compared after each screen has updated. If live updates are built, the original criterion applies.

#### 3.7.2 Stimulus/Response Sequences

1. A Check In, an expiration or a Staff correction happens. The system recalculates occupancy.
2. An occupancy screen queries the backend. The system returns the current value.

#### 3.7.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-40 | The Gym ID shall show name, photo, authorization, Check In status, the minutes left in the session, and a moving element such as a clock, so staff can tell a live screen from a screenshot. For a paid member, after 60 minutes the Gym ID shall show "expired" with text and an icon. For an athlete, the Gym ID shall not expire while the term authorization is active; Staff verify the athlete against the roster. The Gym ID has no code or QR. | MVP | High | Clear | main.tex:153, 210; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-41 | Estimated occupancy shall equal the number of active sessions and shall be recalculated after each Check In, expiration or Staff correction. It counts an athlete only during the 60-minute session, so it undercounts athletes who stay longer: occupancy is an estimate, not a headcount. | MVP | High | Clear | main.tex:164-166, 214; Q&A 2026-10-14 |
| REQ-F-42 | User, Staff and Administrator shall see the same occupancy value, measured after each screen has updated. | MVP | High | Clear | main.tex:166, 214; Q&A 2026-10-13 |
| REQ-F-43 | The occupancy and active session screens shall update by polling the backend every 20 to 30 seconds. | N/A (replaces the optional real time of main.tex:350) | High | Clear. Live updates are a later improvement (CTI, team) | Team; Q&A 2026-10-13 |

#### 3.7.4 Error Handling

- No connection: the screen does not show a stored Gym ID or occupancy as if they were current (REQ-NF-27).

### 3.8 Staff Operations

#### 3.8.1 Description

Staff supervise use and handle exceptions (`main.tex:210-212, 218`). Staff use the shared gym account without the PIN (3.10). Acceptance criterion (Objective 4, `main.tex:177`): Staff can perform the defined supervision and correction tasks. The Objective 2 test plan includes Staff-assisted Check In (`main.tex:573`), although the scope table does not name it; here it is treated as de facto MVP.

#### 3.8.2 Stimulus/Response Sequences

1. Staff open the session view. The system shows the active sessions with Check In time, authorization and Gym ID.
2. A User shows a Gym ID at the desk. Staff search the person by name in the active sessions list and compare the photo (REQ-F-45). For an athlete whose 60 minutes ended, Staff check the roster.
3. An authorized User arrives without a phone. A paid member shows a photo of the payment confirmation, and Staff find the account by Authorization Number. An athlete gives the student number. Staff compare the stored photo with the person, check authorization in the backend and create the session. The system records it in the audit log.
4. Staff end a session early or void a session created by mistake. The system applies the correction, recalculates occupancy and records it in the audit log.
5. Staff open a User's record during Check In or an emergency. The system shows the waiver and the emergency contact (REQ-F-85).

#### 3.8.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-44 | Staff shall be able to see active sessions with Check In time, authorization and Gym ID. | MVP | High | Clear | main.tex:218, 322 |
| REQ-F-45 | Staff shall be able to verify a Gym ID against backend data, not only against the User's screen: Staff search the person by name in the active sessions list and compare the photo. The Gym ID has no code or QR. | MVP | High | Clear | main.tex:210; Q&A 2026-10-14 |
| REQ-F-46 | Staff shall be able to do a Staff-assisted Check In for an authorized User who is present without a phone and create the same 60-minute session. Identification: a paid member shows a photo of the payment confirmation and Staff find the account by Authorization Number; an athlete gives the student number. Staff shall compare the photo stored in the account with the person. Staff shall not be able to bypass authorization or create a second active session. | De facto MVP (test plan, main.tex:573; not in the scope table) | High | Clear | main.tex:212, 573; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-47 | The system shall record each Staff-assisted Check In as an exception in the audit log (REQ-NF-39). | De facto MVP (main.tex:573) | High | Clear. With one shared gym account the log cannot name the Staff member (REQ-NF-39) | main.tex:212, 573 |
| REQ-F-48 | Staff shall be able to make two session corrections: end a session early, and void a session created by mistake. A void keeps the record and its audit log entry, and the session stops counting in occupancy and analytics. Staff shall not be able to extend a session or create a session without authorization. | MVP | High | Clear | main.tex:210, 218; Q&A 2026-10-13 |

#### 3.8.4 Error Handling

- Staff-assisted Check In for a User with no current authorization or with an active session: rejected, no new session.
- Correction outside REQ-F-48: rejected.

### 3.9 Athlete Roster

#### 3.9.1 Description

Change from the proposal: the department's athlete lists are digitized each term by Administrators, that is, by whoever holds the PIN of the gym account (Later change; Q&A 2026-10-13). There is no separate roster permission and no review step: the audit log records every roster change with time and IP address (REQ-NF-39). Roster management moves up to the MVP (1.3).

#### 3.9.2 Stimulus/Response Sequences

1. An Administrator enters the PIN and creates, imports or edits roster records for the term. The system stores them and records each change in the audit log.
2. An Administrator removes an athlete from the roster mid-term. The Gym ID stops being valid at once, the athlete keeps counting in occupancy until the current 60-minute session ends, and the athlete cannot do another Check In.
3. Someone on the gym account without the PIN tries to open the roster tool. The system asks for the PIN and denies access without it.

#### 3.9.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-49 | Only Administrators (with the PIN) shall be able to create, import and change the athlete roster for each term. If an athlete is removed from the roster mid-term, the athlete's Gym ID shall stop being valid immediately, the athlete shall keep counting in occupancy until the current 60-minute session ends, and the athlete shall not be able to do another Check In. | Secondary (moved to MVP, Q&A 2026-10-13) | High | Pending: format of the lists (gym) | main.tex:206, 218; Later change; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-50 | A record entered by designated Staff shall be preapproved, with no Administrator approval. | Secondary | N/A | Removed: there is no designated roster Staff and no review step. The audit log (REQ-NF-39) records each roster change | Later change; Q&A 2026-10-13 |
| REQ-F-51 | Each roster record shall have at least student number, name, institutional email and academic term. | Secondary (moved to MVP with the roster tool) | High | Pending: final list of fields (gym) | main.tex:206; Team |

#### 3.9.4 Error Handling

- Repeated student number in the same term: rejected. Exact behavior: TBD (team, design).

### 3.10 Gym Account, PIN and Permissions

#### 3.10.1 Description

There is one shared gym account. A single PIN, known only to the administration, protects sensitive actions (Q&A 2026-10-13). "Staff" means using the gym account without the PIN; "Administrator" means using it with the PIN. An entered PIN is active only in the browser or device where it was typed, not for the whole gym account (Q&A 2026-10-14). The developer role stays outside the gym roles (REQ-NF-22).

| Action | Without PIN (Staff) | With PIN (Administrator) |
|---|---|---|
| See active sessions | Yes | Yes |
| Verify a Gym ID against the backend | Yes | Yes |
| Staff-assisted Check In | Yes | Yes |
| Session corrections (end early, void) | Yes | Yes |
| See waiver and emergency contact | Yes | Yes |
| Register in person an athlete who is already in the roster (only without outgoing mail) | Yes | Yes |
| See facility analytics (also open to Users) | Yes | Yes |
| Athlete roster | No | Yes |
| Academic terms | No | Yes |
| WooCommerce import | No | Yes |
| Change the PIN and the gym account password | No | Yes |
| Grant or revoke an authorization by hand (REQ-F-87) | No | Yes |
| Schedules, including athletes-only periods | No | Yes |
| Notices and facility information | No | Yes |
| Audit log | No | Yes |
| Release a claimed Authorization Number; handle account deletion for a User if needed | No | Yes |

Acceptance criterion (Objective 4, `main.tex:173-177`), rewritten: every tested action on the gym account is allowed or denied according to whether the PIN was entered, as in the table above. User accounts cannot perform any gym action. Staff can perform the session tasks, and Administrators can manage the roster, schedules, closures and the PIN. Analytics are open to every signed-in role.

#### 3.10.2 Stimulus/Response Sequences

1. Someone on the gym account requests a PIN action. The system asks for the PIN, checks it and allows the action, only in that browser or device.
2. A wrong PIN is entered too many times. The system blocks PIN entry for a time (REQ-NF-48).
3. The PIN was entered and nobody has tapped or pressed a key in that browser for 10 minutes (automatic polling does not count). The app warns that the PIN will close in 5 minutes. At 15 minutes of inactivity the PIN closes, and PIN actions need the PIN again (REQ-NF-48).
4. An Administrator changes the PIN or the gym account password, using the current PIN. The system stores the new value hashed and records the change in the audit log. Changing the password is how access is withdrawn when an employee leaves.
5. A User or the gym account without the PIN requests an action it is not allowed. The backend denies it.

#### 3.10.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-52 | The system shall have one shared gym account, and shall allow or deny each gym action according to whether the PIN was entered (3.10.1), enforced in the backend. | Secondary | High | Pending: gym to confirm the table (gym) | main.tex:175-177, 305; Q&A 2026-10-13 |
| REQ-F-53 | Only Administrators (with the PIN) shall be able to change the PIN. | Secondary | Medium | Pending: who holds the PIN (gym) | main.tex:177, 218; Q&A 2026-10-13 |
| REQ-F-54 | The Administrator shall be able to manage athlete authorizations. | Secondary | N/A | Removed: the roster is handled by PIN holders (REQ-F-49) | main.tex:177, 218; Q&A 2026-10-13 |

#### 3.10.4 Error Handling

- Action not allowed: the backend rejects it even if the interface shows it.
- Wrong PIN: rejected; repeated failures block PIN entry for a time (REQ-NF-48).

### 3.11 Facility Information, Schedules and Notices

#### 3.11.1 Description

Today rules and instructions are communicated in person or on paper (`main.tex:218`). The assessment with the gym asked for notices of schedule changes, closures, maintenance and other updates (`main.tex:104`). Schedules also include athletes-only periods (Q&A 2026-10-13). Acceptance criterion (Objective 4, `main.tex:177`): the Administrator can manage schedules and closures.

#### 3.11.2 Stimulus/Response Sequences

1. The Administrator publishes a schedule, a closure or a notice. The User sees it in the PWA.
2. The Administrator marks a schedule slot as athletes only. The system rejects paid member Check In during that slot (REQ-F-82) and shows the notice of REQ-F-83 to Users whose session overlaps its start.

#### 3.11.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-55 | The Administrator shall be able to manage schedules, special hours and closures, and the User shall be able to see them. Check In is rejected while the gym is closed by the published schedule or a published closure (REQ-F-35). | Secondary | Medium | Clear | main.tex:218; Q&A 2026-10-14 |
| REQ-F-56 | The Administrator shall be able to publish maintenance notices and other operational updates, and the User shall be able to see them. | N/A (need in main.tex:104) | Medium | Clear | main.tex:104 |
| REQ-F-57 | The Administrator shall be able to manage facility information: rules, towel, footwear (including the Crocs and flip-flop restriction), available machines and approved equipment instructions. The User shall be able to see it. | Secondary | Medium | Clear | main.tex:218 |
| REQ-F-58 | Texts the gym writes (rules, notices, closures, information) shall have a Spanish and an English version. If a text has no English version, the Spanish text is shown. | N/A | Medium | Pending: who provides English for notices published after December (gym). The team translates the initial texts and the gym approves them | Later change; Q&A 2026-10-13 |
| REQ-F-59 | The User shall be able to open equipment instructions with a QR code. | Stretch | Low | Clear | main.tex:218, 307 |
| REQ-F-84 | The Administrator (with the PIN) shall be able to mark a schedule slot as "athletes only". | N/A | Medium | Pending: list of athletes-only periods (gym) | Team; Q&A 2026-10-13 |

#### 3.11.4 Error Handling

- Text with no English version: the Spanish text is shown (REQ-F-58).

### 3.12 Membership and Safety Records

#### 3.12.1 Description

Digital records that replace paper, only if Athletic Activities determines them necessary (`main.tex:220`). The system is not a medical records system (`main.tex:328`). The system stores a liability waiver acceptance with an emergency contact. It does not store documents, medical warnings or a street address (Q&A 2026-10-13).

#### 3.12.2 Stimulus/Response Sequences

1. When the account is created, the User accepts the waiver and enters an emergency contact (name and phone). The system stores them with the full name and email from the payment record (paid member) or the roster (athlete). Without the waiver, the account is not created.
2. The User edits the emergency contact from the account (Proposed). Staff see the current value.
3. Staff open the User's record from the Staff dashboard. The system shows the waiver and the emergency contact.

#### 3.12.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-60 | The system shall store a liability waiver acceptance with full name, email and an emergency contact (name and phone). Name and email come from the payment record (paid member) or the roster (athlete). The system shall not collect a street address, documents or medical warnings. The waiver is accepted once, when the account is created, and stays valid while the account exists; it is not repeated each term or when the gym changes the text. Without it the account is not created. Proposed: the User can edit the emergency contact at any time from the account, and Staff always see the current value. | Secondary | Medium | Clear. Gym to confirm that no documents or medical warnings are needed (gym) | main.tex:220, 466; Q&A 2026-10-13, 2026-10-14 |
| REQ-F-85 | Staff shall be able to see a User's waiver acceptance and emergency contact from the Staff dashboard. | N/A | Medium | Clear | Team; Q&A 2026-10-13 |

#### 3.12.4 Error Handling

- Access by a User or a role without permission: denied (REQ-NF-19).

### 3.13 Utilization Analytics

#### 3.13.1 Description

Analytics are facility statistics: visits by hour, day, week and month, peak and low-use periods, occupancy over time, average and maximum occupancy, use by paid members versus athletes, and the number of distinct people. They contain only aggregated counts, no names. They are not protected by the PIN: every signed-in role (User, Staff, Administrator) can see them (Q&A 2026-10-14). This changes the proposal, where the Administrator reviews them (`main.tex:220`). Other metrics beyond REQ-F-61 to REQ-F-65 and REQ-F-86 are set in design. Priority in the proposal: Secondary (`main.tex:305`); committed for December because Objective 5 is part of "complete" (1.3). Voided sessions do not count (REQ-F-48). Acceptance criterion (`main.tex:188`): every final metric equals its expected value on controlled historical datasets.

#### 3.13.2 Stimulus/Response Sequences

1. A signed-in User, Staff or Administrator chooses a period. The system calculates and shows the metrics for that period.

#### 3.13.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-61 | Any signed-in user shall be able to see visits by hour, day, week and month. | Secondary | Medium | Clear | main.tex:186-188, 220 |
| REQ-F-62 | Any signed-in user shall be able to see the high- and low-use periods. | Secondary | Medium | Clear | main.tex:188, 220 |
| REQ-F-63 | Any signed-in user shall be able to see estimated occupancy over time. | Secondary | Medium | Clear | main.tex:188, 220 |
| REQ-F-64 | Any signed-in user shall be able to see average and maximum occupancy summaries. | Secondary | Medium | Clear | main.tex:188, 220 |
| REQ-F-65 | Any signed-in user shall be able to see use by paid members versus athletes. | Secondary | Medium | Clear | main.tex:188, 220 |
| REQ-F-86 | Any signed-in user shall be able to see the number of distinct people who came in a period, counting repeat visits once. It needs no new data. | N/A | Medium | Clear | Team; Q&A 2026-10-14 |

#### 3.13.4 Error Handling

- Period with no data: the system shows zero, not an error.

### 3.14 PWA Installation

#### 3.14.1 Description

Chrome does not always show the install prompt, and on iPhone the app is installed by hand from Share (Team, tested). The Install button and the iPhone help text are in the MVP (Q&A 2026-10-13).

#### 3.14.2 Stimulus/Response Sequences

1. The User taps "Install" in a Chromium-based browser. The browser shows its install dialog.
2. The User is on iPhone. The PWA shows how to install from Share.

#### 3.14.3 Functional Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-66 | The PWA shall have its own "Install" button in Chromium-based browsers and a help text for installing on iPhone. | N/A (moved to MVP, Q&A 2026-10-13) | High | Clear. Still to test: cookies inside the installed PWA on iPhone (team) | Team; Q&A 2026-10-13 |

#### 3.14.4 Error Handling

- Browser without support for the install event: the button does not appear.

## 4. Data Requirements

### 4.1 Logical Data Model

Based on `main.tex:350, 354-359, 426` and the Q&A of 2026-10-13. No diagram in this version.

| Entity | Contains | Related to |
|---|---|---|
| User | Persistent identity, email, password, chosen language | Authorizations, sign-in sessions, facility sessions, waiver acceptance |
| Gym account | One shared account, password hash, PIN hash | Audit log entries, sign-in sessions |
| Academic term | Name, start date, end date (a summer term is possible) | Authorizations, roster records, memberships |
| Authorization | Type (paid, athlete or manual), term, status, photo for the term, reason (manual only) | User, term, membership, roster record or none (manual) |
| Imported membership | Fields of REQ-F-29, claim status, import it came from | WooCommerce order, import, authorization |
| Roster record | Fields of REQ-F-51, claim status | Term, authorization |
| Sign-in session | Device with an open sign-in session; for the gym account, whether the PIN is active in that browser and the last person activity | User (one at a time, REQ-F-03) or gym account (no limit) |
| Facility session | Start, end (start plus 60 minutes), status (active, expired, ended early, void), whether it was assisted | User |
| Schedule slot | Type (regular hours, special hours, closure, athletes only), start, end, text in Spanish and English | None |
| Notice, facility information | Text in Spanish and English, dates | None |
| Waiver acceptance | Full name, email, emergency contact name and phone, acceptance time | User |
| Audit log entry | Gym account, time, IP address, device and browser, action, affected record, values before and after | Gym account |
| Setting | Contact number for people who cannot register | None |

### 4.2 Data Dictionary

| Element | Definition | Format or values |
|---|---|---|
| Session duration | Time a session counts as active | 60 minutes (`main.tex:365`). For athletes, a counting rule only |
| Authorization Number | Number issued with the membership purchase. It appears as "Authorization Number" in the Payment Description of the receipt email | 6 digits (from one sample receipt). Whether it is unique across orders: not verified |
| Receipt email fields | The receipt also has a Reference Number (15 hexadecimal characters), an account number, a transaction date and an amount | Not used for registration. The account number shall not be stored |
| Student number | Student identifier at UPRM | TBD (gym) |
| Time | Every stored and calculated time | Time zone `America/Puerto_Rico` for day, week, month and term boundaries (REQ-NF-37) |
| Date and time display | How dates and times are shown | ISO date and 12-hour time with AM/PM, the same in Spanish and English. Example: `2026-10-13 3:05 PM` (REQ-NF-38) |
| Photo | Image of the User per term | Upload: JPEG, PNG or HEIC, up to 10 MB. Stored as JPEG without location metadata (REQ-NF-24) |
| Emergency contact | Person to call in an emergency | Name and phone |
| IP address | Address of the device that made a gym action | Personal data; kept with the audit log (REQ-NF-39) |
| Failed sign-in limit | Attempts before a wait | 10, per account and per IP address (REQ-F-07) |
| PIN session | Time an entered PIN stays active, only in the browser where it was typed | Closes after 15 minutes without a tap or key press; warning after 10 minutes. Polling does not count as activity (REQ-NF-48) |
| Void | Status of a session created by mistake | Kept with its log entry; not counted in occupancy or analytics (REQ-F-48) |

No street address is stored (2.4). The full dictionary is written in the design phase.

### 4.3 Reports

| Report | Content | Who sees it |
|---|---|---|
| Utilization analytics | REQ-F-61 to REQ-F-65, REQ-F-86. Aggregated counts only, no names | Every signed-in role: User, Staff and Administrator |
| Audit log | REQ-NF-39 | Administrator (with the PIN) |
| Import result | Orders created, updated and rejected, including orders dated outside every term | Administrator. Detail TBD (team, design) |
| Roster changes per term | Roster changes from the audit log | Optional. TBD whether the gym wants it (gym) |

Visual design and export of reports: TBD (team, design).

### 4.4 Data Acquisition, Integrity, Retention, and Disposal

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-01 | The database shall be the source of truth, and backend time shall decide the expiration of sessions and authorizations. | N/A | High | Clear | main.tex:350 |
| REQ-NF-02 | Claim uniqueness and the single active session rule shall be enforced in the database, not only in the frontend. | N/A | High | Clear. Depends on CTI accepting PostgreSQL (CTI) | main.tex:462, 511 |
| REQ-NF-03 | Location shall be used only for Check In and shall not be stored as movement history. The validation result may be stored. | N/A | High | Clear | main.tex:210, 511 |
| REQ-NF-04 | The system shall discard photos from earlier terms, unless UPRM requires keeping them. | N/A | Medium | Pending: UPRM rule (gym, UPRM) | main.tex:511 |
| REQ-NF-05 | The system shall apply retention rules by data type: photos, waivers, emergency contacts, Check Ins and audit log (including IP addresses). Each audit log entry is kept until the end of the term in which it happened (decided), also when it mentions a user whose account was deleted. | N/A | Medium | Pending: every period except the audit log (gym, UPRM). No provisional values | main.tex:328, 466; Q&A 2026-10-13 |
| REQ-NF-06 | There shall be backups of the database and the files, and a tested restore before each milestone. | N/A | Medium | Pending: what is backed up, how often, where (outside the VM) and for how long (CTI, team) | main.tex:468, 513; Review |
| REQ-NF-07 | Real WooCommerce data shall be used only to test the integration: with permission, only the needed fields, outside git and synced folders, and deleted when the test ends. | N/A | Medium | Pending: how many records, on which machines and for how long (team, CTI) | Later change |
| REQ-NF-08 | Development shall use fake data. | N/A | High | Clear | Later change |
| REQ-NF-09 | Student data shall not be sent to external services without approval. | N/A | High | Pending: who approves (CTI) | Team |

## 5. External Interface Requirements

### 5.1 User Interfaces

Screens by role (detailed design in a separate specification, TBD):

- User: registration, sign in, Check In, Gym ID, occupancy, schedules, notices, facility information, renewal, "I am an athlete", facility analytics, waiver and emergency contact, account deletion request.
- Staff (gym account without the PIN): active sessions, Gym ID verification, Staff-assisted Check In, corrections, waiver and emergency contact, in-person athlete registration (only athletes already in the roster), facility analytics.
- Administrator (gym account with the PIN): roster, terms, import and import undo, manual authorizations, PIN and gym account password, schedules (including athletes-only periods), notices, information, audit log, release of claimed Authorization Numbers, plus everything Staff see.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-10 | The interface shall be a mobile-first PWA with one codebase for phone and desktop. | N/A | High | Clear | main.tex:198, 348 |

### 5.2 Software Interfaces

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-11 | Location shall be obtained with the browser's standard Geolocation API, and Check In shall handle the permission state and the reported accuracy. | N/A | High | Clear | main.tex:499-503 |

- WooCommerce: input through an Export Orders file (REQ-F-28). Format (for example CSV): TBD until an authorized export is seen. API or webhook: Stretch (REQ-F-32).
- PostgreSQL: system database (2.4).

### 5.3 Communications Interfaces

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-12 | All traffic shall go over HTTPS, also in development tests on the phone. The Geolocation API requires it. | N/A | High | Clear | main.tex:332; Team |

- Outgoing mail: needed for athlete registration (REQ-F-15, the only athlete flow built by default) and password reset (REQ-F-06, REQ-F-75). In development, a fake mail server. In production: CTI SMTP or relay, TBD (CTI). Still unknown: the sender address and who sets up SPF and DKIM in DNS. An external mail provider was not chosen. If CTI confirms there is no outgoing mail, the in-person flow is built (REQ-F-77) and there is no password reset.
- Real IP address: behind the proxy, the backend reads the client IP address from the proxy header (REQ-NF-39).

## 6. Quality Attributes

### 6.1 Usability

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-13 | The User, Staff and Administrator interfaces shall meet the applicable WCAG 2.2 level AA criteria. | N/A | High | Clear | main.tex:490-494 |
| REQ-NF-14 | Gym ID states and other key states shall be shown with text or an icon in addition to color. | N/A | High | Clear | main.tex:494 |

### 6.2 Performance

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-15 | The system shall serve about 150 people per day. | N/A | High | Clear as an assumption. The number of members and the peak-hour arrivals are unknown; measuring them is one purpose of the app. The Check In concurrency test uses a number fixed in design (team) | main.tex:104; Q&A 2026-10-13 |
| REQ-NF-16 | The Check In button shall be usable in under 3 seconds on mobile data on a mid-range phone. | N/A | High | Clear. Test phone and network conditions set in design (team) | main.tex:433; Q&A 2026-10-13 |

### 6.3 Security

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-17 | Each role shall have only the access it needs. The gym account without the PIN (front desk) shall not be able to perform any Administrator action (3.10.1). | N/A | High | Clear | main.tex:509; Q&A 2026-10-13 |
| REQ-NF-18 | Server credentials shall be in protected configuration, outside the repository. | N/A | High | Clear | main.tex:509 |
| REQ-NF-19 | Staff shall see only the sensitive data needed for Check In and emergencies: photo, authorization, waiver acceptance and emergency contact. | N/A | High | Clear | main.tex:466; Q&A 2026-10-13 |
| REQ-NF-20 | Photos shall be stored in private storage, accessible only through the backend according to role. | N/A | High | Clear | main.tex:466, 511 |
| REQ-NF-21 | The system shall store only the personal data listed in the data dictionary. | N/A | High | Clear | main.tex:466 |
| REQ-NF-22 | The developer role shall be outside the gym roles. | N/A | High | Clear | main.tex:437 |
| REQ-NF-23 | Developers shall not have routine access to safety or emergency data in production. | N/A | High | Pending: if the team manages the VM, it has access; still unknown who manages the VM and who looks after the system (CTI, gym) | main.tex:437, 509 |
| REQ-NF-24 | Uploaded photos shall be JPEG, PNG or HEIC, up to 10 MB. The server shall convert them to JPEG and strip location metadata. | N/A | High | Clear | Review; Q&A 2026-10-13 |
| REQ-NF-25 | The system shall show a privacy notice in Spanish and English before collecting personal data. | N/A | High | Pending: the team drafts the text; the gym approves it (gym) | Team; Q&A 2026-10-13 |
| REQ-NF-48 | The PIN shall be stored hashed. PIN attempts shall be limited. Only PIN holders shall be able to change it. An entered PIN shall be active only in the browser or device where it was typed. Once entered, the PIN shall stay active until 15 minutes of inactivity and then close. After 10 minutes of inactivity the app shall warn that the PIN will close in 5 minutes. Only a tap or key press by a person counts as activity; automatic polling does not. The team creates the gym account, its password and the first PIN once with an install command on the server and gives them to the Administrator; after that the Administrator changes the password and the PIN from the app using the current PIN. | N/A | High | Clear. Attempt limit and wait set in design (team) | Team; Q&A 2026-10-13, 2026-10-14 |

Attempt limits: REQ-F-07 (sign in), REQ-F-71 (Authorization Number lookups), REQ-NF-48 (PIN). There is no inactivity timeout (REQ-F-08 removed).

### 6.4 Other Quality Attributes

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-26 | Sign in, authorization, facility sessions, the one-device rule and Gym ID verification shall require a connection. Without a connection no session is created. | N/A | High | Clear | main.tex:460 |
| REQ-NF-27 | The service worker shall not cache responses from `/api`. | N/A | High | Clear | Review |
| REQ-NF-28 | The location boundary and the accepted accuracy shall be set with tests inside and around the gym on iPhone and Android. The gym coordinates are measured in the same tests. | N/A | High | Pending: the values, until the team measures them. The team can test at the gym whenever it wants, and all three members can test on iPhone, Android, Mac and other computers | main.tex:435, 458; Q&A 2026-10-13 |
| REQ-NF-29 | The location boundary shall be configurable per environment. Production shall refuse to start if the configured boundary is more than 50 meters from the gym coordinates (REQ-NF-28), so the classroom demo boundary cannot reach production. The December demo runs in a separate environment with the classroom boundary; production never carries that boundary. | N/A | High | Clear. The 50 meters can be adjusted after the boundary is measured at the gym. The demo classroom must be farther than 50 meters from the gym (team) | Review; Q&A 2026-10-14 |
| REQ-NF-30 | The main flows shall pass on iPhone with Safari, Android with Chrome, and Windows with Chrome and Edge; macOS and Firefox as a secondary check. | N/A | High | Clear | main.tex:464 |
| REQ-NF-31 | Availability: uptime target and manual procedure if the system fails. | N/A | Medium | Pending: what staff do if the system fails and how long downtime is tolerable (gym); who looks after the system after December (gym) | Review |
| REQ-NF-32 | Database migrations shall be reproducible, and the development configuration shall be separate from the production configuration. | N/A | High | Clear | main.tex:515 |

Portability: same Docker images with a pinned version in development and production (2.4).

## 7. Internationalization and Localization Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-33 | The interface shall be in Spanish by default, with a button that switches all texts to English. | N/A | High | Clear | Later change |
| REQ-NF-34 | All frontend and backend texts, including emails and API error messages, shall be in translation files from the start. | N/A | High | Clear | Later change |
| REQ-NF-35 | Emails shall be sent in the language chosen by the User. | N/A | High | Clear | Later change |
| REQ-NF-36 | The page language attribute shall change together with the texts (WCAG 3.1.1). | N/A | High | Clear | Review |
| REQ-NF-37 | Expiration, end of term and analytics shall use the `America/Puerto_Rico` time zone. | N/A | High | Clear | Review |
| REQ-NF-38 | Dates and times shall be shown as an ISO date plus 12-hour time with AM/PM, the same in Spanish and English. Example: `2026-10-13 3:05 PM`. | N/A | High | Clear | Review; Q&A 2026-10-13 |

Gym texts in two languages: REQ-F-58.

## 8. Other Requirements

### 8.1 Audit

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-39 | The system shall record, for each Staff correction, Staff-assisted Check In, roster change, term or schedule change, import, PIN change, release of a claimed Authorization Number, manual grant or revoke of an authorization (with its reason), import undo, gym account password change and in-person athlete registration: the account, the time, the IP address, the device and browser, and what changed (values before and after). Behind the proxy, the real IP address is read from the proxy header. Because the gym account is shared, the log cannot name the person; the gym identifies who it was by checking the shift schedule. Only Administrators (with the PIN) can see the log. Entries that mention a user whose account was deleted stay intact until the end of their term. | N/A | High | Clear. Each entry is kept until the end of the term in which it happened (REQ-NF-05) | main.tex:212, 513; Q&A 2026-10-13, 2026-10-14 |

### 8.2 Testing

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-40 | There shall be automated unit or database tests for authorization and sessions. | N/A | High | Clear | main.tex:515 |
| REQ-NF-41 | There shall be integration tests from sign in to session creation. | N/A | High | Clear | main.tex:515 |
| REQ-NF-42 | Simultaneous Check In requests and repeated Authorization Number or roster claims shall produce at most one session or one claim. | N/A | High | Clear | main.tex:462, 573 |
| REQ-NF-43 | Location and PWA behavior shall be tested on real phones. | N/A | High | Clear | main.tex:515 |
| REQ-NF-44 | Each test plan case shall be linked to an objective and shall use controlled datasets. | N/A | High | Clear | main.tex:515, 573-575 |

### 8.3 Development Process

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-45 | Changes shall enter `main` through branches and pull requests reviewed by at least one member who is not the author. | N/A | High | Clear | main.tex:515; repo rules |

### 8.4 Legal, Intellectual Property and Privacy

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-46 | Ownership and license of the team's work shall follow UPRM and Capstone policies before a long-term institutional deployment. User and institutional data are not intellectual property of the project. | N/A | Medium | Pending: terms (professor, UPRM) | main.tex:334-338 |
| REQ-NF-47 | Handling of student data shall comply with the laws and policies UPRM determines apply. FERPA probably applies to UPRM (indication, not confirmed). | N/A | High | Pending: whether gym data counts as an education record and which rules apply (UPRM: Registrar or compliance officer, through CTI) | Team |

## Appendix A: Glossary

| Term | Definition |
|---|---|
| Administrator | Way of using the gym account with the PIN. Manages the roster, terms, imports, schedules, notices, information, the audit log and the PIN |
| API | Application Programming Interface: interface the frontend uses to talk to the backend. Here, under `/api` |
| Athletes-only period | Schedule slot when only athletes can do Check In |
| Athletic Activities | UPRM Department of Athletic Activities, owner of the need |
| Audit log | Record of gym actions with time, IP address, device and what changed |
| Authorization Number | 6-digit number issued with the membership purchase in WooCommerce and sent by email to the payer. The paid member uses it to register and renew |
| Check In | Action with which the User opens a facility session |
| Staff-assisted Check In | Check In that Staff do for a User who is present without a phone |
| CSV | Comma-Separated Values: text file with values separated by commas |
| CTI | UPRM technology area. Meaning of the acronym not verified |
| DKIM | DomainKeys Identified Mail: signature that proves an email came from an authorized domain |
| DNS | Domain Name System: system that translates domain names to addresses |
| Export Orders | WooCommerce feature that exports orders to a file |
| FERPA | Family Educational Rights and Privacy Act: U.S. federal law that protects students' education records |
| Gym account | The one shared account the gym uses. Without the PIN it works as Staff; with the PIN, as Administrator |
| Gym ID | Credential in the PWA with name, photo, authorization, Check In status, minutes left and a moving clock. No code or QR. Staff verify it by name and photo in the active sessions list. A paid member's Gym ID shows "expired" after 60 minutes; an athlete's does not expire while the term authorization is active |
| HTTPS | Hypertext Transfer Protocol Secure: encrypted HTTP |
| Paid member | User with a term membership paid in WooCommerce |
| Manual authorization | Authorization an Administrator grants by hand to an existing account, until the end of a chosen term, for order errors (REQ-F-87) |
| MVP | Minimum Viable Product: scope validated first (`main.tex:295`) |
| Estimated occupancy | Number of active facility sessions. It is not a physical headcount |
| PIN | Single secret number, known only to the gym administration, that unlocks the Administrator actions of the gym account |
| PWA | Progressive Web App: web application that can be installed on the phone |
| Roster | List of authorized athletes for an academic term |
| SAML | Security Assertion Markup Language: standard for signing in through an external provider |
| Secondary | Scope planned after the MVP is stable (`main.tex:295`). Committed for December (1.3) |
| Service worker | Browser script that lets the PWA be installed and cache files |
| Sign-in session | Device signed in to an account. Not the same as a facility session |
| Facility session | 60-minute period created by a valid Check In (facility session, `main.tex:358`) |
| SMTP | Simple Mail Transfer Protocol: protocol for sending email |
| SPF | Sender Policy Framework: DNS record that says which servers can send email for a domain |
| Staff | Gym staff, including front desk students, using the gym account without the PIN |
| Stretch | Scope done only if the committed scope is complete and tested (`main.tex:295`) |
| TBD | To Be Determined: missing information |
| Academic term (term) | Period of the UPRM academic calendar with configured start and end dates. The proposal calls it "semester". A summer term exists only if configured |
| UPRM | University of Puerto Rico at Mayagüez |
| User | Person with an account: paid member or athlete |
| VM | Virtual Machine |
| Void | Staff correction that marks a session created by mistake. The record and its log stay, and the session stops counting in occupancy and analytics |
| Waiver | Liability waiver the User accepts once, when the account is created, stored with full name, email and emergency contact |
| WCAG | Web Content Accessibility Guidelines: W3C accessibility guidelines |
| WooCommerce | Commerce system on WordPress that UPRM uses to charge for memberships |

## Appendix B: Analysis Models

Use cases by role:

| Role | Use case | Requirements |
|---|---|---|
| User | Register as paid member | REQ-F-10, REQ-F-11, REQ-F-13, REQ-F-17, REQ-F-70 to REQ-F-73, REQ-F-75 |
| User | Register as athlete | REQ-F-13 to REQ-F-15, REQ-F-17, REQ-F-73, REQ-F-76 |
| User | Sign in, change phone, reset password | REQ-F-02 to REQ-F-07 |
| User | Delete account | REQ-F-09 |
| User | Edit emergency contact (Proposed) | REQ-F-60 |
| User | Renew or change type | REQ-F-20, REQ-F-23 to REQ-F-26, REQ-F-78 to REQ-F-80 |
| User | Accept waiver and give emergency contact | REQ-F-60 |
| User | Check In and show Gym ID | REQ-F-33 to REQ-F-40, REQ-F-81 to REQ-F-83 |
| User | See occupancy, schedules, notices and information | REQ-F-41 to REQ-F-43, REQ-F-55 to REQ-F-58 |
| Staff | See sessions and verify Gym ID | REQ-F-44, REQ-F-45 |
| Staff | Staff-assisted Check In | REQ-F-46, REQ-F-47 |
| Staff | Correct a session (end early, void) | REQ-F-48 |
| Staff | See waiver and emergency contact | REQ-F-85 |
| Staff | Register in person an athlete already in the roster (only without outgoing mail) | REQ-F-77 |
| User, Staff, Administrator | See facility analytics | REQ-F-61 to REQ-F-65, REQ-F-86 |
| Administrator | Maintain the roster | REQ-F-49, REQ-F-51 |
| Administrator | Release a claimed Authorization Number | REQ-F-74 |
| Administrator | Grant or revoke an authorization by hand | REQ-F-87 |
| Administrator | Enter and change the PIN; change the gym account password | REQ-F-52, REQ-F-53, REQ-NF-48 |
| Administrator | Configure terms | REQ-F-21 |
| Administrator | Import, reconcile and undo an import | REQ-F-28 to REQ-F-31 |
| Administrator | Publish schedules, athletes-only periods, notices and information | REQ-F-55 to REQ-F-58, REQ-F-84 |
| Administrator | See the audit log | REQ-NF-39 |

## Summary of Open Items

| TBD | What is missing | Who answers | Blocks |
|---|---|---|---|
| Outgoing mail | CTI SMTP or relay, sender address, SPF and DKIM. Critical: athlete registration and password reset depend on it. Only if CTI confirms there is none, REQ-F-77 is built | CTI | REQ-F-06, REQ-F-15, REQ-F-75, REQ-F-77, REQ-NF-35 |
| PostgreSQL | Whether CTI accepts it or requires MySQL | CTI | REQ-F-17, REQ-F-36, REQ-NF-02 |
| VM | Public IP, containers, subdomain, HTTPS, single name | CTI | 2.3, 2.4, REQ-NF-12 |
| WooCommerce API | Whether there is access and with what restrictions | CTI | REQ-F-32 |
| External services | Who approves | CTI | REQ-NF-09 |
| Backups | What, how often, where, retention | CTI, team | REQ-NF-06 |
| FERPA | Whether it applies to gym data | UPRM (through CTI) | REQ-NF-47 |
| Real data | How many records, on which machines, how long | CTI, team | REQ-NF-07 |
| Authorization Number uniqueness | Whether the number is unique across orders; check with a real export | Team, gym | REQ-F-10 |
| Export Orders | File format and columns | Team, gym | REQ-F-28 |
| Contact number | Number shown to people who cannot register | Gym | REQ-F-72, REQ-F-73, REQ-F-76 |
| Store sells only during terms | Confirm the store sells memberships only while a term runs, and whether a summer term is configured | Gym | REQ-F-21, REQ-F-22 |
| Athletes-only periods | List of periods | Gym | REQ-F-82 to REQ-F-84 |
| PIN holders | Who holds the PIN | Gym | REQ-F-53 |
| Access and PIN table | Confirm the table in 3.10.1 matches how the gym works | Gym | REQ-F-52 |
| Roster lists | Fields and format of the lists | Gym | REQ-F-49, REQ-F-51 |
| Roster change report | Whether the gym wants a term report of roster changes (optional) | Gym | 4.3 |
| Safety records | Confirm that no documents or medical warnings are needed | Gym | REQ-F-60 |
| English for later notices | Who provides English for notices published after December | Gym | REQ-F-58 |
| Privacy notice | Approval of the team's draft | Gym | REQ-NF-25 |
| Retention | Periods by data type except the audit log; old photos | Gym, UPRM | REQ-NF-04, REQ-NF-05 |
| Front desk devices | Whether the desktop computer is shared and whether phones are also used | Gym | 2.3, REQ-F-44 |
| Availability | What staff do if the system fails; tolerable downtime | Gym | REQ-NF-31 |
| Who looks after the system | Gym account, PIN and support after December; who manages the VM | Gym, CTI | REQ-NF-23, REQ-NF-31, 2.5 |
| Location boundary | Values, measured by the team at the gym | Team | REQ-NF-28 |
| Cookies on iPhone | Test the installed PWA on iPhone | Team | REQ-F-03, REQ-F-66 |
| License | Ownership and license terms | Professor, UPRM | REQ-NF-46 |
| Stretch | Capacity policy, other facilities, history to predict | Gym, team | REQ-F-67 to REQ-F-69 |
| Design details | Sign-in waits, lookup limits, PIN attempt limit, link validity period, analytics metrics beyond REQ-F-61 to REQ-F-65 and REQ-F-86, concurrency test number, error texts, import report, repeated roster entry, unconfigured term | Team | REQ-F-07, REQ-F-15, REQ-F-21, REQ-F-28, REQ-F-35, REQ-F-49, REQ-F-61 to REQ-F-65, REQ-F-71, REQ-NF-15, REQ-NF-29, REQ-NF-48 |
