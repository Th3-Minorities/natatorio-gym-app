# Questions for the Team

**What:** open questions the team answers itself, questions for the professor or advisors, and team process items.
**For:** the three team members.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.

| Section | Total | Answered | Open |
|---|---|---|---|
| Requirement questions | 17 | 15 | 2 |
| Decisions from the design-readiness review | 24 | 24 | 0 |
| Decisions from the design review (2026-10-17 and 2026-10-19) | 40 | 40 | 0 |
| Questions for the professor or advisors | 5 | 0 | 5 |
| Team process (not requirements) | 6 | 3 | 3 |
| Total | 92 | 82 | 10 |

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
| Feature | 3.2 Paid Member Registration, 4.1 Data Dictionary |
| Why we ask | Registration uses only the Authorization Number, which has 6 digits in the sample receipt. If two orders can share a number, the lookup can match the wrong order. Also asked in gym.md, G-19. |
| Answer | |
| Answered by | |
| Date | |

### E-11: Password reset by email

| Field | Value |
|---|---|
| Question | Do users reset a forgotten password on their own with an email link? A: yes. B: no, staff help at the front desk. |
| Affects | REQ-F-06 Password reset by email link; REQ-F-03 Account recovery after a lost phone (was REQ-F-05) |
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
| Feature | 6.3 Security, 4.1 Data Dictionary |
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
| E-36 | Check In while closed | Check In is rejected, with a notice, when the gym is closed by its published schedule or a published closure. SRS REQ-F-33 (old REQ-F-35 merged into it), REQ-F-55. | Carlos Pepin | 2026-10-14 |
| E-37 | Waiver | Accepted once, when the account is created, and valid while the account exists. Not repeated each term or when the text changes. Without it the account is not created. Proposed: the User can edit the emergency contact at any time; Staff see the current value. SRS REQ-F-60. | Carlos Pepin | 2026-10-14 |
| E-38 | Athlete photo per term | The first time an athlete signs in during a new term, the app asks for the new photo before Check In is allowed. SRS REQ-F-25, REQ-F-26. | Carlos Pepin | 2026-10-14 |
| E-39 | After 60 minutes | Paid member: the Gym ID shows "expired" with text and icon; nobody has to leave. Athlete: the Gym ID does not expire while the term authorization is active; Staff verify against the roster. Occupancy undercounts athletes who stay longer. SRS REQ-F-38, REQ-F-40, REQ-F-41 (old REQ-F-81 merged into these). | Carlos Pepin | 2026-10-14 |
| E-40 | Gym account creation | The team creates the gym account, its password and the first PIN once with a server install command and gives them to the Administrator. The Administrator then changes both from the app using the current PIN. Changing the password withdraws access when an employee leaves. SRS REQ-F-88, REQ-NF-48. | Carlos Pepin | 2026-10-14 |
| E-41 | Athlete registration flows | Only the email-link flow (REQ-F-15) is built. The in-person flow (REQ-F-77) is built only if CTI confirms there is no outgoing mail. | Carlos Pepin | 2026-10-14 |
| E-42 | Demo environment | The December demo runs in a separate environment with the classroom boundary. Production never carries it. The 50 meter rule stays. SRS REQ-NF-29. | Carlos Pepin | 2026-10-14 |
| E-43 | Registration photo failure | The account and the claim are saved together in one operation only after the photo is saved. If the photo fails nothing is claimed. The Authorization Number is checked and the masked email shown as soon as it is typed. SRS REQ-F-13. | Carlos Pepin | 2026-10-14 |
| E-44 | Athlete removed mid-term | The Gym ID stops being valid at once; the athlete counts in occupancy until the current session ends; no new Check In. SRS REQ-F-49, REQ-F-22. | Carlos Pepin | 2026-10-14 |
| E-45 | Import undo | Any import can be undone at any time. Undo deletes its membership records and dependent authorizations. Accounts and photos stay; people claim again with the corrected file (Proposed). Logged. SRS REQ-F-31. The photos part was replaced by E-57. | Carlos Pepin | 2026-10-14 |
| E-46 | Audit log and deleted users | Entries that mention a deleted user stay intact until the end of their term, then follow the normal retention rule. The distinct people count (REQ-F-61 (f), was REQ-F-86) does not change. SRS REQ-F-09, REQ-NF-05, REQ-NF-39. | Carlos Pepin | 2026-10-14 |
| E-47 | Terminology | Use "term" instead of "semester" except in quotes from the proposal. "Sign-in session" is the login session; "facility session" or "session" is the 60-minute gym session. SRS 1.2. | Carlos Pepin | 2026-10-14 |
| E-48 | Term overlap | Terms never overlap: when the Administrator saves a term, dates that overlap another term are rejected. Gaps between terms are fine. SRS REQ-F-21. | Carlos Pepin | 2026-10-14 |
| E-49 | Assisted Check In in athletes-only periods | Staff-assisted Check In follows the athletes-only rule: it is rejected for a paid member during an athletes-only period. SRS REQ-F-46, REQ-F-82. | Carlos Pepin | 2026-10-14 |
| E-50 | User with no active authorization | Sees the status ("expired" or "not on the roster"), the Authorization Number field, the contact number, schedules, notices, facility information and analytics. Cannot do Check In. SRS REQ-F-23. | Carlos Pepin | 2026-10-14 |
| E-51 | PIN warning | The warning after 10 minutes has a "Keep going" button that resets the full 15 minutes. It takes keyboard focus and is read by screen readers (WCAG 2.2.1). SRS REQ-NF-48. | Carlos Pepin | 2026-10-14 |
| E-52 | Release of a wrong claim | When the Administrator releases an Authorization Number claimed by mistake, if that claim created the account, the account is deleted with its photo; if the number was added to an existing account (for example a renewal), only that authorization is removed and the account stays. The number is free again. SRS REQ-F-74. | Carlos Pepin | 2026-10-14 |
| E-53 | Global lookup limit | The per-IP limit stays. The global limit on failed Authorization Number lookups never blocks registrations: it only slows each lookup and leaves an alert entry in the audit log for the Administrator. SRS REQ-F-71, REQ-NF-39. | Carlos Pepin | 2026-10-14 |
| E-54 | Assisted Check In without a phone | For a paid member, Staff search the person by name and compare the stored photo with the person. No receipt or payment confirmation is needed. Athletes still give the student number. SRS REQ-F-46. Changes the answer of gym.md, G-16. | Carlos Pepin | 2026-10-14 |
| E-56 | PIN state | The PIN state and the last person activity live in the session data of that browser, not in table columns. The gym account has a PIN version number; unlocking stores it in the session, and every Administrator request compares both. Changing the PIN raises the version, which closes the PIN in every browser. SRS REQ-NF-48. | Carlos Pepin | 2026-10-14 |
| E-57 | Photos on import undo | Undo deletes the authorizations from that import together with their term photos. Accounts stay; people upload a new photo when they claim again. Releasing a number added to an existing account also deletes that authorization's photo. Replaces the "photos stay" part of E-45. SRS REQ-F-31, REQ-F-74. | Carlos Pepin | 2026-10-14 |
| E-58 | "I am an athlete" | The roster record is linked only after the User opens a link sent to the institutional email in that record, as in athlete registration. The student number alone is not enough because it is not secret. Needs outgoing mail (cti.md, M-07). SRS REQ-F-80. | Carlos Pepin | 2026-10-14 |
| E-59 | Staff see the roster | Staff (no PIN) see the current-term athlete roster, read only, and search it by name or student number. Changing the roster stays with Administrators. Used to verify athletes and for Staff-assisted Check In. The gym must confirm (gym.md, G-09). SRS role table, REQ-F-45, REQ-F-49. | Carlos Pepin | 2026-10-14 |
| E-60 | Gym account recovery | The install command also creates a one-time recovery code, shown once, that the administration keeps on paper. With it, a person sets a new gym password and PIN from the gym sign-in screen; the code is used up and a new one is shown once. Attempts are limited and each use is logged. If the paper is lost, only the server command remains. SRS REQ-F-88, REQ-F-89, REQ-NF-39. | Carlos Pepin | 2026-10-14 |

