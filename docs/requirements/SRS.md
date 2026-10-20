# Software Requirements Specification

**Project:** UPRM Weight Gym Operations and Member-Access Platform

**Version:** 0.7 draft, not approved

**Authors:** Carlos J. Pepin Delgado, Pierre G Vales Torres, Viviana V Ramos Vivoni

**Organization:** Department of Computer Science and Engineering, University of Puerto Rico at Mayagüez (UPRM)

**Date:** 2026-10-19

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
- **Gym account:** one shared account for the gym, not one per employee. Used **without the PIN** it acts as **Staff** (front desk). Used **with the PIN** it acts as **Administrator** (Athletic Activities administration). The PIN is a secret 4-digit number only the administration knows. It stays open only in the browser where it was typed.
- **Developer:** the project team. Outside the gym roles.

**What each role can do.** The backend enforces this table (REQ-F-52).

| Action | User | Staff (no PIN) | Administrator (PIN) |
|---|---|---|---|
| Register, sign in, Check In, show the Gym ID, renew, delete own account | Yes | No | No |
| See schedules and notices. Anyone can see them, also without signing in (REQ-F-55) | Yes | Yes | Yes |
| See occupancy and facility information (signed in) | Yes | Yes | Yes |
| See facility analytics | Yes | Yes | Yes |
| See active sessions and verify a Gym ID | No | Yes | Yes |
| Staff-assisted Check In; end a session early or void it | No | Yes | Yes |
| See a User's waiver and emergency contact | No | Yes | Yes |
| Give an athlete already on the roster a one-time code to register in person (REQ-F-77) | No | Yes | Yes |
| See the current-term athlete roster, read only (REQ-F-49) | No | Yes | Yes |
| Change the athlete roster; academic terms; WooCommerce import and undo | No | No | Yes |
| Schedules, closures, athletes-only slots, notices, facility information, the gym contact number | No | No | Yes |
| Grant or revoke an authorization by hand; release a claimed Authorization Number | No | No | Yes |
| Delete a User's account when the User asks in person (REQ-F-09) | No | No | Yes |
| See the audit log; change the PIN and the gym account password; generate a new recovery code (REQ-F-89) | No | No | Yes |
| Set a new gym account password and PIN with the recovery code (REQ-F-89) | No | Only with the code | Only with the code |

**Still open.** Pending requirements: REQ-F-10, F-28, F-32, F-49, F-51, F-52, F-58, F-67, F-68, F-69, F-73, F-82, F-91, REQ-NF-04, NF-05, NF-06, NF-07, NF-09, NF-23, NF-25, NF-28, NF-31, NF-46, NF-47. Details: Summary of Open Items.

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

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the December release of the UPRM Weight Gym Operations and Member-Access Platform. It is for the development team and the professor: it says what to build and how to test it.

The baseline is the proposal, in force until further notice. `docs/context.md` lists what changes it and why. If this document and the proposal differ, this document wins, and the difference must appear in `context.md`.

### 1.2 Document Conventions

- IDs: `REQ-F-NN` (functional) and `REQ-NF-NN` (nonfunctional). An ID is never reused or renumbered. A new requirement takes the next free number. A merged or removed requirement is listed in Appendix B with the place where its rule lives now.
- **Proposal priority:** MVP, Secondary or Stretch from the proposal scope table (Proposal:293-310); N/A if it is not in that table.
- **Final priority:** MVP is High, Secondary is Medium, Stretch is Low. Exceptions: a Secondary or N/A row that an MVP flow needs is High; any other N/A row is Medium. High and Medium are committed for December; High is built first. Low is built only if the rest is complete and tested.
- **Status:** **Clear** (can be built and tested now) or **Pending** (information is missing; the cell names who answers and the question ID in `docs/decisions/`).
- **Source:** **Proposal:LINE** (a line of the proposal, see 1.4); **Team decision** (recorded in `context.md` or `docs/decisions/team.md`); **Review gap** (found in the requirements review, not in the proposal); **Professor feedback** (from the grading comments on the proposal).
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
| NIST SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management, final, July 2025 | https://csrc.nist.gov/pubs/sp/800/63/b/4/final | Checked in design for password and session rules. Section 3.1.1.2: password length (REQ-NF-51) |
| Laravel 12.x documentation, Validation, "Validating Passwords" | https://laravel.com/docs/12.x/validation#validating-passwords | Compromised-password check of REQ-NF-51 |
| OWASP Application Security Verification Standard (ASVS), 5.0.0 | https://owasp.org/www-project-application-security-verification-standard/ | Checked in design for authentication and session controls |

## 2. Overall Description

### 2.1 Product Perspective

New product. Today the gym logs on paper, and staff check payment (WooCommerce) or athlete status (department lists) by hand (Proposal:102, 111). There is no count of active users and no usage metrics.

| Related system | Relationship |
|---|---|
| UPRM WooCommerce | Source of truth for payments. The system imports Export Orders files and does not process payments (Proposal:369-371) |
| Department athlete lists | Administrators digitize them each term into the roster (Team decision) |
| User's browser | Provides location through the Geolocation API (Proposal:499-503) |
| Outgoing mail server | Sends athlete registration links and password reset links. The team assumes mail is available (E-61): CTI mail first, an external provider if CTI cannot give it (CTI, M-07) |
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
- CTI services only. No Supabase and no Vercel (Team decision, E-07). Two exceptions. An external mail provider, used only if CTI has no outgoing mail (E-61), needs approval (M-11, REQ-NF-09). The compromised-password check of REQ-NF-51 calls haveibeenpwned.com and sends no student data: only the first 5 characters of a hash of the password leave the VM, with no name, email, photo or full password. It is not submitted to M-11 (E-98).
- One shared gym account with a single PIN. No per-person gym accounts.
- No street address is collected or stored anywhere.
- Minimum cost for the gym; rely on CTI where possible.
- No offline Check In (Proposal:460).

### 2.5 Assumptions and Dependencies

