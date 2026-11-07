# Questions for the Team

**What:** open questions the team answers itself, questions for the professor or advisors, and team process items.
**For:** the three team members.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.

| Section | Total | Answered | Open |
|---|---|---|---|
| Requirement questions | 16 | 16 | 0 |
| Decisions from the design-readiness review | 29 | 29 | 0 |
| Decisions from the design review (2026-10-17 and 2026-10-19) | 40 | 40 | 0 |
| Decisions from the wireframe stage (2026-10-20) | 7 | 7 | 0 |
| Questions after the CTI meeting (E-108 to E-113; E-110 is partly decided) | 6 | 5 | 1 |
| Decisions after the Athletic Activities meeting (2026-11-04) | 38 | 38 | 0 |
| Decisions from the dashboard base (2026-11-06) | 2 | 2 | 0 |
| WooCommerce import | 1 | 1 | 0 |
| Questions for the professor or advisors | 5 | 0 | 5 |
| Team process (not requirements) | 6 | 3 | 3 |
| Total | 150 | 141 | 9 |

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
| Answer | Answered by a read of all 84 store orders on 2026-11-04: the number is the gateway field PGPAY_AUTHNUM, 6 characters that can include letters, and no value repeats. It is unique across all orders (E-128). |
| Answered by | Team |
| Date | 2026-11-05 |

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
| E-31 | PIN scope | An entered PIN is active only in the browser or device where it was typed, not for the whole gym account. SRS REQ-NF-48, 3.10. Replaced by E-114. | Carlos Pepin | 2026-10-14 |
| E-32 | PIN inactivity | Only a tap or key press by a person counts as activity. Automatic polling does not. SRS REQ-NF-48. Replaced by E-114. | Carlos Pepin | 2026-10-14 |
| E-33 | Gym ID lookup | Staff verify a Gym ID by searching the person by name in the active sessions list and comparing the photo. The Gym ID has no code or QR. SRS REQ-F-45. | Carlos Pepin | 2026-10-14 |
| E-34 | Order to term | An order belongs to the term that contains its payment date. Assumed: the store only sells memberships while a term runs; no summer membership unless a summer term is configured (gym.md, G-26). Orders dated outside every term are rejected and listed in the import result. SRS REQ-F-22, REQ-F-29. | Carlos Pepin | 2026-10-14 |
| E-35 | Manual authorization | PIN holders can grant an authorization by hand to an existing account, until the end of a chosen term, and revoke one, for order errors. Proposed: a reason is required, and the action is logged with time, IP and reason. SRS REQ-F-87. The PIN holders part was replaced by E-114. | Carlos Pepin | 2026-10-14 |
| E-36 | Check In while closed | Check In is rejected, with a notice, when the gym is closed by its published schedule or a published closure. SRS REQ-F-33 (old REQ-F-35 merged into it), REQ-F-55. | Carlos Pepin | 2026-10-14 |
| E-37 | Waiver | Accepted once, when the account is created, and valid while the account exists. Not repeated each term or when the text changes. Without it the account is not created. Proposed: the User can edit the emergency contact at any time; Staff see the current value. SRS REQ-F-60. | Carlos Pepin | 2026-10-14 |
| E-38 | Athlete photo per term | The first time an athlete signs in during a new term, the app asks for the new photo before Check In is allowed. SRS REQ-F-25, REQ-F-26. | Carlos Pepin | 2026-10-14 |
| E-39 | After 60 minutes | Paid member: the Gym ID shows "expired" with text and icon; nobody has to leave. Athlete: the Gym ID does not expire while the term authorization is active; Staff verify against the roster. Occupancy undercounts athletes who stay longer. SRS REQ-F-38, REQ-F-40, REQ-F-41 (old REQ-F-81 merged into these). Replaced by E-115. | Carlos Pepin | 2026-10-14 |
| E-40 | Gym account creation | The team creates the gym account, its password and the first PIN once with a server install command and gives them to the Administrator. The Administrator then changes both from the app using the current PIN. Changing the password withdraws access when an employee leaves. SRS REQ-F-88, REQ-NF-48. Replaced by E-114. | Carlos Pepin | 2026-10-14 |
| E-41 | Athlete registration flows | Only the email-link flow (REQ-F-15) is built. The in-person flow (REQ-F-77) is built only if CTI confirms there is no outgoing mail. | Carlos Pepin | 2026-10-14 |
| E-42 | Demo environment | The December demo runs in a separate environment with the classroom boundary. Production never carries it. The 50 meter rule stays. SRS REQ-NF-29. | Carlos Pepin | 2026-10-14 |
| E-43 | Registration photo failure | The account and the claim are saved together in one operation only after the photo is saved. If the photo fails nothing is claimed. The Authorization Number is checked and the masked email shown as soon as it is typed. SRS REQ-F-13. | Carlos Pepin | 2026-10-14 |
| E-44 | Athlete removed mid-term | The Gym ID stops being valid at once; the athlete counts in occupancy until the current session ends; no new Check In. SRS REQ-F-49, REQ-F-22. | Carlos Pepin | 2026-10-14 |
| E-45 | Import undo | Any import can be undone at any time. Undo deletes its membership records and dependent authorizations. Accounts and photos stay; people claim again with the corrected file (Proposed). Logged. SRS REQ-F-31. The photos part was replaced by E-57. Replaced by E-127. | Carlos Pepin | 2026-10-14 |
| E-46 | Audit log and deleted users | Entries that mention a deleted user stay intact until the end of their term, then follow the normal retention rule. The distinct people count (REQ-F-61 (f), was REQ-F-86) does not change. SRS REQ-F-09, REQ-NF-05, REQ-NF-39. | Carlos Pepin | 2026-10-14 |
| E-47 | Terminology | Use "term" instead of "semester" except in quotes from the proposal. "Sign-in session" is the login session; "facility session" or "session" is the 60-minute gym session. SRS 1.2. | Carlos Pepin | 2026-10-14 |
| E-48 | Term overlap | Terms never overlap: when the Administrator saves a term, dates that overlap another term are rejected. Gaps between terms are fine. SRS REQ-F-21. | Carlos Pepin | 2026-10-14 |
| E-49 | Assisted Check In in athletes-only periods | Staff-assisted Check In follows the athletes-only rule: it is rejected for a paid member during an athletes-only period. SRS REQ-F-46, REQ-F-82. | Carlos Pepin | 2026-10-14 |
| E-50 | User with no active authorization | Sees the status ("expired" or "not on the roster"), the Authorization Number field, the contact number, schedules, notices, facility information and analytics. Cannot do Check In. SRS REQ-F-23. | Carlos Pepin | 2026-10-14 |
| E-51 | PIN warning | The warning after 10 minutes has a "Keep going" button that resets the full 15 minutes. It takes keyboard focus and is read by screen readers (WCAG 2.2.1). SRS REQ-NF-48. Replaced by E-114. | Carlos Pepin | 2026-10-14 |
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
| E-61 | Outgoing mail | From now on the team assumes the app has outgoing mail. CTI mail comes first. If CTI cannot give it, the app uses an external provider, as the proposal allows for a prototype; that sends account emails outside the CTI VM and needs approval (cti.md, M-11). The email-link flows are built. Changes E-41: the in-person flow no longer depends on missing mail (see E-62). SRS 2.1, 2.4, 2.5, 5.3, REQ-F-06, REQ-F-15, REQ-F-75, REQ-F-80. CTI meeting (2026-10-22): CTI described a relay through its mail gateway once it authorizes the VM (cti.md, M-07). The external provider branch applies only if CTI does not authorize it. | Carlos Pepin | 2026-10-17 |
| E-62 | In-person athlete registration | Staff (no PIN) give a one-time code valid for 15 minutes. The athlete fills in the password, photo and waiver on their own phone; Staff do not enter data for the person. The tool stays even with mail. SRS REQ-F-77, role table. | Carlos Pepin | 2026-10-17 |
| E-63 | Password rules and reset | At least 10 characters, at least 64 allowed, no composition rules, and a check against compromised passwords with an external service (Laravel `uncompromised`, haveibeenpwned.com). NIST SP 800-63B-4 asks 15 for single-factor passwords; Carlos chose 10 for phone use, a recorded deviation. A local list was rejected as more work. The gym account is assumed to follow the same rule. Passwords stay on Laravel's built-in handling. The reset request gives the same answer whether or not the email has an account. SRS REQ-NF-51 (new), REQ-F-06. | Carlos Pepin | 2026-10-17 |
| E-64 | Language | One language per account, not per device. The User picks it when creating the account and changes it in the profile preferences. The gym account has one language for every computer. No language button in the top bar. Still open: the language before sign in, and where the gym account changes it and whether that needs the PIN. SRS REQ-NF-33. | Carlos Pepin | 2026-10-17 |
| E-65 | Gym dashboard | Staff and the Administrator work on a dashboard on its own address, not in the User app. The gym sign-in page lives there, with no link from the User sign-in page. Staff land on the dashboard. Administrator items show to Staff grayed out with a padlock; tapping one asks for the PIN and unlocks it on the same screen. To confirm: the dashboard is a route of the same codebase, and whether a Lock button returns to Staff mode. SRS REQ-NF-10. The PIN part was replaced by E-114. | Carlos Pepin | 2026-10-17 |
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
| E-82 | Manual authorizations in statistics | Their own group, next to paid members and athletes. SRS REQ-F-61 (e). Replaced by E-148. | Carlos Pepin | 2026-10-17 |
| E-83 | PIN format | 4 digits on a numeric keypad. Carlos knows the tradeoff: 10,000 combinations; attempt limits protect the screen, but a stored hash of a 4-digit PIN falls at once if the database leaks. SRS REQ-NF-48. | Carlos Pepin | 2026-10-19 |
| E-84 | Import result and undo | The result (counts plus accepted and rejected orders) is saved with the import and can be opened again later, so rejected names and emails are stored; their retention is pending (REQ-NF-05). Undo is always allowed, also after Check Ins; active sessions count until they end; the confirmation shows counts without blocking. Undo deletes what that import created and does not revert its changes to older records. SRS REQ-F-28, REQ-F-31, REQ-NF-05, 4.2. Replaced by E-127. | Carlos Pepin | 2026-10-19 |
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

