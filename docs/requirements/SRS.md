# Software Requirements Specification

**Project:** UPRM Weight Gym Operations and Member-Access Platform

**Version:** 0.15 draft, not approved

**Authors:** Carlos J. Pepin Delgado, Pierre G Vales Torres, Viviana V Ramos Vivoni

**Organization:** Department of Computer Science and Engineering, University of Puerto Rico at Mayagüez (UPRM)

**Date:** 2026-11-05

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

**What the system does.** A phone-first web app (PWA) for the UPRM Weight Gym. It replaces the paper log and the manual payment check. People create one account, prove they may use the gym (a paid WooCommerce membership or the athlete roster), and do Check In from their phone inside the gym. A Check In opens a facility session that stays open until Staff check the person out, or ends by itself 2 hours after the Check In, and shows a Gym ID that Staff can verify. The app shows estimated occupancy, schedules, notices, facility information and usage statistics.

**Who uses it.**

- **User:** a person with an account. Either a **paid member** (bought a term membership in WooCommerce; students and employees) or an **athlete** (on the department's athlete roster).
- **Staff:** a person at the front desk (often a student) with a personal staff account: own email, own password, role Staff. There is no shared gym account, no PIN and no paper recovery code (E-114).
- **Administrator:** a person from Athletic Activities administration with a personal staff account, role Administrator. The Administrators are the two department secretaries and the department director. The install command creates the first Administrator. Administrators invite Staff by email and deactivate an account when the person leaves (REQ-F-88).
- **Developer:** the project team. Outside the gym roles.

**What each role can do.** The backend enforces this table (REQ-F-52).

| Action | User | Staff | Administrator |
|---|---|---|---|
| Register, sign in, Check In, show the Gym ID, renew, delete own account | Yes | No | No |
| See schedules and notices. Anyone can see them, also without signing in (REQ-F-55) | Yes | Yes | Yes |
| See occupancy and facility information (signed in) | Yes | Yes | Yes |
| See facility analytics | Yes | Yes | Yes |
| See active sessions and verify a Gym ID | No | Yes | Yes |
| Staff-assisted Check In; check a person out; end a session early or void it | No | Yes | Yes |
| See a User's waiver and emergency contact | No | Yes | Yes |
| See the athlete roster, read only (REQ-F-49) | No | Yes | Yes |
| Mark a photo as pending when it does not match the person (REQ-F-94) | No | Yes | Yes |
| Add, edit and remove athletes by hand (REQ-F-49); academic terms; see the store sync and press "Sync now" (REQ-F-99) | No | No | Yes |
| Schedules, closures, athletes-only slots, notices, facility information, the gym contact number | No | No | Yes |
| Grant or revoke an authorization by hand, also to revoke a refunded membership (REQ-F-87, E-120); release a claimed Authorization Number | No | No | Yes |
| Delete a User's account when the User asks in person (REQ-F-09) | No | No | Yes |
| See the audit log (REQ-NF-39); invite Staff by email and deactivate staff accounts (REQ-F-88) | No | No | Yes |
| Enter paper log entries after an outage (REQ-F-95) | No | No | Yes |
| Download the athlete roster as Word or PDF (REQ-F-100) | No | No | Yes |
| See the last backup, back up now, download a backup, restore a backup (REQ-NF-06) | No | No | Yes |
| Download the statistics of a chosen period, including the term (REQ-F-101) | No | No | Yes |

**Still open.** Pending requirements: REQ-F-28, F-67, F-68, F-69, F-82, F-91, F-94, REQ-NF-07, NF-09, NF-23, NF-25, NF-28, NF-46, NF-47, NF-53. Details: Summary of Open Items.

## Revision History

| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Carlos J. Pepin Delgado | 2026-10-11 | First draft based on the proposal and the later changes | 0.1 |
| Carlos J. Pepin Delgado | 2026-10-13 | Team answers of 2026-10-13: scope and final priority, registration flows, one gym account with a PIN, no refunds, athletes-only periods, waiver, audit log, quality targets | 0.2 |
| Carlos J. Pepin Delgado | 2026-10-14 | Follow-up answers: audit log retention, photo comparison, in-person athlete registration, PIN timeout, athletes-only notice, analytics open to all roles | 0.3 |
| Carlos J. Pepin Delgado | 2026-10-14 | Design-readiness decisions E-31 to E-47 (`team.md`) | 0.4 |
| Carlos J. Pepin Delgado | 2026-10-14 | Shortened: merged duplicate requirements (Appendix B), moved design details to `docs/design/design-notes.md` and team rules to `context.md`, added the Overview, plain Source labels | 0.5 |
| Carlos J. Pepin Delgado | 2026-10-14 | Design review decisions E-56 to E-60 (`team.md`): PIN state per browser with a PIN version, photos deleted on import undo, email link for "I am an athlete", Staff see the roster read only, gym account recovery code (new REQ-F-89) | 0.6 |
| Carlos J. Pepin Delgado | 2026-10-19 | Design review decisions E-61 to E-92 (`team.md`): mail assumed available, password rules (new REQ-NF-51), 4-digit PIN, one language per account, gym dashboard on its own address, public schedules and notices, banners for Users with no active authorization, one authorization per term, Authorization Number unique per term, Gym ID for athletes, athletes-only colors (new REQ-F-90), registration needs a payment or the roster (new REQ-F-91), recovery code format and "Generate new code", saved import results. Data model rules for the migration (E-93). Review answers E-94 to E-100: only active authorizations count per term, Reinstate after a roster removal by mistake, no store option for athletes, Authorization Number field under both banners, the compromised-password check sends no student data, no minutes left for athletes in the Staff active sessions list, "I am an athlete" under both banners, Reinstate needs a reason and is refused when the person has an active authorization | 0.7 |
| Carlos J. Pepin Delgado | 2026-10-20 | Wireframe decisions E-101 to E-107 (`team.md`): a Lock button returns the Administrator to Staff mode, no separate administration menu screen, welcome and sign-in screens in Spanish before an account exists, the gym account changes its language on the dashboard without the PIN, a "My visits" list of the User's own Check Ins (new REQ-F-92), releasing a number never deletes the account, terms are never deleted | 0.8 |
| Carlos J. Pepin Delgado | 2026-10-25 | CTI meeting answers (M-02, M-09 answered; M-03, M-04, M-06, M-07, M-13, M-16 partly answered): containers and PostgreSQL are the team's choice, the project owner files the VM, domain and VPN requests, mail through the CTI gateway after authorization, backups are the team's decision. New open items for the gym (G-31 to G-37) and the team (E-108 to E-113). Proposed, CTI advice: audit log search and export (REQ-F-93), installer (REQ-NF-52), hand-over documents (REQ-NF-53) | 0.9 |
| Carlos J. Pepin Delgado | 2026-11-04 | Team decisions E-114 to E-126 (`team.md`), after the Athletic Activities meeting: personal staff accounts for Staff and Administrators, with no shared gym account, PIN or recovery code (REQ-F-89 and REQ-NF-48 removed; REQ-F-52, REQ-F-88, REQ-NF-10, REQ-NF-39 rewritten); check-out and a session that ends by itself after 2 hours or at a closure; one athlete roster entered by hand; no in-person registration code (REQ-F-77 removed); photo pending (new REQ-F-94); manual entries from the paper log (new REQ-F-95); student or employee on each order and refunds revoked by hand by an Administrator (E-120, rewritten: the store never shows them); new reports and an end-of-term summary (new REQ-F-96); backups on a second disk every two weeks; Rocky Linux 10 and one install command; own UPRM subdomain; every kind of data kept 5 years; store button, optional English notices, four manuals. Then E-127 and E-128: paid memberships come from the store's REST API, not from an uploaded file (REQ-F-28, F-29, F-30, F-10 rewritten; REQ-F-31 and F-32 removed; new REQ-F-97 to F-99; the import result screen becomes the Store sync screen), and the Authorization Number is a 6-character code that can include letters, unique across all orders | 0.10 |
| Carlos J. Pepin Delgado | 2026-11-05 | Team decisions E-140 to E-144 (`team.md`): Administrators download the athlete roster as Word or PDF (new REQ-F-100); Administrators download the statistics of any period as PDF or Excel (new REQ-F-101), and the end-of-term summary is that download with the term chosen (E-144, REQ-F-96 merged); the period is picked with buttons (day, week, month, term, year) or a free date range (REQ-F-61); a read-only REST API gives statistics with no personal data to other services (new REQ-F-102) | 0.11 |
| Carlos J. Pepin Delgado | 2026-11-05 | Team decisions E-145 to E-151 (`team.md`), from the review of the #13 migrations: retention without blocked database links (REQ-NF-05), void a wrong manual entry (REQ-F-95), sport copied onto each visit (REQ-F-61), student or employee on each manual grant (REQ-F-87), no names in the sync record (REQ-F-99), reactivating a staff account and keeping the last Administrator (REQ-F-88) | 0.12 |
| Pierre Vales | 2026-11-06 | Team decision E-152 (`team.md`): dates and times follow the Figma wireframes, in the short form of each language (REQ-NF-38 rewritten) | 0.13 |
| Carlos J. Pepin Delgado | 2026-11-06 | Team decision E-154 (`team.md`): API error texts live only in the PWA translation files and the API sends only a code (REQ-NF-34 rewritten) | 0.13 |
| Carlos J. Pepin Delgado | 2026-11-05 | Team decision E-153 (`team.md`), which replaces E-112: registration is one screen with one field; exactly 10 digits is a student number (athlete registration), anything else is an Authorization Number, whose length is not checked (REQ-F-15, REQ-F-71, REQ-F-76, REQ-F-91; REQ-F-10 and the glossary no longer fix the length at 6 characters, E-128) | 0.14 |
| Carlos J. Pepin Delgado | 2026-11-06 | Team decisions E-155 and E-156 (`team.md`): the waiver is accepted with an on-screen checkbox now, and a drawn signature is added for the Final report after research (REQ-F-60); no "15 minutes left" notice | 0.15 |

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the December release of the UPRM Weight Gym Operations and Member-Access Platform. It is for the development team and the professor: it says what to build and how to test it.

The baseline is the proposal, in force until further notice. `docs/context.md` lists what changes it and why. If this document and the proposal differ, this document wins, and the difference must appear in `context.md`.

### 1.2 Document Conventions

- IDs: `REQ-F-NN` (functional) and `REQ-NF-NN` (nonfunctional). An ID is never reused or renumbered. A new requirement takes the next free number. A merged or removed requirement is listed in Appendix B with the place where its rule lives now.
- **Proposal priority:** MVP, Secondary or Stretch from the proposal scope table (Proposal:293-310); N/A if it is not in that table.
- **Final priority:** MVP is High, Secondary is Medium, Stretch is Low. Exceptions: a Secondary or N/A row that an MVP flow needs is High; any other N/A row is Medium. High and Medium are committed for December; High is built first. Low is built only if the rest is complete and tested.
- **Status:** **Clear** (can be built and tested now) or **Pending** (information is missing; the cell names who answers and the question ID in `docs/decisions/`).
- **Source:** **Proposal:LINE** (a line of the proposal, see 1.4); **Team decision** (recorded in `context.md` or `docs/decisions/team.md`); **Review gap** (found in the requirements review, not in the proposal); **Professor feedback** (from the grading comments on the proposal). **CTI advice** (a request or suggestion CTI makes to student projects; CTI did not say it is a condition to get the VM. Rows with this source stay Proposed until the team adopts them).
- **Proposed:** a rule the team suggests that still needs confirmation.
- Terms: "term" means academic term (the proposal says "semester"). "Sign-in session" is the login on a device. "Session" alone is the facility session.

### 1.3 Project Scope

The system is a PWA for the Weight Gym in the UPRM Natatorio Complex. It replaces the paper log and the manual payment check (Proposal:102). It joins accounts, authorization by paid membership or athlete roster, Check In with location, facility sessions that Staff close at check-out or that end after 2 hours, Gym ID, estimated occupancy, schedules and notices, facility information and utilization analytics (Proposal:120, 198).

Out of scope (Proposal:116, 328): payment processing (stays in WooCommerce), other facilities such as the pool, medical records, and capacity-based admission while UPRM has no official policy.

Delivery: demo in December before professors, with the project "complete". "Complete" means all 5 objectives of the proposal (Proposal:123-192) are met, without Stretch (Team decision, E-01). So the roster tool, the gym permissions, schedules and closures, and analytics are committed, although the scope table calls them Secondary (Proposal:305). The roster tool and the Install button (REQ-F-66) move up to the MVP. The classroom demo uses fake data only (E-126).

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
| NIST SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management, final, July 2025 | https://csrc.nist.gov/pubs/sp/800/63/b/4/final | Checked in design for password and session rules. Section 3.1.1.2: password length (REQ-NF-51) |
| Laravel 12.x documentation, Validation, "Validating Passwords" | https://laravel.com/docs/12.x/validation#validating-passwords | Compromised-password check of REQ-NF-51 |
| OWASP Application Security Verification Standard (ASVS), 5.0.0 | https://owasp.org/www-project-application-security-verification-standard/ | Checked in design for authentication and session controls |

## 2. Overall Description

### 2.1 Product Perspective

New product. Today the gym logs on paper, and staff check payment (WooCommerce) or athlete status (department lists) by hand (Proposal:102, 111). There is no count of active users and no usage metrics.

| Related system | Relationship |
|---|---|
| UPRM WooCommerce | Source of truth for payments. The system reads the orders through the store's REST API with a read-only key and does not process payments (Proposal:369-371; E-127) |
| UPR Payment Gateway portal | Where refunds are made, outside WordPress and WooCommerce. The app has no access to it and the team will not ask for it (E-120) |
| Department athlete lists | The department keeps them in Word, one per sport. Administrators enter them by hand into one roster (Team decision, E-116) |
| User's browser | Provides location through the Geolocation API (Proposal:499-503) |
| Outgoing mail server | Sends athlete registration links and password reset links. The team assumes mail is available (E-61). Path: the CTI mail gateway, after CTI adds the VM to its list of allowed senders. The team runs the mail service on the VM (CTI suggests Postfix) and builds the messages. External provider only if CTI does not authorize the VM (M-07, M-11) |
| CTI VM | Hosts the system in production, running Rocky Linux 10 (E-123) |

### 2.2 User Classes and Characteristics

User types and roles: see the Overview. Some paid members have no institutional email. Athletes do not buy a membership (Proposal:206). Front desk Staff include students (Proposal:118). Estimated use: about 150 people per day (Proposal:104), mostly from the phone (Proposal:198).

### 2.3 Operating Environment

- Client: PWA in the browser. iPhone with Safari, Android with Chrome, Windows with Chrome and Edge; macOS and Firefox as secondary (Proposal:464).
- Production: CTI VM, requested by the project owner with a ticket on the CTI request page. CTI clones a template, typically the same day to about a day, depending on urgency. CTI described no evaluation step (to confirm, M-04, M-05). Operating system: Rocky Linux 10, since CTI is moving its servers to it (E-123). The app gets its own UPRM subdomain and does not replace the department's site (E-124). The owner files a separate domain ticket with the name, and CTI assigns the IP. The name is still to pick.
- Containers: allowed. CTI delivers a plain Linux machine. The install command installs Docker CE (REQ-F-88, E-123); the container engine is the team's choice (M-02, answered).
- Development: `docker-compose` on each member's PC; phone tests through an HTTPS tunnel.
- Pending (CTI, M-01, M-03): public IP or campus only (not answered; whether Users should connect from off campus is a gym question, G-31); who provides the HTTPS certificate.
- The team's access to the production server from off campus needs a VPN. The owner requests it with a VPN ticket or an email that lists the team's emails, and answers for those accounts. Whether Users need a VPN was not said (M-01).
- Pending (gym, G-06): front desk devices. The team understands there is a desktop computer at the front desk.

### 2.4 Design and Implementation Constraints

- Frontend: PWA with React, TypeScript and Vite, one codebase for phone and desktop (Proposal:348).
- Backend: Laravel (PHP 8.3 or higher). Decided, not reopened.
- Database: PostgreSQL in a container. CTI leaves the engine to the team (M-09, answered). Why PostgreSQL: `docs/design/design-notes.md`.
- Containers: `docker-compose` with proxy, PHP, PostgreSQL and scheduled tasks.
- Single origin: PWA at `/` and API at `/api` under one name (Proposed; CTI, M-03). The gym dashboard is a path under the same name, so there is no second domain request (E-124).
- Production on a CTI VM. CTI does not manage the server or the application.
- The VM arrives as plain Linux with Rocky Linux 10 (E-123). CTI usually creates an account with sudo and gives it to the owner, who passes it to the team or creates another account for them. One install command, run once with sudo by the team or a technician, installs and configures everything else (REQ-F-88, REQ-NF-52).
- No SAML: the system has its own accounts.
- CTI services only. No Supabase and no Vercel (Team decision, E-07). Two exceptions. An external mail provider, used only if CTI does not authorize the VM on its mail gateway (E-61), needs approval (M-11, REQ-NF-09). The compromised-password check of REQ-NF-51 calls haveibeenpwned.com and sends no student data: only the first 5 characters of a hash of the password leave the VM, with no name, email, photo or full password. It is not submitted to M-11 (E-98).
- Personal staff accounts: one per Staff member and Administrator, with a role of Staff or Administrator. There is no shared gym account, no PIN and no paper recovery code (E-114). Staff accounts are separate from User accounts.
- No street address is collected or stored anywhere.
- Minimum cost for the gym; rely on CTI where possible.
- No offline Check In (Proposal:460).

### 2.5 Assumptions and Dependencies

| Depends on | What is assumed | If it fails | Question |
|---|---|---|---|
| CTI | VM, subdomain and HTTPS. Containers are the team's choice (M-02) | No production in December | M-01, M-03, M-04, M-05 |
| CTI | Outgoing mail from the VM. The email-link flows (REQ-F-06, REQ-F-15, REQ-F-80) are built. CTI authorizes the VM as a sender on its mail gateway | The app uses an external mail provider, so account emails leave the CTI VM. That needs approval (REQ-NF-09) | M-07, M-11 |
| Gym | Validates the access, renewal, staff account, exception, privacy and retention rules (Proposal:332) | Pending requirements cannot be closed | G-09 |
| Gym | Provides athlete lists (Word files, entered by hand, E-116), schedules, athletes-only periods, rules, equipment information and a contact number (Proposal:332) | No data for the roster, schedules or information | G-10, G-25, G-28 |
| WooCommerce | The team gets a read-only API key for the wc/v3 orders endpoint, kept in the server's environment file (E-127) | No sync and no lookup of new payments | M-12, G-35 |
| CTI | The VM can make outbound HTTPS requests to the store. Open item (E-127) | The app cannot read the store, so new paid members cannot register | M-12 (new question to number in `cti.md`) |
| WooCommerce | The store sells memberships only while a term runs. No summer membership unless a summer term is configured | Orders dated outside every term give no authorization (REQ-F-22) | G-26 |
| UPR Payment Gateway | Refunds are made in the gateway portal, outside WordPress and WooCommerce, so the store never shows them: none of the 84 orders read on 2026-11-04 has a refund. The team will not ask for access to the gateway or to Finance systems just for refunds. When the department refunds a membership, an Administrator revokes the authorization by hand (REQ-F-87), with a reason. If a refund is ever recorded in WooCommerce (status `refunded`), the sync revokes it on its own (REQ-F-98) | A refunded member keeps access until an Administrator revokes it | E-120 |
| Professor | Accepts the stack change from the proposal | It would have to be justified or reverted | P-01, P-03 |
| Project owner and gym | Someone looks after the system after December. CTI does not manage or adopt the system (it has no people for it); the owner must set a plan. Part of the install, accounts, adjustments and user orientation after delivery is the owner's | Nobody operates it; if the team does, it conflicts with REQ-NF-23 | G-01, M-16 |
| Project owner (gym director) | Files the VM ticket and the domain ticket on the CTI request page, requests the team's VPN with a VPN ticket or an email listing the team's emails, and passes the sudo account to the team or creates one for them. CTI acts on these requests only when the owner files them | No production in December | M-04, M-05 |

## 3. System Features

### 3.1 Accounts and Sign In

Each person has one account that lasts across terms, separate from the authorization (Proposal:202, 355-357). Acceptance criterion (Objective 1, Proposal:140-144): every case in the controlled dataset returns the expected decision.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-01 | The system shall keep one account per person, which persists across terms. | MVP | High | Clear | Proposal:202, 355 |
| REQ-F-02 | The User shall be able to create their own account and sign in with email and password. The system shall not use external authentication (SAML). | MVP | High | Clear. `Proposal:120` says "institutional login"; v1 of the proposal must correct it | Proposal:202; Team decision |
| REQ-F-03 | A User account (paid member or athlete) shall have at most one sign-in session. Signing in on another device ends the previous one, and the old device can no longer perform protected actions. There is no inactivity timeout: the sign-in session lasts until the User signs out or signs in elsewhere. A User who loses or changes the phone signs in on the new one; there is no staff process. The rule does not apply to staff accounts. | MVP | High | Clear. To test: cookies in the installed PWA on iPhone (E-17) | Proposal:202, 363; Team decision |
| REQ-F-06 | The User shall be able to reset their password with a link sent to the account email. The answer to a reset request is the same whether or not the email has an account. | N/A | High | Clear. Mail assumed available (2.5, E-61) | Review gap; Team decision (E-63) |
| REQ-F-07 | After 10 failed sign-in attempts, counted per account and per IP address, the system shall make that account or IP address wait, and the wait shall grow with each lockout. The rejection says when to try again. | N/A | High | Clear. Exact waits: design | Review gap |
| REQ-F-09 | A User with no active authorization shall be able to delete their account from the app. An Administrator can do the same deletion when the User asks, after checking the person's identification in person at the gym. The system deletes the personal data and photos and keeps only anonymous Check In counts. Audit log entries that mention the user stay for their retention period (REQ-NF-05), and distinct-people counts already computed (REQ-F-61) do not change. | N/A | Medium | Clear | Review gap; Team decision (E-89) |

Errors not covered above: wrong credentials are rejected without saying whether the email exists; a deletion request with an active authorization is rejected with the reason.

### 3.2 Paid Member Registration

The paid member registers with the Authorization Number, the code in the "Payment Description" of the WooCommerce receipt email (Proposal:204). It can include letters (E-128). The account email is always the payment email of that order. There is no email verification: the number reached the payer by email, and that is the check (E-09). Because the code is short and can be guessed, REQ-F-71 to REQ-F-75 add protections. Registration has one field (E-153): exactly 10 digits is a student number and goes to athlete registration (3.3); the app looks up anything else as an Authorization Number. The app does not check the length of the Authorization Number, because it can change (6 and 7 characters have been seen). A person who just paid registers at once, because the app asks the store for a number it does not have yet (REQ-F-97). Acceptance criterion: Objective 1 (Proposal:140-144), cases of valid, expired and missing membership.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-10 | The system shall validate the Authorization Number against the membership records read from the WooCommerce store, for the current term only. The app does not check the length of the number, because it can change (6 and 7 characters have been seen, E-153). The number can include letters, and registration accepts letters. It is unique across all orders, not only per term. If a number matches two orders (a safety check: the unique key and the sync already prevent it), the lookup is denied with the contact number of REQ-F-73. A number the app does not have yet is asked from the store at once (REQ-F-97). | MVP | High | Clear. Letter case of the number: open (team) | Proposal:204, 371; Team decision (E-71, E-127, E-128, E-153). E-128 replaces the per-term rule of E-71 |
| REQ-F-11 | The paid member's account email shall be the payment email of the WooCommerce record. The member shall not type or change it. | MVP | High | Clear | Proposal:204; Team decision |
| REQ-F-13 | On registration, the User (paid member or athlete) shall create a password and give a current photo, taken with the camera at that moment or uploaded as a file. The screen says that the photo cannot be changed later (REQ-F-26). The account and the claim of the Authorization Number or roster record are saved together, in one step, only after the photo is saved. If the photo fails, nothing is claimed and the number or record stays free. | MVP | High | Clear. G-34 answered: the person takes or uploads the photo on their own phone, and Staff do not take photos (E-118) | Proposal:202, 204, 206; Team decision (E-69, E-118) |
| REQ-F-70 | As soon as a valid, unclaimed Authorization Number is entered, the system shall show the payment email of that order masked: the first and last letter before the @ stay visible (for example `m***z@upr.edu`). The athlete's institutional email is masked the same way. | N/A | High | Clear | Team decision (E-72) |
| REQ-F-71 | The system shall limit failed Authorization Number lookups per IP address: when that limit is hit, lookups from that IP address pause for a time. The registration field is one for both kinds of number, so the limits cover it (E-153). A global limit on failed lookups never blocks registrations: it only slows each lookup and writes an alert entry in the audit log for the Administrator. | N/A | High | Clear. Values: design | Team decision (E-53, E-153) |
| REQ-F-72 | The system shall show the same message when an Authorization Number is invalid, already claimed or from an ended term, with the contact number of REQ-F-73. | N/A | High | Clear | Team decision (E-71) |
| REQ-F-73 | When an Authorization Number or a student number does not match a valid record, the system shall show the contact number of someone who can help. | N/A | High | Clear. The number is 265-3866, the office's direct line (gym, G-25). The Administrator can edit it (REQ-F-55) | Team decision |
| REQ-F-74 | An Administrator shall be able to release an Authorization Number claimed by mistake. The release removes only that authorization and its term photo. The account, its other authorizations and its history stay, also when that claim created the account. A release never deletes the account. If the released authorization was the account's only one, the account stays with no authorization: the person signs in, sees the banner of REQ-F-23 and can claim the correct number. The released number can be claimed again. | N/A | Medium | Clear | Team decision (E-52, E-57, E-87, E-106) |
| REQ-F-75 | If someone else claimed a member's Authorization Number, the real owner shall be able to take the account back with the password reset (REQ-F-06), because the account email is the payment email. If the number was added to an account with another email (REQ-F-78), the reset does not help: the real owner contacts the gym, and the Administrator releases the number (REQ-F-74). | N/A | High | Clear. Mail assumed available (2.5, E-61) | Team decision (E-70) |
| REQ-F-91 | The welcome screen and the registration screen shall say, before the person starts, that registering needs a paid membership or a place on the athlete roster, and shall show the contact number of REQ-F-73. The welcome screen and the registration screen shall also have a "Buy membership" button that opens the WooCommerce store. The button does not redirect the person by itself, and it shows only while a term runs. The store address is a setting. The registration screen is the same for paid members and athletes (E-153), so the button is on it too. | N/A | Medium | Pending: the store address (gym) | Team decision (E-92, E-96, E-126, E-153) |

Errors not covered above: an Authorization Number from an ended term cannot be used to register (message: REQ-F-72).

### 3.3 Athlete Registration

The athlete registers with the student number, typed in the same field as the Authorization Number (exactly 10 digits, E-153) and looked up in the roster that Administrators enter (Proposal:206). The student number is not secret, so the account is created only after the athlete opens a link sent to the institutional email in the roster. Acceptance criterion: Objective 1, cases of valid and invalid athlete and user with no match (Proposal:142).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-15 | The athlete shall register with their student number, typed in the one registration field: exactly 10 digits is a student number (E-153). The system looks it up in the athlete roster. The system sends a link to the institutional email in that roster record. On the page the link opens, the athlete sets the password, the photo (REQ-F-13) and the waiver (REQ-F-60), and the system saves them together and creates the account. Link requests are limited per student number: 1 every 5 minutes and 5 per day. This link is the only way for an athlete to register: there is no in-person code. If the link fails, the athlete calls the office at 265-3866. | MVP | High | Clear. Mail assumed available (2.5, E-61) | Proposal:206; Team decision (E-69, E-73, E-117, E-153) |
| REQ-F-17 | Each roster record and each Authorization Number shall be claimable by only one account, also under simultaneous requests. The database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (team choice, M-09) | Proposal:206, 371, 462, 511 |
| REQ-F-76 | If the student number is not in the roster, the system shall say that the person does not appear as a registered athlete and must go to the Department of Athletic Activities to be registered or to check for an error, with the contact number of REQ-F-73. At registration, the message also says that the student number is only for athletes and that a paid member uses the Authorization Number from the receipt email, with the picture of where to find it. | N/A | High | Clear | Team decision (E-153) |

Errors not covered above: an expired or already used link creates no account (link validity: design); a roster record that is already claimed is refused with the contact number.

### 3.4 Authorization, Academic Terms and Renewal

The authorization says whether the person has access in the current term. A User can have several authorizations over time (Proposal:356, 361). Term dates come from the UPRM academic calendar. An athlete on the roster has nothing to buy or renew: each new term the athlete only uploads a new photo (REQ-F-25). A paid member renews with a new Authorization Number. Acceptance criterion (Objective 1, Proposal:144): every User with a valid authorization is approved and every User without one is denied.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-18 | If a WooCommerce or roster record cannot be verified, the system shall deny the registration, renewal or Check In that depends on it. | MVP | High | Clear | Proposal:513 |
| REQ-F-19 | The authorization shall be stored separately from the account, and a User can have several authorizations over time, but at most one active authorization per term. A revoked authorization does not block a new grant or claim in the same term. | MVP | High | Clear | Proposal:350, 356; Team decision (E-68, E-94) |
| REQ-F-20 | The User shall be able to move between paid-member and athlete authorization without losing the account or the Check In history, by adding the new authorization from inside the existing account (REQ-F-23, REQ-F-80). The account email does not change, no new account is created, and staff do not merge accounts. | MVP | High | Clear | Proposal:202, 356, 406; Team decision |
| REQ-F-21 | The Administrator shall be able to create and edit academic terms with a start date and an end date from the UPRM academic calendar. Terms never overlap: on save, the system rejects dates that overlap another term. Gaps between terms are allowed. Terms are never deleted. The Administrator fixes a term created by mistake by editing its dates. | N/A | High | Clear | Proposal:350, 361; Team decision (E-48, E-107) |
| REQ-F-22 | Each authorization shall expire at the end of its term, whatever the purchase date. An order belongs to the term that contains its payment date. An order dated outside every term gives no authorization and is counted as skipped on the Store sync screen (REQ-F-99). An athlete authorization also ends when the athlete is removed from the roster (REQ-F-49). A `cancelled` or `refunded` order makes its authorization revoked at the next sync (REQ-F-98). A refund made in the payment gateway portal is revoked by hand (REQ-F-87, E-120). A record belongs to the term it was given, even if the term dates change later. The Administrator can edit a term even when its orders or athletes fall outside the new dates. If the end date changes, the authorizations of that term end on the new date. | MVP | High | Clear. Gym to confirm the store sells only while a term runs (G-26) | Proposal:361; Team decision (E-88, E-120) |
| REQ-F-23 | When the authorization expires, the system shall keep the account and disable Check In. A User with no active authorization sees a banner at the top and the Check In button grayed out. If the authorization expired, the banner says so and asks the User to renew. For any other cause (revoked, number released, no current term), the banner says the User has no active authorization and shows the contact number of REQ-F-73. Under both banners the screen shows "I am an athlete" (REQ-F-80) and the Authorization Number field, used to renew, to become a paid member, or to claim a number again after a release (REQ-F-74). If the number cannot be claimed, the User gets the message of REQ-F-72. The User still sees the schedules, notices, facility information and analytics. | MVP | High | Clear. Banner texts: wireframes | Proposal:204; Team decision (E-50, E-67, E-97, E-100) |
| REQ-F-25 | An athlete on the roster shall need no purchase and no Authorization Number in a new term. The only thing the athlete does is upload a new photo (REQ-F-26). The waiver is not asked again. | MVP | High | Clear | Proposal:206, 218, 321; Team decision (E-116) |
| REQ-F-26 | The User shall give a current photo for each term (at registration and at each renewal) and shall not be able to replace it during an active authorization, except when Staff mark it as pending (REQ-F-94). The first time an athlete opens the app during a new term, the system looks up the roster by the student number of the account's last roster claim. If the athlete is still on the roster, the system keeps the same account and history and asks for the new photo before Check In is allowed. That is all the athlete does (E-116). A User with a manual authorization (REQ-F-87) is also asked for the term photo before Check In. | MVP | High | Clear | Proposal:202, 426; Team decision (E-69, E-116, E-118) |
| REQ-F-78 | A signed-in User who enters a valid Authorization Number shall get the new authorization on that account, and no new account is created, even if the payment email is different. This is how a paid member renews. If a person who is not signed in enters a number whose payment email already has an account, the system shows that email masked (REQ-F-70) and asks the person to sign in and add the number from the account. Nothing is claimed. The same applies to an athlete whose roster email already has an account. | N/A | High | Clear | Proposal:320; Team decision (E-70) |
| REQ-F-80 | A signed-in User with no active authorization shall be able to enter a student number ("I am an athlete"). The option is hidden while the User has an active authorization. If the number is in the roster and unclaimed, the system sends a link to the institutional email in that roster record, as in REQ-F-15. It links the record to the account only when the link is opened and the term photo is saved on that page, so there is never an authorization without a photo. Otherwise it shows the message of REQ-F-76. The link request limit of REQ-F-15 applies. | N/A | High | Clear. Mail assumed available (2.5, E-61) | Team decision (E-58, E-68, E-69, E-73) |
| REQ-F-87 | An Administrator shall be able to grant an authorization by hand to an existing account, valid until the end of a chosen term, and to revoke an authorization. It is used for order errors and gives access without a WooCommerce payment record. A revoke is also how the department's refunds are handled, because refunds are made in the payment gateway portal and never reach the store (E-120). A manual authorization counts as a paid member for every rule (E-126); the Administrator picks student or employee on each grant, and statistics count it in that group (E-148). A grant is rejected if the account already has an active authorization for that term (REQ-F-19). A reason of at least 10 characters is required for a grant or a revoke and is logged (REQ-NF-39). The User gives the term photo before Check In (REQ-F-26). | N/A | Medium | Clear | Team decision (E-68, E-69, E-86, E-94, E-120, E-126) |

Errors not covered above: with no term configured for the current date, no new authorization is created. Every Administrator screen shows a notice that no term covers today, and each error caused by it gives that reason (E-85).

### 3.5 WooCommerce Store Sync

WooCommerce stays the source of payments; the system copies only what is needed to authorize (Proposal:369-371). It does not take a file: it reads the store's REST API (wc/v3 orders) with a read-only key kept in the server's environment file (E-127). It reads in two ways: at registration, when the app does not have the Authorization Number yet (REQ-F-97), and in a full sync at least 3 times a day that picks up changes to known orders (REQ-F-28). Only orders with status `completed` give access. Each order stores whether the buyer is a student or an employee, for statistics. Refunds are made in the UPR Payment Gateway portal, outside WordPress and WooCommerce, so the store never shows them (none of the 84 orders read on 2026-11-04 has a refund). An Administrator revokes those by hand (REQ-F-87, E-120). A buyer who paid the wrong price is the department's mistake to fix, not a case the app handles. Acceptance criterion, adapted from Proposal:456: reading the same order again creates no duplicates, and a changed order updates the authorization.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-28 | The system shall read paid memberships from the WooCommerce REST API (wc/v3 orders endpoint) with a read-only key. The key lives only in the server's environment file: not in the database, the repository or the logs. A full sync shall run at least 3 times a day and pick up changes to known orders. Only orders with status `completed` give access. There is no file upload. A second order with the same Authorization Number is rejected (REQ-F-10). | MVP | High | Pending: the read-only key from the store owner, and outbound HTTPS from the VM to the store (CTI, M-12) | Proposal:369, 371; Team decision (E-71, E-127) |
| REQ-F-29 | Each order shall give the system only these fields: order id, Authorization Number (meta field PGPAY_AUTHNUM of the "UPR Payment Gateway"), buyer name, payment email, product variation (student or employee membership), status and paid date. The term comes from the paid date. The system also stores the time of the last sync of the record. It shall not store the order's student number (the student numbers of athletes come from the roster), address, phone, IP address or marketing fields. | MVP | High | Clear | Proposal:204, 371; Team decision (E-120, E-127) |
| REQ-F-30 | Reading the same order more than once (scheduled sync, "Sync now" or a lookup at registration) shall update or confirm the same record, without duplicates. | MVP | High | Clear | Proposal:371, 456; Team decision (E-127) |
| REQ-F-97 | When a person types an Authorization Number the app does not have yet, the system shall ask the store right then, read the new or changed orders, and retry the lookup, so a person who just paid registers at once. These asks go through the failed lookup limits of REQ-F-71. If the store does not answer, the lookup is denied with a message to try again later and the contact number of REQ-F-73 (REQ-F-18). | N/A | High | Clear. How long to wait for the store: design | Team decision (E-127) |
| REQ-F-98 | When a known order later becomes `cancelled` or `refunded`, the sync shall revoke its authorization. The account and its history stay, and the person sees the banner of REQ-F-23. Refunds made in the payment gateway portal never reach the store, so the sync cannot see them: an Administrator revokes those by hand (REQ-F-87, E-120). | N/A | High | Clear | Team decision (E-120, E-127) |
| REQ-F-99 | The Administrator shall see on the Store sync screen when the last sync ran and its counts (orders created, updated, revoked and skipped), and shall have a "Sync now" button. For each skipped order the record keeps only the order reference and the reason, with no names or emails (E-149). A failed sync changes no record and shows the error with the date of the last good sync. | N/A | High | Clear. Layout: design | Team decision (E-127) |

### 3.6 Check In and Facility Session

The User does Check In from the phone. Location is a Check In condition, not proof of presence, and the User is not tracked (Proposal:210). Acceptance criterion (Objective 2, Proposal:151-155): every valid Check In creates exactly one active session and one Gym ID; invalid ones create no session; duplicates follow the session rule; every session stops counting when Staff check the person out, 2 hours after Check In, or at a closure.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-33 | The system shall create a session only if the User has a current authorization, location permission is given, the location is inside the gym boundary with enough accuracy, there is a connection, the photo is not marked as pending (REQ-F-94), and the gym is open by its published schedule and closures. Otherwise no session is created and the app shows the cause (outside the boundary, permission denied, location unavailable, accuracy, authorization, new term photo needed, photo pending, connection, gym closed, athletes-only period). The backend reports each cause with a fixed code, and the app writes the text in the account's language. | MVP | High | Clear. Boundary and accuracy: REQ-NF-28. Texts: design | Proposal:210, 458, 460, 573; Team decision (E-74, E-118) |
| REQ-F-36 | A valid Check In shall create exactly one facility session. The session stays open until Staff check the person out, or ends by itself (REQ-F-38). A User never has two active sessions, also under simultaneous requests; the database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (team choice, M-09) | Proposal:155, 210, 365, 416, 462, 511; Team decision (E-115) |
| REQ-F-37 | If the User already has an active session, another Check In shall return the current session and Gym ID without asking for location or creating a session. Location is asked only when a new session must be created. | MVP | High | Clear | Proposal:365, 416 |
| REQ-F-38 | A session shall end in one of these ways: (a) Staff check the person out at the desk (REQ-F-48); (b) 2 hours after the Check In, by backend time, when nobody closed it, with the note "closed automatically"; (c) a published closure or the end of a term ends every active session at once, with the note "closed by closure"; (d) Staff end it early or void it (REQ-F-48). An ended session stops counting toward occupancy. A person may come back the same day: there is no daily limit, and each entry after a check-out counts as a visit. Stepping out briefly (the bathroom, the car) is the same session. The 60 minutes are a guide that Staff apply when the gym is full; the app does not enforce them. | MVP | High | Clear | Proposal:210, 350, 365; Team decision (E-115) |
| REQ-F-82 | During an athletes-only period, the system shall reject Check In by paid members, including Staff-assisted Check In, with a notice. Athletes can do Check In. | N/A | Medium | Pending: list of periods (gym, G-28) | Team decision (E-49) |
| REQ-F-83 | If an athletes-only period starts during a User's active session, the system shall show a notice with the start time of the period, at Check In and while the session is active. Every User sees it, athletes and paid members. An athletes-only period never cuts a session; only a closure or the end of a term ends sessions at once (REQ-F-38). | N/A | Medium | Clear | Team decision (E-76, E-115) |
| REQ-F-90 | During an athletes-only period, the whole User app shall change to a different color theme, so every User sees at a glance that the period is on. The app also shows the period with text and an icon (REQ-NF-14). The gym dashboard keeps its colors. Without a connection, the app shows its normal colors (REQ-NF-26). | N/A | Medium | Clear. Colors: Carlos picks them, and no color means two things (see REQ-F-40) | Team decision (E-76) |
| REQ-F-92 | The User shall be able to open a "My visits" list of their own past Check Ins from the account screen, with their full history. Each row shows the date and time of the Check In. The list never shows the location (REQ-NF-03). Check Ins are kept 5 years (REQ-NF-05). | N/A | Medium | Clear | Team decision (E-105, E-125, E-126) |

### 3.7 Gym ID and Occupancy

The Gym ID is the credential the User shows (Proposal:210). Estimated occupancy is the number of active sessions, not a headcount (Proposal:214). Screens poll the backend; live updates (SSE or WebSockets) are a later improvement, only if CTI allows them and time remains. Acceptance criterion (Objective 3, Proposal:162-166, rewritten for polling): REQ-F-41 and REQ-F-42 hold in every tested state. If live updates are built, the original criterion applies.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-40 | The Gym ID shall show name, photo, authorization, Check In status, a tag with text and an icon ("Athlete" or "Member") with a different color for each, and a moving clock so Staff can tell a live screen from a screenshot. The clock is the time with seconds, as text, changing at most once per second and never flashing (WCAG 2.2.2). It shows no countdown for anyone: an active session shows "Active session" and the Check In time (E-129), and when the session ends it shows why, with text and an icon: checked out, "closed automatically" or "closed by closure". It shows "Authorized athlete" and the term (for example "Authorized athlete, Fall 2026") and does not expire while the term authorization is active. It has no code or QR. | MVP | High | Clear. Tag colors: Carlos picks them | Proposal:153, 210; Team decision (E-75, E-115, E-129) |
| REQ-F-41 | Estimated occupancy shall equal the number of open sessions and shall be recalculated after each Check In, check-out, automatic close, closure or Staff correction. Athletes count like everyone else while their session is open. | MVP | High | Clear | Proposal:164-166, 214; Team decision (E-115) |
| REQ-F-42 | User, Staff and Administrator screens shall show the same occupancy value, compared after each screen has updated. | MVP | High | Clear | Proposal:166, 214 |
| REQ-F-43 | The occupancy and active session screens shall update by polling the backend every 20 to 30 seconds. | N/A | High | Clear | Team decision |

### 3.8 Staff Operations

Staff supervise use and handle exceptions (Proposal:210-212, 218). Acceptance criterion (Objective 4, Proposal:177): Staff can perform the defined supervision and correction tasks.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-44 | Staff shall be able to see active sessions with Check In time, authorization and Gym ID, and to check a person out from the list (REQ-F-48). For a paid member, the list shows the time left before the automatic close (REQ-F-38). For an athlete, it shows "athlete" and the Check In time, with no time left (REQ-F-40). | MVP | High | Clear | Proposal:218, 322; Team decision (E-99, E-115) |
| REQ-F-45 | Staff shall verify a Gym ID against backend data, not only the User's screen: they search the person by name in the active sessions list and compare the photo. For an athlete with no open session, Staff check the roster, which they can see read only (REQ-F-49). | MVP | High | Clear | Proposal:210; Team decision (E-59) |
| REQ-F-46 | Staff shall be able to do a Staff-assisted Check In for an authorized User who is present without a phone. It creates the same session and cannot bypass authorization, create a second active session, or be done for a paid member during an athletes-only period. To find a paid member, Staff search the person by name; no receipt or payment confirmation is needed. An athlete gives the student number. In both cases Staff compare the stored photo with the person. | N/A (in the Objective 2 test plan, Proposal:573) | High | Clear | Proposal:212, 573; Team decision (E-49, E-54) |
| REQ-F-48 | Staff shall be able to check a person out at the desk. A check-out ends the session at the time of the exit and is the routine way a session ends. The session stores which staff account marked the exit, and a check-out writes no audit log entry (E-129). Staff shall also be able to end a session early, as a correction, and to void a session created by mistake. A void keeps the record, and the session stops counting in occupancy and analytics. Staff can check out, end or void only active sessions, so past sessions and past statistics do not change. Staff cannot extend a session or create one without authorization. | MVP | High | Clear. Team to decide later: who fixes a mistake found after the session ended | Proposal:210, 218; Team decision (E-80, E-115) |
| REQ-F-94 | Staff shall be able to mark an account "photo pending" when the stored photo does not match the person at the door. While the mark is set, Check In is refused with its own cause code (REQ-F-33), also Staff-assisted Check In. The person uploads a new photo from their own phone; Staff do not take photos (G-34). This is the one case where a photo is replaced during an active authorization, an exception to REQ-F-26. Whether the new photo clears the mark by itself or Staff must approve it is open. | N/A | Medium | Pending: does the upload clear the mark by itself, or do Staff approve it (team, E-118) | Team decision (E-118) |
| REQ-F-95 | After an outage, an Administrator shall be able to enter the entries of the paper log as manual entries, each with the person and the entry and exit times. People without an account are entered only as a count of visits for a time block, with no names, and are left out of distinct-people counts (E-132). Only Administrators can create them. Each manual entry writes an audit log entry that names who entered it (REQ-NF-39). Manual entries count in statistics and can be filtered out (REQ-F-61). An Administrator voids a wrong manual entry instead of deleting it; a voided entry does not count (E-146). While the app is down, Staff use the paper log and check payment by hand (REQ-NF-31). | N/A | Medium | Clear | Team decision (E-119) |

### 3.9 Athlete Roster

Change from the proposal: Administrators enter the department's athlete lists by hand into one roster. There is no file import, because the department keeps the lists in Word. There is no separate roster permission and no review step: the audit log records every change (REQ-NF-39) and can filter roster changes, so there is no separate roster report (E-126).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-49 | Only Administrators shall be able to add, edit and remove athletes in the roster, by hand. The roster is one list, not one per term, and there is no file import (E-116). An athlete stays on the roster until an Administrator removes them. Staff shall be able to see the roster, read only, and search it by name or student number. If an athlete is removed, the athlete's Gym ID stops being valid at once, the athlete keeps counting in occupancy until the current session ends, and the athlete cannot do another Check In. The removal revokes the athlete's authorization with the reason "removed from roster". If the removal was a mistake, the Administrator uses "Reinstate" on the athlete roster screen, and the revoked authorization becomes active again. Reinstate needs a reason, free text of at least 10 characters, as in REQ-F-87, and is logged (REQ-NF-39). Reinstate is refused with a message when the person already has an active authorization in that term. | Secondary | High | Clear | Proposal:206, 218; Team decision (E-59, E-93, E-95, E-116) |
| REQ-F-51 | Each roster record shall have name, sport, student number and institutional email. A repeated student number is rejected. | Secondary | High | Clear | Proposal:206; Team decision (E-116) |
| REQ-F-100 | The Administrator shall be able to download the whole athlete roster as a Word file or a PDF file, with name, sport, student number and institutional email. Staff cannot download it. | N/A | Medium | Clear | Team decision (E-140) |

### 3.10 Staff Accounts and Permissions

The roles and the permission table are in the Overview. Acceptance criterion (Objective 4, Proposal:173-177, rewritten): every tested action is allowed or denied as in that table. Staff can do the session tasks; Administrators can manage the roster, schedules, closures, staff accounts and backups. The proposal's "Staff access" management is done by inviting and deactivating staff accounts (REQ-F-88).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-52 | There shall be one personal staff account per Staff member and per Administrator, with an email, a password and a role of Staff or Administrator. A staff account is separate from a User account, so a student employee can have both. There is no shared gym account, no PIN and no paper recovery code. The backend shall allow or deny each action by role, as in the Overview role table, even if the interface shows the action. User accounts cannot perform any gym action, and each role has only the access it needs. | Secondary | High | Clear | Proposal:175-177, 305, 509; Team decision (E-114) |
| REQ-F-88 | The install command shall create the first Administrator (REQ-NF-52). The Administrators are the two department secretaries and the department director. Administrators shall be able to invite Staff by email and to deactivate a staff account when the person leaves. A deactivated account cannot sign in and stays in the audit log; deactivating it ends its open sessions at once (E-130). An Administrator can reactivate a deactivated account, which writes an audit log entry (E-150). The system refuses to deactivate the last active Administrator (E-151). Only Administrators give access by hand after seeing a receipt (REQ-F-87), because desk staff change often. | N/A | High | Clear. How the other Administrators are added is not said (team) | Team decision (E-40, E-114, E-123, E-130) |

### 3.11 Facility Information, Schedules and Notices

Today rules and instructions are given in person or on paper (Proposal:218). The gym asked for notices of schedule changes, closures and maintenance (Proposal:104). Acceptance criterion (Objective 4, Proposal:177): the Administrator can manage schedules and closures.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-55 | The Administrator shall be able to publish and edit, and every User shall be able to see: (a) schedules, special hours and closures; (b) athletes-only slots; (c) maintenance notices and other updates; (d) facility information: rules, towel, footwear (including the Crocs and flip-flop restriction), available machines and approved equipment instructions; (e) the gym contact number of REQ-F-73. The regular weekly schedule is written once, and special hours and closures are added for their dates. Schedules and notices are public: anyone can see them without signing in. The notice editor tells the Administrator not to put sensitive data in notices. Publishing a closure ends the active sessions at once (REQ-F-38). Occupancy and analytics need sign in (REQ-F-61). | Secondary | Medium | Clear | Proposal:104, 218; Team decision (E-66, E-90) |
| REQ-F-58 | Texts the gym writes (rules, notices, closures, information) shall have a Spanish version and may have an English version. The English text of a notice is optional: if there is no English version, the Spanish text is shown. The team translates the initial texts and the gym approves them. | N/A | Medium | Clear | Team decision (E-126) |
| REQ-F-59 | The User shall be able to open equipment instructions with a QR code. | Stretch | Low | Clear | Proposal:218, 307 |

### 3.12 Membership and Safety Records

Digital records that replace paper, only as Athletic Activities needs them (Proposal:220). The system is not a medical records system (Proposal:328).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-60 | When the account is created, the User shall accept a liability waiver and give an emergency contact (name and phone). The system stores them with full name and email from the payment record (paid member) or the roster (athlete). Without the waiver the account is not created. The waiver is accepted once and stays valid while the account exists, even if the text changes; the record stores which version of the text was accepted (E-134). No street address, documents or medical warnings are collected. The User can see and edit the emergency contact at any time, and Staff see the current value. The system stores what is needed to show who accepted and when; the fields are set in design. For the Final report, the User also draws a signature when accepting; how it is captured and stored is researched first (E-155). | Secondary | Medium | Clear. G-21 answered: no documents or medical warnings; the department sends the waiver text. On-screen accept now; drawn signature for the Final report (E-155) | Proposal:220, 466; Team decision (E-79, E-134, E-155) |

### 3.13 Utilization Analytics

Analytics are facility statistics with aggregated counts only, no names. This changes the proposal, where only the Administrator reviews them (Proposal:220). Acceptance criterion (Objective 5, Proposal:188): every metric equals its expected value on controlled historical datasets.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-61 | Every signed-in role (User, Staff, Administrator) shall be able to see for a chosen period, picked with buttons for day, week, month, term and year or with a free range from one date to another (E-142): (a) visits per day and per hour, also by week and month, with the peak hour; (b) high- and low-use periods; (c) estimated occupancy over time; (d) average and maximum occupancy; (e) use by athletes, student members and employee members, as three groups (REQ-F-29); manual authorizations (REQ-F-87) count as paid members for every rule (E-126); (f) distinct people, counting repeat visits once; (g) visits per sport, from the sport copied onto each visit at Check In (E-147). A re-entry after a check-out counts as a new visit (REQ-F-38). Manual entries from the paper log (REQ-F-95) are counted and can be filtered out. Voided sessions do not count. A period with no data shows zero, not an error. | Secondary | Medium | Clear. Manual authorizations count in the group the Administrator picked (E-148) | Proposal:186-188, 220; Team decision (E-82, E-115, E-119, E-121, E-126) |
| REQ-F-101 | The Administrator shall be able to download the statistics of REQ-F-61 for the chosen period as a PDF file (charts and totals) or an Excel file (the numbers). The download uses the same period as the screen. Other roles see the statistics on screen only. | N/A | Medium | Clear | Team decision (E-141, E-142) |
| REQ-F-102 | The system shall give the statistics of REQ-F-61 to other services through a read-only REST API that needs a key. The API gives counts only, with no names or other personal data, and never gives the roster. | N/A | Medium | Undefined: how keys are made. No service besides the app is expected to connect for now (E-143) | Team decision (E-143) |

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
| Authorization Number | Code issued with the membership purchase, shown as "Authorization Number" in the Payment Description of the receipt email and kept in the meta field PGPAY_AUTHNUM of the order | Length not checked (6 and 7 characters have been seen, E-153), letters allowed (3 of 69 real orders end in a letter, E-128). Unique across all orders, not only per term (E-128) |
| Receipt email fields | The receipt also has a Reference Number (15 hexadecimal characters), an account number, a transaction date and an amount | Not used for registration. The account number shall not be stored |
| Student number | Student identifier at UPRM | Exactly 10 digits is read as a student number at registration (E-153); roster format TBD (gym) |

### 4.2 Reports

| Report | Content | Who sees it |
|---|---|---|
| Utilization analytics | REQ-F-61 | Every signed-in role |
| Statistics of a chosen period, the end-of-term summary included | REQ-F-101. A download, PDF or Excel | Administrator |
| Athlete roster | REQ-F-100. A download, Word or PDF | Administrator |
| Audit log | REQ-NF-39 | Administrator |
| Store sync | REQ-F-99, REQ-F-22. When the last sync ran and its counts (created, updated, revoked, skipped). Layout: design | Administrator |
| Roster changes | No separate report. The audit log filters roster changes (REQ-NF-39, E-126) | Administrator |

### 4.3 Data Acquisition, Integrity, Retention, and Disposal

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-01 | The database shall be the source of truth, and backend time shall decide the expiration of sessions and authorizations. | N/A | High | Clear | Proposal:350 |
| REQ-NF-03 | Location shall be used only for Check In and shall not be stored as movement history. The validation result may be stored. | N/A | High | Clear | Proposal:210, 511 |
| REQ-NF-04 | The system shall keep only the current photo of each person. When the photo for a new term is uploaded, the previous term's photo is deleted (E-135). The current photo stays while the account is active (REQ-NF-05). The release of a number still deletes the photo with its authorization (REQ-F-74). | N/A | Medium | Clear | Proposal:511; Team decision (E-125) |
| REQ-NF-05 | The system shall keep every kind of data for 5 years: the current photo (older photos are deleted sooner, REQ-NF-04), waivers, emergency contacts, visits (Check Ins), the record of each store sync (REQ-F-99) and the audit log, IP address included, also when an entry mentions a deleted user. This replaces the end-of-term rule for the audit log. How the 5 years are counted (E-131): a User account is deleted, with the anonymizing of REQ-F-09, 5 years after its last sign-in or Check In; while it is active, each visit, sync record and audit log entry is deleted 5 years after it was created, a roster record removed by an Administrator is deleted 5 years after its removal (E-136), authorizations, store orders and paper log counts are deleted 5 years after they were created, a staff account is deleted 5 years after its last deactivation (E-145), and the current waiver, emergency contact and photo stay. Deleted data can remain in the backup copies for up to 4 weeks (REQ-NF-06). Daily statistics totals, with no personal data, are kept forever (E-133). CTI advice: the team wrote a storage growth estimate for the gym and UPRM (E-111, redone on 2026-11-05 with the 5-year rule). | N/A | Medium | Clear | Proposal:328, 466; Team decision (E-125, E-131, E-135, E-145) |
| REQ-NF-06 | The system shall make an automatic backup of the database and the files every two weeks, on a second virtual disk attached to the same VM and asked for in the same CTI request. The two most recent backups are kept. Losing the whole VM loses the backups too; the team accepts that risk. The Administrator panel shall show the date of the last backup and have buttons to make a backup now, to download a backup and to restore a backup already on the server. A downloaded backup is an encrypted file that needs a password to open (E-137). A restore is tested before each milestone. The install command can also restore a backup on a new server (REQ-NF-52). | N/A | Medium | Clear. The written disaster recovery plan is REQ-NF-53 | Proposal:468, 513; Team decision (E-122) |
| REQ-NF-07 | Real WooCommerce data (the read-only key and the orders it returns) shall be used only to test the integration: with permission, only the needed fields, outside git and synced folders, and deleted when the test ends. Development uses fake data. | N/A | Medium | Pending: CTI and team, M-17 | Team decision |
| REQ-NF-09 | Student data shall not be sent to external services without approval. | N/A | High | Pending: CTI, M-11 | Team decision |

## 5. External Interface Requirements

### 5.1 User Interfaces

Screens by role follow the Overview table. Detailed screen design: design phase.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-10 | The interface shall be a mobile-first PWA with one codebase for phone and desktop. Staff and Administrators use a gym dashboard on a path under the same name as the app (E-124), with its own sign-in page; the User sign-in page has no link to it. Each person signs in with their own staff account (REQ-F-52). Staff land on the dashboard. Administrator items are shown only to Administrators, and the backend decides each action by role. There is no PIN dialog, no Lock button, no "Administrator mode" bar and no administration menu screen. A Staff sign-in ends after 2 hours without a person tapping or typing, and an Administrator sign-in after 20 minutes; automatic refreshes of the screen do not count as activity (E-130). | N/A | High | Clear. Team to confirm: the dashboard is a route of this same codebase, not a separate app | Proposal:198, 348; Team decision (E-65, E-102, E-114, E-124, E-130) |

### 5.2 Software Interfaces

- WooCommerce: REST API, wc/v3 orders endpoint, read only, over HTTPS, with a key kept in the server's environment file (REQ-F-28, REQ-F-97). The VM needs outbound HTTPS to the store (2.5).
- Statistics API: a read-only REST API under `/api` that gives the statistics of REQ-F-61 to other services, with a key and no personal data (REQ-F-102).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-11 | Location shall come from the browser's standard Geolocation API, and Check In shall handle the permission state and the reported accuracy. | N/A | High | Clear | Proposal:499-503 |

### 5.3 Communications Interfaces

- Outgoing mail: needed for athlete registration (REQ-F-15, REQ-F-80) and password reset (REQ-F-06, REQ-F-75). Development uses a fake mail server. The team assumes the app has mail (E-61). Production uses the CTI mail gateway as relay, after CTI authorizes the VM. The mail service on the VM (Postfix, as CTI suggests, unless the team picks another) sends through the gateway. The sender is a no-reply address at the app's domain name, which needs no mailbox (E-126); the owner may ask for another address. SPF and DKIM: Pending, CTI (M-07). If CTI does not authorize the VM, the app uses an external mail provider, which needs approval because account emails leave the CTI VM (M-11, REQ-NF-09). No provider is chosen yet.
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

Authentication rules (passwords, sessions, attempt limits) are checked in design against NIST SP 800-63B-4 and OWASP ASVS (see 1.4).

Attempt limits: REQ-F-07 (sign in), REQ-F-15 (athlete link requests), REQ-F-71 (Authorization Number lookups).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-19 | From the Staff dashboard, Staff shall be able to see a User's photo, authorization, waiver acceptance and emergency contact, and no other sensitive data. Staff and the Administrator see the student number in full on every screen they use; only emails are masked (REQ-F-70). | N/A | High | Clear | Proposal:466; Team decision (E-81) |
| REQ-NF-20 | Photos shall be stored in private storage, reachable only through the backend according to role. | N/A | High | Clear | Proposal:466, 511 |
| REQ-NF-21 | The system shall store only these personal data: account email, password, chosen language, the fields of REQ-F-29 and REQ-F-51, the term photo, the waiver and emergency contact (REQ-F-60), the audit log fields (REQ-NF-39), and the name, email, password and language of staff accounts (REQ-F-88). Attempt counters keyed by IP address and email are temporary and are discarded when the wait ends. | N/A | High | Clear | Proposal:466; Team decision (E-91) |
| REQ-NF-23 | Developers shall be outside the gym roles and shall not have routine access to safety or emergency data in production. | N/A | High | Pending: whether team members with sudo on the VM is acceptable, and removing the team's sudo and VPN access at delivery (CTI, M-16, E-110). The two department secretaries look after the system after December (gym, G-01). The access process is answered: CTI gives a sudo account to the owner, who passes it on | Proposal:437, 509 |
| REQ-NF-24 | Uploaded photos shall be JPEG, PNG or HEIC, up to 10 MB. The server converts them to JPEG, shrinks them to about 0.5 MB (about 1,200 pixels on the long side, E-138) and strips location metadata. | N/A | High | Clear | Review gap; Team decision |
| REQ-NF-25 | The system shall show a privacy notice in Spanish and English before collecting personal data. The team drafts it. | N/A | High | Pending: gym approves the text (G-24) | Team decision |
| REQ-NF-51 | Passwords of User accounts and staff accounts shall have at least 10 characters, and the system shall accept at least 64. There are no composition rules (no required mix of letters, numbers or symbols). When a password is set or changed, the system checks it against known compromised passwords with an external service (haveibeenpwned.com, through Laravel's `uncompromised` rule, which uses the k-anonymity model; see 1.4) and rejects a compromised one. The check sends only the first 5 characters of a hash of the password. No student data leaves the VM, so the check is not submitted to M-11 (2.4). Deviation: NIST SP 800-63B-4, section 3.1.1.2, asks for at least 15 characters for passwords used as a single factor; the team chose 10 because people type the password on a phone. | N/A | High | Clear. Staff accounts assumed to follow the same rule (team to confirm). A test covers the case when the external service does not answer | Team decision (E-63, E-98) |

### 6.4 Other Quality Attributes

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-26 | Sign in, authorization, facility sessions, the one-device rule and Gym ID verification shall require a connection. Without one, no session is created, and the app does not show a stored Gym ID or occupancy as if it were current. The app shows a banner at the top that says the data is not current. Schedules, notices, facility information and analytics already loaded stay on screen, each with the time it was last updated. Occupancy shows no number. The Gym ID says it is not valid now, and its clock stops. | N/A | High | Clear | Proposal:460; Review gap; Team decision (E-77) |
| REQ-NF-28 | The location boundary, the accepted accuracy and the gym coordinates shall be set with tests inside and around the gym on iPhone and Android. | N/A | High | Pending: the team measures the values | Proposal:435, 458 |
| REQ-NF-29 | The location boundary shall be configurable per environment. In production it shall never be more than 50 meters from the gym coordinates (REQ-NF-28). The December demo runs in a separate environment with the classroom boundary. | N/A | High | Clear. The 50 meters can change after the gym is measured; the classroom must be farther than 50 meters from the gym | Review gap; Team decision |
| REQ-NF-30 | The main flows shall pass on iPhone with Safari, Android with Chrome, and Windows with Chrome and Edge; macOS and Firefox as a secondary check. | N/A | High | Clear | Proposal:464 |
| REQ-NF-31 | When the system is down, Staff shall use the paper log and check payment by hand. Up to one week down is acceptable. When the app is back, an Administrator enters the paper entries (REQ-F-95). | N/A | Medium | Clear | Review gap; Team decision (E-119) |

## 7. Internationalization and Localization Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-33 | The interface shall be in Spanish by default, and English shall be available for all texts. Each account stores one language. The User chooses it when creating the account and can change it later in the profile preferences. Before an account exists, the welcome and User sign-in screens are in Spanish. A User whose account is in English also sees these two screens in Spanish while signed out; the account language applies after sign in. Each staff account stores its own language, changed in the account's preferences on the dashboard. The User app has no language button in the top bar. | N/A | High | Clear | Team decision (E-64, E-103, E-114) |
| REQ-NF-34 | All frontend and backend texts shall be in translation files from the start. API error texts shall live only in the PWA translation files, and the API shall send only a code. The backend shall translate what does not pass through the PWA, such as emails. | N/A | High | Clear | Team decision (E-154) |
| REQ-NF-35 | Emails shall be sent in the language chosen by the User. | N/A | High | Clear | Team decision |
| REQ-NF-36 | The page language attribute shall change together with the texts (WCAG 3.1.1). | N/A | High | Clear | Review gap |
| REQ-NF-37 | Expiration, term boundaries and analytics (day, week, month) shall use the `America/Puerto_Rico` time zone. | N/A | High | Clear | Review gap |
| REQ-NF-38 | Dates and times shall be shown in the short form of the account language, as in the wireframes, in Puerto Rico time (REQ-NF-37). Spanish: `5 nov 2026, 8:30 a. m.`; English: `Nov 5, 2026, 8:30 AM`. A time from today shows `Hoy` or `Today` instead of the date. | N/A | High | Clear | Team decision (E-22, E-152) |

## 8. Other Requirements

### 8.1 Audit

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-39 | The system shall record in the audit log each: Staff correction (end early, void), Staff-assisted Check In (as an exception), roster change, term or schedule change, store sync (each run, from a scheduled run or "Sync now", with its counts, and each authorization it revokes, REQ-F-98), release of a claimed Authorization Number, manual grant or revoke of an authorization (with its reason), Reinstate of an athlete's authorization (with its reason, REQ-F-49), manual entry from the paper log (REQ-F-95), and each alert from the global lookup limit (REQ-F-71). Each entry has the staff account that made the change (empty for a system alert), time, IP address, device and browser, and the values before and after. The log names the person, because every Staff member and Administrator has their own account. Only Administrators can see the log. Retention: REQ-NF-05. No screen, route or command edits or deletes an entry, not even for the Administrator; entries leave only by the retention rule of REQ-NF-05 (E-108). The sign in and sign out of staff accounts are also logged; User sign-ins are not (REQ-NF-21, E-108). | N/A | High | Clear | Proposal:212, 513; Team decision (E-108, E-114) |
| REQ-F-93 | The Administrator shall be able to search the audit log by staff account, by date range and by action (for example roster changes, which replaces a separate roster report, E-126), and export the result to a CSV or Excel file. | N/A | Medium | Clear | CTI advice; Team decision (E-108) |

### 8.2 Testing

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-40 | There shall be automated unit or database tests for authorization and sessions. | N/A | High | Clear | Proposal:515 |
| REQ-NF-41 | There shall be integration tests from sign in to session creation. | N/A | High | Clear | Proposal:515 |
| REQ-NF-42 | Tests shall show that simultaneous Check In requests and repeated Authorization Number or roster claims produce at most one session or one claim. | N/A | High | Clear | Proposal:462, 573 |
| REQ-NF-43 | Location and PWA behavior shall be tested on real phones. | N/A | High | Clear | Proposal:515 |
| REQ-NF-44 | Each test plan case shall be linked to an objective and shall use controlled datasets. | N/A | High | Clear | Proposal:515, 573-575 |
| REQ-NF-49 | Before the release, gym staff and real users (paid members and athletes) shall run the main flows on their own phones and computers: registration, Check In, Gym ID, Staff-assisted Check In and store sync. The gym records whether each flow is accepted. | N/A | High | Pending: who takes part and when (gym) | Professor feedback |
| REQ-NF-50 | A load test shall run simultaneous Check Ins above the expected peak. At most one session per User shall be created and the occupancy shall stay correct. | N/A | High | Pending: peak number (REQ-NF-15, G-05), fixed in design (team) | Professor feedback |

### 8.3 Legal, Intellectual Property and Privacy

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-46 | Ownership and license of the team's work shall follow UPRM and Capstone policies before a long-term institutional deployment. User and institutional data are not intellectual property of the project. | N/A | Medium | Pending: professor and UPRM, P-05 | Proposal:334-338 |
| REQ-NF-47 | Handling of student data shall comply with the laws and policies UPRM determines apply. FERPA probably applies to UPRM (indication, not confirmed). | N/A | High | Pending: UPRM through CTI, M-15 | Team decision |

### 8.4 Deployment and hand-over

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-52 | The team shall deliver one install command. The team or a technician runs it once, with sudo, on a Rocky Linux 10 server. It installs Docker CE, sets the firewall and SELinux, starts the app, creates the first Administrator (REQ-F-88) and schedules the backups (REQ-NF-06). The same command, with a backup, restores the system on a new server. Administrators never use Docker or the server. | N/A | Medium | Clear | Team decision (E-123); CTI advice |
| REQ-NF-53 | The team shall deliver four manuals, each in Spanish and English: User, Staff, Administrator and Developer (E-126). The Administrator manual explains how to revoke a refunded membership by hand, with a reason (REQ-F-87, E-120), and how to read and use the Store sync screen (REQ-F-99). Proposed, CTI advice: a written disaster recovery plan agreed with the owner (what data is backed up, how often, where copies are kept, and the restore steps), and the step-by-step procedures the gym follows (first account, backups). | N/A | Medium | Pending: the written disaster recovery plan, and removing the team's sudo and VPN access at delivery (team, owner, E-110) | Team decision (E-126); CTI advice |

## Appendix A: Glossary

| Term | Definition |
|---|---|
| Academic term (term) | Period of the UPRM academic calendar with configured start and end dates. The proposal says "semester". A summer term exists only if configured |
| Accuracy | How precise the phone's reported location is, in meters. Check In needs enough accuracy (REQ-NF-28) |
| Administrator | Person with a personal staff account and the Administrator role. The two department secretaries and the department director |
| API | Application Programming Interface: how the frontend talks to the backend, under `/api` |
| Athletes-only period | Schedule slot when only athletes can do Check In |
| Athletic Activities | UPRM Department of Athletic Activities, owner of the need |
| Audit log | Record of gym actions with the staff account, time, IP address, device and what changed |
| Authorization | Permission to use the gym in one term: from a paid order, the roster, or granted by hand |
| Authorization Number | Code (6 or 7 characters seen, length not checked), letters allowed, issued with the membership purchase in WooCommerce and sent by email to the payer. Unique across all orders. Used to register and renew |
| Boundary | Area around the gym inside which Check In is allowed |
| Check In | Action with which the User opens a facility session |
| Check-out | Staff action that ends a person's session at the exit (REQ-F-48) |
| Claim | Linking an Authorization Number or roster record to one account. Each can be claimed once |
| CSV | Comma-Separated Values: text file with values separated by commas |
| CTI | Centro de Tecnologías de Información, the UPRM technology office (https://www.uprm.edu/cti/) |
| DKIM | DomainKeys Identified Mail: signature that proves an email came from an authorized domain |
| DNS | Domain Name System: translates domain names to addresses |
| Estimated occupancy | Number of active facility sessions. Not a headcount |
| Facility session (session) | Period from a valid Check In until Staff check the person out, 2 hours pass ("closed automatically"), or a closure or the end of a term closes it ("closed by closure") (REQ-F-38) |
| FERPA | Family Educational Rights and Privacy Act: U.S. federal law that protects students' education records |
| Staff account | Personal account of a Staff member or an Administrator, with email, password and a role. Separate from a User account |
| Gym ID | Screen in the PWA with name, photo, authorization, an "Athlete" or "Member" tag, Check In status, the Check In time (no countdown, E-129) and a moving clock. No code or QR |
| HTTPS | Encrypted HTTP |
| Manual authorization | Authorization an Administrator grants by hand, until the end of a chosen term, for order errors (REQ-F-87). It counts as a paid member for every rule |
| Manual entry | Paper log entry that an Administrator types into the app after an outage, with the person and the times (REQ-F-95) |
| MVP | Minimum Viable Product: scope validated first (Proposal:295) |
| Paid member | User with a term membership paid in WooCommerce |
| Photo pending | Mark Staff set on an account whose photo does not match the person. Check In is refused until the person uploads a new photo (REQ-F-94) |
| PWA | Progressive Web App: web app that can be installed on the phone |
| Reinstate | Administrator action that makes the revoked authorization of an athlete removed from the roster by mistake active again (REQ-F-49) |
| REST API | Way for one program to read data from another over HTTPS. The app reads the store's orders this way (REQ-F-28) |
| Release | Administrator action that frees a claimed Authorization Number so it can be claimed again |
| Renew | Getting an authorization for a new term on the same account |
| Roster | The one list of the department's athletes, entered by hand by Administrators. Not one list per term (REQ-F-49) |
| SAML | Security Assertion Markup Language: signing in through an external provider |
| Secondary | Scope planned after the MVP in the proposal (Proposal:295). Committed for December (1.3) |
| Sign-in session | A device signed in to an account. Not the same as a facility session |
| SMTP | Simple Mail Transfer Protocol: protocol for sending email |
| SPF | Sender Policy Framework: DNS record that says which servers can send email for a domain |
| Staff | Gym staff, including front desk students, with a personal staff account and the Staff role |
| Staff-assisted Check In | Check In that Staff do for a User who is present without a phone |
| Store sync | Reading the orders of the WooCommerce store: at least 3 times a day, with "Sync now", and at registration for a number the app does not have yet (REQ-F-28, REQ-F-97, REQ-F-99) |
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
| REQ-F-27 | Removed: refunds and cancellations do not exist. Changed by E-120: refunds happen in the payment gateway portal, outside the store, and an Administrator revokes them by hand; the sync revokes a `cancelled` or `refunded` order | 2.5; REQ-F-22, REQ-F-87, REQ-F-98 |
| REQ-F-31 | Removed (E-127, 2026-11-04): re-importing a corrected file and undoing an import are gone, because there is no file to load. A changed order updates its record at the next sync, and a cancelled or refunded one is revoked | REQ-F-28, REQ-F-98 |
| REQ-F-32 | Merged (E-127, 2026-11-04): the API sync, once a Stretch item, is now the way the system reads the store | REQ-F-28, REQ-F-97 |
| REQ-F-34 | Merged: location asked only for a new session | REQ-F-37 |
| REQ-F-35 | Merged: reasons a Check In creates no session | REQ-F-33 |
| REQ-F-39 | Merged: new Check In allowed after expiry | REQ-F-38 |
| REQ-F-47 | Merged: Staff-assisted Check In logged as an exception | REQ-NF-39 |
| REQ-F-50 | Removed: no designated roster Staff and no review step | REQ-F-49, REQ-NF-39 |
| REQ-F-53 | Merged: only PIN holders change the PIN. Now removed with REQ-NF-48 | None (E-114) |
| REQ-F-54 | Removed: Administrator manages athlete authorizations | REQ-F-49, REQ-F-87 |
| REQ-F-56 | Merged: maintenance notices | REQ-F-55 (c) |
| REQ-F-57 | Merged: facility information | REQ-F-55 (d) |
| REQ-F-62 | Merged: high- and low-use periods | REQ-F-61 (b) |
| REQ-F-63 | Merged: occupancy over time | REQ-F-61 (c) |
| REQ-F-64 | Merged: average and maximum occupancy | REQ-F-61 (d) |
| REQ-F-65 | Merged: paid members versus athletes | REQ-F-61 (e) |
| REQ-F-77 | Removed (E-117, 2026-11-04): the in-person registration code is gone. Athletes register only with the link sent to the roster email; if it fails they call the office at 265-3866. Replaces E-62 | REQ-F-15 |
| REQ-F-79 | Merged: Authorization Number field when there is no active authorization | REQ-F-23 |
| REQ-F-81 | Merged: athletes have no time limit; occupancy undercounts them. Replaced by E-115: athletes count like everyone else while their session is open | REQ-F-38, REQ-F-40, REQ-F-41 |
| REQ-F-84 | Merged: mark a slot as athletes only | REQ-F-55 (b) |
| REQ-F-85 | Merged: Staff see waiver and emergency contact | REQ-NF-19 |
| REQ-F-86 | Merged: distinct people | REQ-F-61 (f) |
| REQ-F-89 | Removed (E-114, 2026-11-04): the paper recovery code is gone. Every Staff member and Administrator has a personal account, so there is no shared gym account to recover | REQ-F-52, REQ-F-88 |
| REQ-F-96 | Merged (E-144, 2026-11-05): the end-of-term summary is the statistics download with the term chosen | REQ-F-101 |
| REQ-NF-02 | Merged: uniqueness and one active session enforced in the database | REQ-F-17, REQ-F-36 |
| REQ-NF-08 | Merged: development uses fake data | REQ-NF-07; `context.md` section 3 |
| REQ-NF-17 | Merged: each role has only the access it needs | REQ-F-52 |
| REQ-NF-18 | Moved: server credentials outside the repository (team rule) | `context.md` section 3 |
| REQ-NF-22 | Merged: developer role outside the gym roles | REQ-NF-23 |
| REQ-NF-27 | Merged: no stale data shown as current; the service worker detail moved | REQ-NF-26; `docs/design/design-notes.md` |
| REQ-NF-32 | Moved: reproducible migrations, separate development and production configuration (team rule) | `context.md` section 3 |
| REQ-NF-45 | Moved: changes enter `main` through reviewed pull requests (team rule) | `context.md` section 3 |
| REQ-NF-48 | Removed (E-114, 2026-11-04): there is no PIN. Administrator actions are allowed by role | REQ-F-52, REQ-NF-10 |

## Summary of Open Items

Not discussed in the CTI meeting: the HTTPS certificate and single origin (M-03), disk encryption (M-13), backup retention (M-06), external services (M-11), FERPA (M-15), real data on team PCs (M-17), ports, monitoring and cost.

| Open item | Who answers | Question | Blocks |
|---|---|---|---|
| Outgoing mail: CTI authorizes the VM on its mail gateway (path answered, M-07); external provider only if it does not (E-61) | CTI | M-07, M-11 | REQ-NF-09 if an external provider is used |
| SPF and DKIM for the sender domain: who sets them | CTI | M-07 | REQ-F-06, F-15, F-75, F-80 |
| VM: public IP, HTTPS certificate, single origin, approval conditions, early access | CTI | M-01, M-03, M-04, M-05 | 2.3, 2.4, REQ-NF-12 |
| Users off campus and allowed networks | Gym, then CTI | G-31, M-01 | REQ-NF-16, NF-26, 2.3 |
| Ports and firewall | CTI | M-18 | REQ-NF-12 |
| WooCommerce read-only API key: who at the department's WordPress issues it. Outbound HTTPS from the VM to the store (new CTI question to number in `cti.md`) | Gym, CTI | G-35, M-12 | REQ-F-28, F-97 |
| External services approval | CTI | M-11 | REQ-NF-09 |
| Disk encryption and other CTI storage (data on the VM disk: answered) | CTI | M-13 | REQ-NF-20 |
| Backups: method decided, a second disk on the VM every two weeks (E-122). Still open: the written disaster recovery plan; CTI snapshots not discussed | Team, owner, CTI | M-06, E-110 | REQ-NF-06, NF-53 |
| FERPA | UPRM through CTI | M-15 | REQ-NF-47 |
| Real data limits | CTI, team | M-17 | REQ-NF-07 |
| Server administrator access: process answered; whether team members with sudo is acceptable | CTI, owner | M-16 | REQ-NF-23 |
| Letter case of the Authorization Number: compare ignoring case or not | Team | E-128 | REQ-F-10 |
| Store address (a setting) | Gym | E-92, E-126 | REQ-F-91 |
| Dashboard: same codebase or separate app | Team | E-65 | REQ-NF-10 |
| Name of the app's UPRM subdomain (the dashboard is a path under it, E-124) | Team, owner | E-124 | REQ-NF-10, 2.3 |
| Who fixes a session mistake found after the session ended | Team | E-80 | REQ-F-48 |
| Staff account password follows REQ-NF-51 (assumed) | Team | E-63 | REQ-NF-51 |
| Photo pending: does the new photo clear the mark by itself, or do Staff approve it | Team | E-118 | REQ-F-94 |
| Content and file format of the end-of-term summary (resolved: the statistics download with the term chosen, E-144) | Team | E-141, E-144 | REQ-F-101 |
| How statistics show manual authorizations (resolved: the Administrator picks student or employee, E-148) | Team | E-126, E-148 | REQ-F-61 |
| When the 5 years start and what happens to data after them (resolved: E-131 and E-136; daily totals kept forever, E-133) | Team, UPRM | E-125, E-131 | REQ-NF-05 |
| Store sells only during terms; summer | Gym | G-26 | REQ-F-21, F-22 |
| Athletes-only periods | Gym | G-28 | REQ-F-55, F-82 |
| How the other Administrators are added (resolved: an Administrator invites them by email, E-114); staff session limits (resolved: 2 hours for Staff and 20 minutes for Administrators without activity, deactivation ends sessions at once, E-130) | Team | E-114, E-130 | REQ-F-88 |
| Safety records | Gym | G-21 | REQ-F-60 |
| Privacy notice approval | Gym | G-24 | REQ-NF-25 |
| UPRM confirmation of the 5-year retention rule (the storage estimate is redone, E-111, 2026-11-05) | UPRM | E-111, M-15 | REQ-NF-05 |
| Front desk devices | Gym | G-06 | 2.3 |
| Busiest hour | Gym | G-05 | REQ-NF-15 |
| Availability | Gym | G-07 | REQ-NF-31 |
| Who looks after the system (CTI says it is the owner's question) | Gym | G-01 | REQ-NF-23, NF-31 |
| Location boundary values | Team | None (measure at the gym) | REQ-NF-28 |
| Cookies on iPhone | Team | E-17 | REQ-F-03, F-66 |
| Rubric, deliverables, stack approval | Professor | P-01 to P-03 | 1.3, 2.4 |
| License | Professor, UPRM | P-05 | REQ-NF-46 |
| Stretch inputs | Gym, team | None | REQ-F-67 to F-69 |
| Design details: sign-in waits, lookup limits, link validity, concurrency test number, error texts, Store sync screen layout | Team | Design phase | REQ-F-07, F-15, F-28, F-33, F-71, NF-15 |