| Depends on | What is assumed | If it fails | Question |
|---|---|---|---|
| CTI | VM with containers, subdomain and HTTPS | No production in December | M-01 to M-05 |
| CTI | Outgoing mail from the VM. The email-link flows (REQ-F-06, REQ-F-15, REQ-F-80) are built | The app uses an external mail provider, so account emails leave the CTI VM. That needs approval (REQ-NF-09) | M-07, M-11 |
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
| REQ-F-06 | The User shall be able to reset their password with a link sent to the account email. The answer to a reset request is the same whether or not the email has an account. | N/A | High | Clear. Mail assumed available (2.5, E-61) | Review gap; Team decision (E-63) |
| REQ-F-07 | After 10 failed sign-in attempts, counted per account and per IP address, the system shall make that account or IP address wait, and the wait shall grow with each lockout. The rejection says when to try again. | N/A | High | Clear. Exact waits: design | Review gap |
| REQ-F-09 | A User with no active authorization shall be able to delete their account from the app. An Administrator can do the same deletion when the User asks, after checking the person's identification in person at the gym. The system deletes the personal data and photos and keeps only anonymous Check In counts. Audit log entries that mention the user stay until the end of their term (REQ-NF-39), and distinct-people counts already computed (REQ-F-61) do not change. | N/A | Medium | Clear | Review gap; Team decision (E-89) |

Errors not covered above: wrong credentials are rejected without saying whether the email exists; a deletion request with an active authorization is rejected with the reason.

### 3.2 Paid Member Registration

The paid member registers with the Authorization Number, the 6-digit value in the "Payment Description" of the WooCommerce receipt email (Proposal:204). The account email is always the payment email of that order. There is no email verification: the number reached the payer by email, and that is the check (E-09). Because 6 digits can be guessed, REQ-F-71 to REQ-F-75 add protections. Acceptance criterion: Objective 1 (Proposal:140-144), cases of valid, expired and missing membership.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-10 | The system shall validate the Authorization Number against the membership records imported from WooCommerce for the current term only. The number is unique per term: the same number can appear in another term. If a number matches two orders of the current term (a safety check: the per-term unique key and the import already prevent it), the lookup is denied with the contact number of REQ-F-73. | MVP | High | Pending: Carlos checks the sample Export Orders file (columns, how the term comes from the payment date, whether two orders in one file share a number) (team, E-55) | Proposal:204, 371; Team decision (E-71) |
| REQ-F-11 | The paid member's account email shall be the payment email of the WooCommerce record. The member shall not type or change it. | MVP | High | Clear | Proposal:204; Team decision |
| REQ-F-13 | On registration, the User (paid member or athlete) shall create a password and give a current photo, taken with the camera at that moment or uploaded as a file. The screen says that the photo cannot be changed later (REQ-F-26). The account and the claim of the Authorization Number or roster record are saved together, in one step, only after the photo is saved. If the photo fails, nothing is claimed and the number or record stays free. | MVP | High | Clear | Proposal:202, 204, 206; Team decision (E-69) |
| REQ-F-70 | As soon as a valid, unclaimed Authorization Number is entered, the system shall show the payment email of that order masked: the first and last letter before the @ stay visible (for example `m***z@upr.edu`). The athlete's institutional email is masked the same way. | N/A | High | Clear | Team decision (E-72) |
| REQ-F-71 | The system shall limit failed Authorization Number lookups per IP address: when that limit is hit, lookups from that IP address pause for a time. A global limit on failed lookups never blocks registrations: it only slows each lookup and writes an alert entry in the audit log for the Administrator. | N/A | High | Clear. Values: design | Team decision (E-53) |
| REQ-F-72 | The system shall show the same message when an Authorization Number is invalid, already claimed or from an ended term, with the contact number of REQ-F-73. | N/A | High | Clear | Team decision (E-71) |
| REQ-F-73 | When an Authorization Number or a student number does not match a valid record, the system shall show the contact number of someone who can help. | N/A | High | Pending: the number (gym, G-25) | Team decision |
| REQ-F-74 | An Administrator shall be able to release an Authorization Number claimed by mistake. The release removes only that authorization and its term photo. The account, its other authorizations and its history stay, also when that claim created the account (except the open case of an account whose only authorization is released). The number can be claimed again. | N/A | Medium | Clear. Team to confirm: whether the account stays when the released authorization was its only one and the account has no other data | Team decision (E-52, E-57, E-87) |
| REQ-F-75 | If someone else claimed a member's Authorization Number, the real owner shall be able to take the account back with the password reset (REQ-F-06), because the account email is the payment email. If the number was added to an account with another email (REQ-F-78), the reset does not help: the real owner contacts the gym, and the Administrator releases the number (REQ-F-74). | N/A | High | Clear. Mail assumed available (2.5, E-61) | Team decision (E-70) |
| REQ-F-91 | The welcome screen and the registration screens (paid member and athlete) shall say, before the person starts, that registering needs a paid membership or a place on the athlete roster, and shall show the contact number of REQ-F-73. The welcome screen and the paid member registration screen shall also offer a way to the WooCommerce store, where paid members buy the membership. The athlete registration screen has no store option, because athletes do not buy (REQ-F-25). Proposed: the store option appears only while a term runs (G-26). | N/A | Medium | Pending: the store address, and whether it is a button that opens the store or an automatic redirect (team, gym) | Team decision (E-92, E-96) |

Errors not covered above: an Authorization Number from an ended term cannot be used to register (message: REQ-F-72).

### 3.3 Athlete Registration

