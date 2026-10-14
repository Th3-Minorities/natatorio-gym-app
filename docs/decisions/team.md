# Questions for the Team

**What:** open questions the team answers itself, questions for the professor or advisors, and team process items.
**For:** the three team members.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.

| Section | Total | Answered | Open |
|---|---|---|---|
| Requirement questions | 16 | 15 | 1 |
| Decisions from the design-readiness review | 17 | 17 | 0 |
| Questions for the professor or advisors | 5 | 0 | 5 |
| Team process (not requirements) | 6 | 0 | 6 |
| Total | 44 | 32 | 12 |

## Scope and priorities

### E-01: What "complete" means in December (merges E-02)

| Field | Value |
|---|---|
| Question | What does "complete" mean for the December demo? A: MVP only. B: MVP plus the Secondary items that Objectives 4 and 5 test (roster, permissions, schedules, closures, analytics). C: all 5 objectives, without Stretch. |
| Affects | REQ-F-49 to REQ-F-65 Roster, permissions, information and analytics |
| Feature | 1.3 Project Scope, 2.5 Assumptions and Dependencies |
| Why we ask | The scope table lists these items as Secondary, but Objectives 4 and 5 give them acceptance tests. Until this is decided, the final priority of every requirement stays TBD. Confirm with the professor (P-01). |
| Answer | C: all 5 objectives, without Stretch. Roster, permissions, schedules, closures and analytics are committed for December. This also resolves the conflict between the scope table and Objectives 4 and 5. See SRS 1.3 and 2.5. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-03: Final priority of each requirement (merges E-04, E-19)

| Field | Value |
|---|---|
| Question | Approve the final priority (High, Medium, Low) of every requirement. Settle these two first. 1: Does the roster tool move up to the MVP? 2: Do the Install button and the iPhone help text go into the MVP? |
| Affects | All requirements; REQ-F-49 Only PIN holders change the roster; REQ-F-66 Install button and iPhone help |
| Feature | 1.2 Document Conventions, 3.9 Athlete Roster, 3.14 PWA Installation |
| Why we ask | Every row has final priority TBD. Without the roster tool athletes cannot register, yet the proposal lists it as Secondary. |
| Answer | Final priority follows the rule MVP = High, Secondary = Medium, Stretch = Low; rows with no proposal priority are High if an MVP flow needs them, otherwise Medium. 1: yes, the roster tool moves up to the MVP. 2: yes, the Install button and the iPhone help text are in the MVP. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-07: Supabase out of the plan

| Field | Value |
|---|---|
| Question | Do we confirm that Supabase is out of the plan? A: confirm now. B: wait for CTI's answers on containers (cti.md, M-02) and the VM (cti.md, M-04). |
| Affects | None directly. Closes the open item in 2.4 |
| Feature | 2.4 Design and Implementation Constraints |
| Why we ask | The recorded decision is that Supabase comes back only if CTI gives no VM or no containers. The SRS still lists the confirmation as open. |
| Answer | Yes. Supabase and Vercel are out of the plan. Use CTI services only. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

## Accounts and sign in

### E-09: Verify the paid member email

| Field | Value |
|---|---|
| Question | Do we check the paid member's email before creating the account? A: no, we trust the payment email. B: yes, with the same email link the athlete gets. |
| Affects | REQ-F-12 Verify paid member email (now Removed); REQ-F-11 Account email is the payment email |
| Feature | 3.2 Paid Member Registration |
| Why we ask | An earlier decision said "it is verified" but gave no flow. B needs outgoing mail (cti.md, M-07). If the gym lets members change the email (gym.md, G-02), B is required. |
| Answer | A: no email verification. The account email is always the payment email from the WooCommerce record, and the member does not type it. The Authorization Number arrives by email to the payer, which serves as the check. The system shows the payment email masked (for example `c***@upr.edu`). REQ-F-12 is Removed and REQ-F-11 is Clear. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-10: Same response for any student number

