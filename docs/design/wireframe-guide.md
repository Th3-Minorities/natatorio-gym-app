# Wireframe guide

## 1. What this guide is

This guide is for whoever draws the wireframes of issues #40 to #45. For each issue it says how many screens you draw, in which order, and what each screen must show. Everything in it comes from the [screen map](screen-map.md), the issue bodies and the team decisions. If this guide and the screen map ever disagree, follow the screen map and tell the team.

How to use it: pick an issue, read its section in [5. The six issues](#5-the-six-issues), open the diagrams listed there, then draw the screens in the table order with every state in the "States to draw" column.

## 2. Legend

### Screen letters

| Letter | Meaning |
|---|---|
| N | Not signed in: public screens, sign in and registration entry points |
| U | User: a paid member or an athlete, signed in to the User app |
| C | Shared by every role (C-02 and C-03 are also public on N-01) |
| S | Staff: a staff account with the Staff role, on the gym dashboard |
| A | Administrator: a staff account with the Administrator role, on the gym dashboard |

### IDs

One letter, a hyphen and two digits, for example `U-01`. IDs never change. A removed screen keeps its number so the other IDs do not shift: A-03 (E-102), A-06 (E-127), N-10, N-12, S-04, A-01, A-02 and A-14 (E-114, E-117) were removed and their IDs are not reused. Do not draw them.

### Device

"Phone" means you design it for a phone first. "Desk" means the gym mostly uses it on the front desk desktop computer, which the gym still has to confirm (G-06). Every screen must still work on both sizes (REQ-NF-10). "Both" means people use it on phones and on the desk computer.

### Key states

A key state is one version of a screen that you draw on its own. Diagram 7 of the screen map (Standard data states) names the first four; the inventory adds Wait and Special.

| State | What you draw |
|---|---|
| Loading | The screen while data or an action is on its way: a placeholder or a busy button |
| Empty | The screen with nothing to show, for example "no notices". Empty is never an error |
| Error | The message for a failed action or server error, usually with Retry |
| No connection | The persistent top banner; loaded content stays with "not current, updated at TIME"; actions that need the server are disabled with a reason |
| Wait | A limit was reached: "try again at TIME" |
| Special | Anything that only this screen has, for example "link sent to `m***z@upr.edu`" |

### Codes in the tables

| Code | Meaning | Where to find it |
|---|---|---|
| REQ-F-N, REQ-NF-N | A requirement (F functional, NF non-functional) | `docs/requirements/SRS.md` |
| E-N | A team decision, with who decided and when | `docs/decisions/team.md` |
| G-N | A question for the gym, some still open | `docs/decisions/gym.md` |
| M-N | A question for CTI, some still open | `docs/decisions/cti.md` |
| SM-N | A screen map design decision (SM-1 to SM-6, all decided) | [screen map](screen-map.md), "Design decisions to confirm" |
| REG-N | A registration design decision | [registration flows](registration-flows.md) |
| check-in D-N | A Check In design decision | [Check In flows](check-in-flows.md) |
| admin D-N | A staff account and administration design decision | [administration flows](admin-flows.md) |
| WCAG N.N.N | An accessibility rule of WCAG 2.2 | screen map section 11 |

## 3. Totals

| Issue | Name | Screens |
|---|---|---|
| #40 | Registration screens | 7 |
| #41 | Check In and Gym ID screens | 3 |
| #42 | Sign in and account screens | 12 |
| #43 | Staff screens | 3 |
| #44 | Content screens and analytics | 7 |
| #45 | Administration screens | 9 |
| | Total | 41 |

Changes from the original issue lists: A-03 Administration menu was removed (E-102), and U-09 My visits was added to #42 (E-105). On 2026-11-04 N-10 and S-04 (in-person registration, E-117) left #40, N-12 (recovery code, E-114) left #42, A-01 and A-02 (PIN, E-114) left #43, and A-14 (Security, E-114) left #45. A-15 Staff accounts, A-16 Backups and A-17 Manual entries joined #45. A-06 (file upload, E-127) left #45 and A-07 became the Store sync screen. The total is 41.

## 4. Recommended work order

Proposed; the team can change it.

| Step | Issue | Why at this point |
|---|---|---|
| 1 | #42 Sign in and account | It holds the app frame of screen map diagram 6 (top bar, no-connection banner, bottom tabs, side menu) and the entry screens N-01, N-02 and N-11. Most other flows start from these screens or return to them. |
| 2 | #41 Check In and Gym ID | U-01 is the User home. C-01, the occupancy card, sits on every home (U-01, U-07, S-01), so the later homes reuse it. |
| 3 | #43 Staff | S-01 is the gym dashboard home: the menu with the Staff items and, for Administrators, the Administrator items. S-03 (#41) opens from S-01, and every A screen opens from the S-01 menu. |
| 4 | #40 Registration | The registration flows end on U-01, drawn in step 2. U-07, in this issue, reuses the C-01 card and the tabs. |
| 5 | #44 Content and analytics | C-02 to C-05 sit behind the tabs and the dashboard menu, which exist by now. A-10 to A-12 need the S-01 menu from step 3. |
| 6 | #45 Administration | Every A screen opens from the S-01 menu for Administrators from step 3. |

If you work in parallel, the gym dashboard is its own path (E-65, E-124), so one person can take the User app track (#42, #41, #40: 22 screens) and the other the dashboard track (#43, #45, then #44: 19 screens). The User app issues also hold two dashboard screens (N-11, S-03). Where a screen links to one that someone else draws, draw the link as a labeled button.

## 5. The six issues

The sections follow the order of section 4. In each table, "Who sees it" is the Roles column of the screen map, "What it must show" is its Purpose, and "States to draw" is its Key states. "Comes from" and "Leads to" come from the navigation diagrams; "none drawn" means the diagrams draw no exit for that screen.

### Issue 42: Sign in and account

You draw 12 screens.

Draw the app frame first (screen map diagram 6). It is not one of the 13 screens, but every User screen sits inside it: a top bar with the persistent no-connection banner and no language button, bottom tabs on the phone (Home, Hours, Notices, Stats, More) and the same items as a side menu on wide screens (SM-1). Home is U-01 or U-07. More holds C-04, U-03, N-08 and N-09.

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| N-01 | Landing | Not signed in | Choose sign in or register; Install button; links to N-08 and N-09; public schedules (C-02) and notices (C-03); one line that registering needs a paid membership or a roster entry, with the contact number; a "Buy membership" button that opens the store (no redirect, only while a term runs; the address is a setting, E-126) | Loading: app shell. No connection: banner, sign in and register disabled. Install button hidden where the browser has no install event. Signed in: redirect to home. Language: always Spanish before an account exists (E-103) | Phone | Opening the app; U-03 Sign out; U-05 after deletion | N-02, N-03, N-04, N-08, N-09; the store; a signed-in person goes to the home of diagram 2, 3 or 4 |
| N-02 | Sign in | User | Email and password; "Forgot password" link. No link to N-11 (SM-5) | Loading: button busy. Error: wrong credentials, without saying if the email exists (SRS 3.1). Wait: "try again at TIME" (REQ-F-07). No connection: form kept, submit disabled. Special: "you signed in on another device" (REQ-F-03). Language: Spanish while signed out; the account language applies after sign in (E-103) | Phone | N-01; N-03 or N-04 when the email already has an account; N-07; N-05 when not signed in here; U-01 when signed in on another device | N-06; after sign in: U-01, U-07 or U-02 |
| N-08 | Privacy notice | Everyone | Notice in Spanish and English, shown before any personal data | Loading. Error. No connection: the notice is static text in the app, so it still shows. Text pending G-24 | Phone | N-01; step 1 of N-03 and N-04; More menu | none drawn |
| N-09 | Install help | Everyone | Install button in Chromium browsers; iPhone steps with Share | Special: button hidden without the install event; "already installed" when opened as the installed app. Static, works without connection | Phone | N-01; More menu | none drawn |
| N-06 | Forgot password | User | Ask for a reset link | Loading. Error: server error. No connection. Special: the same answer whether the email exists or not: "if that email has an account, we sent a link" (E-63) | Phone | N-02 | Email with reset link, then N-07 |
| N-07 | Set new password | User | From the reset link: new password | Loading: link check. Error: link expired or used; password rules. No connection | Phone | Email with reset link | N-02 |
| U-03 | Account | User | Name, account email (read only), current authorization and term, language choice (C-06), links to U-04, U-09, U-05, U-06 (only without an active authorization), sign out | Loading. Error. No connection: data marked not current | Phone | More menu, from U-01 or U-07 | U-04, U-09, U-05; U-06 only without an active authorization; N-01 (Sign out) |
| C-06 | Language setting | Users and staff accounts | Spanish or English for every text. A setting, not a screen. Asked when the account is created (N-03, N-05), with a notice that it can change later; changed in the preferences of U-03. No button in the top bar of the User app (E-64). The gym dashboard may have one (E-104) | Special: one language per account, saved on the account for Users and for each staff account, so a change applies on every computer (E-64); page `lang` changes with the texts. On the dashboard the control may be a setting, a button in the dashboard top bar, or both; the wireframe picks the placement (E-104) | Both | U-03 (Users); the dashboard (staff accounts); account creation on N-03, N-05 | none drawn |
| U-04 | Emergency contact | User | See and edit the emergency contact at any time; Staff always see the current value (E-79, REQ-F-60) | Loading. Error: name or phone invalid. No connection: save disabled | Phone | U-03 | none drawn |
| U-09 | My visits | User | The User's own past Check Ins, newest first, each with date and time. Location is never shown (REQ-NF-03). It shows the full history, kept 5 years (E-126, E-125) | Loading. Empty: no Check Ins yet. Error: message with Retry. No connection: loaded list stays with "not current, updated at TIME"; with nothing loaded, the no-connection message (SM-6) | Phone | U-03 | none drawn |
| U-05 | Delete account | User | Explain what is deleted and kept, confirm | Error: refused with the reason while an authorization is active. No connection: disabled. Special: after deletion, back to N-01 | Phone | U-03; More menu of a User with no active authorization | N-01 |
| N-11 | Staff sign in | Staff, Administrator | Email and password of a staff account, on the dashboard path with no link from N-02 (SM-5, E-124) | Loading. Error: wrong credentials. Wait: REQ-F-07. No connection. Special: a deactivated account is refused (REQ-F-88) | Desk | Typing the dashboard address; S-01 Sign out | S-01 (correct password) |

#### Open items for this issue

- N-08 privacy notice text: the team drafts it and the gym approves it (G-24). Draw the layout with placeholder text.
- N-01 contact number is 265-3866 (G-25). The store address is a setting that is not known yet (E-92): draw a labeled placeholder. The store button shows only while a term runs.
- N-06 and N-07 use outgoing mail, which the team assumes is available (E-61). Draw them as normal screens. The issue body still says "only with outgoing mail"; that condition no longer applies.
- U-09: the list shows the full history (E-126). Draw a plain list.
- Dashboard language control (E-104): you pick the placement: a dashboard setting, a button in the dashboard top bar, or both. Each staff account has its own language.
- The issue body calls C-06 "Language switch". The screen map calls it "Language setting" and says it is a setting, not a screen. It still counts in the 13.

#### Diagrams to read

- [Screen map](screen-map.md) 1. Public screens; 2. User with an active authorization; 6. Shared screens and the app frame; 7. Standard data states
- [Administration flows](admin-flows.md) 1. Staff account states (N-11)
- [Administration flows](admin-flows.md) 14. Account deletion when a User asks (what U-05 explains is deleted and kept)
- [Check In flows](check-in-flows.md) 4. Facility session states (its notes describe where U-09 reads its data)

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR

Desk screen in this issue: N-11. Draw it desktop first.

### Issue 41: Check In and Gym ID

You draw 3 screens.

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| C-01 | Occupancy card | User, Staff, Administrator | Estimated occupancy with "updated at TIME", on every home | Loading: placeholder, no number. Empty: 0 is a real value. Error and no connection: number hidden, "not current" with icon (REQ-NF-26). Polls every 20 to 30 s (check-in D6) | Both | Sits on U-01, U-07 and S-01 | C-05 Analytics, today (tap) |
| U-01 | Check In and Gym ID | User with active authorization | Home. Check In button; Gym ID after a valid Check In; C-01 card | Empty: no session yet, Check In button. Loading: checking eligibility, waiting for location, sending. Error: one state per cause code of check-in D5, with the text written by the app in the account's language (no authorization, gym closed, athletes-only, location denied with how to turn it on, location unavailable, low accuracy, outside boundary, new term photo needed, photo pending). No connection: Check In refused; Gym ID shows "not valid now" and the clock stops (SM-6). Special: paid member active with "Active session", the Check In time and the moving clock, no countdown (E-129); session ended shown with text and icon (checked out, closed automatically, closed by closure); athlete shown as "Authorized athlete, Fall 2026" (the term) with the moving clock, never time left, never "expired"; tag "Athlete" or "Member" with an icon and a different color for each (colors to pick); invalid after roster removal; athletes-only notice with start time for every User, and the theme color of the app changes during that period (E-76) | Phone | After sign in (N-02); saved on N-03, N-05, U-02 or U-08; N-05 Continue | U-02 (Check In rejected: new term photo needed); Hours, Notices and Stats tabs (C-02, C-03, C-05); More menu (C-04, U-03, N-09, N-08); U-07 when the authorization expires, is revoked or the athlete is removed from the roster; N-02 when signed in on another device |
| S-03 | Person lookup and Staff-assisted Check In | Staff, Administrator | Search by name (paid member) or student number (athlete); compare the photo; confirm Check In; link to S-05 to check the roster | Loading. Empty: no match. Error: cause keys (no authorization, photo required, photo pending, gym closed, athletes-only for paid members). No connection: disabled. Special: person already has an active session, shown instead of a new one; opens with the student number filled in after "Check In this athlete" on S-05; the student number is shown in full (E-81) | Desk | S-01 (name not in active sessions, or the Assisted Check In button); S-05 (Check In this athlete) | S-01 (photo matches, confirm); S-02 (open person); S-05 (check the roster) |

#### Open items for this issue

- Colors of the "Athlete" and "Member" tags and of the athletes-only theme are the owner's choice and are not picked yet (E-75, E-76). Draw the tag with its text and icon, and write a note where the color changes. No colors in the wireframe.
- The rejection texts are written later (E-74). Draw each cause with a draft text that names the cause.
- The issue body lists 7 rejection causes. The screen map adds an eighth, "new term photo needed", which opens U-02 (drawn in #40), and a ninth, "photo pending" (E-118), which also leads to U-02. Draw both as U-01 states too.
- S-03 is Desk. If the gym says Staff also use phones (G-06), S-03 needs a phone layout too.
- The athletes-only periods themselves are not known yet (G-28). Draw the notice with a placeholder start time.

#### Diagrams to read

- [Screen map](screen-map.md) 2. User with an active authorization; 4. Staff (S-03); 6. Shared screens and the app frame; 7. Standard data states
- [Check In flows](check-in-flows.md) 1. Check In checks before location (the order of the rejection causes)
- [Check In flows](check-in-flows.md) 2. Check In location checks and session creation
- [Check In flows](check-in-flows.md) 5. Staff-assisted Check In
- [Check In flows](check-in-flows.md) 11. Staff check-out and photo pending
- [Check In flows](check-in-flows.md) 6. Gym ID states: paid member; 7. Gym ID states: athlete
- [Check In flows](check-in-flows.md) 8. Athletes-only notice during a session, and its part "Theme color during the athletes-only period"
- [Check In flows](check-in-flows.md) 9. Occupancy counting (C-01 polling)

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR

Desk screen in this issue: S-03. Draw it desktop first.

### Issue 43: Staff

You draw 3 screens.

The gym dashboard is its own path, not part of the User app (E-65, E-124). Draw its frame on S-01: the menu with the Staff items, the Administrator items (shown to Administrators only, E-114), and the C-01 card. The dashboard does not change color during the athletes-only period (E-76).

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| S-01 | Active sessions | Staff, Administrator | Home of the dashboard. C-01 card, list of active sessions with name, Check In time, authorization, and time left before the automatic close for paid members (for an athlete the list shows "athlete" and the Check In time instead, E-99); a Check out action on each row (E-115); search by name; the menu shows the Administrator items only to Administrators (E-114) | Loading. Empty: "no active sessions". Error. No connection: list marked not current, actions disabled. Search is a fresh request, never cached. Also draw the menu as an Administrator sees it (screen map diagram 5) | Desk | N-11 (correct password); S-02 or S-03 after their action | S-02, S-03, S-05; C-02 to C-05 (menu); N-11 (Sign out); for Administrators: A-04 to A-13, A-15 to A-17 |
| S-02 | Person and session detail | Staff, Administrator | Photo from the backend, authorization, waiver acceptance, emergency contact, session; Check out, End early and Void with confirm; Mark photo pending (E-118) | Loading: photo. Error: session already ended or changed by another browser. No connection: actions disabled. Special: only active sessions can be checked out, ended early or voided; no list of past sessions, and past statistics do not change (E-80). With a photo pending: the mark shows, and Check In stays off until the person uploads a new photo | Desk | S-01 (tap a session); S-03 (open person) | S-01 (Check out, End early, Void or Mark photo pending, after confirm) |
| S-05 | Athlete roster | Staff, Administrator | Read-only list of the roster records; search by name or student number; "Check In this athlete" opens S-03 (E-59) | Loading. Empty: "no records". Empty search: no match. Error. No connection: list marked not current, search disabled. Special: no add, edit or remove controls; search is a fresh request, never cached; the student number is shown in full (E-81). Gym still to confirm (G-09) | Desk | S-01 menu: Roster; S-03 (check the roster) | S-03 (Check In this athlete, number filled in) |

#### Open items for this issue

- Front desk devices (G-06): the gym has not confirmed. Draw Desk first. If Staff also use phones, S-01 to S-03 and S-05 need the phone layout too; the issue body says to draw it only if the gym says so.
- S-05 waits on the gym's yes (G-09). Draw it anyway; the team decided it (E-59).
- Dashboard language control (E-104): a setting, a button in the dashboard top bar, or both. Pick it together with whoever draws C-06 (#42).
- The issue's "Done when" says "phone size first", while its scope says "Desktop first". The screen map marks all five as Desk, so draw desktop first.

#### Diagrams to read

- [Screen map](screen-map.md) 4. Staff (staff account with the Staff role); 5. Administrator (staff account with the Administrator role); 6. Shared screens and the app frame; 7. Standard data states
- [Administration flows](admin-flows.md) 1. Staff account states (what Staff and Administrators see)
- [Check In flows](check-in-flows.md) 4. Facility session states (Check out, End early and Void)
- [Check In flows](check-in-flows.md) 11. Staff check-out and photo pending
- [Check In flows](check-in-flows.md) 10. Staff verification of a Gym ID (active sessions list and roster search)

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR

All three screens are Desk. Draw them desktop first.

### Issue 40: Registration

You draw 7 screens.

N-03 and N-05 are wizards inside one page: typed data stays in the page until the final save and is lost on reload (REG-8). Draw each step.

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| N-03 | Register as paid member | Not signed in | Steps: privacy notice, Authorization Number, masked email, password, photo (take it now or upload it; the screen says it cannot be changed), waiver and emergency contact, choose language (Spanish or English; it can be changed later in the account preferences), final save. A line says a paid membership is needed first, with the contact number and a "Buy membership" button that opens the store (no redirect, only while a term runs; the address is a setting, E-126) | Loading: lookup after 6 characters, letters allowed (E-128); if the number is not in the app yet, the lookup asks the store right then (REQ-F-97), and if the store does not answer the message says to try again later; slow mode waits (REG-2). Error: one message for an invalid number, a claimed number and a number from an ended term, with contact number (lookup covers the current term only, REG-9); per-IP pause "try again at TIME"; photo rejected, stays on the photo step with data kept in the page, lost if the page closes (REG-8). No connection: data kept in page, submit disabled. Special: "you already have an account, sign in to add it" with the masked email, for example `m***z@upr.edu`; nothing is claimed (REG-4, REG-3) | Phone | N-01 | N-08 (step 1); N-02 (email already has an account); after the save, signed in: U-01, U-07 or U-02 |
| N-04 | Register as athlete | Not signed in | Privacy notice, student number, link sent. The language is chosen at N-05, where the account is created. A line says the athlete must be on the roster, with the contact number. No store button, because athletes do not buy (E-96); a paid member who lands here goes back to N-01 | Loading: lookup. Error: not on the roster with contact number (REQ-F-76); record claimed; link request limit (1 link every 5 minutes and 5 per day for each student number, REG-7). No connection: submit disabled. Special: "link sent to `m***z@upr.edu`", first and last letter before the @ (REG-3); "you already have an account, sign in to add it" with the masked email; nothing is claimed | Phone | N-01 | N-08 (step 1); N-02 (roster email already has an account); email with athlete link, then N-05; N-01 for a paid member |
| N-05 | Athlete link landing | Not signed in, or a User | Two modes. From an N-04 link: password, photo (take it now or upload it; the screen says it cannot be changed), waiver, choose language (Spanish or English; it can be changed later in the account preferences), one final save. No authorization exists without the photo (E-69). From a U-06 link: the photo step, then the roster record is linked to the account that asked and a confirmation (E-58) | Loading: link check. Error: link expired, already used or replaced, record claimed since (REG-6); photo rejected, back to the photo step with data kept. No connection: data kept, submit disabled. Special (U-06 mode): "record linked to the account `m***z@...`" with Continue when that account is signed in here, Sign in otherwise | Phone | Email link sent from N-04 or from U-06 | N-04 mode: home after the save (U-01, U-07 or U-02). U-06 mode: U-01 (Continue) or N-02 (Sign in) |
| U-07 | No-authorization home | User with no active authorization | Banner on top, Check In shown but grayed out, Authorization Number field, I am an athlete, contact number, C-01 card. Same tabs as U-01; the Home tab shows U-07 (SM-4) | Loading. Error. No connection: field disabled. Special: two banners (E-67, REQ-F-23). Expired: "Your authorization has expired. Renew to use Check In." with the Authorization Number field (U-08) and I am an athlete. Any other cause (revoked, number released, athlete removed from the roster, no current term): "You have no active authorization. Contact the gym." with the contact number and the Authorization Number field (E-97, REQ-F-74). A number that cannot be claimed gets the same message with the contact number. I am an athlete shows under both banners (E-100). Contact number pending G-25 | Phone | Sign in or app open with no active authorization; U-01 when the authorization ends | U-08 (6 characters typed, lookup passes); U-07 again (lookup fails or paused); U-06; Hours, Notices and Stats tabs; More menu (C-04, U-03, N-08, N-09, U-05) |
| U-08 | Renew with Authorization Number | User with no active authorization | After a valid number: masked email, renewal or type change, photo, confirm | Loading: lookup, save. Error: same messages as N-03. A number whose payment email belongs to another account is accepted: having the number is the proof (E-70). No connection: data kept, submit disabled | Phone | U-07 | U-01 (saved) |
| U-06 | I am an athlete | User with no active authorization | Student number, then "check your institutional email". Nothing is linked yet: the record is linked only when the email link is opened at N-05, where the photo is also saved (E-58) | Loading. Error: not on the roster with contact number (REQ-F-76); record claimed; link request limit (1 link every 5 minutes and 5 per day for each student number, REG-7). No connection: submit disabled. Special (end state): "check your institutional email `m***z@upr.edu`" | Phone | U-07; U-03 (only without an active authorization) | End state "check your institutional email"; email link, then N-05 in U-06 mode |
| U-02 | New term photo | Athlete in a new term; manual grant without photo; any User whose photo Staff marked pending | Upload the term photo before Check In. Opens at the first app open in the new term, after the roster is found by the student number of the account's last claim (REG-10). It also opens when Staff mark the photo pending (E-118) | Loading: upload. Error: type or size (REQ-NF-24); record claimed by another account, contact number. No connection: upload disabled. Special (photo pending): the new photo replaces the old one during an active authorization; whether the upload clears the mark by itself or Staff approve it is open (E-118) | Phone | Sign in or app open of an athlete in a new term with the photo owed; U-01 (Check In rejected: new term photo needed or photo pending) | U-01 (saved) |

#### Open items for this issue

- Contact number: 265-3866, the office's direct line (G-25). N-03, N-04, U-06, U-07, U-08 and the U-02 error show it.
- Store address (E-92): N-03 has a "Buy membership" button while a term runs, with no redirect (E-126). The address is a setting that is not known yet: draw it with a placeholder address. N-04 has none (E-96).
- Outgoing mail is assumed (E-61), so draw the email link flows (N-04, N-05, U-06) as the normal path. There is no in-person registration any more (E-117), so N-10 and S-04 are not drawn. The issue body still says "only if the school has no outgoing mail" and asks for both versions of the athlete flow; one version is enough now.
- U-07 banner texts are drafts; you write the final wording in the wireframe (E-67).
- N-05 in U-06 mode: the order of sign in and photo is left to the wireframes (screen map diagram 3). You choose it.
- N-08 privacy notice text (G-24) appears as step 1 of N-03 and N-04: use placeholder text.

#### Diagrams to read

- [Screen map](screen-map.md) 1. Public screens; 3. User with no active authorization; 7. Standard data states
- [Registration flows](registration-flows.md) 1. Paid member registration
- [Registration flows](registration-flows.md) 4. Athlete registration by email link
- [Registration flows](registration-flows.md) 6. Renewal and type change with a new Authorization Number
- [Registration flows](registration-flows.md) 7. "I am an athlete" inside the account
- [Registration flows](registration-flows.md) 8. Athlete in a new term

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR


### Issue 44: Content and analytics

You draw 7 screens.

Every A screen also shows Loading, "No connection: actions disabled", and the notice when no term covers today (E-85).

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| C-02 | Schedules | Everyone, also before sign in (shown on N-01) | Regular hours, special hours, closures, athletes-only slots; "open now" or "closed now" | Loading. Empty: "no schedule published". Error. No connection: loaded content stays with "not current, updated at TIME" (SM-6) | Both | N-01; Hours tab; dashboard menu | none drawn |
| C-03 | Notices | Everyone, also before sign in (shown on N-01) | Current maintenance notices and updates | Loading. Empty: "no notices". Error. No connection: loaded content stays with "not current, updated at TIME" (SM-6) | Both | N-01; Notices tab; dashboard menu | none drawn |
| C-04 | Facility information | User, Staff, Administrator | Rules, towel, footwear, machines, equipment instructions | Loading. Empty per topic. Error. No connection: loaded content stays with "not current, updated at TIME" (SM-6). Stretch: a QR code opens one topic (REQ-F-59) | Both | More menu; dashboard menu | none drawn |
| C-05 | Analytics | User, Staff, Administrator | Period picker and metrics (a) to (g) of REQ-F-61: visits per day and per hour with the peak hour, athletes against student members and employee members, visits per sport. Manual authorizations count as paid members for every rule (E-126); how they show is to confirm. Administrators also see a button to download the end-of-term summary (REQ-F-96) | Loading. Empty: zeros, not an error. Error. No connection: charts already loaded stay with "not current, updated at TIME" (SM-6) | Both | Stats tab; C-01 tap (today); dashboard menu | none drawn |
| A-10 | Schedules editor | Administrator | Regular hours, special hours, closures, athletes-only slots, Spanish and English text. Each slot repeats weekly or has a concrete date: the regular schedule is written once and exceptions are separate entries (E-90) | Loading. Empty. Error: Spanish text missing. No connection: actions disabled. Slot list pending G-28 | Desk | S-01 menu (Administrators) | none drawn |
| A-11 | Notices editor | Administrator | Create, edit, delete notices in Spanish and English. A help text says notices are public, so they must hold no sensitive data (E-66) | Loading. Empty. Error: Spanish text missing. No connection: actions disabled | Desk | S-01 menu (Administrators) | none drawn |
| A-12 | Facility information editor | Administrator | Edit rules, towel, footwear, machines, equipment instructions; edit the gym contact number (E-66) | Loading. Error: Spanish text missing; contact number empty or invalid. No connection: actions disabled | Desk | S-01 menu (Administrators) | none drawn |

#### Open items for this issue

- The athletes-only periods are not known yet (G-28). Draw the slot type in C-02 and A-10 with placeholder times.
- C-04 QR code per topic is a stretch goal (REQ-F-59). Mark it as optional on the wireframe.
- C-05 metrics (a) to (g) are listed in REQ-F-61 in the SRS. Draw aggregated counts only (issue scope). The content and format of the end-of-term summary are not decided (REQ-F-96): draw only the button.

#### Diagrams to read

- [Screen map](screen-map.md) 2. User with an active authorization (tabs); 4. Staff (menu); 5. Administrator (A-10 to A-12); 6. Shared screens and the app frame; 7. Standard data states
- [Administration flows](admin-flows.md) 16. Schedules, closures, notices and facility information
- [Administration flows](admin-flows.md) 9. No term for the current date (the notice on every A screen)

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR

Desk screens in this issue: A-10, A-11 and A-12. Draw them desktop first.

### Issue 45: Administration

You draw 9 screens. A-03 (E-102), A-06 (E-127) and A-14 (E-114) were removed: do not draw them.

Every A screen also shows Loading, "No connection: actions disabled", and the notice when no term covers today (every error names that reason, E-85).

| ID | Screen | Who sees it | What it must show | States to draw | Device | Comes from | Leads to |
|---|---|---|---|---|---|---|---|
| A-04 | Academic terms | Administrator | List, create and edit terms. No delete button: terms are never deleted, and a term created by mistake is fixed by editing it (E-107) | Loading. Empty: no terms, notice. Error: dates in wrong order; overlap names the other term. Special: no delete states; an edit is never blocked when records fall outside the new dates; records keep their term and only the end date of their authorization follows the new term end (E-88). No connection: save disabled | Desk | S-01 menu (Administrators) | none drawn |
| A-05 | Athlete roster | Administrator | List, add, edit and remove roster records by hand: name, sport, student number, institutional email. There is no file import (E-116). Athletes are added one at a time with a quick form: after saving, the form stays open and empty for the next athlete, except the sport, which keeps the last value; the current sport shows large at the top ("Adding athletes of: Volleyball") (E-139). Reinstate an athlete removed by mistake | Loading. Empty: no records yet. Error: repeated student number; Reinstate refused when the person already has an active authorization in that term (E-94). Special: the student number is shown in full (E-81); removal confirm says the Gym ID stops being valid at once. Reinstate returns the revoked authorization to active; it needs a reason of at least 10 characters (E-86) and writes an audit log entry (E-95) | Desk | S-01 menu (Administrators) | none drawn |
| A-07 | Store sync | Administrator | See when the last sync ran and its counts (orders created, updated, revoked and skipped), the skipped orders with their reason, and press "Sync now". The read-only key is not shown or edited here (E-127) | Loading: sync running, button busy. Empty: no sync yet. Error: the store did not answer, so nothing changed; show the error and the date of the last good sync. Special: a skipped order shows its reason (outside every term, Authorization Number used by another order, invalid field). No connection: Sync now disabled | Desk | S-01 menu (Administrators) | none drawn |
| A-08 | Accounts | Administrator | Find an account by name or email; see authorizations; grant manual, revoke (each with a reason; revoke is also how a refunded membership is handled, E-120); delete on the User's request after the Administrator confirmed in person, with identification, at the gym (E-89) | Loading. Empty: no match. Error: grant refused (term ended, or the person already has an active authorization in that term, E-94); reason missing or shorter than 10 characters, free text written to the audit log (E-86); delete refused with an active authorization. Special: a manual authorization counts as a paid member for every rule (E-126); the User is asked for the term photo on U-02 before Check In (E-69) | Desk | S-01 menu (Administrators) | none drawn |
| A-09 | Release Authorization Number | Administrator | Type the number; see account, masked email, claim time; confirm. The confirmation text says that releasing a number never deletes the account: only that authorization and its term photo go (E-106) | Loading. Empty: number not claimed. Special: the release deletes only that authorization and its term photo; the account, its other authorizations and its history stay, also when the claim created the account and it was the account's only authorization. The person signs in, sees U-07 and can claim the correct number (E-87, E-106, admin D12) | Desk | S-01 menu (Administrators) | none drawn |
| A-13 | Audit log | Administrator | Filter by date, action and staff account; roster changes are one of the filters (E-126). Entry with time, staff account, IP address, device, before and after; lookup alerts | Loading. Empty: no entries for the filter. Error | Desk | S-01 menu (Administrators) | none drawn |
| A-15 | Staff accounts | Administrator | List staff accounts with role and status; invite a Staff member by email (name, email); deactivate an account with confirm (REQ-F-88). Accounts are never deleted | Loading. Empty: only the first Administrator. Error: email already used by a staff account. Special: deactivated accounts stay in the list, marked; an invited account shows "invited" until the person sets a password. No connection: actions disabled | Desk | S-01 menu (Administrators) | none drawn |
| A-16 | Backups | Administrator | The date of the last backup; Back up now; Download a backup; Restore a backup already on the server, with confirm. Two backups are kept (E-122) | Loading. Empty: no backup yet. Error: backup or restore failed. Special: the restore confirm says it replaces everything saved after that backup, audit log entries included. No connection: actions disabled | Desk | S-01 menu (Administrators) | none drawn |
| A-17 | Manual entries | Administrator | Enter a paper log entry after an outage: find the person, type the entry time and the exit time (E-119). People without an account are entered only as a count for a time block, for example 3 visits on Tuesday from 2 to 4, with no names (E-132) | Loading. Empty: no manual entries yet. Error: exit before entry; overlaps another session of the person; a count of zero visits or a block that ends before it starts. Special: each entry writes an audit log entry with who entered it; counts are part of the visit totals and left out of distinct-people counts. No connection: actions disabled | Desk | S-01 menu (Administrators) | none drawn |

#### Open items for this issue

- Roster (E-116): draw adding, editing and removing records one by one. There is no upload of a list: the department keeps the lists in Word.
- Store sync (E-127): the orders come from the store's API, so there is no file upload and no import history. Draw A-07 with the last sync, its counts and the Sync now button. How long the saved sync rows are kept (REQ-NF-05) does not change the drawing.
- S-01 to A-17 are Desk, pending G-06. A screens stay desktop first even if Staff use phones.

#### Diagrams to read

- [Screen map](screen-map.md) 5. Administrator (staff account with the Administrator role); 7. Standard data states
- [Administration flows](admin-flows.md) 1. Staff account states
- [Administration flows](admin-flows.md) 4. Invite and deactivate staff accounts (A-15)
- [Administration flows](admin-flows.md) 6. WooCommerce store sync (A-07)
- [Administration flows](admin-flows.md) 8. Academic terms (A-04)
- [Administration flows](admin-flows.md) 9. No term for the current date
- [Administration flows](admin-flows.md) 10. Athlete roster: add, edit, remove (A-05)
- [Administration flows](admin-flows.md) 11. Removing and reinstating an athlete mid-term (A-05)
- [Administration flows](admin-flows.md) 12. Manual grant and revoke of an authorization (A-08)
- [Administration flows](admin-flows.md) 13. Release of a claimed Authorization Number (A-09)
- [Administration flows](admin-flows.md) 14. Account deletion when a User asks (A-08)
- [Administration flows](admin-flows.md) 15. Global lookup limit alert (A-13)
- [Administration flows](admin-flows.md) 18. Manual entries from the paper log (A-17)
- [Administration flows](admin-flows.md) 19. Backups (A-16)

#### Done when (from the issue)

- Every screen listed above has a wireframe, phone size first and desktop where it changes
- Another member approved it in a PR

All nine screens are Desk. Draw them desktop first.

## 6. Rules for every wireframe

- Draw every state in the "States to draw" column, including Loading, Empty, Error and No connection where the column lists them. Diagram 7 of the screen map applies to every screen that loads data.
- Phone first for every N screen except N-11, and for every U and C screen. Desk first for S-01 to S-03, S-05, A-04 to A-13, A-15 to A-17 and N-11 (pending G-06). C screens are used on both. Draw the other size where the layout changes. S-01, S-05 and A-13 are tables that need a wide layout.
- Write the texts in Spanish and leave room for English. Draft texts are fine where the final wording is still open.
- Leave out colors and final visual design: every issue puts them out of scope. Where the design says a color changes (the athletes-only theme, the "Athlete" and "Member" tags), write a note on the wireframe.
- Show every state with text and an icon, never with color alone (REQ-NF-14, WCAG 1.4.1). For example, the Gym ID states active, expired, "Authorized athlete", invalid and no connection each have a text label and an icon.
- Without a connection, a persistent banner in the top bar, with text and an icon, stays while there is no connection. Each section shows "updated at TIME". Loaded content stays with "not current". Occupancy shows no number. The Gym ID shows "not valid now" and its clock stops. Actions that need the server are disabled with a reason (SM-6, E-77). The User app goes back to its normal theme color (E-76).
- The User app has no language button in its top bar (E-64, E-104). The language is chosen when the account is created (N-03, N-05) and changed in U-03. N-01 and N-02 are always in Spanish (E-103). The gym dashboard may have a language button in its top bar, a setting, or both; each staff account has its own language (E-104).
- The gym dashboard menu shows the Administrator items only to Administrators. There is no padlock, PIN dialog, Lock button or "Administrator mode" bar (E-114).
- Every A screen shows a notice when no term covers today, and every error names that reason (E-85).
- Emails are masked with the first and last letter before the @, for example `m***z@upr.edu` (E-72). Staff and the Administrator see the student number in full on every screen they use (E-81).
- Bottom tabs and the Check In button are at least 24 by 24 CSS pixels, and the fixed tab bar must not cover the focused element (WCAG 2.5.8, 2.4.11). The other screen-specific notes are in section 11 of the screen map.

## 7. Diagram reading map

The design documents hold 55 numbered diagrams. Two are removed and keep their numbers: registration flows 5 and administration flows 5. Check In flows diagram 8 also has an unnumbered part, "Theme color during the athletes-only period", listed here as 8b.

| Document | Diagram | Issues that need it |
|---|---|---|
| [Screen map](screen-map.md) | 1. Public screens | #40, #42 |
| | 2. User with an active authorization | #41, #42, #44 |
| | 3. User with no active authorization | #40 |
| | 4. Staff (staff account with the Staff role) | #40, #41, #43, #44 |
| | 5. Administrator (staff account with the Administrator role) | #43, #44, #45 |
| | 6. Shared screens and the app frame | #41, #42, #43, #44 |
| | 7. Standard data states | all six |
| [Registration flows](registration-flows.md) | 1. Paid member registration | #40 |
| | 2. Authorization Number lookup with limits | not needed now |
| | 3. Final step: photo first, then account and claim | not needed now |
| | 4. Athlete registration by email link | #40 |
| | 5. In-person athlete registration by Staff (removed, E-117) | none |
| | 6. Renewal and type change with a new Authorization Number | #40 |
| | 7. "I am an athlete" inside the account | #40 |
| | 8. Athlete in a new term | #40 |
| | 9. Authorization states | not needed now |
| [Check In flows](check-in-flows.md) | 1. Check In checks before location | #41 |
| | 2. Check In location checks and session creation | #41 |
| | 3. Successful Check In | not needed now |
| | 4. Facility session states | #42 (U-09), #43 |
| | 5. Staff-assisted Check In | #41 |
| | 6. Gym ID states: paid member | #41 |
| | 7. Gym ID states: athlete | #41 |
| | 8. Athletes-only notice during a session | #41 |
| | 8b. Theme color during the athletes-only period | #41 |
| | 9. Occupancy counting | #41 |
| | 10. Staff verification of a Gym ID | #43 |
| | 11. Staff check-out and photo pending | #43 |
| [Administration flows](admin-flows.md) | 1. Staff account states | #43, #45 |
| | 2. Backend check on every gym request | not needed now |
| | 3. Install command and first Administrator | not needed now |
| | 4. Invite and deactivate staff accounts | #45 |
| | 5. Recovery with the recovery code (removed, E-114) | none |
| | 6. WooCommerce store sync | #45 |
| | 7. Undo of an import (removed, E-127) | none |
| | 8. Academic terms | #45 |
| | 9. No term for the current date | #44, #45 |
| | 10. Athlete roster: add, edit, remove | #45 |
| | 11. Removing and reinstating an athlete mid-term | #45 |
| | 12. Manual grant and revoke of an authorization | #45 |
| | 13. Release of a claimed Authorization Number | #45 |
| | 14. Account deletion when a User asks | #42 (U-05), #45 (A-08) |
| | 15. Global lookup limit alert | #45 |
| | 16. Schedules, closures, notices and facility information | #44 |
| | 17. Audit log entry and supporting data | not needed now |
| | 18. Manual entries from the paper log | #45 |
| | 19. Backups | #45 |
| [Data model](data-model.md) | 1. All tables and links | not needed now |
| | 2. Accounts and access tables | not needed now |
| | 3. Sessions and schedule tables | not needed now |
| | 4. Content and audit tables | not needed now |
| [Architecture](architecture.md) | 1. System context | not needed now |
| | 2. Containers on one host | not needed now |
| | 3. Development on each member's PC | not needed now |
| | 4. Production and demo | not needed now |
| | 5. Request path: one Check In | not needed now |

### Not needed for wireframes now

These diagrams describe the backend, the database or the servers. The issue names come from the "Start here" announcement (Discussion #51).

- Architecture 1 to 3: the project skeleton (#11, split into #46, #47, #48).
- Architecture 4: production on the CTI VM (#31).
- Architecture 5 and Check In flows 3: Check In with location (#17).
- Data model 1 to 4: the database (#13).
- Registration flows 2 and 3: paid member registration (#22).
- Registration flows 9: authorization status and renewal (#24).
- Administration flows 2, 3 and 17: staff accounts, install command and audit log service (#16); diagram 17 also for the database (#13).

## 8. Open items that affect wireframes

| Open item | Screens | What to do meanwhile |
|---|---|---|
| Store address is a setting and not given yet; the store button opens the store and shows only while a term runs (E-92, E-96, E-126) | N-01, N-03 | Draw the button with a placeholder address. N-04 has no store button |
| Outgoing mail: assumed available (E-61). CTI described a relay through its mail gateway after it authorizes the VM (M-07); the authorization, SPF and DKIM are still open | N-04, N-05, N-06, N-07, U-06 | Draw the mail flows as the normal path |
| Front desk devices (G-06) | S-01 to S-03, S-05, A-04 to A-13, A-15 to A-17, N-11 | Draw Desk first. If Staff also use phones, S-01 to S-03 and S-05 need a phone layout |
| Staff see the roster: gym yes pending (G-09) | S-05, S-03 link to S-05 | Draw it as decided (E-59) |
| Privacy notice text (G-24) | N-08; step 1 of N-03, N-04 | Placeholder text |
| My visits range and retention (E-105, REQ-NF-05, G-03) | U-09 | Draw a plain list with no promise about the range |
| Tag colors and athletes-only theme color not picked (E-75, E-76) | U-01 and every User screen | No colors; text and icon, plus a note |
| Dashboard language control placement (E-104) | C-06, S-01 top bar | You pick: setting, top bar button, or both. Each staff account has its own language |
| Order of sign in and photo in N-05 U-06 mode (screen map diagram 3) | N-05 | You pick |
| U-07 banner texts are drafts (E-67) | U-07 | Write the final wording in the wireframe |
| Check In rejection texts written later (E-74) | U-01, S-03 | Draft texts that name each cause |
| Store sync layout: the counts and the skipped orders list (E-127) | A-07 | Draw the screen; the exact columns are your choice |
| Athletes-only periods not given (G-28) | C-02, A-10, U-01 notice | Placeholder times |
| Dashboard in the same codebase as the User app: to confirm (screen map Gaps 11) | S and A screens | No change to the drawings |
| Waiver form: on screen, signature or paper (G-21) | N-03, N-05 | Draw acceptance on screen |
| Users off campus (G-31) | none | Nothing to draw |
| Photo pending: does the new photo clear the mark by itself, or do Staff approve it (E-118) | U-02, S-02 | Draw the mark and the upload; leave the clearing step open |
| End-of-term summary: content and format not decided (REQ-F-96) | C-05 | Draw only the download button for Administrators |
| Manual entry for a person with no account (REQ-F-95) | A-17 | Draw the error state |
| Two registration paths (decided, E-112): "I paid for a membership" asks for the receipt number, with a picture of where it is; "I am an athlete" asks for the student number | N-01, N-03, N-04 | Draw the two paths |
| Backups panel: last backup, back up now, download, restore (E-122) | A-16 | Draw as decided |