The athlete registers with the student number, looked up in the roster that Administrators enter (Proposal:206). The student number is not secret, so the account is created only after the athlete opens a link sent to the institutional email in the roster. Acceptance criterion: Objective 1, cases of valid and invalid athlete and user with no match (Proposal:142).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-15 | The athlete shall register with their student number, which the system looks up in the current-term roster. The system sends a link to the institutional email in that roster record. On the page the link opens, the athlete sets the password, the photo (REQ-F-13) and the waiver (REQ-F-60), and the system saves them together and creates the account. Link requests are limited per student number: 1 every 5 minutes and 5 per day. | MVP | High | Clear. Mail assumed available (2.5, E-61) | Proposal:206; Team decision (E-69, E-73) |
| REQ-F-17 | Each roster record and each Authorization Number shall be claimable by only one account, also under simultaneous requests. The database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (CTI, M-09) | Proposal:206, 371, 462, 511 |
| REQ-F-76 | If the student number is not in the current-term roster, the system shall say that the person does not appear as a registered athlete and must go to the Department of Athletic Activities to be registered or to check for an error, with the contact number of REQ-F-73. | N/A | High | Clear | Team decision |
| REQ-F-77 | Staff shall be able to help an athlete who is in the current-term roster register in person, after checking identification. Staff generate a one-time code that is valid for 15 minutes. The athlete enters it on their own phone and sets the password, photo and waiver there. Staff do not enter data for the athlete, cannot register a person who is not on the roster, and cannot add roster records. This tool exists even though the app has outgoing mail. | N/A | High | Clear | Team decision (E-62) |

Errors not covered above: an expired or already used link creates no account (link validity: design); a roster record that is already claimed is refused with the contact number.

### 3.4 Authorization, Academic Terms and Renewal

The authorization says whether the person has access in the current term. A User can have several authorizations over time (Proposal:356, 361). Term dates come from the UPRM academic calendar. An athlete on the current-term roster has nothing to renew; a paid member renews with a new Authorization Number. Acceptance criterion (Objective 1, Proposal:144): every User with a valid authorization is approved and every User without one is denied.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-18 | If a WooCommerce or roster record cannot be verified, the system shall deny the registration, renewal or Check In that depends on it. | MVP | High | Clear | Proposal:513 |
| REQ-F-19 | The authorization shall be stored separately from the account, and a User can have several authorizations over time, but at most one active authorization per term. A revoked authorization does not block a new grant or claim in the same term. | MVP | High | Clear | Proposal:350, 356; Team decision (E-68, E-94) |
| REQ-F-20 | The User shall be able to move between paid-member and athlete authorization without losing the account or the Check In history, by adding the new authorization from inside the existing account (REQ-F-23, REQ-F-80). The account email does not change, no new account is created, and staff do not merge accounts. | MVP | High | Clear | Proposal:202, 356, 406; Team decision |
| REQ-F-21 | The Administrator shall be able to create and edit academic terms with a start date and an end date from the UPRM academic calendar. Terms never overlap: on save, the system rejects dates that overlap another term. Gaps between terms are allowed. | N/A | High | Clear | Proposal:350, 361; Team decision (E-48) |
| REQ-F-22 | Each authorization shall expire at the end of its term, whatever the purchase date. An order belongs to the term that contains its payment date. An order dated outside every term gives no authorization and is listed in the import result. An athlete authorization also ends when the athlete is removed from the roster (REQ-F-49). A record belongs to the term it was given, even if the term dates change later. The Administrator can edit a term even when its orders or athletes fall outside the new dates. If the end date changes, the authorizations of that term end on the new date. | MVP | High | Clear. Gym to confirm the store sells only while a term runs (G-26) | Proposal:361; Team decision (E-88) |
| REQ-F-23 | When the authorization expires, the system shall keep the account and disable Check In. A User with no active authorization sees a banner at the top and the Check In button grayed out. If the authorization expired, the banner says so and asks the User to renew. For any other cause (revoked, import undone, number released, no current term), the banner says the User has no active authorization and shows the contact number of REQ-F-73. Under both banners the screen shows "I am an athlete" (REQ-F-80) and the Authorization Number field, used to renew, to become a paid member, or to claim a number again after an import undo or a release (REQ-F-31, REQ-F-74). If the number cannot be claimed, the User gets the message of REQ-F-72. The User still sees the schedules, notices, facility information and analytics. | MVP | High | Clear. Banner texts: wireframes | Proposal:204; Team decision (E-50, E-67, E-97, E-100) |
| REQ-F-25 | The athlete shall renew through the roster for the new term, with no purchase or Authorization Number. | MVP | High | Clear | Proposal:206, 218, 321 |
| REQ-F-26 | The User shall give a current photo for each term (at registration and at each renewal) and shall not be able to replace it during an active authorization. The first time an athlete opens the app during a new term, the system looks up the current-term roster by the student number of the account's last roster claim. If the athlete is there, the system keeps the same account and history and asks for the new photo before Check In is allowed. A User with a manual authorization (REQ-F-87) is also asked for the term photo before Check In. | MVP | High | Clear | Proposal:202, 426; Team decision (E-69) |
| REQ-F-78 | A signed-in User who enters a valid Authorization Number shall get the new authorization on that account, and no new account is created, even if the payment email is different. This is how a paid member renews. If a person who is not signed in enters a number whose payment email already has an account, the system shows that email masked (REQ-F-70) and asks the person to sign in and add the number from the account. Nothing is claimed. The same applies to an athlete whose roster email already has an account. | N/A | High | Clear | Proposal:320; Team decision (E-70) |
| REQ-F-80 | A signed-in User with no active authorization shall be able to enter a student number ("I am an athlete"). The option is hidden while the User has an active authorization. If the number is in the current-term roster and unclaimed, the system sends a link to the institutional email in that roster record, as in REQ-F-15. It links the record to the account only when the link is opened and the term photo is saved on that page, so there is never an authorization without a photo. Otherwise it shows the message of REQ-F-76. The link request limit of REQ-F-15 applies. | N/A | High | Clear. Mail assumed available (2.5, E-61) | Team decision (E-58, E-68, E-69, E-73) |
| REQ-F-87 | An Administrator shall be able to grant an authorization by hand to an existing account, valid until the end of a chosen term, and to revoke an authorization. It is used for order errors and gives access without a WooCommerce payment record. A grant is rejected if the account already has an active authorization for that term (REQ-F-19). A reason of at least 10 characters is required for a grant or a revoke and is logged (REQ-NF-39). The User gives the term photo before Check In (REQ-F-26). | N/A | Medium | Clear | Team decision (E-68, E-69, E-86, E-94) |