| Field | Value |
|---|---|
| Question | Do we confirm that registration shows the same response whether or not the student number is in the roster? |
| Affects | REQ-F-16 Same response for any student number (now Removed); REQ-F-76 Message for athletes not in the roster |
| Feature | 3.3 Athlete Registration |
| Why we ask | The student number is not secret, so a different response would show who is an athlete. The cost is that a user who mistypes the number gets no clear error. |
| Answer | No. An athlete not in the roster gets a clear message: they do not appear as a registered athlete and must go to the Department of Athletic Activities to be registered or to check for an error, plus a contact number. REQ-F-16 is Removed and replaced by REQ-F-76. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-30: Is the Authorization Number unique?

| Field | Value |
|---|---|
| Question | Is the Authorization Number unique across orders? It may be a card approval code, which can repeat. Check it with a real Export Orders file. |
| Affects | REQ-F-10 Validate Authorization Number against imports; REQ-F-17 One account per roster record or number |
| Feature | 3.2 Paid Member Registration, 4.2 Data Dictionary |
| Why we ask | Registration uses only the Authorization Number, which has 6 digits in the sample receipt. If two orders can share a number, the lookup can match the wrong order. Also asked in gym.md, G-19. |
| Answer | |
| Answered by | |
| Date | |

### E-11: Password reset by email

| Field | Value |
|---|---|
| Question | Do users reset a forgotten password on their own with an email link? A: yes. B: no, staff help at the front desk. |
| Affects | REQ-F-06 Password reset by email link; REQ-F-05 Account recovery after a lost phone |
| Feature | 3.1 Accounts and Sign In |
| Why we ask | A needs outgoing mail (cti.md, M-07). With B, every forgotten password goes through staff (gym.md, G-04). |
| Answer | A: yes, reset by email link (REQ-F-06). It depends on CTI outgoing mail (cti.md, M-07). There is no staff process for a lost phone: the user signs in on the new phone, and the old session ends. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-12: Attempt limit and inactivity timeout

| Field | Value |
|---|---|
| Question | Do we limit failed sign-in attempts and end sessions after inactivity? If yes: how many attempts, how long to wait, and after how much inactivity? |
| Affects | REQ-F-07 Limit failed sign-in attempts; REQ-F-08 End session after inactivity (now Removed) |
| Feature | 3.1 Accounts and Sign In, 6.3 Security |
| Why we ask | Both requirements are new and not approved. A short timeout can sign a user out between Check In and showing the Gym ID at the desk. |
| Answer | Attempt limit: yes. 10 failed attempts, then a wait that grows with each lockout, counted per account and per IP address. Exact waits are set in design. Inactivity timeout: no. The session lasts until the user signs out or signs in on another device. REQ-F-08 is Removed. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-13: One device rule for Staff and Administrator

| Field | Value |
|---|---|
| Question | Does the one-device rule also apply to Staff and the Administrator? A: yes. B: no, only to Users. |
| Affects | REQ-F-03 One sign-in session per account |
| Feature | 3.1 Accounts and Sign In |
| Why we ask | Staff may share a front desk computer or move between a phone and a computer (gym.md, G-06). With A, signing in on one device signs them out of the other. |
| Answer | B: only Users (paid members and athletes). The gym uses one shared gym account, and the rule does not apply to it. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

## Occupancy and Gym ID

### E-05: Polling interval and the Objective 3 test

| Field | Value |
|---|---|
| Question | Do we confirm that screens ask the server for occupancy every 20 to 30 seconds, and rewrite the Objective 3 test to compare values after each screen updates? |
| Affects | REQ-F-42 Same occupancy on every screen; REQ-F-43 Screens update every 20 to 30 seconds |
| Feature | 3.7 Gym ID and Occupancy |
| Why we ask | The proposal asked for optional real time, and SSE did not work through the tunnel. With polling, two screens can differ for up to one interval, so the current test would fail. |
| Answer | Yes. Screens poll every 20 to 30 seconds first. Live updates (SSE or WebSockets) are a later improvement if CTI allows them and time remains. The Objective 3 test compares values after each screen updates; with live updates the original test applies. SSE did not work through the development tunnel and was not tested on the CTI VM. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-06: Gym ID live indicators

