# Check In, session and Gym ID flows

This document draws how Check In decides, how a facility session lives and ends, how Staff do an assisted Check In and verify a Gym ID, what the Gym ID shows in each state, and how occupancy is counted. It covers SRS sections 3.6, 3.7 and 3.8 (GitHub issue #6). The backend is Laravel and the database is PostgreSQL (`docs/context.md` section 2). The single active session rule depends on a PostgreSQL exclusion constraint, so it depends on CTI accepting PostgreSQL (M-09). Values the SRS leaves to design are in "Design decisions to confirm". On 2026-11-04 the team decided that a session ends at a Staff check-out, 2 hours after Check In, or at a closure (E-115), and that Staff can mark a photo as pending (E-118).

<nav aria-label="On this page" markdown="1">

**On this page**

[Diagrams](#diagrams) · [Design decisions](#design-decisions-to-confirm) · [Open questions](#gaps-and-questions) · [Traceability](#traceability)

</nav>

## Diagrams

<nav aria-label="Diagram topics" markdown="1">

[Check In checks](#1-check-in-checks-before-location) · [Session states](#4-facility-session-states) · [Staff-assisted Check In](#5-staff-assisted-check-in) · [Gym ID states](#6-gym-id-states-paid-member) · [Occupancy](#9-occupancy-counting) · [Staff check-out](#11-staff-check-out-and-photo-pending)

</nav>

Legend used in the flowcharts: blue nodes run on the phone (PWA) or are Staff actions, yellow nodes run on the backend, red nodes are rejections, green nodes are outcomes that show a session.

### 1. Check In checks before location

**Type:** System flow. **Use it to:** write the backend eligibility check, its order, and one test per rejection.

```mermaid
flowchart TD
  A["User taps Check In"] --> B{"Request reaches the backend?"}
  B -- "No" --> R1["Reject: no connection<br/>no stored Gym ID shown as current"]
  B -- "Yes" --> C{"User has an active session?<br/>status active and backend time before its end"}
  C -- "Yes" --> S0["Return the current session and Gym ID<br/>no location asked, no new session"]
  C -- "No" --> D{"Current authorization?<br/>paid, athlete or manual, term not ended"}
  D -- "No" --> R2["Reject: no authorization<br/>status expired or not on the roster"]
  D -- "Yes" --> E{"Photo saved for this term?"}
  E -- "No" --> R3["Reject: new term photo needed<br/>opens the photo upload"]
  E -- "Yes" --> E2{"Photo marked pending by Staff?"}
  E2 -- "Yes" --> R3b["Reject: photo pending<br/>the person uploads a new photo"]
  E2 -- "No" --> F{"Gym open now?<br/>schedule slots minus closures"}
  F -- "No" --> R4["Reject: gym closed"]
  F -- "Yes" --> G{"Athletes-only period now<br/>and the User is a paid member?"}
  G -- "Yes" --> R5["Reject: athletes-only period<br/>with a notice"]
  G -- "No" --> L["Eligible: continue to<br/>the location checks"]

  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B client
  class C,D,E,E2,F,G,L back
  class R1,R2,R3,R3b,R4,R5 reject
  class S0 ok
```

**About this diagram:** Location is asked only when a new session must be created (REQ-F-37), so every check that does not need location runs first; the order and its reasons are in D1. Each rejection maps to one message key: `check_in_offline`, `check_in_no_authorization`, `check_in_photo_required`, `check_in_photo_pending`, `check_in_gym_closed`, `check_in_athletes_only` (full list in D5).

- Authorization is checked before enabling the Check In button. The wireframe has no separate "Verificando acceso" screen; its visible loading states are location and submission. The backend checks below and the final submission checks remain required (E-163).
- "No connection" is detected on the phone: the request fails or times out. There is no offline Check In (REQ-NF-26, SRS 2.4).
- The athlete photo check comes from REQ-F-26. A paid member uploads the photo at registration and renewal, so in practice only athletes get the "new term photo needed" rejection.
- Photo pending (REQ-F-94, E-118): Staff mark an account when its photo does not match the person. Check In is refused, also the Staff-assisted one, until the person uploads a new photo from their phone. The upload does not clear the mark: Staff approve the new photo on S-02, and only then can the person Check In (E-168).
- The athletes-only check applies only to paid members (REQ-F-82). Manual authorizations: see Gaps.

### 2. Check In location checks and session creation

**Type:** System flow. **Use it to:** build the location step on the phone and the backend Check In operation, with its error messages.

```mermaid
flowchart TD
  L["Eligible from the checks<br/>before location"] --> P{"Location permission state"}
  P -- "denied" --> R6["Reject: permission denied<br/>how to turn it on"]
  P -- "granted or not asked yet" --> Q["Ask the browser for one position<br/>high accuracy, no cached position"]
  Q -- "User denies the prompt" --> R6
  Q -- "unavailable or timeout" --> R7["Reject: location unavailable"]
  Q -- "position and accuracy" --> AC{"Accuracy at or below<br/>the threshold?"}
  AC -- "No" --> R8["Reject: low accuracy<br/>try again"]
  AC -- "Yes" --> BD{"Inside the gym boundary?"}
  BD -- "No" --> R9["Reject: outside the boundary"]
  BD -- "Yes" --> POST["Send coordinates and accuracy once<br/>to the Check In operation"]
  POST -- "connection lost" --> R1["Reject: no connection<br/>a retry returns the session if it was created"]
  POST --> RE{"Backend repeats the checks before location<br/>plus accuracy and boundary"}
  RE -- "a check fails" --> RX["Reject with that check's message<br/>no session"]
  RE -- "active session found<br/>or exclusion constraint hit" --> S0["Return the existing session and Gym ID"]
  RE -- "all checks pass" --> OK["Create one session that closes by itself after 2 hours<br/>return the Gym ID<br/>plus athletes-only notice if one starts inside it"]

  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class P,Q,AC,BD,POST client
  class L,RE back
  class R1,R6,R7,R8,R9,RX reject
  class S0,OK ok
```

**About this diagram:** The rejections map to the keys `check_in_location_denied`, `check_in_location_unavailable`, `check_in_low_accuracy` and `check_in_outside_boundary` (D5). Accuracy and boundary follow D2. The final submit repeats every check in the order set in D1, except the location permission: only the phone knows it. The backend requires a position and checks accuracy and boundary.

- Location comes from the browser Geolocation API (REQ-NF-11). The permission state is read before asking where the browser allows it; otherwise the error of the position request tells denied, unavailable or timeout apart.
- The phone checks accuracy and boundary only to answer fast. The backend repeats every check except the location permission and is the only one that decides. The client is never trusted for authorization. Location is a condition, not proof of presence (SRS 3.6).
- Coordinates travel once in the Check In request and are not stored. Only the result of the location check may be stored on the session (REQ-NF-03). The boundary, accuracy threshold and gym coordinates come from environment configuration (REQ-NF-28, REQ-NF-29).
- The 50 m check always runs at startup. Only a flag allows another boundary; development and the demo set it, production does not. Without the flag, a boundary farther than 50 m stops the app from starting (architecture D6, Decided (team, 2026-10-19), open to revision).

### 3. Successful Check In

**Type:** Sequence diagram. **Use it to:** write the Check In endpoint, its transaction, and the test for two simultaneous requests.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant PWA as PWA on the phone
  participant GEO as Browser Geolocation
  participant API as Laravel backend
  participant DB as PostgreSQL

  U->>PWA: Tap Check In
  PWA->>API: GET current session and eligibility (sign-in cookie)
  API->>API: Check the one-device rule
  API->>DB: Read active facility_sessions row for this User
  DB-->>API: None
  API->>DB: Read authorization, term photo, schedule_slots
  DB-->>API: Authorized, photo saved, open, no athletes-only block
  API-->>PWA: Eligible, location needed
  PWA->>GEO: Ask for one position
  GEO-->>PWA: Latitude, longitude, accuracy in meters
  PWA->>PWA: Pre-check accuracy and boundary
  PWA->>API: POST Check In with coordinates and accuracy, sent once
  API->>DB: BEGIN
  API->>DB: Re-read authorization, photo, schedule_slots
  API->>API: Check accuracy and boundary in memory, then drop the coordinates
  API->>DB: Read active session for this User
  DB-->>API: None
  API->>DB: INSERT facility_sessions, period from now() to now() plus 2 hours, status active
  Note over DB: Exclusion constraint, no two overlapping non-void periods for one User. Final guard. Needs CTI to accept PostgreSQL
  alt No other session for this User
    DB-->>API: Row created
    API->>DB: COMMIT
    API-->>PWA: 201 with session, Gym ID data, server time, athletes-only notice if any
  else A simultaneous request created one first
    DB-->>API: exclusion_violation (SQLSTATE 23P01)
    API->>DB: ROLLBACK, then read the session that won
    API-->>PWA: 200 with the existing session and Gym ID, as for an active session
  end
  PWA-->>U: Show the Gym ID
```

**About this diagram:** Step 3 is the one-device rule (REQ-F-03). The exclusion constraint is the final guard of REQ-F-36 and depends on CTI accepting PostgreSQL (M-09). The 200 answer follows REQ-F-37.

- Steps 13 to 24 are the single protected operation: re-check, look for an active session and create one, in one transaction. The read in step 16 gives a clean answer in the normal case. Under simultaneous requests both reads can see nothing, so the constraint decides (REQ-NF-42 tests this).
- Backend time is the database clock `now()` (REQ-NF-01). The response carries server time, so the elapsed duration uses the backend Check In time and does not trust the phone's own clock (E-163). The Gym ID shows no countdown for anyone: an active session shows "Active session" and the Check In time (E-129).

### 4. Facility session states

**Type:** State diagram. **Use it to:** write the session status column, the Staff check-out and corrections, and the rule for what counts in occupancy and analytics.

```mermaid
stateDiagram-v2
  [*] --> active : valid Check In or Staff-assisted Check In
  active --> checked_out : Staff check the person out
  active --> expired : backend time reaches start plus 2 hours, closed automatically
  active --> closed : closure starts or term ends, closed by closure
  active --> ended_early : Staff end it early, a correction
  active --> void : Staff void it, created by mistake
  checked_out --> [*]
  expired --> [*]
  closed --> [*]
  ended_early --> [*]
  void --> [*]

  note right of active
    Counts in occupancy and analytics.
    No transition extends a session.
  end note
  note right of void
    Record kept and logged.
    Counts in neither occupancy nor analytics.
  end note
```

- A session stays open until Staff check the person out (E-115, REQ-F-48): `status = 'checked_out'` and the end time is the time of the exit. This is the routine way a session ends. `ended_early` stays for corrections, so statistics tell them apart. A check-out is routine, not a correction, so it needs no audit entry of its own (to confirm).
- A session nobody closes ends by itself 2 hours after the Check In, computed from backend time (REQ-F-38). The app shows it as "closed automatically". It counts in analytics as a visit, not in occupancy.
- When a closure starts or the term ends, every active session gets `status = 'closed'` and the end time of that moment. The app shows "closed by closure" (E-115).
- The 60 minutes are a guide Staff apply when the gym is full; the app does not enforce them. A person may come back the same day: there is no daily limit, and each entry after a session ends counts as a visit. Stepping out briefly (the bathroom, the car) is the same session (E-115).
- Only Staff and Administrators can check out, end early or void (REQ-F-48). Each correction is an audit log entry (REQ-NF-39). Staff cannot extend a session or create one without authorization.
- Staff can check out, end or void only active sessions (E-80). Staff already list active sessions, so there is no Staff list of past sessions, and past statistics do not change. Who fixes a mistake found the next day is still open (see Gaps).
- The User's own past Check Ins are the visit history (E-105). The My visits screen (U-09), reached from the account (U-03), reads them from these session records. Each row shows the date and time, newest first. Location is never shown (REQ-NF-03). The list shows the full history, and records are kept 5 years (E-126, E-125).

### 5. Staff-assisted Check In

**Type:** User flow. **Use it to:** build the Staff assisted Check In screens and write its test cases.

```mermaid
flowchart TD
  A["User at the desk without a phone"] --> T{"Paid member or athlete?"}
  T -- "Paid member" --> N["Staff search by name<br/>no receipt needed"]
  T -- "Athlete" --> SN["Staff search the roster<br/>by student number, read-only"]
  N --> F{"Account with a current<br/>authorization found?"}
  SN --> F
  F -- "No" --> X1["Reject: no authorization<br/>no session"]
  F -- "Yes" --> PH["Backend shows the stored term photo"]
  PH --> M{"Photo matches the person?"}
  M -- "No" --> X2["Staff mark the account photo pending<br/>no session"]
  M -- "Yes" --> C["Staff confirm"]
  C --> RC{"Backend checks: authorization, term photo,<br/>photo not pending, gym open,<br/>athletes-only for paid members"}
  RC -- "a check fails" --> X3["Reject with that check's message<br/>same rules as the User Check In"]
  RC -- "pass" --> AS{"User already has an active session?"}
  AS -- "Yes" --> X4["No second session<br/>show the existing one"]
  AS -- "No" --> OK["Create the same session<br/>marked assisted, same exclusion constraint<br/>audit log entry as an exception, same transaction"]

  classDef staff fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,T,N,SN,M,C staff
  class F,PH,RC,AS back
  class X1,X2,X3,X4 reject
  class OK ok
```

**About this diagram:** Covers REQ-F-46. The athlete search uses the read-only roster that Staff see (E-59, still to be confirmed by the gym).

- Location is not checked: Staff are at the desk, so the person is in the gym. Every other rule of the User Check In applies (REQ-F-46), including the athletes-only rejection for paid members (REQ-F-82).
- Staff can only read the roster here; adding, editing, removing or importing roster records stays with the Administrator (E-59).
- "Check in" on the roster screen (S-05) opens the assisted Check In screen (S-03) with the student number already filled in (E-81). Staff and Administrators always see the student number in full, on every screen they use.
- The assisted session goes through the same protected operation as diagram 3, so the exclusion constraint also guards it. A connection is required (REQ-NF-26). The audit log entry follows REQ-NF-39.
- Decided (E-118, REQ-F-94): when the photo does not match the person, Staff mark the account "photo pending" (diagram 11). Check In stays off until the person uploads a new photo from their phone. Staff do not take photos. The upload does not clear the mark: Staff approve the new photo on S-02 (E-168).

### 6. Gym ID states: paid member

**Type:** State diagram. **Use it to:** build the paid member Gym ID screen and what it shows in each state.

```mermaid
stateDiagram-v2
  state "No session, Check In button" as pm_none
  state "Active with Member tag, name, photo, authorization, Active session and the Check In time, elapsed duration" as pm_active
  state "Ended, shown with text and icon" as pm_expired
  state "No connection, not valid now, duration stopped" as pm_offline

  [*] --> pm_none
  pm_none --> pm_active : valid Check In
  pm_active --> pm_expired : checked out, closed automatically after 2 hours, or closed by closure
  pm_active --> pm_expired : Staff end early or void
  pm_expired --> pm_none : Continue, resolve current access before enabling Check In
  pm_active --> pm_offline : poll fails
  pm_offline --> pm_active : poll succeeds
```

- When the session ends, the Gym ID says why: checked out, "closed automatically" or "closed by closure", with text and an icon, not only color (REQ-F-40, REQ-NF-14, E-115). The app reads the last ended visit from `last_session` in `GET /api/user/check-in`.
- The live indicator shows elapsed duration from the backend Check In time, in HH:MM:SS. It advances at most once per second without flashing and stops when the visit ends or connection is lost. It is not a countdown or the current time of day. There is no code or QR (REQ-F-40, E-163, WCAG 2.2.2).
- The Gym ID shows a tag, "Member" for a paid member, with text and an icon, and a color different from the athlete tag (E-75). The colors are the team's choice and are not picked yet. They must not repeat the athletes-only theme color of diagram 8, so one color never means two things.
- Without a connection the app does not show a stored Gym ID as current (REQ-NF-26). It shows "not valid now", the last successful update time, and a stopped elapsed-duration indicator (E-77, E-163). A persistent banner at the top of the screen says the data is not current, with an "updated at" time. The same applies to the athlete Gym ID below.
- If an athletes-only period starts inside the active session, the Gym ID shows a notice with its start time while the session is active. The session is never cut (REQ-F-83).

### 7. Gym ID states: athlete

**Type:** State diagram. **Use it to:** build the athlete Gym ID screen and what it shows in each state.

```mermaid
stateDiagram-v2
  state "Registra tu entrada, no session" as a_none
  state "Active session with Athlete tag, name, photo, elapsed duration" as a_active
  state "Visit ended, reason and total duration" as a_ended
  state "Invalid, removed from roster or term ended" as a_invalid
  state "No connection, not valid now, duration stopped" as a_offline

  [*] --> a_none
  a_none --> a_active : valid Check In
  a_active --> a_ended : check-out, automatic close, closure or Staff correction
  a_ended --> a_none : Continue, authorization still current
  a_ended --> a_invalid : Continue, authorization no longer current
  a_active --> a_offline : poll fails
  a_offline --> a_active : poll succeeds, session active
  a_offline --> a_ended : poll succeeds, session ended
  a_active --> a_invalid : removed from roster mid-term
  a_none --> a_invalid : removed from roster or term ends
  a_invalid --> [*]
```

- Ending a visit removes it from occupancy but does not revoke a current athlete authorization. After Continue, the athlete returns to "Registra tu entrada" and follows the normal Check In process. Current access, photo and opening rules still apply (E-163, REQ-F-33, REQ-F-38).
- There is no separate "Authorized athlete" card without a session, and the Gym ID does not display the term (E-163). Term dates still govern authorization and the new-term photo rules.
- Removed from the roster mid-term: the Gym ID is invalid at once, the current session keeps counting until it ends, and no new Check In is allowed (REQ-F-49).
- The Athlete tag keeps its text, icon and category color. The duration, offline and athletes-only notice rules are the same as for a paid member. Athletes never see time left (REQ-F-40, E-99).

### 8. Athletes-only notice before Check In and during a session

**Type:** System flow. **Use it to:** write the backend rule that adds the notice to the Check In and Gym ID answers, and its tests.

```mermaid
flowchart TD
  A["Check In response or Gym ID poll"] --> B{"Session active?"}
  B -- "No" --> P{"An athletes-only slot starts<br/>in the next 60 minutes?"}
  P -- "No" --> Z["No notice"]
  P -- "Yes" --> N
  B -- "Yes" --> C{"An athletes-only slot starts<br/>after now and before the session end?"}
  C -- "No" --> Z
  C -- "Yes" --> N["Show notice with the period start time<br/>to every User: athletes and paid members<br/>session keeps running"]
  N --> E["At the start: no new Check In for paid members<br/>current sessions not cut"]

  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B,C,P back
  class N,E,Z ok
```

- Covers REQ-F-83 and the rejection side of REQ-F-82. Times shown in `America/Puerto_Rico`, in the format of REQ-NF-38 (REQ-NF-37).
- Every User sees the notice, athletes and paid members (E-76). Without a session it shows in the 60 minutes before the period, and a paid member can still Check In until the period starts (E-161).

#### Theme color during the athletes-only period

**Type:** System flow. **Use it to:** build the theme switch of the User app (REQ-F-90, E-76).

```mermaid
flowchart TD
  A["User app opens or polls"] --> B{"Connection?"}
  B -- "No" --> N1["Normal theme color<br/>offline banner says the data is not current<br/>no athletes-only claim from cached schedules"]
  B -- "Yes" --> C{"Athletes-only period now?"}
  C -- "No" --> N2["Normal theme color"]
  C -- "Yes" --> T["Athletes-only theme color for the whole app<br/>text notice with the start time and an icon stay"]

  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B,C client
  class N1,N2,T ok
```

- The whole theme of the User app changes color, so every User sees at a glance which period it is. The Staff and Administrator dashboard does not change color (REQ-F-90).
- Color is never the only signal (REQ-NF-14): the text notice and an icon stay (WCAG 1.4.1).
- Without a connection the app returns to the normal color and does not claim an athletes-only period from cached schedules (REQ-F-90, REQ-NF-26).
- The theme colors, and the colors of the Member and Athlete tags on the Gym ID, are the team's choice and are not picked yet. They must not overlap, so one color never means two things.

### 9. Occupancy counting

**Type:** System flow. **Use it to:** write the occupancy query and endpoint, and the polling on the User, Staff and Administrator screens.

```mermaid
flowchart LR
  CI["Check In<br/>row inserted"] --> T[("facility_sessions")]
  SC["Staff check out, end early or void<br/>row updated"] --> T
  CLO["Closure starts or term ends<br/>every active row closed"] --> T
  TM["Time passes: 2 hours<br/>no write needed"] --> T
  T --> Q["Count open rows: status active<br/>and now() before the 2-hour end"]
  Q --> API["GET occupancy<br/>fresh count, no cache"]
  API --> U["User screen"]
  API --> S["Staff screen"]
  API --> AD["Administrator screen"]
  CL["Scheduled task<br/>marks old active rows as expired"] -.-> T

  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef data fill:#d4edda,stroke:#2e7d32,color:#000
  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  class CI,SC,CLO,TM,Q,API,CL back
  class T data
  class U,S,AD client
```

- Occupancy is the count of open sessions (REQ-F-41, E-115). Because the count is done at query time with backend time, every request already reflects the last Check In, expiration or Staff correction. Expiry is never late.
- Every screen polls the same endpoint every 20 to 30 seconds (REQ-F-43, interval in D6), so all three show the same value after each one updates (REQ-F-42). A failed poll marks the value as not current (REQ-NF-26): the screen keeps the loaded content with "updated at TIME", the persistent offline banner shows, and occupancy shows no number (E-77).
- An athlete removed mid-term keeps counting until the session ends (REQ-F-49). Voided sessions never count. Athletes count like everyone else while their session is open. Staff check-out keeps the count close to the people inside; a person Staff forget to check out counts until the automatic close after 2 hours.

### 10. Staff verification of a Gym ID

**Type:** User flow. **Use it to:** build the Staff verification screens (active sessions list and roster search) and write test cases.

```mermaid
flowchart TD
  A["User shows the Gym ID"] --> B{"Elapsed duration moving and state shown<br/>with text and icon?"}
  B -- "No" --> X1["Not verified: possible screenshot"]
  B -- "Yes" --> C["Staff search the name<br/>in the active sessions list"]
  C --> D{"Found in active sessions?"}
  D -- "Yes" --> E{"Stored photo from the backend<br/>matches the person?"}
  E -- "Yes" --> OK["Verified"]
  E -- "No" --> X2["Not verified"]
  D -- "No" --> F{"Athlete with no open session?"}
  F -- "Yes" --> G["Staff search the roster<br/>read-only, by name or student number"]
  R["Staff verify an athlete without an open session"] --> G
  G --> H{"On the roster and<br/>stored photo matches?"}
  H -- "Yes" --> OK2["Verified: authorized athlete"]
  H -- "No" --> X3["Not verified"]
  F -- "No" --> X4["Not verified as checked in<br/>the User can do a new Check In"]

  classDef staff fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B,C,G,R staff
  class D,E,F,H back
  class X1,X2,X3,X4 reject
  class OK,OK2 ok
```

**About this diagram:** Covers REQ-F-44 and REQ-F-45. The roster search is the read-only roster Staff see under E-59 (still to be confirmed by the gym).

- Staff verify against backend data, not only the User's screen (REQ-F-45). The active sessions list shows Check In time, authorization and Gym ID (REQ-F-44). It shows the time inside, counted from the Check In time, for paid members and athletes, never time left (E-170). Each row has a Check out action (REQ-F-48). A search is a fresh request, so verification never waits for the next poll.
- An athlete without an open session can be checked directly against the roster, without a live Gym ID. This verifies authorization, not a new entry; normal or Staff-assisted Check In still creates the visit (E-163, REQ-F-45).
- Staff see only photo, authorization, waiver and emergency contact (REQ-NF-19). The roster list they see is read-only (E-59). The student number is shown in full (E-81).

### 11. Staff check-out and photo pending

**Type:** User flow. **Use it to:** build the Check out action on S-01 and S-02, the photo pending mark, and write test cases.

```mermaid
flowchart TD
  A["Person leaves the gym"] --> B["Staff tap Check out on the row in the active sessions list<br/>or open the person and tap Check out"]
  B --> C{"Session still active?"}
  C -- "No" --> X1["Nothing to check out<br/>the list refreshes"]
  C -- "Yes" --> D["Status checked out<br/>end time is the time of the exit"]
  D --> E["Occupancy drops at the next poll"]

  P["Photo does not match the person at the door"] --> Q["Staff mark the account photo pending"]
  Q --> R["Check In and Staff-assisted Check In refused<br/>cause: photo pending"]
  R --> S["The person uploads a new photo from their own phone"]
  S --> T["Staff approve the new photo on S-02 (E-168)"]
  T --> U["Mark cleared, Check In allowed"]

  classDef staff fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B,P,Q staff
  class C,S,T back
  class X1,R reject
  class D,E ok
```

**About this diagram:** covers REQ-F-48 (check-out) and REQ-F-94 (photo pending). Staff do not take photos (E-118). A photo pending is the one case where a photo is replaced during an active authorization, an exception to REQ-F-26. A check-out can come from S-01 or S-02. The audit log entry for a check-out is not required (diagram 4).

## Design decisions to confirm

"Decided, revisable" means the team accepted the recommendation and can still change it.

### D1. Order of the Check In checks and the two-call flow

Status: Decided (team, 2026-10-17), option A.

- A. Phone first asks the backend for the current session and eligibility (connection, active session, authorization, photo, open, athletes-only). Only if eligible, it asks location and sends one Check In request, where the backend repeats all checks. Pro: no location prompt when Check In would fail anyway; matches REQ-F-37; the same GET serves the Gym ID screen. Con: two requests, about one extra round trip toward the 3 second target (REQ-NF-16).
- B. Ask location first, then one request that checks everything. Pro: one request. Con: asks location from people with no authorization or when the gym is closed; the User fixes location only to learn the gym is closed.
- C. One POST with no location first; the backend answers "location needed" or the active session; the phone retries with location. Pro: one endpoint. Con: the same round trips as A with a less clear contract.

Decision: A, because the User gets no location prompt when Check In would fail anyway. The eligibility query comes first, then location, then one final submit that repeats every check except the location permission, which only the phone knows (the backend requires a position and checks accuracy and boundary). Order: connection (nothing works without it), active session (REQ-F-37 must win over all other checks), authorization (the most basic rule, REQ-F-33), term photo (part of the authorization, REQ-F-26), photo pending (REQ-F-94), gym open (applies to everyone), athletes-only (needs the authorization type), then location permission, accuracy, boundary. Accuracy comes before boundary because a boundary result with a poor fix cannot be trusted, and "low accuracy" tells the User to retry instead of moving.

### D2. Accuracy and boundary rule

Status: Proposed. Values come from measurement at the gym (REQ-NF-28) and stay out of this issue. One part is decided (architecture D6, team, 2026-10-19, revisable): the 50 m check always runs at startup. Only a flag allows another boundary; development and the demo set it, production does not. Without the flag, a boundary farther than 50 m stops the app from starting.

- A. Two separate checks: accuracy at or below a threshold, and distance to the gym coordinates at or below the boundary radius. Pro: simple, each failure has its own message. Con: a fix near the edge with a large accuracy radius can pass.
- B. Distance plus accuracy at or below the boundary radius (the whole uncertainty circle inside the boundary). Pro: strict. Con: rejects people inside the gym when accuracy is poor indoors.
- C. Distance minus accuracy at or below the boundary radius. Pro: lenient indoors. Con: easier to pass from outside.

Recommendation: A, because it maps one to one to the SRS messages and the measurement at the gym can tune both numbers. The threshold and radius are environment settings with a development placeholder (for example 50 m) that is replaced after the gym tests.

### D3. How expiry is computed

Status: Decided (team, 2026-10-19), option A, revisable.

- A. Query time is the rule: a session is active while status is active and `now()` is before its end. A scheduled task also marks old rows as expired, only for tidy data. Pro: expiry is exact; the task can fail without wrong counts. Con: one more moving part.
- B. Query time only, never store expired. Pro: least code. Con: every reader (Staff list, analytics) must apply the same time rule.
- C. Scheduled task only. Pro: simple queries. Con: occupancy is wrong until the task runs; breaks REQ-F-38 by up to the task interval.

Decision: A, because expiry is exact and the task can fail without wrong counts. The rule lives in one place in the backend so all readers share it.

### D4. Exclusion constraint and early end

Status: Decided (team, 2026-10-19), option A, revisable. Depends on PostgreSQL (M-09).

- A. `EXCLUDE USING gist (user_id WITH =, period WITH &&) WHERE (status <> 'void')`, and ending early cuts the period to the real end time. Pro: the stored period is the real visit, which analytics need anyway. Con: the period changes after insert.
- B. Same constraint with `WHERE (status = 'active')`, period kept at 2 hours, real end stored in another column. Pro: the period never changes. Con: two end values to keep straight.

Decision: A, because the stored period is the real visit, which analytics need anyway. A check-out, an early end or a closure shortens the period. It needs the `btree_gist` extension, written in SQL in the migration (`context.md` section 2).

### D5. Error message keys and response shape

Status: Decided (team, 2026-10-17), option A (E-74). On 2026-10-26 the codes were renamed from `check_in.reason` to `check_in_reason` to match the snake_case rule in `api-conventions.md` (issue #47 review). The decision itself did not change.

- A. The backend returns a stable code per reason (`check_in_offline` is phone only; `check_in_no_authorization`, `check_in_photo_required`, `check_in_photo_pending`, `check_in_gym_closed`, `check_in_athletes_only`, `check_in_location_denied`, `check_in_location_unavailable`, `check_in_low_accuracy`, `check_in_outside_boundary`; `location_required` (422) when the request has no latitude, longitude or accuracy, and the phone shows the location-unavailable panel) and the app writes the text in the account's language. Pro: one test per code; texts change without code changes (REQ-NF-34). Con: frontend and backend share a list.
- B. The backend returns translated text only. Pro: one place. Con: the phone cannot react per reason (open photo upload, show how to turn on location), and tests depend on wording.

Decision: A, because the app can react to each cause (open the photo upload, show how to turn on location). Two causes are added to REQ-F-33: location unavailable and new term photo needed. The texts are written later (REQ-F-33 "Texts: design").

### D6. Polling interval

Status: Proposed. REQ-F-43 allows 20 to 30 seconds.

- A. 20 seconds. Pro: freshest. Con: 50% more requests and battery than 30.
- B. 30 seconds. Pro: fewer requests and less battery on phones. Con: up to 30 seconds of delay on a value that changes only with Check In, expiry or a correction.
- C. 20 for Staff screens, 30 for User screens. Pro: fresh where Staff work. Con: two values to test.

Recommendation: B, one setting, polling only while the page is visible. The elapsed-duration indicator runs on the phone from the backend Check In time and server time (E-163), so it does not depend on the interval, and Staff searches are fresh requests.

### D7. Can the User see their own past Check Ins

Status: Decided (team, 2026-10-20), option A (E-105). Answered by E-126: the full history, kept 5 years (E-125).

- A. Yes. A My visits screen (U-09), reached from the account (U-03), lists the User's own past Check Ins from the session records: date and time, newest first. Location is never shown (REQ-NF-03). Pro: a returning User can see their own history. Con: one more screen and a new requirement.
- B. Not now. History stays in the database for statistics only. Pro: less to build. Con: the User cannot see their own visits.

Decision: A. The earlier recommendation was B. How far back the list goes: all history (E-126). Retention: 5 years (REQ-NF-05, E-125). REQ-F-92 is the requirement for the screen.

## Gaps and questions

1. Decided (E-74): REQ-F-33 adds "location unavailable or timeout", which the Geolocation API can return, with its own key `check_in_location_unavailable`. REQ-F-33 now lists it (SRS v0.7).
2. Decided (E-74): REQ-F-33 adds "new term photo needed", because REQ-F-26 blocks Check In without it. REQ-F-33 now lists it (SRS v0.7).
3. REQ-F-82 rejects "paid members" during athletes-only periods. Decided (E-126): a manual authorization counts as a paid member for every rule, so it is rejected too.
4. Decided (E-76): every User sees the athletes-only notice, athletes and paid members.
5. Decided (E-80): Staff can void only active sessions, so past statistics do not change (REQ-F-48). Open: who fixes a mistake found the next day.
6. Resolved by E-59 (still to be confirmed by the gym): Staff see the roster read-only and search it by name or student number, for athlete verification and assisted Check In.
7. Athletes-only slots and regular hours: if an athletes-only slot falls outside regular hours, is the gym open for athletes? Depends on the slot list (G-28).
8. Resolved by E-115 and E-169: a closure starting, or a term ending, ends every active session at once with the note "closed by closure".
9. Staff-assisted Check In for an athlete on the roster with no account: no session is possible because sessions belong to a User. The athlete registers with the link sent to the roster email; there is no in-person code (E-117), and if the link fails the athlete calls the office. Whether the gym accepts that Staff cannot do the assisted Check In in this case is still pending.
10. REQ-NF-03: coordinates must also stay out of request logs and error reports. Not stated in the SRS; noted for implementation.
11. Decided (E-105, E-126): the User sees their own past Check Ins on My visits (U-09), from the session records, with date and time, newest first, no location, and the full history. Records are kept 5 years (REQ-NF-05, E-125). REQ-F-92 is the requirement for the screen.
12. Resolved by E-115 (G-32): a person may come back the same day, each entry after a check-out counts as a visit, and there is no daily limit. The 60 minutes are a guide Staff apply when the gym is full; the app does not enforce them.
13. Resolved by E-168: the new photo does not clear the mark; Staff approve it on S-02.

## Traceability

<details markdown="1">
<summary>Show traceability tables</summary>

| Requirement or decision | Where it appears |
|---|---|
| REQ-F-26 | 1. Check In checks before location; 5. Staff-assisted Check In |
| REQ-F-33 | 1. Check In checks before location; 2. Check In location checks and session creation; D1; D5 (photo pending is a cause, E-118) |
| REQ-F-36 | 2. Check In location checks and session creation; 3. Successful Check In; 5. Staff-assisted Check In; D4 |
| REQ-F-37 | 1. Check In checks before location (active session first); 2. Check In location checks and session creation; 3. Successful Check In (alt block) |
| REQ-F-38 | 4. Facility session states; 6. Gym ID states: paid member; 7. Gym ID states: athlete; D3 |
| REQ-F-40 | 6. Gym ID states: paid member; 7. Gym ID states: athlete |
| REQ-F-41 | 9. Occupancy counting |
| REQ-F-42 | 9. Occupancy counting |
| REQ-F-43 | 9. Occupancy counting; D6 |
| REQ-F-44 | 10. Staff verification of a Gym ID |
| REQ-F-45 | 10. Staff verification of a Gym ID; 7. Gym ID states: athlete |
| REQ-F-46 | 5. Staff-assisted Check In |
| REQ-F-48 | 4. Facility session states; 6. Gym ID states: paid member; 11. Staff check-out and photo pending |
| REQ-F-94 | 1. Check In checks before location; 5. Staff-assisted Check In; 11. Staff check-out and photo pending |
| REQ-F-49 | 7. Gym ID states: athlete; 9. Occupancy counting |
| REQ-F-82 | 1. Check In checks before location; 5. Staff-assisted Check In; 8. Athletes-only notice before Check In and during a session |
| REQ-F-83 | 2. Check In location checks and session creation (notice on success); 6. Gym ID states: paid member; 8. Athletes-only notice before Check In and during a session |
| REQ-F-90 | 8. Athletes-only notice before Check In and during a session (theme color) |
| REQ-NF-01 | 3. Successful Check In; 4. Facility session states; 9. Occupancy counting |
| REQ-NF-03 | 2. Check In location checks and session creation; 3. Successful Check In; 4. Facility session states (My visits shows no location) |
| REQ-NF-05 (retention, 5 years) | 4. Facility session states (how long visits are kept); D7; Gap 11 |
| REQ-NF-11 | 2. Check In location checks and session creation |
| REQ-NF-14 | 6. Gym ID states: paid member; 7. Gym ID states: athlete; 10. Staff verification of a Gym ID |
| REQ-NF-19 | 10. Staff verification of a Gym ID |
| REQ-NF-26 | 1. Check In checks before location; 2. Check In location checks and session creation; 5. Staff-assisted Check In; 6. Gym ID states: paid member; 7. Gym ID states: athlete; 8. Athletes-only notice before Check In and during a session (theme color); 9. Occupancy counting |
| REQ-NF-28 | 2. Check In location checks and session creation; D2 |
| REQ-NF-29 | 2. Check In location checks and session creation |
| REQ-NF-37 | 8. Athletes-only notice before Check In and during a session |
| REQ-NF-39 | 4. Facility session states; 5. Staff-assisted Check In |
| REQ-NF-42 | 3. Successful Check In (alt block) |
| E-59 (Staff see the roster) | 5. Staff-assisted Check In; 7. Gym ID states: athlete; 10. Staff verification of a Gym ID; Gap 6 |
| D1 (check order, eligibility query first) | 1. Check In checks before location; 2. Check In location checks and session creation; 3. Successful Check In; D1 |
| E-74 (fixed code per rejection cause) | 1. Check In checks before location; 2. Check In location checks and session creation; D5; Gaps 1 and 2 |
| E-75 (Member and Athlete tags; timing and post-visit display refined by E-163) | 3. Successful Check In; 6. Gym ID states: paid member; 7. Gym ID states: athlete; 8. Athletes-only notice before Check In and during a session; D6 |
| E-76 (everyone sees the athletes-only notice; theme color in the athletes-only period) | 8. Athletes-only notice before Check In and during a session; Gap 4 |
| E-80 (Staff void only active sessions) | 4. Facility session states; Gap 5 |
| E-81 (student number filled and never masked) | 5. Staff-assisted Check In; 10. Staff verification of a Gym ID |
| E-105 (My visits screen U-09, own past Check Ins from session records) | 4. Facility session states; D7; Gap 11 |
| E-99 (no time left for athletes on the Staff active sessions list) | 7. Gym ID states: athlete; 10. Staff verification of a Gym ID |
| D4 (exclusion constraint) | D4 |
| D3 (expiry at query time plus scheduled task) | 9. Occupancy counting; D3 |
| E-77 (offline banner, Gym ID not valid now) | 6. Gym ID states: paid member; 7. Gym ID states: athlete; 9. Occupancy counting |
| E-117 (no in-person code) | Gap 9 |
| E-115 (check-out, 2-hour close, closure) | 2, 3, 4, 6, 7, 9; Gaps 8, 12 |
| E-118 (photo pending) | 1. Check In checks before location; 5. Staff-assisted Check In; 11. Staff check-out and photo pending; Gap 13 |
| Architecture D6 (50 m check always runs at startup) | 2. Check In location checks and session creation; D2 |

E-56, E-60, E-78, E-83 and E-101 (PIN, recovery code, Lock button) were replaced by E-114 and change no flow in this document. E-57 (photos on import undo), E-58 ("I am an athlete"), E-102 to E-104, E-106 and E-107 do not change any flow either.

</details>