Errors not covered above: with no term configured for the current date, no new authorization is created. Every Administrator screen shows a notice that no term covers today, and each error caused by it gives that reason (E-85).

### 3.5 WooCommerce Import

WooCommerce stays the source of payments; the system copies only what is needed to authorize (Proposal:369-371). There are no refunds or cancellations, so the import handles only new and corrected orders. Acceptance criterion, adapted from Proposal:456: re-importing creates no duplicates, and corrected orders update the authorization. The proposal's mention of refunded and cancelled orders no longer applies.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-28 | The Administrator shall be able to load membership data from a WooCommerce Export Orders file. A file with an unexpected format imports nothing. A second order with the same Authorization Number in the same term is rejected (REQ-F-10). The import result lists orders created, updated and rejected. It is saved with the import, with every created, updated and rejected row, so the Administrator can open it again later. | MVP | High | Pending: file format and columns (team, E-55). How long these rows are kept: REQ-NF-05 | Proposal:369, 371; Team decision (E-71, E-84) |
| REQ-F-29 | The import shall copy only name, email, student number when present, membership details, Authorization Number, order reference, status, payment date, term (from the payment date) and last synchronization time. It shall not copy billing or address data. | MVP | High | Clear | Proposal:204, 371 |
| REQ-F-30 | Processing the same order more than once shall update or confirm the same record, without duplicates. | MVP | High | Clear | Proposal:371, 456 |
| REQ-F-31 | The Administrator shall be able to re-import a corrected file (reconciliation) and to undo any import at any time. Undo deletes the membership records that import brought, the authorizations that depend on them, and the term photos of those authorizations. Accounts stay, and people claim again, with a new photo, when the corrected file is imported. Undo is allowed even after people did Check In with those authorizations: active sessions keep counting until they end, and the confirmation shows how many authorizations, sessions and photos the undo affects, without blocking it. Undo does not revert changes that the import made to records created by earlier imports. | MVP | High | Clear | Proposal:371; Team decision (E-57, E-84) |
| REQ-F-32 | The system shall be able to synchronize with WooCommerce through approved API or webhook access, updating the same local records. | Stretch | Low | Pending: CTI, M-12 | Proposal:307, 371 |

### 3.6 Check In and Facility Session

The User does Check In from the phone. Location is a Check In condition, not proof of presence, and the User is not tracked (Proposal:210). Acceptance criterion (Objective 2, Proposal:151-155): every valid Check In creates exactly one active session and one Gym ID; invalid ones create no session; duplicates follow the session rule; every session stops counting after 60 minutes.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-33 | The system shall create a session only if the User has a current authorization, location permission is given, the location is inside the gym boundary with enough accuracy, there is a connection, and the gym is open by its published schedule and closures. Otherwise no session is created and the app shows the cause (outside the boundary, permission denied, location unavailable, accuracy, authorization, new term photo needed, connection, gym closed, athletes-only period). The backend reports each cause with a fixed code, and the app writes the text in the account's language. | MVP | High | Clear. Boundary and accuracy: REQ-NF-28. Texts: design | Proposal:210, 458, 460, 573; Team decision (E-74) |
| REQ-F-36 | A valid Check In shall create exactly one 60-minute session. A User never has two active sessions, also under simultaneous requests; the database enforces this, not only the frontend. | MVP | High | Clear. Design assumes PostgreSQL (CTI, M-09) | Proposal:155, 210, 365, 416, 462, 511 |
| REQ-F-37 | If the User already has an active session, another Check In shall return the current session and Gym ID without asking for location or creating a session. Location is asked only when a new session must be created. | MVP | High | Clear | Proposal:365, 416 |
| REQ-F-38 | The session shall expire 60 minutes after it starts, by backend time, with no checkout. It then stops counting toward occupancy, and a new valid Check In can create a new session. Expiry never makes anyone leave the gym: for athletes the 60 minutes are only a counting rule, with no time limit in the gym. | MVP | High | Clear | Proposal:210, 350, 365; Team decision |
| REQ-F-82 | During an athletes-only period, the system shall reject Check In by paid members, including Staff-assisted Check In, with a notice. Athletes can do Check In. | N/A | Medium | Pending: list of periods (gym, G-28) | Team decision (E-49) |
| REQ-F-83 | If an athletes-only period starts during a User's active session, the system shall show a notice with the start time of the period, at Check In and while the session is active. Every User sees it, athletes and paid members. The session is never cut. | N/A | Medium | Clear | Team decision (E-76) |
| REQ-F-90 | During an athletes-only period, the whole User app shall change to a different color theme, so every User sees at a glance that the period is on. The app also shows the period with text and an icon (REQ-NF-14). The gym dashboard keeps its colors. Without a connection, the app shows its normal colors (REQ-NF-26). | N/A | Medium | Clear. Colors: Carlos picks them, and no color means two things (see REQ-F-40) | Team decision (E-76) |

### 3.7 Gym ID and Occupancy