| Field | Value |
|---|---|
| Question | What do the Gym ID "live indicators" show without real time? A: minutes left in the session, refreshed on each update. B: a moving element, such as a clock, so staff can tell a live screen from a screenshot. C: both. |
| Affects | REQ-F-40 Gym ID shows session indicators |
| Feature | 3.7 Gym ID and Occupancy |
| Why we ask | The proposal names live indicators but does not define them. Confirm the choice with the gym. |
| Answer | C: both. The minutes left in the session and a moving element such as a clock. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

## Data and security

### E-20: Photo types and size

| Field | Value |
|---|---|
| Question | Which photo file types and what maximum size do we accept? For example JPEG, PNG and HEIC (the iPhone default), up to a set number of MB. |
| Affects | REQ-NF-24 Photo types, size and metadata |
| Feature | 6.3 Security, 4.2 Data Dictionary |
| Why we ask | REQ-NF-24 needs the list and the limit. Rejecting HEIC makes iPhone users convert photos first. |
| Answer | JPEG, PNG and HEIC, up to 10 MB. The server converts the photo to JPEG and strips location metadata. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

Also asked in cti.md: M-17 (limits for real WooCommerce data on team computers; absorbs E-15).

## Quality, location and testing

### E-16: Keep the classroom location out of production

| Field | Value |
|---|---|
| Question | How do we make sure the classroom demo location boundary cannot reach production? For example: production refuses to start with a boundary outside the gym, or the boundary is set only on the server. |
| Affects | REQ-NF-29 Boundary configurable per environment |
| Feature | 6.4 Other Quality Attributes |
| Why we ask | The demo runs in a classroom, not at the gym. If that boundary reaches production, users could do Check In from the classroom. |
| Answer | Production refuses to start if the configured boundary is outside a range around the gym coordinates. The range is 50 meters. The coordinates are measured at the gym (REQ-NF-28). |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-17: Who tests on which phone (merges E-18)

| Field | Value |
|---|---|
| Question | Who tests on real phones, and with which ones? 1: location accuracy at the gym, on iPhone with Safari and Android with Chrome. 2: login cookies inside the installed PWA on iPhone. Which member has an iPhone? |
| Affects | REQ-NF-28 Location boundary set with tests; REQ-F-03 One sign-in session per account; REQ-F-66 Install button and iPhone help; REQ-NF-43 Location and PWA tested on phones |
| Feature | 6.4 Other Quality Attributes, 3.14 PWA Installation, 8.2 Testing |
| Why we ask | Tests so far used only a Samsung phone at home. Cookie behavior inside the installed PWA on iPhone is not verified. Gym access for the tests is asked in gym.md, G-08. |
| Answer | Closed: not a requirement. All three members can test on iPhone, Android, Mac and other computers, and the team can test inside and around the gym whenever it wants. The cookie test inside the installed PWA on iPhone is still to be done. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-21: PWA performance target

| Field | Value |
|---|---|
| Question | Which performance measure and value must the PWA meet on phones? For example: time until the Check In button can be used, measured on a mid-range phone on mobile data. |
| Affects | REQ-NF-16 PWA performance target on phones |
| Feature | 6.2 Performance |
| Why we ask | The proposal names performance but gives no number, so REQ-NF-16 cannot be tested. |
| Answer | The Check In button is usable in under 3 seconds on mobile data on a mid-range phone. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

### E-22: Date and time format

| Field | Value |
|---|---|
| Question | Which date and time format does each language use? A: Spanish `13/10/2026 3:05 p. m.` and English `10/13/2026 3:05 PM`. B: one format for both, such as `2026-10-13 15:05`. |
| Affects | REQ-NF-38 Date and time format per language |
| Feature | 7 Internationalization and Localization Requirements |
| Why we ask | `10/11` means a different day in each language. REQ-NF-38 needs one written rule. |
| Answer | B, with 12-hour time: ISO date plus 12-hour time with AM/PM, the same in Spanish and English. Example: `2026-10-13 3:05 PM`. |
| Answered by | Carlos Pepin |
| Date | 2026-10-13 |

