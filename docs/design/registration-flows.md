# Registration and authorization flows

These diagrams show how a person gets an account and keeps access to the gym: paid member registration, athlete registration, the in-person athlete fallback, renewal and type change inside the same account, and the states an authorization goes through. They are the base for building the registration and renewal features (issue #5). Sign in and password reset appear only as context. Screen design and texts are out of scope. Requirements come from `docs/requirements/SRS.md` v0.5, sections 3.1 to 3.4 and 3.12, plus REQ-NF-24 and REQ-NF-25. Entity names follow the logical data model in `docs/design/design-notes.md`.

The diagrams use plain words only. Requirement IDs and decision codes are in the "About this diagram" paragraph under each diagram and in [Traceability](#traceability). Where a diagram draws a proposal, that paragraph names the item in [Design decisions to confirm](#design-decisions-to-confirm). Diagrams 4, 5 and 8 draw the recommended option; diagram 7 draws a decided one (E-58).

Two pending answers touch almost every diagram:

- The contact number (REQ-F-73) is pending from the gym (G-25).
- Every email link needs CTI outgoing mail (M-07): athlete registration (diagram 4), "I am an athlete" (diagram 7, E-58) and password reset. Without mail, only diagram 5 is built for athlete registration, and there is no password reset.

## Diagrams

### 1. Paid member registration

**Type:** User flow. **Use it to:** build the paid member registration screens and their error messages.

```mermaid
flowchart TD
  START["Open Register as paid member"] --> PN["Privacy notice in Spanish and English<br/>text pending from the gym"]
  PN -->|"Continue"| NUM["Type the 6-digit Authorization Number"]
  NUM --> LK[["Authorization Number lookup<br/>diagram 2"]]
  LK -->|"invalid, claimed or not verifiable"| M1["Same message for invalid and claimed,<br/>with the contact number"]
  LK -->|"order from an ended term"| M2["Ended-term message, cannot register"]
  LK -->|"paused by the per-IP limit"| M3["Message: try again at TIME"]
  LK -->|"valid, current term, unclaimed"| MASK["Show the payment email masked<br/>for example c***@upr.edu"]
  MASK --> HAS{"Payment email already<br/>belongs to an account?"}
  HAS -->|"yes"| REN["Message: you already have an account.<br/>Sign in to add this membership.<br/>Nothing claimed"]
  REN --> SI["Sign in, then diagram 6"]
  HAS -->|"no"| PW["Create a password<br/>rules: sign-in design"]
  PW --> PH["Choose a current photo<br/>JPEG, PNG or HEIC, up to 10 MB"]
  PH --> WV["Accept the waiver and give an emergency contact,<br/>name and phone"]
  WV --> FIN[["Final step: save photo, then account and claim<br/>diagram 3"]]
  FIN -->|"photo rejected or not saved"| PF["Stay on the photo step, typed data kept in the page,<br/>message with the cause, retry.<br/>Nothing claimed"]
  PF --> PH
  FIN -->|"number claimed meanwhile"| M1
  FIN -->|"saved"| OK["Account email is the payment email.<br/>Paid authorization for the term of the payment date.<br/>Signed in on this device"]
  M1 -.->|"real owner whose number was taken"| RO["Owner takes the account back with password reset<br/>to the payment email, waits on CTI's answer about mail.<br/>Or an Administrator releases the number"]
```

**About this diagram:** The person is not signed in; the privacy notice (REQ-NF-25, text pending G-24) comes before any field, and password, photo, waiver and emergency contact stay in the page until the final step sends them in one request (REQ-F-13, F-17, F-60, NF-24, F-26). Messages follow REQ-F-72, F-73, F-18 (invalid or claimed), REQ-F-22 with REG-9 (ended term), REQ-F-71 (pause), REQ-F-70 with REG-3 (masking), REQ-F-78 with REG-4 (email already has an account) and REG-8 (photo failure). The dotted path is REQ-F-75 (needs M-07) and REQ-F-74.

Notes: the term comes from the payment date of the order (REQ-F-22). The member never types or changes the account email (REQ-F-11).

### 2. Authorization Number lookup with limits

**Type:** System flow. **Use it to:** write the backend lookup check, its per-IP and global limits, and their tests.

```mermaid
flowchart TD
  IN["App sends the 6-digit number"] --> FMT{"Exactly 6 digits?"}
  FMT -->|"no"| X0["Form error. No lookup, not counted"]
  FMT -->|"yes"| IPP{"Per-IP pause active?<br/>IPv6 counted per /64 prefix"}
  IPP -->|"yes"| X1["Reject: try again at TIME"]
  IPP -->|"no"| SLOW{"Global slow mode on?"}
  SLOW -->|"yes"| WAIT["Slow this lookup, never block it"]
  SLOW -->|"no"| Q
  WAIT --> Q["Find the number in the imported orders"]
  Q -->|"not found"| FAIL["Same message plus contact number"]
  Q -->|"found, already claimed"| FAIL
  Q -->|"more than one order with this number"| DUP["Deny with contact number.<br/>Waits on the answer about duplicate numbers"]
  Q -->|"found, term ended"| ENDED["Ended-term message"]
  Q -->|"found, current term, unclaimed"| GOOD["Return the masked payment email.<br/>Not counted"]
  FAIL --> CNT["Count one failed lookup<br/>for this IP and globally"]
  ENDED --> CNT
  DUP --> CNT
  CNT --> T1{"This IP over its limit?"}
  T1 -->|"yes"| P1["Start the per-IP pause"]
  T1 -->|"no"| T2
  P1 --> T2{"Global failures over the threshold?"}
  T2 -->|"yes, slow mode was off"| P2["Turn slow mode on and write one alert<br/>in the audit log"]
  T2 -->|"no, or already on"| RESP["Send the chosen message to the app"]
  P2 --> RESP
```

**About this diagram:** Backend view of one lookup, used by diagrams 1 and 6. The PWA sends the number as soon as 6 digits are typed (REQ-F-70); the lookup reads imported_memberships (REQ-F-10), the limits are REQ-F-71 with values in REG-1 and REG-2, the alert goes to audit_log_entries (REQ-NF-39), and duplicate numbers wait on E-30 and G-19.

Notes: a claimed number counts as a failure, so the reply and the counting look the same as for an invalid number (REQ-F-72). If the database cannot answer, the lookup is denied with a "try again later" message (REQ-F-18).

### 3. Final step: photo first, then account and claim

**Type:** Sequence diagram. **Use it to:** write the final save endpoint, its transaction and the tests for photo failure and a lost race.

```mermaid
sequenceDiagram
  autonumber
  participant P as PWA
  participant A as Laravel API
  participant F as Private photo storage
  participant D as PostgreSQL
  P->>A: Final submit with number or link token, password, photo, waiver, emergency contact
  A->>D: Check the record is still current term and unclaimed
  alt record no longer valid
    A-->>P: Same message as an invalid number, nothing saved
  else record still free
    A->>A: Check type JPEG, PNG or HEIC and size up to 10 MB
    alt photo rejected
      A-->>P: Photo error with the cause, nothing saved
    else photo accepted
      A->>A: Convert to JPEG and strip location metadata
      A->>F: Save the photo file
      alt photo not saved
        A-->>P: Photo error, retry, nothing claimed
      else photo saved
        A->>D: BEGIN
        A->>D: Insert users row
        A->>D: Insert waiver_acceptances row
        A->>D: Mark the imported_memberships or roster_records row claimed, UNIQUE
        A->>D: Insert authorizations row with type, term and photo
        alt unique violation, another request won
          A->>D: ROLLBACK
          A->>F: Delete the saved photo file
          A-->>P: Same message as an invalid number
        else all rows saved
          A->>D: COMMIT
          A-->>P: Account ready, start a sign-in session on this device
        end
      end
    end
  end
```

**About this diagram:** One request, used by every registration and renewal path (REQ-F-13, F-17, F-60, NF-24; failure messages follow REQ-F-72). Renewal, type change and "I am an athlete" (diagrams 6 to 8) skip the users and waiver_acceptances rows. For athletes the claimed row is in roster_records and the email link is marked used in the same transaction.

Notes: the photo is stored with the authorization, not the account (design-notes.md). The waiver is stored with the full name and email from the payment record or the roster (REQ-F-60).

### 4. Athlete registration by email link

**Type:** User flow. **Use it to:** build the athlete registration screens, the link email and their error messages.

```mermaid
flowchart TD
  START["Open Register as athlete"] --> PN["Privacy notice"]
  PN --> SN["Type the student number"]
  SN --> LIM{"Link request limit hit?"}
  LIM -->|"yes"| X0["Message: try again at TIME"]
  LIM -->|"no"| R{"In the current-term roster?"}
  R -->|"no, or no current term"| X1["You do not appear as a registered athlete.<br/>Go to Athletic Activities. Contact number"]
  R -->|"yes, already claimed"| X2["Record already claimed.<br/>Contact number"]
  R -->|"yes, roster email already has an account"| X3["You already have an account.<br/>Sign in and use I am an athlete"]
  R -->|"yes, unclaimed"| SEND["Send a link to the institutional email in the record.<br/>Show it masked. Needs outgoing mail,<br/>waits on CTI's answer"]
  SEND --> OPEN["Athlete opens the link"]
  OPEN --> V{"Link state"}
  V -->|"expired"| X4["Link expired. No account.<br/>Ask for a new link"]
  V -->|"used or replaced"| X5["Link already used. No account.<br/>Sign in or ask for a new link"]
  V -->|"record claimed since"| X2
  V -->|"valid"| PW["Create a password"]
  PW --> PH["Current photo"]
  PH --> WV["Waiver and emergency contact"]
  WV --> FIN[["Final step, diagram 3"]]
  FIN -->|"photo failed"| PH
  FIN -->|"saved"| OK["Account email is the roster email.<br/>Athlete authorization for the term.<br/>Link marked used. Signed in"]
  X4 --> SN
```

**About this diagram:** Drawn with the recommended option of REG-5: only the student number is asked before the link; password, photo and waiver come after the link is opened (REQ-F-15, NF-25, NF-24, F-26, F-60). The request limit is REG-7 and the link rules are REG-6; messages follow REQ-F-76, F-73, F-18, SRS 3.3 errors and REG-4. Needs CTI outgoing mail (M-07).

Notes: the account exists only after the final step that follows opening the link (REQ-F-15). The final step checks the link again, so a link that expires while the form is open creates no account.

### 5. In-person athlete registration by Staff

**Type:** User flow. **Use it to:** build the front desk screen and the one-time code step, only if CTI has no mail.

```mermaid
flowchart TD
  subgraph FALLBACK["Only if CTI confirms there is no outgoing mail"]
    START["Staff, gym account without PIN,<br/>opens Register athlete in person"] --> SN["Type the athlete's student number"]
    SN --> R{"In the current-term roster?<br/>Staff see it read-only"}
    R -->|"no"| X1["Not a registered athlete message.<br/>Staff cannot add or edit roster records.<br/>An Administrator adds the athlete first"]
    R -->|"yes, already claimed"| X2["Refused, contact number"]
    R -->|"yes, unclaimed"| ID["Staff check identification<br/>against the name in the record"]
    ID -->|"does not match"| X3["Stop. No registration"]
    ID -->|"matches"| CODE["System shows a one-time code,<br/>single use, short validity"]
    CODE --> AUD["Write an audit log entry:<br/>in-person athlete registration"]
    CODE --> PHONE["Athlete types the code on own phone:<br/>privacy notice, password, photo, waiver"]
    PHONE -->|"code expired"| X4["No account. Staff issue a new code"]
    PHONE --> FIN[["Final step, diagram 3"]]
    FIN --> OK["Account email is the roster email.<br/>Athlete authorization for the term"]
  end
```

**About this diagram:** Built only if CTI confirms there is no outgoing mail (M-07); otherwise it is not built (REQ-F-77, E-41). Staff see the current-term roster as a read-only list and can search it by student number, but adding, editing, removing and importing records stay Administrator only (E-59, still to be confirmed by the gym). Drawn with the recommended option of REG-11; the not-on-roster message is REQ-F-76, the audit entry is REQ-NF-39, and the final step covers REQ-F-13, F-17 and F-60.

### 6. Renewal and type change with a new Authorization Number

**Type:** User flow. **Use it to:** build the renewal screen for a signed-in User and its error messages.

```mermaid
flowchart TD
  START["Signed-in User opens the app"] --> ACT{"Active authorization today?"}
  ACT -->|"yes"| CI["Normal home and Check In<br/>other issue"]
  ACT -->|"no"| HOME["Status: expired or not on the roster.<br/>Authorization Number field, contact number,<br/>schedules, notices, information, analytics.<br/>No Check In"]
  HOME --> NUM["Type the new Authorization Number"]
  HOME --> ATH["I am an athlete<br/>diagram 7"]
  NUM --> LK[["Authorization Number lookup<br/>diagram 2"]]
  LK -->|"invalid, claimed, ended or paused"| MSG["Same messages as in diagram 1"]
  LK -->|"valid, current term, unclaimed"| MASK["Show the payment email masked"]
  MASK --> EM{"Payment email compared<br/>with the account email"}
  EM -->|"same email"| RN["Renewal, no new account"]
  EM -->|"different, no other account has it"| TC["Type change to paid member.<br/>Account email does not change"]
  EM -->|"different, another account has it"| X1["Refuse, contact number.<br/>See Gaps"]
  RN --> PH["New photo for this term"]
  TC --> PH
  PH --> FIN[["Final step, diagram 3, without the account<br/>or waiver rows"]]
  FIN -->|"photo failed"| PH
  FIN -->|"number claimed meanwhile"| MSG
  FIN -->|"saved"| OK["New paid authorization active.<br/>Same account and Check In history"]
```

**About this diagram:** The User is signed in and has no active authorization (REQ-F-23). A paid member renews this way (REQ-F-78), and an athlete who becomes a paid member uses the same field (REQ-F-20); the lookup is REQ-F-70, F-71, F-72 and the final step is REQ-F-13, F-17, F-26, NF-24.

Notes: the photo cannot be replaced while an authorization is active (REQ-F-26). The waiver is not asked again (REQ-F-60).

### 7. "I am an athlete" inside the account

**Type:** User flow. **Use it to:** build the "I am an athlete" screen, its link email and its error messages.

```mermaid
flowchart TD
  START["Signed-in User taps I am an athlete"] --> SN["Type the student number"]
  SN --> LIM{"Link request limit hit?"}
  LIM -->|"yes"| X0["Message: try again at TIME"]
  LIM -->|"no"| R{"In the current-term roster?"}
  R -->|"no"| X1["Not a registered athlete message,<br/>with contact number"]
  R -->|"yes, already claimed"| X2["Record already claimed, contact number"]
  R -->|"yes, unclaimed"| LNK["Send a link to the institutional email in the record.<br/>Show it masked. Nothing linked yet.<br/>Needs outgoing mail, waits on CTI's answer<br/>like athlete registration"]
  LNK --> OPEN["User opens the link"]
  OPEN --> V{"Link state"}
  V -->|"expired"| X3["Link expired. Nothing linked.<br/>Ask for a new link"]
  V -->|"used or replaced"| X4["Link already used. Nothing linked"]
  V -->|"record claimed since"| X2
  V -->|"valid"| PH["New photo for this term,<br/>unless the account already has one for this term"]
  PH --> FIN[["Final step, diagram 3: save photo,<br/>then claim and athlete authorization"]]
  FIN -->|"photo failed"| PH
  FIN -->|"record claimed meanwhile"| X2
  FIN -->|"saved"| OK["Athlete authorization active. Link marked used.<br/>Account email does not change"]
  X3 --> SN
```

**About this diagram:** Decided in E-58 (REG-12): typing the student number links nothing; the roster record is linked only when the link sent to its institutional email is opened (REQ-F-80, changed to match REQ-F-15). The link works like the athlete registration link (single use, expires, stored hashed, requests limited; values in REG-6 and REG-7) and needs CTI outgoing mail (M-07). Messages follow REQ-F-76 and F-73; the account email does not change (REQ-F-20).

### 8. Athlete in a new term

**Type:** User flow. **Use it to:** build the new-term photo prompt and the check that matches the new roster record.

```mermaid
flowchart TD
  START["Athlete opens the app for the first time in a new term,<br/>still signed in or signing in again"] --> T{"Is a term configured for today?"}
  T -->|"no"| X0["No active authorization, no Check In"]
  T -->|"yes"| M{"Current-term roster record with the student number<br/>of the account's last athlete claim?"}
  M -->|"no"| X1["Status: not on the roster.<br/>Not a registered athlete message with contact number"]
  M -->|"yes, claimed by another account"| X2["Contact number.<br/>Administrator checks the claim"]
  M -->|"yes, unclaimed"| PH["Ask for the new term photo.<br/>Check In stays off until it is saved"]
  PH --> FIN[["Final step, diagram 3: save photo,<br/>then claim and athlete authorization"]]
  FIN -->|"photo failed"| PH
  FIN -->|"saved"| OK["Athlete authorization for the new term.<br/>Check In allowed"]
```

**About this diagram:** An athlete on the new-term roster has nothing to renew (REQ-F-25); the app asks for the new photo before Check In (REQ-F-26, E-38). Drawn with the recommended option of REG-10; the no-term case follows SRS 3.4 errors and the not-on-roster case REQ-F-23 and F-76. A paid member in a new term just sees "expired" and uses diagram 6.

### 9. Authorization states

**Type:** State diagram. **Use it to:** write the authorization status rules, the release and import undo actions, and their tests.

```mermaid
stateDiagram-v2
  direction LR
  state "removed from roster" as removed
  state "deleted with its term photo" as deleted
  [*] --> active : paid claim, athlete claim, or manual grant by an Administrator (audit for manual)
  active --> expired : term end date passes, any type
  active --> revoked : Administrator revokes, any type (audit)
  active --> removed : athlete type, roster record removed (audit)
  active --> deleted : paid type, number released or import undone (audit)
  expired --> deleted : paid type, number released or import undone (audit)
  revoked --> deleted : paid type, import undone (audit)
  expired --> [*]
  revoked --> [*]
  removed --> [*]
  deleted --> [*]
  note right of deleted
    Account stays, unless a release
    removes the claim that created it.
    A new claim needs a new photo.
  end note
```

**About this diagram:** One row in authorizations; types are paid, athlete and manual. Transitions marked "audit" write an audit_log_entries row (REQ-NF-39); claims made by the User are not gym actions and write no audit entry. Release (REQ-F-74) and import undo (REQ-F-31) delete the authorization together with its term photo, row and file (E-57).

| Transition | Rule |
|---|---|
| to active | Paid: diagram 1 or 6 (REQ-F-13, F-78). Athlete: diagram 4, 5, 7 or 8 (REQ-F-15, F-25, F-77, F-80). Manual: REQ-F-87, with reason (Proposed), audit |
| active to expired | End of the term, whatever the purchase date (REQ-F-22). Backend time decides (REQ-NF-01). Account stays, Check In off (REQ-F-23). No audit entry |
| active to revoked | Administrator revokes by hand (REQ-F-87). Audit with reason |
| active to removed from roster | Administrator removes the athlete from the roster (REQ-F-49, F-22). Gym ID stops being valid at once; the current facility session keeps counting until it ends. Audit (roster change) |
| to deleted, release | REQ-F-74. If this claim created the account, the account and its photo are deleted too. If it was added to an existing account, that authorization and its term photo (row and file) are deleted and the account stays (E-57). The number can be claimed again, with a new photo. Audit |
| to deleted, import undone | REQ-F-31, E-57. Undo deletes the import's imported_memberships rows and the authorizations that came from them, together with their term photo (row and file). Accounts stay. When the person claims again with the corrected file, they upload a new photo, as in any renewal. Audit |

Notes: whether "expired" is a stored status or computed from the term end date is left to the data model issue. Manual and athlete authorizations have no imported membership, so release and import undo do not apply to them.

## Design decisions to confirm

All are **Proposed** except REG-12, which is **Decided**. The team decides the rest in the PR review. No standard was cited for these values because none was checked for this document.

### REG-1: Per-IP limit on failed Authorization Number lookups (REQ-F-71)

How many guesses one IP gets. The chance that one guess hits a valid, unclaimed, current-term number is about U / 1,000,000, where U is how many such numbers exist. U is unknown; 300 is used below only as an example.

| Option | What it means | Tradeoff |
|---|---|---|
| A | 10 failures in 15 minutes, then a 15-minute pause | Up to about 960 guesses a day per IP, about 0.3 hits a day at U = 300. Few real users ever see a pause |
| B | 5 failures in an hour, then pause until the hour ends | About 120 guesses a day per IP, about 0.04 hits a day. Easy to explain |
| C | 5 free failures, then a pause that doubles after each further 5 failures (15 min, 30 min, 1 h, ... up to 24 h). Resets after 24 hours without failures | About 35 guesses a day per IP, about 0.01 hits a day. Same idea as the growing wait of REQ-F-07, so one mechanism can serve both |

Recommendation: C. It gives the fewest guesses and a real user who mistypes 1 to 3 times never sees it. Many campus users may share one public IP, but only failures count, so a shared IP is rarely paused. In all options, IPv6 addresses are counted per /64 prefix, because one device can use many addresses inside a /64.

### REG-2: Global slow-down on failed lookups (REQ-F-71, E-53)

The global limit must never block, only slow, and must write an alert entry.

| Option | What it means | Tradeoff |
|---|---|---|
| A | While slow mode is on, the server waits N seconds before answering each lookup | Simplest. Each waiting request holds a PHP worker. A flood can fill every worker and stop the whole app, which is a block in practice |
| B | While slow mode is on, the server answers "check again in N seconds" with a signed ticket. The PWA waits and resends by itself. The server answers only tickets at least N seconds old | No worker is held while waiting. A little more code in the API and the PWA |

Proposed values for both: slow mode turns on when there are more than 100 failed lookups in 10 minutes across all IPs, N = 3 seconds, and it turns off when the count falls below the threshold. One alert entry is written each time slow mode turns on, not one per lookup. Recommendation: B. Honest limit: slowing each lookup does not stop an attacker who uses many IPs in parallel; the per-IP limit and the alert do the real work.

### REG-3: Masking format for emails (REQ-F-70)

| Option | Example for `carlos@upr.edu` | Tradeoff |
|---|---|---|
| A | First character, always 3 stars, full domain: `c***@upr.edu` | Matches the SRS example. Fixed stars hide the length. The domain helps the member recognize the email |
| B | First and last character, full domain: `c***s@upr.edu` | Easier to recognize; shows one more character |
| C | Also mask the domain: `c***@u***.edu` | Shows less; harder to recognize |

Recommendation: A, also for the institutional email shown after the athlete link is sent. A one-character local part shows only `*@domain`.

### REG-4: Record whose email already has an account, person not signed in (REQ-F-78)

| Option | What it means | Tradeoff |
|---|---|---|
| A | Show the masked email and "you already have an account, sign in to add this membership". Nothing is claimed until the person signs in and runs diagram 6 | Keeps one path for renewals, and the new term photo is taken in the same step (REQ-F-26). One more step for the member |
| B | Attach the authorization right away without sign in. Ask for the photo at the next app open before Check In | Fewer steps. Safe, because access goes to the payer's account, but it needs an "active without photo" case that every Check In path must check |

Recommendation: A. The same rule applies to athletes: if the roster email already has an account, the athlete signs in and uses "I am an athlete" (diagram 4).

### REG-5: Where athletes enter password, photo and waiver (REQ-F-15)

| Option | What it means | Tradeoff |
|---|---|---|
| A | Before the link: the athlete fills everything, the server keeps it as a pending registration, and opening the link creates the account | One sitting. But anyone can type an athlete's student number, which is not secret, and set the password and photo. If the real athlete then opens the link, the account belongs to that other person. Also stores photos of people not yet checked, which needs a cleanup task |
| B | After the link: only the student number before; the page opened from the link asks for password, photo and waiver | The person who sets the password is the one who reads the institutional email. No pending personal data. The athlete may switch device between steps |

Recommendation: B. Drawn in diagram 4.

### REG-6: Athlete link validity

| Option | Validity | Tradeoff |
|---|---|---|
| A | 1 hour | Short exposure. Students who do not check institutional email right away must ask again |
| B | 24 hours | Covers checking email later the same day. The link only works for the holder of the institutional mailbox |
| C | 7 days | Fewest repeat requests; a forgotten link stays usable for a long time |

Recommendation: B. In every option the link is single use, a new link cancels the earlier one, the token is stored hashed, and it is checked again in the final step.

### REG-7: Limit on athlete link requests (not in the SRS)

| Option | What it means | Tradeoff |
|---|---|---|
| A | Per student number: at most 1 link every 5 minutes and 5 a day | Stops someone from flooding an athlete's mailbox by typing the student number |
| B | No limit, as the SRS is today | Less code. Any visitor can make the system send many emails to one athlete and spend the CTI mail quota |

Recommendation: A.

### REG-8: What the user sees when the photo or the final step fails (REQ-F-13)

| Option | What it means | Tradeoff |
|---|---|---|
| A | One final request with everything (diagram 3). On failure the user stays on the photo step with the typed data kept in the page, sees the cause (wrong type, over 10 MB, could not be read, server error) and retries. Closing the page loses the data; the number stays free | Simplest. Nothing stored on the server until the end. The photo error shows only at the end |
| B | Upload the photo first to a temporary area, get a reference, and send the rest with that reference at the end | Photo errors show earlier. Needs temporary files and a task that deletes abandoned ones |

Recommendation: A. The password is kept only in page memory, never in browser storage.

### REG-9: Message for an Authorization Number from an ended term (SRS 3.2 errors)

| Option | What it means | Tradeoff |
|---|---|---|
| A | Same message as REQ-F-72 | Reveals nothing. A member with an old receipt does not learn why |
| B | Specific message: this membership was for a term that ended, buy a new one, plus the contact number | Helps real members. It confirms that an old number existed, which gives a guesser nothing to claim |

Recommendation: B. In both options it counts as a failed lookup (diagram 2).

### REG-10: How an athlete's new-term roster record reaches the account (REQ-F-25, F-26)

| Option | What it means | Tradeoff |
|---|---|---|
| A | At the first app open in the new term, match the current-term roster record by the student number of the account's last athlete claim, then claim it together with the new photo (diagram 3) | Same atomic step as registration. That student number was proven by the email link before. An athlete who never opens the app has no new-term authorization |
| B | When the Administrator saves the new roster, link existing accounts by student number automatically, with no photo yet; Check In stays off until the photo is uploaded | Staff see the athlete as authorized even before the athlete opens the app. Adds an "active without photo" case |
| C | Match by institutional email equal to the account email | Fails for accounts whose email is a payment email (REQ-F-20), and when the roster email changes |

Recommendation: A. Drawn in diagram 8. See the Gaps note about Staff-assisted Check In.

### REG-11: In-person athlete registration, where the athlete enters the data (REQ-F-77)

| Option | What it means | Tradeoff |
|---|---|---|
| A | The athlete types password, picks a photo and accepts the waiver on the front desk device | No extra code. The password is typed on a shared computer, and the front desk is a desktop (G-06), so taking a current photo is hard |
| B | After checking identification, Staff get a one-time code (single use, valid 15 minutes). The athlete enters it on their own phone and finishes there | Photo from the phone camera, password on the athlete's own device. Needs the code and its expiry |

Recommendation: B. Only matters if CTI confirms there is no mail.

### REG-12: Email link for "I am an athlete" (REQ-F-80)

**Decided (E-58):** the system sends a link to the institutional email in the roster record and links the record only when the link is opened, with the same link mechanism as athlete registration; it needs outgoing mail. Drawn in diagram 7.

## Gaps and questions

1. **REQ-F-80 lets anyone take an athlete's record.** Resolved by E-58: the record is linked only after the link sent to its institutional email is opened.
2. **"First time they sign in during a new term" (REQ-F-26, E-38) does not fit REQ-F-03.** Sign-in sessions have no inactivity timeout, so an athlete may never sign in again. The diagrams use "first time the app is opened in the new term".
3. **REQ-F-78 does not say what happens when the person is not signed in**, and the athlete flow has no matching rule for a roster email that already has an account. Proposal: REG-4.
4. **A signed-in User enters a number whose payment email belongs to another account.** Neither REQ-F-20 nor REQ-F-78 covers it. Diagram 6 refuses it with the contact number. Team to confirm.
5. **REQ-F-75 does not cover every case.** When a signed-in User with a different email attaches a number (type change, REQ-F-20), the real owner cannot use password reset, because the payment email is not that account's email. Only the release by an Administrator (REQ-F-74) helps.
6. **Two orders with the same Authorization Number** (REQ-F-10, E-30, G-19). Diagram 2 denies the lookup with the contact number until E-30 is answered.
7. **No limit on athlete link requests.** Proposal: REG-7.
8. **Two active authorizations in the same term.** REQ-F-23 shows the Authorization Number field only without an active authorization, but REQ-F-80 has no such condition. Can a paid member with an active authorization also become an athlete in the same term? If yes, which one does Check In use?
9. **Deleted authorizations and analytics.** Release (REQ-F-74) and import undo (REQ-F-31) delete authorizations. In the data model a facility session points only to the User. The paid versus athlete split in REQ-F-61 (e) then needs the facility session to keep the authorization type it was created with. Question for the data model issue.
10. **Staff-assisted Check In for an athlete in a new term** (REQ-F-46) who has not opened the app: with REG-10 option A there is no new-term authorization or photo yet, so Staff cannot check them in. Gym to say if that is acceptable. With E-59 Staff can see the athlete on the current-term roster (read-only), but that alone does not give an authorization.
11. **Athlete removed from the roster by mistake and added back** (REQ-F-49): the old authorization stays removed from roster. With REG-10 option A the athlete gets a new one at the next app open. Not stated in the SRS.
12. **Link tokens and one-time codes have no entity** in the logical data model (design-notes.md). The athlete link (REQ-F-15), the "I am an athlete" link (E-58) and the REG-11 code need a place to be stored, hashed. Question for the data model issue.

## Traceability

| Requirement or decision | Where it appears |
|---|---|
| REQ-F-10 | 2. Authorization Number lookup with limits |
| REQ-F-11 | 1. Paid member registration |
| REQ-F-13 | 1, 3, 4, 5, 6, 7, 8 (final step) |
| REQ-F-15 | 4. Athlete registration by email link; 7. "I am an athlete" inside the account; 9. Authorization states |
| REQ-F-18 | 1. Paid member registration; 2. Authorization Number lookup with limits; 4. Athlete registration by email link |
| REQ-F-20 | 6. Renewal and type change with a new Authorization Number; 7. "I am an athlete" inside the account |
| REQ-F-22 | 1. Paid member registration; 2. Authorization Number lookup with limits (ended term); 9. Authorization states |
| REQ-F-23 | 6. Renewal and type change; 8. Athlete in a new term; 9. Authorization states |
| REQ-F-25 | 8. Athlete in a new term; 9. Authorization states |
| REQ-F-26 | 1, 4, 6, 7, 8 (photo per term) |
| REQ-F-31 | 9. Authorization states (import undo deletes the authorization and its term photo, E-57) |
| REQ-F-60 | 1. Paid member registration; 3. Final step: photo first, then account and claim; 4. Athlete registration by email link; 5. In-person athlete registration by Staff (waiver on the phone) |
| REQ-F-70 | 1. Paid member registration; 2. Authorization Number lookup with limits; 6. Renewal and type change |
| REQ-F-71 | 2. Authorization Number lookup with limits; 1 and 6 (pause message) |
| REQ-F-72 | 1. Paid member registration; 2. Authorization Number lookup with limits; 3. Final step |
| REQ-F-73 | 1, 2, 4, 7, 8 (contact number, pending G-25) |
| REQ-F-74 | 1. Paid member registration (dotted path); 9. Authorization states |
| REQ-F-75 | 1. Paid member registration (dotted path, needs M-07) |
| REQ-F-76 | 4. Athlete registration by email link; 5. In-person athlete registration by Staff; 7. "I am an athlete" inside the account; 8. Athlete in a new term |
| REQ-F-77 | 5. In-person athlete registration by Staff |
| REQ-F-78 | 1. Paid member registration; 6. Renewal and type change; 9. Authorization states |
| REQ-F-80 | 7. "I am an athlete" inside the account (email link, E-58); 9. Authorization states |
| REQ-NF-24 | 1. Paid member registration; 3. Final step; 4, 6 |
| REQ-NF-25 | 1. Paid member registration; 4. Athlete registration by email link; 5. In-person athlete registration by Staff |
| Also shown: REQ-F-17, F-49, F-87, NF-39 | 3. Final step (F-17); 9. Authorization states (F-49, F-87, NF-39); 2 and 5 (NF-39) |
| E-56 (PIN state) | Not in this file |
| E-57 (photos on import undo and release) | 9. Authorization states |
| E-58 ("I am an athlete" by email link) | 7. "I am an athlete" inside the account; REG-12; Gaps 1 and 12 |
| E-59 (Staff see the roster read-only) | 5. In-person athlete registration by Staff; Gap 10 |
| E-60 (recovery code) | Not in this file |