The Gym ID is the credential the User shows (Proposal:210). Estimated occupancy is the number of active sessions, not a headcount (Proposal:214). Screens poll the backend; live updates (SSE or WebSockets) are a later improvement, only if CTI allows them and time remains. Acceptance criterion (Objective 3, Proposal:162-166, rewritten for polling): REQ-F-41 and REQ-F-42 hold in every tested state. If live updates are built, the original criterion applies.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-40 | The Gym ID shall show name, photo, authorization, Check In status, a tag with text and an icon ("Athlete" or "Member") with a different color for each, and a moving clock so Staff can tell a live screen from a screenshot. The clock is the time with seconds, as text, changing at most once per second and never flashing (WCAG 2.2.2). For a paid member, it shows the minutes left in the session, and after 60 minutes it shows "expired" with text and an icon. For an athlete, it never shows minutes left. It shows "Authorized athlete" and the term (for example "Authorized athlete, Fall 2026") and does not expire while the term authorization is active. It has no code or QR. | MVP | High | Clear. Tag colors: Carlos picks them | Proposal:153, 210; Team decision (E-75) |
| REQ-F-41 | Estimated occupancy shall equal the number of active sessions and shall be recalculated after each Check In, expiration or Staff correction. Athletes count only during their 60-minute session, so athletes who stay longer are not counted. | MVP | High | Clear | Proposal:164-166, 214; Team decision |
| REQ-F-42 | User, Staff and Administrator screens shall show the same occupancy value, compared after each screen has updated. | MVP | High | Clear | Proposal:166, 214 |
| REQ-F-43 | The occupancy and active session screens shall update by polling the backend every 20 to 30 seconds. | N/A | High | Clear | Team decision |

### 3.8 Staff Operations

Staff supervise use and handle exceptions (Proposal:210-212, 218). Acceptance criterion (Objective 4, Proposal:177): Staff can perform the defined supervision and correction tasks.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-44 | Staff shall be able to see active sessions with Check In time, authorization and Gym ID. For a paid member, the list shows the minutes left in the session. For an athlete, it shows "athlete" and the Check In time, with no minutes left (REQ-F-40). | MVP | High | Clear | Proposal:218, 322; Team decision (E-99) |
| REQ-F-45 | Staff shall verify a Gym ID against backend data, not only the User's screen: they search the person by name in the active sessions list and compare the photo. For an athlete whose 60 minutes ended, Staff check the current-term roster, which they can see read only (REQ-F-49). | MVP | High | Clear | Proposal:210; Team decision (E-59) |
| REQ-F-46 | Staff shall be able to do a Staff-assisted Check In for an authorized User who is present without a phone. It creates the same 60-minute session and cannot bypass authorization, create a second active session, or be done for a paid member during an athletes-only period. To find a paid member, Staff search the person by name; no receipt or payment confirmation is needed. An athlete gives the student number. In both cases Staff compare the stored photo with the person. | N/A (in the Objective 2 test plan, Proposal:573) | High | Clear | Proposal:212, 573; Team decision (E-49, E-54) |
| REQ-F-48 | Staff shall be able to end a session early and to void a session created by mistake. A void keeps the record, and the session stops counting in occupancy and analytics. Staff can end or void only active sessions, so past sessions and past statistics do not change. Staff cannot extend a session or create one without authorization. | MVP | High | Clear. Team to decide later: who fixes a mistake found after the session ended | Proposal:210, 218; Team decision (E-80) |

### 3.9 Athlete Roster

Change from the proposal: Administrators (PIN holders) digitize the department's athlete lists each term. There is no separate roster permission and no review step; the audit log records every change.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-49 | Only Administrators shall be able to create, import and change the athlete roster for each term. Staff shall be able to see the current-term roster, read only, and search it by name or student number. If an athlete is removed mid-term, the athlete's Gym ID stops being valid at once, the athlete keeps counting in occupancy until the current session ends, and the athlete cannot do another Check In. The removal revokes the athlete's authorization with the reason "removed from roster". If the removal was a mistake, the Administrator uses "Reinstate" on the athlete roster screen, and the revoked authorization becomes active again. Reinstate needs a reason, free text of at least 10 characters, as in REQ-F-87, and is logged (REQ-NF-39). Reinstate is refused with a message when the person already has an active authorization in that term. | Secondary | High | Pending: format of the lists (gym, G-10); Staff read access (gym, G-09) | Proposal:206, 218; Team decision (E-59, E-93, E-95) |
| REQ-F-51 | Each roster record shall have at least student number, name, institutional email and term. A repeated student number in the same term is rejected. | Secondary | High | Pending: final list of fields (gym, G-10) | Proposal:206; Team decision |

### 3.10 Gym Account, PIN and Permissions

The roles and the PIN table are in the Overview. Acceptance criterion (Objective 4, Proposal:173-177, rewritten): every tested action is allowed or denied as in that table. Staff can do the session tasks; Administrators can manage the roster, schedules, closures and the PIN. The proposal's "Staff access" management is done by changing the gym account password (REQ-F-88).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-52 | There shall be one shared gym account. The backend shall allow or deny each action as in the Overview role table, even if the interface shows the action. User accounts cannot perform any gym action, and each role has only the access it needs. | Secondary | High | Pending: gym confirms the table (G-09) | Proposal:175-177, 305, 509; Team decision |
| REQ-F-88 | The team shall create the gym account, its password, the first PIN and the first recovery code (REQ-F-89) once, with an install command on the server, and give them to the Administrator. After that, the Administrator changes the password and the PIN from the app, using the current PIN. Changing the password is how access is withdrawn when an employee leaves. | N/A | High | Clear | Team decision (E-40, E-60) |
| REQ-F-89 | The system shall keep one recovery code for the gym account. The system generates it, shows it only once and stores it hashed. The code has 12 characters in 3 groups of 4, letters and numbers without look-alike characters (no 0 and O, no 1 and l), and is accepted with or without hyphens and in any case. With it, a person can set a new gym account password and a new PIN from the gym sign-in screen. The code is then used up and a new one is shown once. The person retypes the new code to continue and then signs in again. The Administrator, with the PIN, can also generate a new code at any time: the old code stops working, the new one is shown once and retyped to confirm, and the audit log records only that the code changed. Attempts are limited and each use is logged (REQ-NF-39). If the code is lost and nobody can enter the PIN, only the install command on the server remains. | N/A | Medium | Clear. Attempt limit: design. Gym to confirm (G-09) | Team decision (E-60, E-78); Review gap |

### 3.11 Facility Information, Schedules and Notices