## Decisions from the design review (2026-10-17 and 2026-10-19)

| ID | Topic | Answer | Answered by | Date |
|---|---|---|---|---|
| E-61 | Outgoing mail | From now on the team assumes the app has outgoing mail. CTI mail comes first. If CTI cannot give it, the app uses an external provider, as the proposal allows for a prototype; that sends account emails outside the CTI VM and needs approval (cti.md, M-11). The email-link flows are built. Changes E-41: the in-person flow no longer depends on missing mail (see E-62). SRS 2.1, 2.4, 2.5, 5.3, REQ-F-06, REQ-F-15, REQ-F-75, REQ-F-80. | Carlos Pepin | 2026-10-17 |
| E-62 | In-person athlete registration | Staff (no PIN) give a one-time code valid for 15 minutes. The athlete fills in the password, photo and waiver on their own phone; Staff do not enter data for the person. The tool stays even with mail. SRS REQ-F-77, role table. | Carlos Pepin | 2026-10-17 |
| E-63 | Password rules and reset | At least 10 characters, at least 64 allowed, no composition rules, and a check against compromised passwords with an external service (Laravel `uncompromised`, haveibeenpwned.com). NIST SP 800-63B-4 asks 15 for single-factor passwords; Carlos chose 10 for phone use, a recorded deviation. A local list was rejected as more work. The gym account is assumed to follow the same rule. Passwords stay on Laravel's built-in handling. The reset request gives the same answer whether or not the email has an account. SRS REQ-NF-51 (new), REQ-F-06. | Carlos Pepin | 2026-10-17 |
| E-64 | Language | One language per account, not per device. The User picks it when creating the account and changes it in the profile preferences. The gym account has one language for every computer. No language button in the top bar. Still open: the language before sign in, and where the gym account changes it and whether that needs the PIN. SRS REQ-NF-33. | Carlos Pepin | 2026-10-17 |
| E-65 | Gym dashboard | Staff and the Administrator work on a dashboard on its own address, not in the User app. The gym sign-in page lives there, with no link from the User sign-in page. Staff land on the dashboard. Administrator items show to Staff grayed out with a padlock; tapping one asks for the PIN and unlocks it on the same screen. To confirm: the dashboard is a route of the same codebase, and whether a Lock button returns to Staff mode. SRS REQ-NF-10. | Carlos Pepin | 2026-10-17 |
| E-66 | Public schedules and notices; contact number | Schedules and notices are public, also before sign in. Occupancy and analytics stay behind sign in. The notice editor warns against sensitive data. The Administrator edits the gym contact number in the facility information editor. SRS role table, REQ-F-55. | Carlos Pepin | 2026-10-17 |
| E-67 | User with no active authorization | A banner on top and Check In grayed out. Expired: the banner asks to renew and shows the Authorization Number field and "I am an athlete". Any other cause (revoked, import undone, number released, no current term): "no active authorization" and the contact number. Final texts go in the wireframes. Changes E-50. SRS REQ-F-23. | Carlos Pepin | 2026-10-17 |
| E-68 | One authorization per term | A User holds at most one active authorization per term. "I am an athlete" shows only to a User with no active authorization, and a manual grant to an account that already has an active one for that term is rejected. A revoked authorization does not count (E-94). SRS REQ-F-19, REQ-F-80, REQ-F-87. | Carlos Pepin | 2026-10-17 |
| E-69 | Photo at registration and in a new term | The photo is taken at that moment or uploaded, and the screen says it cannot be changed. The athlete sets password, photo and waiver on the link page, saved together; with "I am an athlete" the photo is saved on the link page, so there is never an authorization without a photo. A new term starts at the first app open: the roster is looked up by the student number of the last claim, the account and history stay, and the new photo is asked before Check In. A User with a manual authorization gives the photo the same way. Changes E-38. SRS REQ-F-13, REQ-F-15, REQ-F-26, REQ-F-80, REQ-F-87. | Carlos Pepin | 2026-10-17 |
| E-70 | Number for an existing account | Not signed in and the email already has an account: show the email masked and "sign in to add it"; nothing is claimed; same for athletes. Signed in: the number is accepted for that account even if the payment email is different, because having the number is the proof. A real owner who finds the number claimed contacts the gym and the Administrator releases it. SRS REQ-F-78, REQ-F-75. | Carlos Pepin | 2026-10-17 |
| E-71 | Authorization Number per term | Answers part of E-30. The number is unique per term and the same number can appear in another term. Lookups use only the current term's orders. A number from an ended term gets the same message as an invalid or claimed one. Two current-term orders with one number: the lookup is denied with the contact number, and the import rejects the second order. Still open in E-55: the sample file review. SRS REQ-F-10, REQ-F-28, REQ-F-72, 4.1. | Carlos Pepin | 2026-10-19 |
| E-72 | Email mask | First and last letter before the @, for example `m***z@upr.edu`, also for the institutional email. SRS REQ-F-70. | Carlos Pepin | 2026-10-17 |
| E-73 | Athlete link limit | Per student number: 1 link every 5 minutes and 5 per day. SRS REQ-F-15, REQ-F-80. | Carlos Pepin | 2026-10-17 |
| E-74 | Check In rejection causes | The backend returns a fixed code per cause, and the app writes the text in the account's language. Two new causes: location unavailable and new term photo needed. SRS REQ-F-33. | Carlos Pepin | 2026-10-17 |
| E-75 | Gym ID | A tag with text and icon ("Athlete" or "Member") plus a different color for each; Carlos picks the colors. The clock shows the time with seconds as text, changes at most once per second and never flashes. Athletes never see minutes left; they see "Authorized athlete" and the term. Changes the minutes part of E-06 for athletes. SRS REQ-F-40. | Carlos Pepin | 2026-10-17 |
| E-76 | Athletes-only period | Every User sees the notice, athletes and paid members. The whole User app changes color during the period; the dashboard does not. Without a connection the app shows its normal colors. Colors are Carlos's choice and must not clash with the Gym ID tag colors. SRS REQ-F-83, REQ-F-90 (new). | Carlos Pepin | 2026-10-17 |
| E-77 | No connection | A banner on top. Loaded content stays, each section with "updated at". Occupancy shows no number. The Gym ID says "not valid now" and the clock stops. SRS REQ-NF-26. | Carlos Pepin | 2026-10-17 |
| E-78 | Recovery code | 12 characters in 3 groups of 4, letters and numbers without look-alike characters, accepted with or without hyphens and in any case. After a use, the person retypes the new code to continue, then signs in again. A "Generate new code" action, for the Administrator with the PIN, voids the old code, shows the new one once and logs only that the code changed. SRS REQ-F-89, REQ-NF-39, role table. | Carlos Pepin | 2026-10-17 |
| E-79 | Emergency contact | The User sees and edits it any time; Staff see the current value. Makes the Proposed part of E-37 final. SRS REQ-F-60. | Carlos Pepin | 2026-10-17 |
| E-80 | Void | Staff end or void only active sessions; past statistics do not change. For later: who fixes a mistake found the next day. SRS REQ-F-48. | Carlos Pepin | 2026-10-17 |
| E-81 | Student number | Shown in full to Staff and the Administrator on every screen they use. Only emails are masked. SRS REQ-NF-19. | Carlos Pepin | 2026-10-17 |
| E-82 | Manual authorizations in statistics | Their own group, next to paid members and athletes. SRS REQ-F-61 (e). | Carlos Pepin | 2026-10-17 |
| E-83 | PIN format | 4 digits on a numeric keypad. Carlos knows the tradeoff: 10,000 combinations; attempt limits protect the screen, but a stored hash of a 4-digit PIN falls at once if the database leaks. SRS REQ-NF-48. | Carlos Pepin | 2026-10-19 |
| E-84 | Import result and undo | The result (counts plus accepted and rejected orders) is saved with the import and can be opened again later, so rejected names and emails are stored; their retention is pending (REQ-NF-05). Undo is always allowed, also after Check Ins; active sessions count until they end; the confirmation shows counts without blocking. Undo deletes what that import created and does not revert its changes to older records. SRS REQ-F-28, REQ-F-31, REQ-NF-05, 4.2. | Carlos Pepin | 2026-10-19 |
| E-85 | No current term | A notice on every Administrator screen, and the reason in each error. SRS 3.4. | Carlos Pepin | 2026-10-19 |
| E-86 | Reason for a manual grant or revoke | Required, free text of at least 10 characters, written to the audit log. Makes the Proposed part of E-35 final. SRS REQ-F-87. | Carlos Pepin | 2026-10-19 |
| E-87 | Release of a claimed number | Only that authorization and its term photo are deleted, also when the claim created the account and the account has other authorizations. The account and its history stay. Not asked yet: an account whose only authorization is released. Changes E-52. SRS REQ-F-74. | Carlos Pepin | 2026-10-19 |
| E-88 | Editing a term | Allowed even when orders or athletes fall outside the new dates. Records keep their term; the authorizations of the term end on the new end date. Not asked: whether a term can be deleted. SRS REQ-F-22. | Carlos Pepin | 2026-10-19 |
| E-89 | Deletion asked through the Administrator | The person confirms in person at the gym with identification. SRS REQ-F-09. | Carlos Pepin | 2026-10-19 |
| E-90 | Regular schedules | One table: each slot repeats weekly or has a date. The regular schedule is written once, and exceptions are separate rows. SRS REQ-F-55. | Carlos Pepin | 2026-10-19 |
| E-91 | Sign-in data and attempt counters | Sign-in sessions do not keep the IP address or browser. Attempt counters keyed by IP address and email are temporary and are discarded when the wait ends. SRS REQ-NF-21. | Carlos Pepin | 2026-10-19 |
| E-92 | Registration needs a payment or the roster | The welcome and registration screens say up front that registering needs a paid membership or a place on the roster, with the contact number, and offer a way to the WooCommerce store. Athletes do not buy, so the store is for paid members. Open: the store address, and a button or an automatic redirect. SRS REQ-F-91 (new). | Carlos Pepin | 2026-10-17 |
| E-93 | Data model rules for the migration | Where the data model and the admin flows differ, the data model rules. PIN attempt counters live in the `cache` table. The audit log has no `pin_active` field. Imports have no uploaded-by field, because the audit log already records each import with the account and time. Removing an athlete from the roster revokes the authorization with the reason "removed from roster" instead of deleting it, so REQ-F-49 holds. SRS REQ-F-49, REQ-NF-39. | Carlos Pepin | 2026-10-19 |
| E-94 | Revoked authorization and one per term | Only active authorizations count. A revoked one does not block a new grant or claim in the same term, as in the data model unique index. Changes E-68. SRS REQ-F-19, REQ-F-87. | Carlos Pepin | 2026-10-19 |
| E-95 | Athlete removed from the roster by mistake | A "Reinstate" action on the athlete roster screen (A-05) makes the revoked authorization active again and writes an audit log entry. The action needs a reason, free text of at least 10 characters, as in E-86. It is refused with a message when the person already has an active authorization in that term, because the database allows one active authorization per term. SRS REQ-F-49, REQ-NF-39. | Carlos Pepin | 2026-10-19 |
| E-96 | Store option on athlete registration | The athlete registration screen has no store option, because athletes do not buy. A paid member who opens it by mistake goes back to the welcome screen, which has the option. The welcome screen and the paid member registration screen offer the store; showing it only while a term runs stays Proposed (G-26). Changes E-92. SRS REQ-F-91. | Carlos Pepin | 2026-10-19 |
| E-97 | Authorization Number field with no active authorization | The field shows under both banners. A person whose authorization went away with an import undo or a release can claim the number again. A number that cannot be claimed gets the same message with the contact number. Changes E-67. SRS REQ-F-23. | Carlos Pepin | 2026-10-19 |
| E-98 | Compromised-password check | The check is an external call that sends no student data: only the first 5 characters of a hash of the password, with no name, email, photo or full password. The SRS describes it, and the team does not submit it for approval (cti.md, M-11). SRS 2.4, REQ-NF-51. | Carlos Pepin | 2026-10-19 |
| E-99 | Staff active sessions list | For an athlete the list shows "athlete" and the Check In time, with no minutes left. Paid members keep the minutes left. Extends E-75 to Staff screens. SRS REQ-F-44. | Carlos Pepin | 2026-10-19 |
| E-100 | "I am an athlete" under both banners | A User with no active authorization sees "I am an athlete" under both banners, expired or any other cause, as in E-68. Changes E-67. SRS REQ-F-23, REQ-F-80. | Carlos Pepin | 2026-10-19 |