## Decisions from the wireframe stage (2026-10-20)

| ID | Topic | Answer | Answered by | Date |
|---|---|---|---|---|
| E-101 | Lock button | While the PIN is open, the dashboard shows an "Administrator mode" bar with a Lock button. One tap returns to Staff mode. The PIN still closes after inactivity, with the warning at 10 minutes. Answers the Lock part of E-65. SRS REQ-NF-10, REQ-NF-48. | Carlos Pepin | 2026-10-20 |
| E-102 | Administration menu screen | Removed. After the PIN, the Administrator stays on the dashboard with the menu unlocked and the "Administrator mode" bar. The other screen IDs keep their numbers, and the removed screen is marked "removed" so references in issues and docs stay valid. SRS REQ-NF-10. | Carlos Pepin | 2026-10-20 |
| E-103 | Language before an account exists | The welcome and User sign-in screens are always in Spanish until the person picks a language when creating the account. A User whose account is in English sees these two screens in Spanish while signed out; the account language applies after sign in. Answers part of E-64. SRS REQ-NF-33. | Carlos Pepin | 2026-10-20 |
| E-104 | Gym account language | Changed on the dashboard without the PIN. The control can be a dashboard setting, a button in the dashboard top bar, or both; the wireframe picks the place. The E-64 rule of no language button in the top bar covers the User app only. Answers the rest of E-64. SRS REQ-NF-33. | Carlos Pepin | 2026-10-20 |
| E-105 | "My visits" | The User sees a list of their own past Check Ins on a new "My visits" screen, opened from the account screen. Proposed: each row shows the date and time. The list never shows location (REQ-NF-03). How far back: all history (E-126); retention is 5 years (E-125). Carlos chose this over the recommendation to leave it for later. SRS REQ-F-92 (new). | Carlos Pepin | 2026-10-20 |
| E-106 | Release of an account's only authorization | The account always stays, with no authorization. Only the authorization and its term photo go. The person signs in, sees the no-authorization banner and can claim the correct number. Carlos chose this over the recommendation to delete the account when it never had a Check In. Answers the open case of E-87. SRS REQ-F-74. | Carlos Pepin | 2026-10-20 |
| E-107 | Deleting a term | Terms are never deleted. The Administrator fixes a term created by mistake by editing its dates. The term screen has no delete button. Answers the open case of E-88. SRS REQ-F-21. | Carlos Pepin | 2026-10-20 |