Today rules and instructions are given in person or on paper (Proposal:218). The gym asked for notices of schedule changes, closures and maintenance (Proposal:104). Acceptance criterion (Objective 4, Proposal:177): the Administrator can manage schedules and closures.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-55 | The Administrator shall be able to publish and edit, and every User shall be able to see: (a) schedules, special hours and closures; (b) athletes-only slots; (c) maintenance notices and other updates; (d) facility information: rules, towel, footwear (including the Crocs and flip-flop restriction), available machines and approved equipment instructions; (e) the gym contact number of REQ-F-73. The regular weekly schedule is written once, and special hours and closures are added for their dates. Schedules and notices are public: anyone can see them without signing in. The notice editor tells the Administrator not to put sensitive data in notices. Occupancy and analytics need sign in (REQ-F-61). | Secondary | Medium | Clear | Proposal:104, 218; Team decision (E-66, E-90) |
| REQ-F-58 | Texts the gym writes (rules, notices, closures, information) shall have a Spanish and an English version. If there is no English version, the Spanish text is shown. The team translates the initial texts and the gym approves them. | N/A | Medium | Pending: English for notices after December (gym, G-27) | Team decision |
| REQ-F-59 | The User shall be able to open equipment instructions with a QR code. | Stretch | Low | Clear | Proposal:218, 307 |

### 3.12 Membership and Safety Records

Digital records that replace paper, only as Athletic Activities needs them (Proposal:220). The system is not a medical records system (Proposal:328).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-60 | When the account is created, the User shall accept a liability waiver and give an emergency contact (name and phone). The system stores them with full name and email from the payment record (paid member) or the roster (athlete). Without the waiver the account is not created. The waiver is accepted once and stays valid while the account exists, even if the text changes. No street address, documents or medical warnings are collected. The User can see and edit the emergency contact at any time, and Staff see the current value. | Secondary | Medium | Clear. Gym to confirm no documents or medical warnings (G-21) | Proposal:220, 466; Team decision (E-79) |

### 3.13 Utilization Analytics

Analytics are facility statistics with aggregated counts only, no names. This changes the proposal, where only the Administrator reviews them (Proposal:220). Acceptance criterion (Objective 5, Proposal:188): every metric equals its expected value on controlled historical datasets.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-F-61 | Every signed-in role (User, Staff, Administrator), without the PIN, shall be able to see for a chosen period: (a) visits by hour, day, week and month; (b) high- and low-use periods; (c) estimated occupancy over time; (d) average and maximum occupancy; (e) use by paid members, athletes and manual authorizations (REQ-F-87), as three groups; (f) distinct people, counting repeat visits once. Voided sessions do not count. A period with no data shows zero, not an error. | Secondary | Medium | Clear | Proposal:186-188, 220; Team decision (E-82) |

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
| Authorization Number | Number issued with the membership purchase, shown as "Authorization Number" in the Payment Description of the receipt email | 6 digits (from one sample receipt). Unique per term; the same number can appear in another term (E-71). Whether two orders in one file share a number: to check with the sample file (E-55) |
| Receipt email fields | The receipt also has a Reference Number (15 hexadecimal characters), an account number, a transaction date and an amount | Not used for registration. The account number shall not be stored |
| Student number | Student identifier at UPRM | TBD (gym) |

### 4.2 Reports

| Report | Content | Who sees it |
|---|---|---|
| Utilization analytics | REQ-F-61 | Every signed-in role |
| Audit log | REQ-NF-39 | Administrator |
| Import result | REQ-F-28, REQ-F-22. Saved with the import, with every created, updated and rejected row, and opened again from the list of imports. Layout: design | Administrator |
| Roster changes per term | Roster changes from the audit log. Optional | Pending: gym, G-30 |

### 4.3 Data Acquisition, Integrity, Retention, and Disposal

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-01 | The database shall be the source of truth, and backend time shall decide the expiration of sessions and authorizations. | N/A | High | Clear | Proposal:350 |
| REQ-NF-03 | Location shall be used only for Check In and shall not be stored as movement history. The validation result may be stored. | N/A | High | Clear | Proposal:210, 511 |
| REQ-NF-04 | The system shall discard photos from earlier terms, unless UPRM requires keeping them. | N/A | Medium | Pending: gym and UPRM, G-03 | Proposal:511 |
| REQ-NF-05 | The system shall apply retention rules by data type: photos, waivers, emergency contacts, Check Ins, rows of saved import results (REQ-F-28) and audit log. Each audit log entry, IP address included, is kept until the end of the term in which it happened, also when it mentions a deleted user. | N/A | Medium | Pending: every period except the audit log (gym and UPRM, G-03, M-15) | Proposal:328, 466; Team decision |
| REQ-NF-06 | There shall be backups of the database and the files, kept outside the VM, and a tested restore before each milestone. | N/A | Medium | Pending: CTI and team, M-06 | Proposal:468, 513 |
| REQ-NF-07 | Real WooCommerce data shall be used only to test the integration: with permission, only the needed fields, outside git and synced folders, and deleted when the test ends. Development uses fake data. | N/A | Medium | Pending: CTI and team, M-17 | Team decision |
| REQ-NF-09 | Student data shall not be sent to external services without approval. | N/A | High | Pending: CTI, M-11 | Team decision |

## 5. External Interface Requirements

### 5.1 User Interfaces

Screens by role follow the Overview table. Detailed screen design: design phase.

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-10 | The interface shall be a mobile-first PWA with one codebase for phone and desktop. Staff and the Administrator use a gym dashboard on its own address, with its own sign-in page; the User sign-in page has no link to it. Staff land on the dashboard. Administrator items appear to Staff grayed out with a padlock; tapping one asks for the PIN and unlocks the item on the same screen. | N/A | High | Clear. Team to confirm: the dashboard is a route of this same codebase, not a separate app; whether a Lock button returns to Staff mode | Proposal:198, 348; Team decision (E-65) |

### 5.2 Software Interfaces

- WooCommerce: Export Orders file (REQ-F-28); format TBD until an authorized export is seen. API or webhook: Stretch (REQ-F-32).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-11 | Location shall come from the browser's standard Geolocation API, and Check In shall handle the permission state and the reported accuracy. | N/A | High | Clear | Proposal:499-503 |