## WooCommerce import

### E-55: Review the Export Orders example

| Field | Value |
|---|---|
| Question | Review the Export Orders example: columns, how the term is read, and whether the Authorization Number is unique. |
| Affects | REQ-F-28 Load an Export Orders file; REQ-F-29 Fields the import copies; REQ-F-10 Validate the Authorization Number (with E-30) |
| Feature | 3.5 WooCommerce Import, 3.2 Paid Member Registration |
| Why we ask | The team has an example file but cannot share it yet. The import cannot be designed without the real columns. |
| Owner | Carlos Pepin |
| Status | Open |
| Answer | |
| Answered by | |
| Date | |

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
| Feature | 8.3 Legal, Intellectual Property and Privacy |
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
| Answer | Yes, all four. The repository is public, so secrets and real data must never be committed. Not applied yet: the change goes in through a pull request, with the skeleton work (#46, #47) or the SRS update branch. |
| Answered by | Carlos Pepin |
| Date | 2026-10-19 |

### E-28: Protection of `main`

| Field | Value |
|---|---|
| Question | When do we turn on protection of `main`: first a required PR with no direct push, then 1 approved review? |
| Answer | Now. `main` requires a pull request and 1 approval from another member, as announcement #51 says. Turned on 2026-10-19. The rule is not enforced for administrators, so Carlos keeps an emergency bypass. |
| Answered by | Carlos Pepin |
| Date | 2026-10-19 |

### E-29: Write access

| Field | Value |
|---|---|
| Question | When do the other two members get write access to the repository? |
| Answer | Now, so they can push branches for #46 to #48 and review pull requests. Both have write access on this repository since 2026-10-19. |
| Answered by | Carlos Pepin |
| Date | 2026-10-19 |
