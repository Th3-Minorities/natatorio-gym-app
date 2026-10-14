# Check In, session and Gym ID flows

This document draws how Check In decides, how a facility session lives and ends, how Staff do an assisted Check In and verify a Gym ID, what the Gym ID shows in each state, and how occupancy is counted. It covers SRS sections 3.6, 3.7 and 3.8 (GitHub issue #6). The backend is Laravel and the database is PostgreSQL (`docs/context.md` section 2). The single active session rule depends on a PostgreSQL exclusion constraint, so it depends on CTI accepting PostgreSQL (M-09). Values the SRS leaves to design are in "Design decisions to confirm".

Legend used in the flowcharts: blue nodes run on the phone (PWA), yellow nodes run on the backend, red nodes are rejections, green nodes are outcomes that show a session.

## 1. Check In decision flow, part 1: checks before location

The phone asks the backend first. Location is asked only when a new session must be created (REQ-F-37), so every check that does not need location runs before the location prompt. The order and its reasons are in decision D1.

```mermaid
flowchart TD
  A["User taps Check In"] --> B{"Request reaches the backend?"}
  B -- "No" --> R1["Reject: no connection<br/>key check_in.offline<br/>no stored Gym ID shown as current"]
  B -- "Yes" --> C{"User has an active session?<br/>status active and backend time before its end"}
  C -- "Yes" --> S0["Return the current session and Gym ID<br/>no location asked, no new session"]
  C -- "No" --> D{"Current authorization?<br/>paid, athlete or manual, term not ended"}
  D -- "No" --> R2["Reject: no authorization<br/>key check_in.no_authorization<br/>status expired or not on the roster"]
  D -- "Yes" --> E{"Photo saved for this term?"}
  E -- "No" --> R3["Reject: new term photo needed<br/>key check_in.photo_required<br/>opens the photo upload"]
  E -- "Yes" --> F{"Gym open now?<br/>schedule slots minus closures"}
  F -- "No" --> R4["Reject: gym closed<br/>key check_in.gym_closed"]
  F -- "Yes" --> G{"Athletes-only period now<br/>and the User is a paid member?"}
  G -- "Yes" --> R5["Reject: athletes-only period<br/>key check_in.athletes_only<br/>with a notice"]
  G -- "No" --> L["Eligible: continue to part 2<br/>location checks"]

  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B client
  class C,D,E,F,G,L back
  class R1,R2,R3,R4,R5 reject
  class S0 ok
```

- "No connection" is detected on the phone: the request fails or times out. There is no offline Check In (REQ-NF-26, SRS 2.4).
- The athlete photo check comes from REQ-F-26. A paid member uploads the photo at registration and renewal, so in practice only athletes reach R3.
- The athletes-only check applies only to paid members (REQ-F-82). Manual authorizations: see Gaps.

## 2. Check In decision flow, part 2: location and session creation

```mermaid
flowchart TD
  L["Eligible from part 1"] --> P{"Location permission state"}
  P -- "denied" --> R6["Reject: permission denied<br/>key check_in.location_denied<br/>how to turn it on"]
  P -- "granted or not asked yet" --> Q["Ask the browser for one position<br/>high accuracy, no cached position"]
  Q -- "User denies the prompt" --> R6
  Q -- "unavailable or timeout" --> R7["Reject: location unavailable<br/>key check_in.location_unavailable"]
  Q -- "position and accuracy" --> AC{"Accuracy at or below<br/>the threshold?"}
  AC -- "No" --> R8["Reject: low accuracy<br/>key check_in.low_accuracy<br/>try again"]
  AC -- "Yes" --> BD{"Inside the gym boundary?"}
  BD -- "No" --> R9["Reject: outside the boundary<br/>key check_in.outside_boundary"]
  BD -- "Yes" --> POST["Send coordinates and accuracy once<br/>to the Check In operation"]
  POST -- "connection lost" --> R1["Reject: no connection<br/>a retry returns the session if it was created"]
  POST --> RE{"Backend repeats part 1 checks<br/>plus accuracy and boundary"}
  RE -- "a check fails" --> RX["Reject with that check's key<br/>no session"]
  RE -- "active session found<br/>or exclusion constraint hit" --> S0["Return the existing session and Gym ID"]
  RE -- "all checks pass" --> OK["Create one 60-minute session<br/>return the Gym ID<br/>plus athletes-only notice if one starts inside it"]

  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class P,Q,AC,BD,POST client
  class L,RE back
  class R1,R6,R7,R8,R9,RX reject
  class S0,OK ok
```

- Location comes from the browser Geolocation API (REQ-NF-11). The permission state is read before asking where the browser allows it; otherwise the error of the position request tells denied, unavailable or timeout apart.
- The phone checks accuracy and boundary only to answer fast. The backend repeats every check and is the only one that decides. The client is never trusted for authorization. Location is a condition, not proof of presence (SRS 3.6).
- Coordinates travel once in the Check In request and are not stored. Only the result of the location check may be stored on the session (REQ-NF-03). The boundary, accuracy threshold and gym coordinates come from environment configuration (REQ-NF-28, REQ-NF-29).

## 3. Successful Check In: phone, backend, database

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
  API->>API: Check the one-device rule (REQ-F-03)
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
  API->>DB: INSERT facility_sessions, period from now() to now() plus 60 min, status active
  Note over DB: Exclusion constraint, no two overlapping non-void periods for one User. Final guard (REQ-F-36). Needs PostgreSQL, CTI M-09
  alt No other session for this User
    DB-->>API: Row created
    API->>DB: COMMIT
    API-->>PWA: 201 with session, Gym ID data, server time, athletes-only notice if any
  else A simultaneous request created one first
    DB-->>API: exclusion_violation (SQLSTATE 23P01)
    API->>DB: ROLLBACK, then read the session that won
    API-->>PWA: 200 with the existing session and Gym ID, same as REQ-F-37
  end
  PWA-->>U: Show the Gym ID
```

- Steps 13 to 24 are the single protected operation: re-check, look for an active session and create one, in one transaction. The read in step 16 gives a clean answer in the normal case. Under simultaneous requests both reads can see nothing, so the constraint decides (REQ-NF-42 tests this).
- Backend time is the database clock `now()` (REQ-NF-01). The response carries server time so the phone can count minutes left without trusting its own clock.

## 4. Facility session states

```mermaid
stateDiagram-v2
  [*] --> active : valid Check In or Staff-assisted Check In
  active --> expired : backend time reaches start plus 60 min
  active --> ended_early : Staff end it early
  active --> void : Staff void it, created by mistake
  expired --> [*]
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

- expired is computed from backend time with no checkout (REQ-F-38). It counts in analytics as a visit, not in occupancy. ended_early counts the same way, with its real end time.
- Only Staff and Administrators can end early or void (REQ-F-48). Each correction is an audit log entry (REQ-NF-39). Staff cannot extend a session or create one without authorization.
- Whether an expired or ended_early session can still be voided is open (see Gaps).

## 5. Staff-assisted Check In

```mermaid
flowchart TD
  A["User at the desk without a phone"] --> T{"Paid member or athlete?"}
  T -- "Paid member" --> N["Staff search by name<br/>no receipt needed"]
  T -- "Athlete" --> SN["Staff enter the student number"]
  N --> F{"Account with a current<br/>authorization found?"}
  SN --> F
  F -- "No" --> X1["Reject: no authorization<br/>no session"]
  F -- "Yes" --> PH["Backend shows the stored term photo"]
  PH --> M{"Photo matches the person?"}
  M -- "No" --> X2["Staff stop, no session"]
  M -- "Yes" --> C["Staff confirm"]
  C --> RC{"Backend checks: authorization, term photo,<br/>gym open, athletes-only for paid members"}
  RC -- "a check fails" --> X3["Reject with that check's key<br/>same rules as part 1"]
  RC -- "pass" --> AS{"User already has an active session?"}
  AS -- "Yes" --> X4["No second session<br/>show the existing one"]
  AS -- "No" --> OK["Create the same 60-minute session<br/>marked assisted, same exclusion constraint<br/>audit log entry as an exception, same transaction"]

  classDef staff fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,T,N,SN,M,C staff
  class F,PH,RC,AS back
  class X1,X2,X3,X4 reject
  class OK ok
```

- Location is not checked: Staff are at the desk, so the person is in the gym. Every other rule of the User Check In applies (REQ-F-46), including the athletes-only rejection for paid members (REQ-F-82).
- The assisted session goes through the same protected operation as section 3, so the exclusion constraint also guards it. A connection is required (REQ-NF-26). The audit log entry follows REQ-NF-39.

## 6. Gym ID states: paid member

```mermaid
stateDiagram-v2
  state "No session, Check In button" as pm_none
  state "Active with name, photo, authorization, minutes left, moving clock" as pm_active
  state "Expired, shown with text and icon" as pm_expired
  state "No connection, not shown as current" as pm_offline

  [*] --> pm_none
  pm_none --> pm_active : valid Check In
  pm_active --> pm_expired : 60 min by backend time
  pm_active --> pm_expired : Staff end early or void
  pm_expired --> pm_active : new valid Check In
  pm_active --> pm_offline : poll fails
  pm_offline --> pm_active : poll succeeds
```

- After 60 minutes the Gym ID says "expired" with text and an icon, not only color (REQ-F-40, REQ-NF-14). Nobody has to leave (REQ-F-38).
- The moving clock runs on the phone in every state where the Gym ID is shown, so Staff can tell a live screen from a screenshot. There is no code or QR (REQ-F-40).
- Without a connection the app does not show a stored Gym ID as current (REQ-NF-26). The same applies to the athlete Gym ID below.
- If an athletes-only period starts inside the active session, the Gym ID shows a notice with its start time while the session is active. The session is never cut (REQ-F-83).

## 7. Gym ID states: athlete

```mermaid
stateDiagram-v2
  state "No session, Check In button" as a_none
  state "Active session with name, photo, minutes left, moving clock" as a_active
  state "Valid, session not counted, moving clock" as a_valid
  state "Invalid, removed from roster or term ended" as a_invalid

  [*] --> a_none
  a_none --> a_active : valid Check In
  a_active --> a_valid : 60 min by backend time
  a_valid --> a_active : new valid Check In
  a_active --> a_invalid : removed from roster mid-term
  a_valid --> a_invalid : removed from roster mid-term
  a_valid --> a_invalid : term authorization ends
  a_invalid --> [*]
```

- The athlete Gym ID stays valid while the term authorization is active; the 60 minutes are only a counting rule (REQ-F-38, REQ-F-40). Staff check the roster for an athlete in a_valid (REQ-F-45).
- Removed from the roster mid-term: the Gym ID is invalid at once, the current session keeps counting until it ends, and no new Check In is allowed (REQ-F-49).
- Text for a_valid is not set by the SRS. Proposed: "Authorized athlete, session ended" plus an icon (REQ-NF-14).

## 8. Athletes-only period during an active session

```mermaid
flowchart TD
  A["Check In response or Gym ID poll"] --> B{"Session active?"}
  B -- "No" --> Z["No notice"]
  B -- "Yes" --> C{"An athletes-only slot starts<br/>after now and before the session end?"}
  C -- "No" --> Z
  C -- "Yes" --> N["Show notice with the period start time<br/>session keeps running"]
  N --> E["At the start: no new Check In for paid members<br/>current sessions not cut"]

  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B,C back
  class N,E,Z ok
```

- Covers REQ-F-83 and the rejection side of REQ-F-82. Times shown as ISO date plus 12-hour time in `America/Puerto_Rico` (REQ-NF-37, REQ-NF-38).

## 9. Occupancy counting

```mermaid
flowchart LR
  CI["Check In<br/>row inserted"] --> T[("facility_sessions")]
  SC["Staff end early or void<br/>row updated"] --> T
  TM["Time passes<br/>no write needed"] --> T
  T --> Q["Count rows with status active<br/>and now() before end of period"]
  Q --> API["GET occupancy<br/>fresh count, no cache"]
  API --> U["User screen"]
  API --> S["Staff screen"]
  API --> AD["Administrator screen"]
  CL["Optional scheduled task<br/>marks old active rows as expired"] -.-> T

  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef data fill:#d4edda,stroke:#2e7d32,color:#000
  classDef client fill:#d1ecf1,stroke:#0c5460,color:#000
  class CI,SC,TM,Q,API,CL back
  class T data
  class U,S,AD client
```

- Occupancy is the count of active sessions (REQ-F-41). Because the count is done at query time with backend time, every request already reflects the last Check In, expiration or Staff correction. Expiry is never late.
- Every screen polls the same endpoint every 20 to 30 seconds (REQ-F-43, interval in D6), so all three show the same value after each one updates (REQ-F-42). A failed poll marks the value as not current (REQ-NF-26).
- An athlete removed mid-term keeps counting until the session ends (REQ-F-49). Voided sessions never count. Athletes who stay past 60 minutes are not counted.

## 10. Staff verification of a Gym ID

```mermaid
flowchart TD
  A["User shows the Gym ID"] --> B{"Clock moving and state shown<br/>with text and icon?"}
  B -- "No" --> X1["Not verified: possible screenshot"]
  B -- "Yes" --> C["Staff search the name<br/>in the active sessions list"]
  C --> D{"Found in active sessions?"}
  D -- "Yes" --> E{"Stored photo from the backend<br/>matches the person?"}
  E -- "Yes" --> OK["Verified"]
  E -- "No" --> X2["Not verified"]
  D -- "No" --> F{"Athlete whose 60 minutes ended?"}
  F -- "Yes" --> G{"On the current-term roster<br/>and photo matches?"}
  G -- "Yes" --> OK2["Verified: authorized athlete"]
  G -- "No" --> X3["Not verified"]
  F -- "No" --> X4["Not verified as checked in<br/>the User can do a new Check In"]

  classDef staff fill:#d1ecf1,stroke:#0c5460,color:#000
  classDef back fill:#fff3cd,stroke:#b8860b,color:#000
  classDef reject fill:#f8d7da,stroke:#842029,color:#000
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#000
  class A,B staff
  class C,D,E,F,G back
  class X1,X2,X3,X4 reject
  class OK,OK2 ok
```

- Staff verify against backend data, not only the User's screen (REQ-F-45). The active sessions list shows Check In time, authorization and Gym ID (REQ-F-44). A search is a fresh request, so verification never waits for the next poll.
- Staff see only photo, authorization, waiver and emergency contact (REQ-NF-19). The roster lookup needs a read access the role table does not list (see Gaps).

## Design decisions to confirm

### D1. Order of the Check In checks and the two-call flow

Status: Proposed.

- A. Phone first asks the backend for the current session and eligibility (connection, active session, authorization, photo, open, athletes-only). Only if eligible, it asks location and sends one Check In request, where the backend repeats all checks. Pro: no location prompt when Check In would fail anyway; matches REQ-F-37; the same GET serves the Gym ID screen. Con: two requests, about one extra round trip toward the 3 second target (REQ-NF-16).
- B. Ask location first, then one request that checks everything. Pro: one request. Con: asks location from people with no authorization or when the gym is closed; the User fixes location only to learn the gym is closed.
- C. One POST with no location first; the backend answers "location needed" or the active session; the phone retries with location. Pro: one endpoint. Con: the same round trips as A with a less clear contract.

Recommendation: A. Order inside it: connection (nothing works without it), active session (REQ-F-37 must win over all other checks), authorization (the most basic rule, REQ-F-33), term photo (part of the authorization, REQ-F-26), gym open (applies to everyone), athletes-only (needs the authorization type), then location permission, accuracy, boundary. Accuracy comes before boundary because a boundary result with a poor fix cannot be trusted, and "low accuracy" tells the User to retry instead of moving.

### D2. Accuracy and boundary rule

Status: Proposed. Values come from measurement at the gym (REQ-NF-28) and stay out of this issue.

- A. Two separate checks: accuracy at or below a threshold, and distance to the gym coordinates at or below the boundary radius. Pro: simple, each failure has its own message. Con: a fix near the edge with a large accuracy radius can pass.
- B. Distance plus accuracy at or below the boundary radius (the whole uncertainty circle inside the boundary). Pro: strict. Con: rejects people inside the gym when accuracy is poor indoors.
- C. Distance minus accuracy at or below the boundary radius. Pro: lenient indoors. Con: easier to pass from outside.

Recommendation: A, because it maps one to one to the SRS messages and the measurement at the gym can tune both numbers. The threshold and radius are environment settings with a development placeholder (for example 50 m) that is replaced after the gym tests.

### D3. How expiry is computed

Status: Proposed (`context.md` section 2 lists "calculated when queried, scheduled task for cleanup" as Proposed).

- A. Query time is the rule: a session is active while status is active and `now()` is before its end. A scheduled task also marks old rows as expired, only for tidy data. Pro: expiry is exact; the task can fail without wrong counts. Con: one more moving part.
- B. Query time only, never store expired. Pro: least code. Con: every reader (Staff list, analytics) must apply the same time rule.
- C. Scheduled task only. Pro: simple queries. Con: occupancy is wrong until the task runs; breaks REQ-F-38 by up to the task interval.

Recommendation: A, as in `context.md`, with the rule in one place in the backend so all readers share it. B is acceptable if the team wants less code.

### D4. Exclusion constraint and early end

Status: Proposed. Depends on PostgreSQL (M-09).

- A. `EXCLUDE USING gist (user_id WITH =, period WITH &&) WHERE (status <> 'void')`, and ending early cuts the period to the real end time. Pro: the stored period is the real visit, which analytics need anyway. Con: the period changes after insert.
- B. Same constraint with `WHERE (status = 'active')`, period kept at 60 minutes, real end stored in another column. Pro: the period never changes. Con: two end values to keep straight.

Recommendation: A. It needs the `btree_gist` extension, written in SQL in the migration (`context.md` section 2).

### D5. Error message keys and response shape

Status: Proposed.

- A. The backend returns a stable code per reason (`check_in.offline` is phone only; `check_in.no_authorization`, `check_in.photo_required`, `check_in.gym_closed`, `check_in.athletes_only`, `check_in.location_denied`, `check_in.location_unavailable`, `check_in.low_accuracy`, `check_in.outside_boundary`) and the PWA maps it to Spanish and English text from translation files. Pro: one test per code; texts change without code changes (REQ-NF-34). Con: frontend and backend share a list.
- B. The backend returns translated text only. Pro: one place. Con: the phone cannot react per reason (open photo upload, show how to turn on location), and tests depend on wording.

Recommendation: A. Texts themselves are a later design item (REQ-F-33 "Texts: design").

### D6. Polling interval

Status: Proposed. REQ-F-43 allows 20 to 30 seconds.

- A. 20 seconds. Pro: freshest. Con: 50% more requests and battery than 30.
- B. 30 seconds. Pro: fewer requests and less battery on phones. Con: up to 30 seconds of delay on a value that changes only with Check In, expiry or a correction.
- C. 20 for Staff screens, 30 for User screens. Pro: fresh where Staff work. Con: two values to test.

Recommendation: B, one setting, polling only while the page is visible. Minutes left and the moving clock run on the phone from the server end time, so they do not depend on the interval, and Staff searches are fresh requests.

## Gaps and questions

1. REQ-F-33 lists the rejection causes but not "location unavailable or timeout", which the Geolocation API can return. Proposed: its own key `check_in.location_unavailable`. Should REQ-F-33 add it?
2. REQ-F-33 does not list "new term photo needed", although REQ-F-26 blocks Check In without it. Should it be added to the cause list?
3. REQ-F-82 rejects "paid members" during athletes-only periods. It does not say what happens to a User with a manual authorization (REQ-F-87). Proposed: treat manual as paid member, since it fixes order errors.
4. REQ-F-83 says "a User's active session". For an athlete the notice has no effect. Show it to athletes too, or only to paid members?
5. REQ-F-48 does not say if an expired or ended_early session can be voided. Voiding it would change analytics after the fact. Allow it, or only for active sessions?
6. REQ-F-45 and REQ-F-46 need Staff to search Users by name and student number and to check the roster. The Overview role table gives roster access only to Administrators. Proposed: a read-only lookup for Staff (name, photo, authorization status), in line with REQ-NF-19. The role table should say so.
7. Athletes-only slots and regular hours: if an athletes-only slot falls outside regular hours, is the gym open for athletes? Depends on the slot list (G-28).
8. No rule for a closure published, or a term ending, during an active session. Proposed: the session is not cut, like REQ-F-83.
9. Staff-assisted Check In for an athlete on the roster with no account: no session is possible because sessions belong to a User. Only REQ-F-77 (in-person registration, if no mail) would cover it.
10. REQ-NF-03: coordinates must also stay out of request logs and error reports. Not stated in the SRS; noted for implementation.

## Traceability

| Requirement ID | Where it appears |
|---|---|
| REQ-F-26 | 1. Check In decision flow, part 1; 5. Staff-assisted Check In |
| REQ-F-33 | 1. Check In decision flow, part 1; 2. part 2; D1; D5 |
| REQ-F-36 | 2. part 2; 3. Successful Check In; 5. Staff-assisted Check In; D4 |
| REQ-F-37 | 1. part 1 (active session first); 2. part 2; 3. Successful Check In (alt block) |
| REQ-F-38 | 4. Facility session states; 6. Gym ID: paid member; 7. Gym ID: athlete; D3 |
| REQ-F-40 | 6. Gym ID: paid member; 7. Gym ID: athlete |
| REQ-F-41 | 9. Occupancy counting |
| REQ-F-42 | 9. Occupancy counting |
| REQ-F-43 | 9. Occupancy counting; D6 |
| REQ-F-44 | 10. Staff verification of a Gym ID |
| REQ-F-45 | 10. Staff verification of a Gym ID; 7. Gym ID: athlete |
| REQ-F-46 | 5. Staff-assisted Check In |
| REQ-F-48 | 4. Facility session states; 6. Gym ID: paid member |
| REQ-F-49 | 7. Gym ID: athlete; 9. Occupancy counting |
| REQ-F-82 | 1. part 1; 5. Staff-assisted Check In; 8. Athletes-only period |
| REQ-F-83 | 2. part 2 (notice on success); 6. Gym ID: paid member; 8. Athletes-only period |
| REQ-NF-01 | 3. Successful Check In; 4. Facility session states; 9. Occupancy counting |
| REQ-NF-03 | 2. part 2; 3. Successful Check In |
| REQ-NF-11 | 2. part 2 |
| REQ-NF-14 | 6. Gym ID: paid member; 7. Gym ID: athlete; 10. Staff verification |
| REQ-NF-19 | 10. Staff verification of a Gym ID |
| REQ-NF-26 | 1. part 1; 2. part 2; 5. Staff-assisted Check In; 6. Gym ID: paid member; 9. Occupancy counting |
| REQ-NF-28 | 2. part 2; D2 |
| REQ-NF-29 | 2. part 2 |
| REQ-NF-37 | 8. Athletes-only period |
| REQ-NF-39 | 4. Facility session states; 5. Staff-assisted Check In |
| REQ-NF-42 | 3. Successful Check In (alt block) |