## Decisions from the design-readiness review (2026-10-14)

| ID | Topic | Answer | Answered by | Date |
|---|---|---|---|---|
| E-31 | PIN scope | An entered PIN is active only in the browser or device where it was typed, not for the whole gym account. SRS REQ-NF-48, 3.10. | Carlos Pepin | 2026-10-14 |
| E-32 | PIN inactivity | Only a tap or key press by a person counts as activity. Automatic polling does not. SRS REQ-NF-48. | Carlos Pepin | 2026-10-14 |
| E-33 | Gym ID lookup | Staff verify a Gym ID by searching the person by name in the active sessions list and comparing the photo. The Gym ID has no code or QR. SRS REQ-F-45. | Carlos Pepin | 2026-10-14 |
| E-34 | Order to term | An order belongs to the term that contains its payment date. Assumed: the store only sells memberships while a term runs; no summer membership unless a summer term is configured (gym.md, G-26). Orders dated outside every term are rejected and listed in the import result. SRS REQ-F-22, REQ-F-29. | Carlos Pepin | 2026-10-14 |
| E-35 | Manual authorization | PIN holders can grant an authorization by hand to an existing account, until the end of a chosen term, and revoke one, for order errors. Proposed: a reason is required, and the action is logged with time, IP and reason. SRS REQ-F-87. | Carlos Pepin | 2026-10-14 |
| E-36 | Check In while closed | Check In is rejected, with a notice, when the gym is closed by its published schedule or a published closure. SRS REQ-F-33, REQ-F-35, REQ-F-55. | Carlos Pepin | 2026-10-14 |
| E-37 | Waiver | Accepted once, when the account is created, and valid while the account exists. Not repeated each term or when the text changes. Without it the account is not created. Proposed: the User can edit the emergency contact at any time; Staff see the current value. SRS REQ-F-60. | Carlos Pepin | 2026-10-14 |
| E-38 | Athlete photo per term | The first time an athlete signs in during a new term, the app asks for the new photo before Check In is allowed. SRS REQ-F-25, REQ-F-26. | Carlos Pepin | 2026-10-14 |
| E-39 | After 60 minutes | Paid member: the Gym ID shows "expired" with text and icon; nobody has to leave. Athlete: the Gym ID does not expire while the term authorization is active; Staff verify against the roster. Occupancy undercounts athletes who stay longer. SRS REQ-F-38, REQ-F-40, REQ-F-41, REQ-F-81. | Carlos Pepin | 2026-10-14 |
| E-40 | Gym account creation | The team creates the gym account, its password and the first PIN once with a server install command and gives them to the Administrator. The Administrator then changes both from the app using the current PIN. Changing the password withdraws access when an employee leaves. SRS 2.2, REQ-NF-48. | Carlos Pepin | 2026-10-14 |
| E-41 | Athlete registration flows | Only the email-link flow (REQ-F-15) is built. The in-person flow (REQ-F-77) is built only if CTI confirms there is no outgoing mail. | Carlos Pepin | 2026-10-14 |
| E-42 | Demo environment | The December demo runs in a separate environment with the classroom boundary. Production never carries it. The 50 meter rule stays. SRS REQ-NF-29. | Carlos Pepin | 2026-10-14 |
| E-43 | Registration photo failure | The account and the claim are saved together in one operation only after the photo is saved. If the photo fails nothing is claimed. The Authorization Number is checked and the masked email shown as soon as it is typed. SRS REQ-F-13. | Carlos Pepin | 2026-10-14 |
| E-44 | Athlete removed mid-term | The Gym ID stops being valid at once; the athlete counts in occupancy until the current session ends; no new Check In. SRS REQ-F-49, REQ-F-22. | Carlos Pepin | 2026-10-14 |
| E-45 | Import undo | Any import can be undone at any time. Undo deletes its membership records and dependent authorizations. Accounts and photos stay; people claim again with the corrected file (Proposed). Logged. SRS REQ-F-31. | Carlos Pepin | 2026-10-14 |
| E-46 | Audit log and deleted users | Entries that mention a deleted user stay intact until the end of their term, then follow the normal retention rule. The distinct people count (REQ-F-86) does not change. SRS REQ-F-09, REQ-NF-05, REQ-NF-39. | Carlos Pepin | 2026-10-14 |
| E-47 | Terminology | Use "term" instead of "semester" except in quotes from the proposal. "Sign-in session" is the login session; "facility session" or "session" is the 60-minute gym session. SRS 1.2. | Carlos Pepin | 2026-10-14 |