### 5.3 Communications Interfaces

- Outgoing mail: needed for athlete registration (REQ-F-15, REQ-F-80) and password reset (REQ-F-06, REQ-F-75). Development uses a fake mail server. The team assumes the app has mail (E-61). Production uses CTI SMTP or relay first, with sender address, SPF and DKIM (CTI, M-07). If CTI cannot give mail, the app uses an external mail provider, which needs approval because account emails leave the CTI VM (M-11, REQ-NF-09). No provider is chosen yet.
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

Attempt limits: REQ-F-07 (sign in), REQ-F-15 (athlete link requests), REQ-F-71 (Authorization Number lookups), REQ-F-89 (recovery code), REQ-NF-48 (PIN).

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-19 | From the Staff dashboard, Staff shall be able to see a User's photo, authorization, waiver acceptance and emergency contact, and no other sensitive data. Staff and the Administrator see the student number in full on every screen they use; only emails are masked (REQ-F-70). | N/A | High | Clear | Proposal:466; Team decision (E-81) |
| REQ-NF-20 | Photos shall be stored in private storage, reachable only through the backend according to role. | N/A | High | Clear | Proposal:466, 511 |
| REQ-NF-21 | The system shall store only these personal data: account email, password, chosen language, the fields of REQ-F-29 and REQ-F-51, the term photo, the waiver and emergency contact (REQ-F-60), and the audit log fields (REQ-NF-39). Attempt counters keyed by IP address and email are temporary and are discarded when the wait ends. | N/A | High | Clear | Proposal:466; Team decision (E-91) |
| REQ-NF-23 | Developers shall be outside the gym roles and shall not have routine access to safety or emergency data in production. | N/A | High | Pending: who manages the VM and looks after the system (CTI and gym, M-16, G-01) | Proposal:437, 509 |
| REQ-NF-24 | Uploaded photos shall be JPEG, PNG or HEIC, up to 10 MB. The server converts them to JPEG and strips location metadata. | N/A | High | Clear | Review gap; Team decision |
| REQ-NF-25 | The system shall show a privacy notice in Spanish and English before collecting personal data. The team drafts it. | N/A | High | Pending: gym approves the text (G-24) | Team decision |
| REQ-NF-48 | The PIN shall be 4 digits, typed on a numeric keypad. It shall be stored hashed, PIN attempts shall be limited, and only PIN holders can change it. An entered PIN is active only in the browser where it was typed. Changing the PIN closes it in every browser. It closes after 15 minutes without a tap or key press by a person (automatic polling does not count), with a warning after 10 minutes that it closes in 5 minutes. The warning has a "Keep going" button that resets the full 15 minutes; the button takes keyboard focus and is read by screen readers (WCAG 2.2.1). | N/A | High | Clear. Attempt limit and wait: design | Proposal:177, 218; Team decision (E-51, E-56, E-83) |
| REQ-NF-51 | Passwords of User accounts shall have at least 10 characters, and the system shall accept at least 64. There are no composition rules (no required mix of letters, numbers or symbols). When a password is set or changed, the system checks it against known compromised passwords with an external service (haveibeenpwned.com, through Laravel's `uncompromised` rule, which uses the k-anonymity model; see 1.4) and rejects a compromised one. The check sends only the first 5 characters of a hash of the password. No student data leaves the VM, so the check is not submitted to M-11 (2.4). Deviation: NIST SP 800-63B-4, section 3.1.1.2, asks for at least 15 characters for passwords used as a single factor; the team chose 10 because people type the password on a phone. | N/A | High | Clear. Gym account assumed to follow the same rule (team to confirm). A test covers the case when the external service does not answer | Team decision (E-63, E-98) |

### 6.4 Other Quality Attributes

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-26 | Sign in, authorization, facility sessions, the one-device rule and Gym ID verification shall require a connection. Without one, no session is created, and the app does not show a stored Gym ID or occupancy as if it were current. The app shows a banner at the top that says the data is not current. Schedules, notices, facility information and analytics already loaded stay on screen, each with the time it was last updated. Occupancy shows no number. The Gym ID says it is not valid now, and its clock stops. | N/A | High | Clear | Proposal:460; Review gap; Team decision (E-77) |
| REQ-NF-28 | The location boundary, the accepted accuracy and the gym coordinates shall be set with tests inside and around the gym on iPhone and Android. | N/A | High | Pending: the team measures the values | Proposal:435, 458 |
| REQ-NF-29 | The location boundary shall be configurable per environment. In production it shall never be more than 50 meters from the gym coordinates (REQ-NF-28). The December demo runs in a separate environment with the classroom boundary. | N/A | High | Clear. The 50 meters can change after the gym is measured; the classroom must be farther than 50 meters from the gym | Review gap; Team decision |
| REQ-NF-30 | The main flows shall pass on iPhone with Safari, Android with Chrome, and Windows with Chrome and Edge; macOS and Firefox as a secondary check. | N/A | High | Clear | Proposal:464 |
| REQ-NF-31 | Availability: an uptime target and a manual procedure for when the system fails. | N/A | Medium | Pending: gym, G-07, G-01 | Review gap |

## 7. Internationalization and Localization Requirements

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-33 | The interface shall be in Spanish by default, and English shall be available for all texts. Each account stores one language. The User chooses it when creating the account and can change it later in the profile preferences. The gym account has one language for every computer where it is used. There is no language button in the top bar. | N/A | High | Clear. Team to confirm: the language of the screens before sign in, and where the gym account changes its language and whether that needs the PIN | Team decision (E-64) |
| REQ-NF-34 | All frontend and backend texts, including emails and API error messages, shall be in translation files from the start. | N/A | High | Clear | Team decision |
| REQ-NF-35 | Emails shall be sent in the language chosen by the User. | N/A | High | Clear | Team decision |
| REQ-NF-36 | The page language attribute shall change together with the texts (WCAG 3.1.1). | N/A | High | Clear | Review gap |
| REQ-NF-37 | Expiration, term boundaries and analytics (day, week, month) shall use the `America/Puerto_Rico` time zone. | N/A | High | Clear | Review gap |
| REQ-NF-38 | Dates and times shall be shown as an ISO date plus 12-hour time with AM/PM, the same in both languages. Example: `2026-10-13 3:05 PM`. | N/A | High | Clear | Team decision |

## 8. Other Requirements

### 8.1 Audit

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-39 | The system shall record in the audit log each: Staff correction, Staff-assisted Check In (as an exception), in-person athlete registration, roster change, term or schedule change, import and import undo, release of a claimed Authorization Number, manual grant or revoke of an authorization (with its reason), Reinstate of an athlete's authorization (with its reason, REQ-F-49), PIN change, gym account password change, each use of the recovery code and each new code generated (REQ-F-89), and each alert from the global lookup limit (REQ-F-71). Each entry has the account, time, IP address, device and browser, and the values before and after. Only Administrators can see the log. The shared account means the log cannot name the person; the gym checks the shift schedule. Retention: REQ-NF-05. | N/A | High | Clear | Proposal:212, 513; Team decision |

### 8.2 Testing

| ID | Requirement | Proposal priority | Final priority | Status | Source |
|---|---|---|---|---|---|
| REQ-NF-40 | There shall be automated unit or database tests for authorization and sessions. | N/A | High | Clear | Proposal:515 |
| REQ-NF-41 | There shall be integration tests from sign in to session creation. | N/A | High | Clear | Proposal:515 |
| REQ-NF-42 | Tests shall show that simultaneous Check In requests and repeated Authorization Number or roster claims produce at most one session or one claim. | N/A | High | Clear | Proposal:462, 573 |
| REQ-NF-43 | Location and PWA behavior shall be tested on real phones. | N/A | High | Clear | Proposal:515 |
| REQ-NF-44 | Each test plan case shall be linked to an objective and shall use controlled datasets. | N/A | High | Clear | Proposal:515, 573-575 |
| REQ-NF-49 | Before the release, gym staff and real users (paid members and athletes) shall run the main flows on their own phones and computers: registration, Check In, Gym ID, Staff-assisted Check In and import. The gym records whether each flow is accepted. | N/A | High | Pending: who takes part and when (gym) | Professor feedback |
| REQ-NF-50 | A load test shall run simultaneous Check Ins above the expected peak. At most one session per User shall be created and the occupancy shall stay correct. | N/A | High | Pending: peak number (REQ-NF-15, G-05), fixed in design (team) | Professor feedback |

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
| Gym ID | Screen in the PWA with name, photo, authorization, an "Athlete" or "Member" tag, Check In status, minutes left (paid members only) and a moving clock. No code or QR |
| HTTPS | Encrypted HTTP |
| Manual authorization | Authorization an Administrator grants by hand, until the end of a chosen term, for order errors (REQ-F-87) |
| MVP | Minimum Viable Product: scope validated first (Proposal:295) |
| Paid member | User with a term membership paid in WooCommerce |
| PIN | Secret 4-digit number, known only to the gym administration, that unlocks the Administrator actions of the gym account |
| PWA | Progressive Web App: web app that can be installed on the phone |
| Reconciliation | Importing a corrected Export Orders file so local records match WooCommerce again |
| Reinstate | Administrator action that makes the revoked authorization of an athlete removed from the roster by mistake active again (REQ-F-49) |
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
| Outgoing mail: CTI or an external provider (mail assumed available, E-61) | CTI | M-07, M-11 | REQ-NF-09 if an external provider is used |
| PostgreSQL accepted | CTI | M-09 | REQ-F-17, F-36 |
| VM: public IP, containers, subdomain, HTTPS, approval, early access | CTI | M-01 to M-05 | 2.3, 2.4, REQ-NF-12 |
| WooCommerce API | CTI | M-12 | REQ-F-32 |
| External services approval | CTI | M-11 | REQ-NF-09 |
| Storage and disk encryption | CTI | M-13 | REQ-NF-20 |
| Backups | CTI, team | M-06 | REQ-NF-06 |
| FERPA | UPRM through CTI | M-15 | REQ-NF-47 |
| Real data limits | CTI, team | M-17 | REQ-NF-07 |
| Server administrator access | CTI | M-16 | REQ-NF-23 |
| Export Orders example: columns, how the term is read, whether two orders in one file share an Authorization Number (unique per term is decided, E-71) | Team (Carlos) | E-55 | REQ-F-10, F-28, F-29 |
| Store address and how the store option works | Team, gym | E-92 | REQ-F-91 |
| Language of screens before sign in; where the gym account changes its language and whether that needs the PIN | Team | E-64 | REQ-NF-33 |
| Dashboard: same codebase or separate app; Lock button back to Staff mode | Team | E-65 | REQ-NF-10 |
| Released number that was the account's only authorization: does the account stay | Team | E-87 | REQ-F-74 |
| Can a term be deleted | Team | E-88 | REQ-F-21 |
| Who fixes a session mistake found after the session ended | Team | E-80 | REQ-F-48 |
| Gym account password follows REQ-NF-51 (assumed) | Team | E-63 | REQ-NF-51 |
| Does a User see their own visit history | Team (Carlos) | None | None (design) |
| Contact number | Gym | G-25 | REQ-F-72, F-73, F-76 |
| Store sells only during terms; summer | Gym | G-26 | REQ-F-21, F-22 |
| Athletes-only periods | Gym | G-28 | REQ-F-55, F-82 |
| Who holds the PIN | Gym | G-29 | None (operations) |
| Role and PIN table, including Staff reading the roster and the recovery code | Gym | G-09 | REQ-F-49, F-52, F-89 |
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
| Design details: sign-in waits, lookup limits, PIN attempt limit, link validity, concurrency test number, error texts, import result layout | Team | Design phase | REQ-F-07, F-15, F-28, F-33, F-71, NF-15, NF-48 |