## Questions after the CTI meeting

### E-108: CTI's audit log requests

| Field | Value |
|---|---|
| Question | CTI asks every student project for an audit log with these rules. Do we adopt them? (a) No screen, route or command edits or deletes an entry, not even for the Administrator; entries leave only by the retention rule (REQ-NF-05). (b) The Administrator searches the log by account and by date range (by person only if per-person sign-in is adopted, gym.md G-09) and exports the result to CSV or Excel. (c) The gym account's sign in and sign out are logged. User sign-ins stay out, because E-91 and REQ-NF-21 keep no IP per sign-in. |
| Affects | REQ-NF-39; new REQ-F-93 (Proposed) |
| Feature | 8.1 Audit |
| Why we ask | CTI said it always asks every project for such a log. CTI did not say whether it is a condition for the VM. Source: [CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59). |
| Status | Decided |
| Answer | Yes to all three: (a) no screen, route or command edits or deletes an entry, not even an Administrator; entries leave only by the retention rule (E-131); (b) the Administrator searches by staff account and date range and exports to CSV or Excel (REQ-F-93); (c) staff account sign in and sign out are logged. User sign-ins stay out. |
| Answered by | Team |
| Date | 2026-11-05 |

### E-109: Backup method

| Field | Value |
|---|---|
| Question | Which backup method do we propose to the owner? A: a second disk on the VM (agreed with whoever creates the VM, so probably in the VM request; it is not outside the VM as REQ-NF-06 asks). B: an Administrator button that downloads one file with the database and the photos (CTI's minimum, daily in the afternoon or on Fridays; the file holds all personal data and photos on a gym computer). C: a scheduled copy to a second server (needs a second server request and a stored remote password). Also: how often, who does it, the acceptable data loss, and how long copies are kept. Decide before the VM request is filed if A is chosen. |
| Affects | REQ-NF-06 |
| Feature | 4.3 |
| Why we ask | CTI said where backups go is the team's decision and that the team must agree the backup and restore procedure with the owner. Source: [CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59). |
| Status | Decided (E-122) |
| Answer | A: a second virtual disk on the same VM, asked for in the VM request. One copy every two weeks, the 2 most recent kept, plus a Download button and a restore from the panel (E-122). |
| Answered by | Team |
| Date | 2026-11-04 |

### E-110: Hand-over package

| Field | Value |
|---|---|
| Question | CTI asks the student groups it works with for an installer script (from a plain Linux machine to a running app with the first account created) and a written disaster recovery plan (what is backed up, how often, how to restore after a corrupted database, a hacked server or a hardware failure). Do we deliver both? Is restore an action inside the app or a step on the server? Do we remove the team's sudo and VPN access at delivery? |
| Affects | REQ-F-88, REQ-NF-06, REQ-NF-23, REQ-NF-31; new REQ-NF-52 and REQ-NF-53 (Proposed) |
| Feature | 2.5, 4.3, 6.3 |
| Why we ask | CTI said it normally asks its groups for both. CTI did not say whether they are conditions for the VM. User and administrator manuals are asked of the director (gym.md, G-36). Source: [CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59). |
| Status | Partly decided (E-123) |
| Answer | Yes to the installer: one sudo command that installs everything on Rocky Linux 10, creates the first Administrator, schedules backups and can restore a backup on a new server (E-123). Restore is also a button in the Administrator panel, from a copy already on the server (E-122). Still open: the written disaster recovery plan, and removing the team's sudo and VPN access at delivery. |
| Answered by | Team |
| Date | 2026-11-04 |

### E-111: Storage estimate and VM size

| Field | Value |
|---|---|
| Question | Which VM size do we recommend to the owner, and with what storage estimate? CTI's usual size for web apps is 2 processors, 4 GB of memory and 40 to 60 GB of disk. The estimate uses the size of the files per person, the number of people, and how often files are added. Which cleanup options do we offer the gym and UPRM (each term, each year, or by the User)? The team sets no retention period (gym.md, G-03). |
| Affects | REQ-NF-04, REQ-NF-05 |
| Feature | 2.3, 4.3 |
| Why we ask | CTI said the team defines the size and asked for a growth estimate and a cleanup plan. Source: [CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59). |
| Status | Decided, redone on 2026-11-05 with a large margin on purpose: running out of disk is worse than asking for too much |
| Answer | Ask for 2 processors, 8 GB of memory, a 60 GB main disk and a 40 GB second disk for backups (E-122), in the same VM request.<br><br>The numbers are rounded up on purpose. What we know: the store had 69 paid orders from January to October 2026 (read on 2026-11-04). We do not know how many athletes there are.<br><br>Main disk:<br>- People: we assume up to 500 new people a year, paid and athletes, several times what the store shows. An account and its current photo stay until 5 years after its last use (E-131), so up to 2,500 accounts; we double it to 5,000.<br>- Photos: only the current photo is kept (E-135), and the server shrinks each one to about 0.5 MB when it is uploaded (E-138): 5,000 x 0.5 MB = 2.5 GB.<br>- Database: visits, audit log, orders and daily totals stay under 1 GB for years at the real volume; we count 5 GB.<br>- Linux, containers, images and logs: 20 GB.<br>- Total about 28 GB. We ask for 60 GB, the top of CTI's usual size, so the disk is never close to full.<br><br>Second disk: the 2 most recent backups (E-122), each about 8 GB in the worst case (photos plus database), about 16 GB. We ask for 40 GB.<br><br>Memory: PostgreSQL about 1 GB, PHP and the queue worker about 1 GB, Linux about 0.5 GB, plus the nightly and backup tasks. 4 GB would be enough; we ask for 8 GB so a backup or a busy hour never runs short. Processors: the real load is a few requests a second at most, so 2 are enough. |
| Answered by | Team |
| Date | 2026-11-05 |

### E-112: One registration number field

| Field | Value |
|---|---|
| Question | CTI suggested one field, 'registration number': paid members type the receipt number, athletes the student number, and the system looks in the current-term roster first and then in the imported orders. A remark that most likely came from CTI said the current choice of athlete or paid member is fine. Do we adopt it? Check first that a 6-digit Authorization Number cannot be mistaken for a student number, and that the 'not on the roster' message (REQ-F-76) and the lookup limits still work. |
| Affects | REQ-F-15, REQ-F-71, REQ-F-76, REQ-F-91 |
| Feature | 3.2, 3.3 |
| Why we ask | CTI suggested it in the meeting ([CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59)). |
| Status | Replaced by E-153 (2026-11-05): one field adopted |
| Answer | A: keep two paths. "I paid for a membership" asks only for the Authorization Number from the receipt, with a picture of where it is in the receipt email; "I am an athlete" asks only for the student number. Why: paid members are students too and have a student number, so one field invites them to type it, which looks in the wrong place and shows a confusing error. Each path asks for one number, the right one. |
| Answered by | Team |
| Date | 2026-11-05 |

### E-113: Address of the gym dashboard

| Field | Value |
|---|---|
| Question | REQ-NF-10 puts the gym dashboard on its own address. Is that a second domain name, which needs its own domain request to CTI, or a path under the same name? |
| Affects | REQ-NF-10 |
| Feature | 5.1 |
| Why we ask | CTI said each domain is a separate request filed by the owner. Source: [CTI meeting](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/59). |
| Status | Decided (E-124) |
| Answer | A path under the same name. The app has its own UPRM subdomain and the dashboard lives under it, so there is no second domain request (E-124). |
| Answered by | Team |
| Date | 2026-11-04 |

## Decisions after the Athletic Activities meeting (2026-11-04)

The team met the department on 2026-11-04 and settled the rest as a team the same day. The meeting summary is in [Announcements](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/99); the gym's answers are in `gym.md`.

| ID | Topic | Answer | Answered by | Date |
|---|---|---|---|---|
| E-114 | Personal accounts for Staff and Administrators | One account per person with its own email and password and a role of Staff or Administrator. No shared gym account, no PIN and no paper recovery code. The Administrators are the two department secretaries and the department director; they invite Staff by email and deactivate an account when the person leaves. The install command creates the first Administrator. Only Administrators give access by hand after seeing a receipt, because desk staff change often. Replaces E-56, E-60, E-78, E-83, E-101 and the PIN part of E-104. SRS REQ-F-52, REQ-F-88, REQ-F-89 (Removed), REQ-NF-10, REQ-NF-39, REQ-NF-48 (Removed). Data model D13. | Team | 2026-11-04 |
| E-115 | Check-out and the 2-hour close | A session stays open until Staff check the person out at the desk. A session nobody closes ends by itself 2 hours after the Check In, with the note "closed automatically". When a closure is published or the term ends, every active session ends at once with the note "closed by closure". Estimated occupancy counts the open sessions. A person may come back the same day; each entry after a check-out counts as a visit, and stepping out briefly (the bathroom, the car) is the same session. The 60 minutes are a guide Staff apply when the gym is full, not a rule the app enforces. Replaces the 60-minute session. SRS REQ-F-33, REQ-F-36, REQ-F-37, REQ-F-38, REQ-F-41, REQ-F-48, REQ-F-83. Data model D14. | Team | 2026-11-04 |
| E-116 | One athlete roster, entered by hand | The roster is one list, not one per term. Administrators add, edit and remove athletes by hand; there is no file import, because the department keeps the lists only in Word. Each record has name, sport, student number and institutional email. An athlete stays until an Administrator removes them. Staff see the roster read only. At the first app open in a new term, an athlete on the roster only uploads a new photo; the waiver is not asked again. Replaces the per-term roster and the roster import. SRS REQ-F-25, REQ-F-26, REQ-F-49, REQ-F-51. Data model D16. | Team | 2026-11-04 |
| E-117 | In-person registration code | Removed. Athletes register only with the link sent to the roster email; if it fails they call the office at 265-3866. Replaces E-62. SRS REQ-F-77 (Removed). | Team | 2026-11-04 |
| E-118 | Photo that does not match | Staff mark the account "photo pending". It cannot Check In until the person uploads a new photo from their phone. Staff do not take photos. Still open: whether the new photo clears the mark by itself or Staff approve it. Exception to REQ-F-26, which forbids a new photo during an active authorization. Data model D17. | Team | 2026-11-04 |
| E-119 | Paper log during an outage | If the app is down, Staff use the paper log and check payment by hand. Up to one week down is acceptable. When the app is back, only Administrators enter the paper entries as manual entries with the person and the times. Each one writes an audit log entry with who entered it. They count in statistics and can be filtered out. New requirement. Data model D18. | Team | 2026-11-04 |
| E-120 | Student or employee, and refunds | Each order stores whether the buyer is a student or an employee, from the product variation in the store, for statistics (data model D15). A buyer who paid the wrong price is the department's mistake to fix. Refunds are made in the UPR Payment Gateway portal, outside WordPress and WooCommerce, so the store never shows them: none of the 84 orders read on 2026-11-04 has a refund, a refunded status or a refund note. The team will not ask for access to the gateway or to Finance systems just for refunds. So when the department refunds a membership, an Administrator revokes the authorization by hand in the app (REQ-F-87), with a reason. This is an Administrator task and goes in the Administrator manual. If a refund is ever recorded in WooCommerce, the sync revokes it on its own (E-127). Changes G-22. SRS REQ-F-22, REQ-F-87. | Team | 2026-11-04 |
| E-127 | Paid memberships from the store's API | The app reads the orders from the WooCommerce REST API with a read-only key kept in the server's environment file, instead of an uploaded export file. At registration, when a person types an Authorization Number the app does not have, the app asks the store right then, so a person who just paid registers at once. A full sync runs at least 3 times a day and picks up changes to known orders. Only `completed` orders give access; an order that later becomes `cancelled` or `refunded` loses it. The Administrator sees the last sync and has a "Sync now" button. There is no file upload, re-import or undo. Why: a test read of all 84 orders on 2026-11-04 worked with a read-only key, and it saves the Administrator a manual step. The VM needs outbound HTTPS to the store (to ask CTI). The order's student number is not stored, and address, phone, IP and marketing fields never are. Answers E-55 and #77 question 42. SRS REQ-F-28 to REQ-F-31 (REQ-F-31 Removed). Data model D1, D19. | Team | 2026-11-04 |
| E-128 | Authorization Number format | A code from the UPR Payment Gateway (order field PGPAY_AUTHNUM). The first read showed 6 characters, and 7 have been seen since, so the length can change and registration does not depend on it (E-153). It can include letters: 3 of the 69 paid orders end in a letter. It is unique across all orders, not only per term: no value repeats in the 69. Registration accepts letters (E-153). Changes G-19 and E-71. Data model D1. | Team | 2026-11-04 |
| E-129 | Gym ID time and who checked out | The Gym ID shows no countdown: an active session shows "Active session" and the Check In time. A 2-hour countdown would invite people to stay 2 hours, and a 60-minute one would suggest the session ends there. Staff apply the 60-minute guide from the Check In time on their screen. A check-out writes no audit log entry; the session stores which staff account marked the exit. The audit log stays for changes and corrections (void, early end, manual entry). SRS REQ-F-40, REQ-F-48. Data model D14. | Team | 2026-11-04 |
| E-130 | Staff session time limits | A staff sign-in ends after 2 hours without a person tapping or typing; an Administrator sign-in ends after 20 minutes. Automatic refreshes of the screen do not count as activity. Deactivating a staff account ends its open sessions at once. Trade-off the team accepts: on the shared desk computer, a student who leaves without signing out leaves their account open for the next shift for up to 2 hours. SRS REQ-NF-10, REQ-F-88. | Team | 2026-11-05 |
| E-131 | How the 5 years are counted | A User account is deleted 5 years after its last activity (last sign-in or Check In), with the anonymizing of REQ-F-09. While the account is active it stays, and its history is trimmed instead: each visit, sync record and audit log entry is deleted 5 years after it was created. Past-term photos are deleted sooner, when the new photo arrives (E-135). The current waiver, emergency contact and current photo stay while the account is active. A deactivated staff account is deleted 5 years after its last audit log entry. Deleted data can still sit in the 2 backup copies for up to 4 weeks. Refines E-125. SRS REQ-NF-04, REQ-NF-05, REQ-F-09. | Team | 2026-11-05 |
| E-132 | Paper log entries for people without an account | When an Administrator enters the paper log, a person with an account gets a manual entry linked to it. People without an account are entered only as a count for a time block (for example 3 visits on Tuesday from 2 to 4), with no names. Counts are part of the visit totals and are left out of distinct-people counts. Refines E-119. SRS REQ-F-95, REQ-F-61. Data model D18. | Team | 2026-11-05 |
| E-133 | Statistics are never deleted | Each night the app saves the day's totals with no personal data: visits, visits by athletes, student members, employee members and manual entries, visits per sport and the busiest hour. These daily totals are kept forever, so the department can compare years after the visits themselves are deleted at 5 years (E-131). Reports older than 5 years read the totals. SRS REQ-F-61, REQ-NF-05. Data model D20. | Team | 2026-11-05 |
| E-134 | Waiver text version | Each waiver acceptance stores which version of the text the person accepted. The waiver still stays valid when the text changes (REQ-F-60), but the record shows what each person agreed to. SRS REQ-F-60. Data model D21. | Team | 2026-11-05 |
| E-135 | Past-term photos | When a person uploads the photo for a new term, the photo of the previous term is deleted. Only the current photo is kept: the Gym ID uses no other, and older photos only add privacy risk and disk. Changes E-125 and E-131 for photos. SRS REQ-NF-04. | Team | 2026-11-05 |
| E-136 | Athletes removed from the roster | A roster record removed by an Administrator is deleted 5 years after its removal. Refines E-131. SRS REQ-NF-05. | Team | 2026-11-05 |
| E-137 | Downloaded backups and the store key | A backup downloaded from the Administrator panel is an encrypted file that needs a password to open, because it holds every photo and every person's data. The read-only store key lives only in the environment file of the server and of the lead's computer; it is never shared by chat or committed, the team develops with fake data (#81), and at delivery the key is revoked and a new one is made for the server only. SRS REQ-NF-06, REQ-F-28. | Team | 2026-11-05 |
| E-138 | Photo size | The server shrinks each uploaded photo to about 0.5 MB (about 1,200 pixels on the long side, JPEG), which is plenty for the Gym ID and the Staff screens. Uploads up to 10 MB are still accepted. It keeps the disk and the backups small. SRS REQ-NF-24. | Team | 2026-11-05 |
| E-139 | Entering the roster | Administrators enter athletes one at a time on the roster screen, with a quick form: after saving, the form stays open and empty for the next athlete, except the sport, which keeps the last value because the lists come by sport. The form shows the current sport large at the top ("Adding athletes of: Volleyball") so nobody forgets to change it. There are about 100 athletes, so no paste or file tool is needed. SRS REQ-F-49. | Team | 2026-11-05 |
| E-121 | Reports | Visits per day and per hour with the peak hour; athletes against student members and employee members; visits per sport; and an end-of-term summary the Administrator can download. SRS REQ-F-61 to REQ-F-65 (REQ-F-62 to REQ-F-65 Merged). | Team | 2026-11-04 |
| E-122 | Backups | Automatic copies on a second virtual disk attached to the same VM, asked for in the same CTI request. One copy every two weeks; the 2 most recent are kept. Losing the whole VM loses the copies too; the team accepts that risk. The Administrator panel shows the last backup and has buttons to make a backup now, download one and restore one already on the server. Answers E-109 (option A). SRS REQ-NF-06. | Team | 2026-11-04 |
| E-123 | Installer and server | The server runs Rocky Linux 10, since CTI is moving to it. One install command, run once with sudo by the team or a technician, installs Docker CE, sets the firewall and SELinux, starts the app, creates the first Administrator and schedules the backups; the same command can restore a backup on a new server. Administrators never use Docker or the server. Answers part of E-110. SRS REQ-F-88. | Team | 2026-11-04 |
| E-124 | Address | The app gets its own UPRM subdomain and does not replace the department's site. The gym dashboard is a path under the same name, so no second domain request. The name is still to pick. Answers E-113. SRS REQ-NF-10. | Team | 2026-11-04 |
| E-125 | Retention | Every kind of data is kept 5 years, including photos, waivers, emergency contacts, visits and the audit log. Replaces the end-of-term rule for the audit log and the per-term photo deletion. The storage estimate of E-111 must be redone. SRS REQ-NF-04, REQ-NF-05. | Team | 2026-11-04 |
| E-126 | Smaller answers | "Buy membership" button to the store, no redirect, only while a term runs; the store address is a setting. The English text of a notice is optional and Spanish shows when it is empty. Four manuals (User, Staff, Administrator, Developer), each in Spanish and English. The classroom demo uses fake data only. Users see their full visit history. No separate roster report: the audit log filters roster changes. Manual access counts as a paid member for every rule. Outgoing mail uses a no-reply sender. The team drafts the privacy notice. SRS REQ-F-62 (Merged), REQ-F-82, REQ-F-87, REQ-F-92. | Team | 2026-11-04 |
| E-140 | Downloading the athlete roster | An Administrator can download the whole athlete roster as a Word file or a PDF file, with name, sport, student number and institutional email. Staff cannot download it, because the roster holds personal data. SRS REQ-F-100. | Team | 2026-11-05 |
| E-141 | Downloading statistics | The statistics of the chosen period download as a PDF file (charts and totals, to read or print) or an Excel file (the numbers, to work with). Only Administrators can download; the other roles see the statistics on screen only. SRS REQ-F-101. | Team | 2026-11-05 |
| E-142 | Choosing the period | The statistics screen has buttons for day, week, month, term and year, plus a free range from one date to another. The same period applies to the screen and to the download. SRS REQ-F-61, REQ-F-101. | Team | 2026-11-05 |
| E-143 | Statistics for other services | A read-only REST API gives the statistics to another service, so the department can build its own charts. It gives counts only, with no names or other personal data, and needs a key. The roster never goes out through it. No service besides the app is expected to connect for now, so how keys are made stays undefined until one is. SRS REQ-F-102. | Team | 2026-11-05 |
| E-144 | End-of-term summary | The end-of-term summary is the statistics download (E-141) with the term chosen in the period picker, with the same metrics as the screen. There is no separate report to design. Changes E-121. SRS REQ-F-96 (Merged into REQ-F-101). | Team | 2026-11-05 |
| E-145 | Retention and the database links | Authorizations, store orders, sync records and paper log counts are deleted 5 years after they were created, like visits (E-131). A staff account is deleted 5 years after it was deactivated; an active one is never deleted. By then every visit, audit log entry and paper log entry that names the account is already gone, so no link in the database blocks the deletion, and the links stay strict as a guard. The retention task deletes the history first. Changes D13 ("never deleted"). SRS REQ-NF-05. | Team | 2026-11-05 |
| E-146 | Voiding a wrong paper log entry | An Administrator who types a paper log entry wrong voids it instead of deleting it, so the audit log keeps the trail. A voided entry does not count in statistics, like any voided session. SRS REQ-F-95. Data model D18. | Team | 2026-11-05 |
| E-147 | Sport on each visit | Check In copies the athlete's sport from the roster record onto the session, as it already copies student or employee. Visits per sport stay right when an Administrator changes an athlete's sport later or when the record is deleted. The copy is a snapshot of the visit, so it is repeated data on purpose. SRS REQ-F-61 (g). | Team | 2026-11-05 |
| E-148 | Manual access in statistics | When an Administrator grants access by hand, they pick student or employee. A manual authorization then counts in the student members or the employee members group, so statistics keep three groups (athletes, student members, employee members) and E-126 holds. Answers "how statistics show manual authorizations". SRS REQ-F-87, REQ-F-61 (e). | Team | 2026-11-05 |
| E-149 | Skipped orders in the sync record | The record of each store sync keeps the counts and, for each skipped order, only the order reference and the reason. No names or emails: the Administrator finds the order in the store by its reference. SRS REQ-F-99, REQ-NF-21. | Team | 2026-11-05 |
| E-150 | Reactivating a staff account | An Administrator can reactivate a deactivated staff account, for example a student who comes back to work the next term. The person signs in with the same email and password. It writes an audit log entry. The 5 years of E-145 count from the last deactivation. SRS REQ-F-88. | Team | 2026-11-05 |
| E-151 | The last Administrator | The system refuses to deactivate the last active Administrator, so the department never loses access to the Administrator screens. SRS REQ-F-88. | Team | 2026-11-05 |
| E-153 | One registration screen | Registration is one screen with one field where the person types a number. Exactly 10 digits is a student number: only athletes register with one, so the app looks it up in the roster and sends the link to the institutional email of the record (E-58). The app looks up anything else as an Authorization Number, as before. The app does not check the length of the Authorization Number, because the length can change (6 and 7 characters have been seen); letters stay allowed (E-128). A 10-digit number that is not on the roster gets the message of REQ-F-76 and says that the student number is only for athletes and that a paid member uses the Authorization Number from the receipt email, with the picture of where to find it. The app never looks up a 10-digit number as an Authorization Number. The lookup limits (REQ-F-71) cover the one field. Why: fewer screens and fewer choices. Replaces E-112. SRS REQ-F-15, REQ-F-71, REQ-F-76, REQ-F-91. | Team | 2026-11-05 |
| E-155 | Waiver signature | For the midterm, the person accepts the waiver with a checkbox on screen, as today. For the Final report, the app also asks for a drawn signature, because the department wants a signature as well as the acceptance. First the team researches how to capture and store it: the screen, the file format, the size, and how it enters the backups. Until then the data model has no signature column. SRS REQ-F-60. | Team | 2026-11-06 |
| E-156 | Time left notice | There is no "15 minutes left" notice before the 60-minute use guideline ends. The team proposed it at the CTI meeting; it was never a requirement, and the Gym ID shows no countdown (E-129). The athletes-only notice (REQ-F-83) stays. | Team | 2026-11-06 |

## Decisions from the dashboard base (2026-11-06)

The team settled these while building the dashboard base, after the Athletic Activities decisions above.

| ID | Topic | Answer | Answered by | Date |
|---|---|---|---|---|
| E-152 | Date and time format | Dates and times follow the Figma wireframes: the short form of each language, in Puerto Rico time. Spanish `5 nov 2026, 8:30 a. m.`, a time alone `9:28 a. m.`, and a time from today `Hoy, 10:42 a. m.`. English `Nov 5, 2026, 8:30 AM`, `9:28 AM` and `Today, 10:42 AM`. Changes E-22, which used an ISO date with 12-hour time for both languages (`2026-10-13 3:05 PM`). SRS REQ-NF-38. | Team | 2026-11-06 |
| E-154 | One source for error texts | Every `/api` error is `{"error": {"code": "...", "details": {...}, "debug": {...}}}`. There is no `message` field. `details` is optional and `debug` only appears with `APP_DEBUG=true`. For `validation_failed`, `details` maps each field to a list of rule codes in snake_case, for example `{"email": ["required"], "password": ["min"]}`, with no text. The PWA holds the only texts, in `frontend/src/i18n/es.ts` and `en.ts`, under `errors.<code>` and `validation.<rule>`. An unknown code shows the general `bad_request` text, or `server_error` for a 5xx status. An unknown rule shows a general "check this field" text. The backend no longer translates API errors: `backend/lang/*/errors.php` and the `SelectAccountLocale` middleware are removed. The backend translates only what does not pass through the PWA, such as emails (REQ-NF-35), using the account's `locale` when it sends them. A frontend test reads the codes the backend can send and fails if a code has no text in both language files. A backend test checks that codes are snake_case plain strings. Why: the same 13 texts lived in both the backend and the frontend files, a test had to keep them equal, every new code had to be added in two places, and errors raised before the account is known (404, 405, 419) could not follow the account language. The PWA always knows the account language, so it translates. Updates REQ-NF-34 and the error format in `docs/design/api-conventions.md`. Replaces the backend part of issue #97 ("API errors in the account language"). | Team | 2026-11-06 |
| E-157 | Staff dashboard address | The staff dashboard lives at `/staff`, under the app's own name, with no link from the User sign-in. Completes E-124, which left the path name open. It is a route of the same PWA build, not a separate app, which confirms E-65. N-11 (staff sign-in) opens at `/staff`; staff password reset (#84) goes at `/staff/recuperar`. The API keeps its own prefix, `/api/staff/...`, so the proxy rule of D2 does not change. Why: the path matches the role name and the API routes, and the desk computer bookmarks one short address. Decided while building #16. | Team | 2026-11-06 |

## WooCommerce import

### E-55: Review the Export Orders example

| Field | Value |
|---|---|
| Question | Review the Export Orders example: columns, how the term is read, and whether the Authorization Number is unique. |
| Affects | REQ-F-28 Load an Export Orders file; REQ-F-29 Fields the import copies; REQ-F-10 Validate the Authorization Number (with E-30) |
| Feature | 3.5 WooCommerce Import, 3.2 Paid Member Registration |
| Why we ask | The team has an example file but cannot share it yet. The import cannot be designed without the real columns. |
| Owner | Carlos Pepin |
| Status | Answered (E-127, E-128) |
| Answer | The orders were read from the store's API instead of an export file. The fields the app needs, where each lives and what it stores are in E-127 and E-128. |
| Answered by | Team |
| Date | 2026-11-05 |

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