## Questions for the professor or advisors

These are course questions, not requirement questions.

### P-01: Rubric and dates

| Field | Value |
|---|---|
| Question | What is the rubric, and what are the due dates of the midterm report and the final report? |
| Affects | None directly. Sets the limit for E-01 |
| Feature | 1.3 Project Scope |
| Why we ask | The rubric tells us what "complete" must include for the December demo. |
| Answer | |
| Answered by | |
| Date | |

### P-02: SRS, updated proposal, or both (absorbs part of E-07)

| Field | Value |
|---|---|
| Question | Do you ask for an SRS, an updated proposal (v1), or both? |
| Affects | None directly |
| Feature | 1.1 Purpose |
| Why we ask | The SRS already overrides the proposal. If a v1 proposal is required, it must include the stack change and fix "institutional login", as the REQ-F-02 note says. |
| Answer | |
| Answered by | |
| Date | |

### P-03: Approval of the stack change

| Field | Value |
|---|---|
| Question | Does the change from Supabase and Vercel to Laravel, PostgreSQL in a container and a CTI VM need your approval? |
| Affects | None directly |
| Feature | 2.4 Design and Implementation Constraints, 2.5 Assumptions and Dependencies |
| Why we ask | If approval is needed and denied, the team must justify or undo the change. |
| Answer | |
| Answered by | |
| Date | |

### P-04: Course rule on declaring tools

| Field | Value |
|---|---|
| Question | Does the course require a statement of the tools used to produce code and documents? |
| Affects | Nothing in the SRS. Course policy only |
| Feature | None |
| Why we ask | If required, the team must add the statement to its reports. |
| Answer | |
| Answered by | |
| Date | |

### P-05: Code ownership and license

| Field | Value |
|---|---|
| Question | Which Capstone or UPRM policy decides who owns the code and under which license it is released? |
| Affects | REQ-NF-46 Ownership and license follow UPRM policy |
| Feature | 8.4 Legal, Intellectual Property and Privacy |
| Why we ask | REQ-NF-46 stays Pending until the terms are known. They matter before any long-term deployment at UPRM. |
| Answer | |
| Answered by | |
| Date | |

## Team process (not requirements)

These items are about how the team works in the repository. They do not change any requirement.

### E-23: Backend lead

| Field | Value |
|---|---|
| Question | Who leads the backend work? |
| Answer | |
| Answered by | |
| Date | |

### E-24: First backend task

| Field | Value |
|---|---|
| Question | Who builds and who reviews the first backend task: sign in with Sanctum, and a Check In that creates one session, with a test of simultaneous requests? |
| Answer | |
| Answered by | |
| Date | |

### E-26: Issue, branch and PR for these documents

| Field | Value |
|---|---|
| Question | Who opens the issue for these document changes, sets the milestone and the Capstone project, and creates the branch and the PR? |
| Answer | |
| Answered by | |
| Date | |

### E-27: Lines to add to `.gitignore`

| Field | Value |
|---|---|
| Question | Do we add `.env.*`, `!.env.example`, `/data/real/` and `*.sql` to `.gitignore`? (`.env` is already there.) |
| Answer | |
| Answered by | |
| Date | |

### E-28: Protection of `main`

| Field | Value |
|---|---|
| Question | When do we turn on protection of `main`: first a required PR with no direct push, then 1 approved review? |
| Answer | |
| Answered by | |
| Date | |

### E-29: Write access

| Field | Value |
|---|---|
| Question | When do the other two members get write access to the repository? |
| Answer | |
| Answered by | |
| Date | |
