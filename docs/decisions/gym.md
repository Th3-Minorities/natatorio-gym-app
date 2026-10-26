# Questions for Athletic Activities

**What:** open questions for the gym about access rules, registration, the athlete roster, front desk work, data and testing.
**For:** Athletic Activities administration and the staff who run the Weight Gym.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.

| Total | Answered | Partly answered | Open |
|---|---|---|---|
| 36 | 17 | 5 | 14 |

"Answered" items were answered by the team on 2026-10-13. The gym must still confirm each one. "Partly answered" items have a team note but still need the gym's answer.

## Running the system

### G-01: Who looks after the system after December

| Field | Value |
|---|---|
| Question | After December, who at the gym looks after the system: holds the PIN and the gym account password, changes them when an employee leaves, helps users with problems, and calls for help if it fails? |
| Affects | REQ-NF-23 No routine developer access to safety data; REQ-NF-31 Uptime target and manual procedure |
| Feature | 2.5 Assumptions and Dependencies, 6.4 Other Quality Attributes |
| Why we ask | CTI does not manage the server or the application and has no people to adopt the project. In the CTI meeting, CTI said this is the owner's question: the owner must set a plan (for example hiring students), and part of the work after December (install, configuration, accounts, adjustments, user orientation) is his. If nobody is named, the team would run it, which conflicts with REQ-NF-23. CTI minutes, section 3.2 (`docs/meetings/2026-10-22-cti-minuta.md`). |
| Answer | Partly answered. Gym administration actions now need the PIN of the one shared gym account, so whoever holds the PIN runs them (see G-29). Who looks after the system after December, helps users and calls for help if it fails: unknown, the gym answers. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

Also asked in cti.md: M-16 (who may have administrator access to the server).

### G-07: What staff do if the system fails

| Field | Value |
|---|---|
| Question | If the system stops working, what do staff do? A: go back to the paper log and the manual payment check. B: another procedure (describe it). How long can it be down before it causes a real problem? |
| Affects | REQ-NF-31 Uptime target and manual procedure |
| Feature | 6.4 Other Quality Attributes |
| Why we ask | There is no offline Check In. REQ-NF-31 needs both a backup procedure and an uptime target. |
| Answer | Partly answered. The team does not know what staff do if the system fails or how long downtime is tolerable. The gym answers both. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-06: Front desk devices

| Field | Value |
|---|---|
| Question | Which devices do front desk staff use? A: their own phones. B: a gym computer at the front desk. C: both. If there is a computer, do several staff members share it? |
| Affects | REQ-F-44 Staff see active sessions |
| Feature | 2.3 Operating Environment, 3.8 Staff Operations |
| Why we ask | The Staff screens are designed for these devices. A shared computer affects whether the one-device rule fits Staff (team.md, E-13). |
| Answer | Partly answered. The team understands the gym has a desktop computer at the front desk. The gym must confirm whether several staff share it and whether staff also use phones. The one-device rule no longer applies to the gym account (team.md, E-13). |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-05: Number of members and busiest hour

| Field | Value |
|---|---|
| Question | About how many members are active each term (paid members and athletes)? About how many people arrive in the busiest hour? |
| Affects | REQ-NF-15 Serve about 150 people per day |
| Feature | 6.2 Performance |
| Why we ask | The proposal estimates 150 people per day. The busiest hour sets how many Check Ins at once we test. |
| Answer | Unknown. Measuring the number of members and the busiest hour is one purpose of the app. The SRS keeps about 150 people per day as an assumption, and the Check In concurrency test uses a number fixed in design. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-31: Using the app from outside campus

| Field | Value |
|---|---|
| Question | Should Users be able to open the app and do Check In from outside the campus network, for example on mobile data? Should the Administrator be able to limit the networks that can connect, and for which screens? |
| Affects | REQ-NF-16 Check In usable on mobile data; REQ-NF-26 Core actions require a connection |
| Feature | 2.3 Operating Environment |
| Why we ask | In the CTI meeting, CTI raised it as the gym's decision. A campus-only rule would block Check In from phones on mobile data. Whether CTI's network allows outside access at all is cti.md, M-01. CTI minutes, section 3.19. |
| Answer | |
| Answered by | |
| Date | |

### G-36: Manuals for the gym

| Field | Value |
|---|---|
| Question | Do you want a user manual and an administrator manual from the team? In which language? |
| Affects | None directly |
| Feature | 2.5 Assumptions and Dependencies |
| Why we ask | In the CTI meeting, CTI said the owner should ask the team now for what he needs after December, for example these manuals. CTI minutes, sections 3.2 and 3.23. |
| Answer | |
| Answered by | |
| Date | |

### G-37: Backups at the gym

| Field | Value |
|---|---|
| Question | If the team proposes that the Administrator downloads a backup file from the app, who at the gym would do it, how often, and where would the file be kept? The file holds every photo and the personal data in the system. |
| Affects | REQ-NF-06 |
| Feature | 4.3 |
| Why we ask | Proposed question, open until the team picks a backup method. Where backups go is the team's decision with the owner (cti.md, M-06; team.md, E-109). |
| Answer | |
| Answered by | |
| Date | |

## Accounts and registration

### G-02: Paid member email

| Field | Value |
|---|---|
| Question | When a paid member creates the account, which email does it use? A: always the email used to pay in WooCommerce. B: the member can change it at that moment. |
| Affects | REQ-F-11 Account email is the payment email; REQ-F-12 Verify paid member email (now Removed) |
| Feature | 3.2 Paid Member Registration |
| Why we ask | The plan today is A. With B, the new email must be checked with a link (team.md, E-09). |
| Answer | A: always the payment email in WooCommerce. The member does not type it, and there is no email verification step (team.md, E-09). |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-15: Email when a member changes type

| Field | Value |
|---|---|
| Question | When a paid member becomes an athlete, or an athlete becomes a paid member, which email stays on the account? A: the current account email. B: the institutional email from the roster. C: the user chooses. |
| Affects | REQ-F-20 Change type without losing the account |
| Feature | 3.4 Authorization, Academic Terms and Renewal |
| Why we ask | The person must keep one account and its Check In history. Paid members use the payment email and athletes the roster email, so the two may differ. The answer also tells us how to match a roster record to an existing account. |
| Answer | A: the current account email stays. The user signs in to the existing account and adds the new authorization from inside it: an Authorization Number for a new paid membership, or a student number ("I am an athlete") that is in the current-term roster and unclaimed. No new account is created and staff do not merge accounts. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-04: Lost or changed phone

| Field | Value |
|---|---|
| Question | When a user loses or changes their phone and cannot get back into the account, what do staff do? A: nothing, the user signs in on the new phone with the password. B: staff check the person's ID at the front desk and help restore access. C: another process (describe it). |
| Affects | REQ-F-03 Account recovery after a lost phone (was REQ-F-05) |
| Feature | 3.1 Accounts and Sign In |
| Why we ask | Each account works on one device at a time. REQ-F-05 (now part of REQ-F-03) stayed Pending until the staff role was defined. |
| Answer | A: the user signs in on the new phone with the password, and the old session ends. A user who forgot the password uses the email reset (team.md, E-11). There is no staff process. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-19: Authorization Number format

| Field | Value |
|---|---|
| Question | What does the Authorization Number look like? How long is it, does it use letters or only digits, is it random or in sequence, and can it be used only once? A sample with part of the number hidden helps. |
| Affects | REQ-F-10 Validate Authorization Number against imports |
| Feature | 3.2 Paid Member Registration, 4.1 Data Dictionary |
| Why we ask | The number is the paid member's proof of purchase. If it is short or in sequence, someone can guess another member's number, and registration needs extra protection. |
| Answer | From a sample receipt email: the Authorization Number is the 6-digit value in the Payment Description. Registration uses only this number, with these protections: limits on failed lookups per IP address and in total, a masked payment email, the same message for an invalid and an already claimed number, release of a number claimed by mistake by PIN holders, and recovery by the real owner with the password reset. Still open: whether the number is unique across orders. The team checks it with a real export (team.md, E-30). |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

Also asked in cti.md, if CTI manages the store.

### G-23: Deleting an account

| Field | Value |
|---|---|
| Question | Who can ask to delete an account or its data: the user, the gym, or UPRM? What must be kept after a deletion? |
| Affects | REQ-F-09 Delete an account or its data |
| Feature | 3.1 Accounts and Sign In |
| Why we ask | REQ-F-09 is new and nobody has approved it. Retention periods come from G-03. |
| Answer | The user requests deletion from the app, only when the user has no active authorization. Personal data and photos are deleted. Anonymous Check In counts are kept for analytics. PIN holders can handle a deletion for a user if needed. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-34: Who takes the User's photo

| Field | Value |
|---|---|
| Question | Is a photo the User takes with their own phone at registration valid, or should Staff take it? Is the first registration done by the person alone or with Staff? If the photo does not match the person at the door, what do Staff do? |
| Affects | REQ-F-13, REQ-F-26, REQ-F-45 |
| Feature | 3.2, 3.3, 3.8 |
| Why we ask | In the CTI meeting, CTI first said that, if it were up to CTI, taking the photo would be a Staff task, then said the phone is fine if the director accepts it. CTI also said Staff should flag a photo that does not match, which has no design today. CTI minutes, section 3.22. |
| Answer | |
| Answered by | |
| Date | |

### G-35: Technical contact for the store

| Field | Value |
|---|---|
| Question | Who is the technical contact for the athletic department's WordPress store? How should payments reach the app later: a file export (today), a message from WordPress, or the app asking the store? |
| Affects | REQ-F-32 Sync with WooCommerce through the API |
| Feature | 3.5 WooCommerce Import |
| Why we ask | In the CTI meeting, CTI said the director is not a technical contact. The MVP stays a file import; this only blocks Stretch work. CTI minutes, section 3.10. |
| Answer | |
| Answered by | |
| Date | |

## Terms and athlete roster

### G-18: Term dates

| Field | Value |
|---|---|
| Question | Who provides the start and end dates of each term, and who enters them in the system? A: the dates come from the UPRM academic calendar and the Administrator enters them. B: the gym sets its own dates. |
| Affects | REQ-F-21 Administrator edits academic terms; REQ-F-22 Authorization expires at term end |
| Feature | 3.4 Authorization, Academic Terms and Renewal |
| Why we ask | Every authorization expires at the end of its term. A wrong date gives or removes access for everyone at once. |
| Answer | A: the dates come from the UPRM academic calendar and the Administrator enters them. Summer is asked in G-26. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-10: Roster data and format

| Field | Value |
|---|---|
| Question | For each athlete, which data does the department record: student number, name, institutional email, sport, term, photo, other? Are the lists on paper or in a spreadsheet? Can they be sent as one file to import? |
| Affects | REQ-F-49 Only PIN holders change the roster; REQ-F-51 Minimum fields of a roster record |
| Feature | 3.9 Athlete Roster |
| Why we ask | The SRS minimum is student number, name, institutional email and term. A spreadsheet lets us import the list; paper means typing each record. |
| Answer | Partly answered. PIN holders create, import or edit the roster in the system. The SRS minimum stays student number, name, institutional email and term. The gym still answers which other fields it records and whether the lists are on paper or in a spreadsheet. In the CTI meeting one team member said the gym receives the list as an Excel file and prints it; another said the source is not known. Not verified with the gym. CTI recommended uploading the same file the gym receives, so the system keeps what it needs and ignores the rest. Follow-up questions: G-33. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-13: Who names the roster Staff (closed: no roster Staff)

| Field | Value |
|---|---|
| Question | (Closed: there is no roster permission; see Answer.) Who decides which Staff members get the roster permission? A: the Administrator, in the system. B: the department names them and the Administrator grants the permission. |
| Affects | REQ-NF-48 Only PIN holders change the PIN (was REQ-F-53); REQ-F-49 Only PIN holders change the roster |
| Feature | 3.10 Gym Account, PIN and Permissions, 3.9 Athlete Roster |
| Why we ask | Only Staff with this permission can change the roster. REQ-F-53 (now part of REQ-NF-48) stayed Pending until we knew who grants it. |
| Answer | Closed. There is no separate roster permission. The gym uses one shared gym account, and the roster tool needs the PIN. Who holds the PIN is asked in G-29. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### E-14: Administrator and the roster (moved from the team list)

| Field | Value |
|---|---|
| Question | Should the Administrator also be able to add, change or remove athletes? A: yes, together with the roster Staff. B: no, only the roster Staff. (Closed: the roster Staff role no longer exists; see Answer.) |
| Affects | REQ-F-54 Administrator manages athlete authorizations (now Removed) |
| Feature | 3.10 Gym Account, PIN and Permissions |
| Why we ask | The proposal gave this task to the Administrator; now designated Staff do it. The gym knows how the work is split. With B, REQ-F-54 is removed and the team rewrites the Objective 4 test. |
| Answer | Closed. The roster is handled by PIN holders. REQ-F-54 is Removed, and the Objective 4 test now checks each action by whether the PIN was entered. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-14: Review of roster entries

| Field | Value |
|---|---|
| Question | Records entered by roster Staff (a role that no longer exists) are approved right away. Does the gym want a check of what they entered? A: no. B: a report each term. C: another kind of review (describe it). |
| Affects | REQ-F-50 Roster entries are preapproved (now Removed) |
| Feature | 3.9 Athlete Roster |
| Why we ask | With B or C, the team adds a report or review step to REQ-F-50. |
| Answer | Replaced by the audit log. Every roster change is recorded with time, IP address, device and the values before and after. Whether the gym also wants a term report is asked in G-30. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-33: Roster updates each term

| Field | Value |
|---|---|
| Question | (1) Who gives the athlete list each term (for example the registrar or the coaches), and in what format? (2) Does it carry an institutional email for each student, and a sport or only an athlete mark? (3) On what date each term is it ready? (4) When a new list arrives, what happens to people who are not on it? A: they lose athlete status (the list is final). B: they stay until someone removes them by hand, for example a graduate the gym still treats as an athlete. (5) Who tells the system that a student stopped being an athlete mid-term, and who adds one mid-term? (6) Open, from a CTI example: if another group (for example the band) gets the gym benefit, must the statistics tell them apart from athletes? |
| Affects | REQ-F-49, REQ-F-51, REQ-F-61 (e), REQ-F-76 |
| Feature | 3.9 Athlete Roster |
| Why we ask | The athlete email link only works if the roster has the student's email. Athletes who try to register before the list is loaded get the 'not a registered athlete' message. In the CTI meeting, CTI said these are the gym's decisions. A person kept by hand today can only get a manual authorization, which counts as its own group in statistics, not as an athlete. CTI minutes, section 3.11. |
| Answer | |
| Answered by | |
| Date | |

## Front desk work

### G-16: Identification for assisted Check In

| Field | Value |
|---|---|
| Question | When a user without a phone asks Staff to do the Check In, what identification do Staff accept? A: UPRM ID card. B: any photo ID. C: the user's name and the photo in the system. |
| Affects | REQ-F-46 Staff-assisted Check In |
| Feature | 3.8 Staff Operations |
| Why we ask | Staff must find the account and confirm it is the same person. REQ-F-46 stays Pending until the accepted identification is set. |
| Answer | A paid member shows a photo of the payment confirmation, and staff find the account by Authorization Number. An athlete gives the student number. Staff also compare the photo stored in the account with the person in front of them (confirmed 2026-10-14). Changed 2026-10-14 (team.md, E-54): for a paid member, Staff search by name and compare the stored photo; no receipt or payment confirmation is needed. Athletes still give the student number. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-20: Session corrections by Staff

| Field | Value |
|---|---|
| Question | Which session corrections can Staff make? For example: end a session early, remove a session created by mistake, other (describe). |
| Affects | REQ-F-48 Staff make permitted session corrections |
| Feature | 3.8 Staff Operations |
| Why we ask | Any correction outside this list is rejected. Each correction changes the occupancy count and is recorded in the audit log. |
| Answer | Two corrections: end a session early, and void a session created by mistake. A void keeps the record and the log, and the session stops counting in occupancy and analytics. Staff cannot extend sessions or create sessions without authorization. Open, depends on G-32: if the gym wants a check-out, ending sessions becomes a routine Staff action, not only a correction. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-22: Refund during an active session

| Field | Value |
|---|---|
| Question | If a membership is refunded or cancelled while the person has an active session, what happens to that session? A: it continues until its 60 minutes end. B: it ends right away. |
| Affects | REQ-F-27 Refund or cancellation removes the authorization (now Removed) |
| Feature | 3.4 Authorization, Academic Terms and Renewal |
| Why we ask | REQ-F-27 removes the authorization, but the effect on a session already open is not defined. |
| Answer | Closed. There are no refunds or cancellations; memberships only expire at the end of the term. REQ-F-27 is Removed. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-09: Access rules and the PIN model

| Field | Value |
|---|---|
| Question | The team will send a one-page table with the access and renewal rules and with what the shared gym account can do without the PIN (front desk) and with the PIN (administration), including who sees the audit log. Does it match how the gym works? Mark any change. Two points need an explicit yes or no: (1) the front desk, students included, sees the current-term athlete roster (name, student number, institutional email) without the PIN, read only (team.md, E-59); (2) the administration keeps a one-time recovery code on paper to reset the gym password and PIN (team.md, E-60). (3) Open, from a CTI idea: does the gym want each Staff member and each Administrator to sign in with their own account instead of one shared gym account? Then the audit log names the person, and the gym can see who did each Check In or roster change. The shared account was the team's choice and the gym has not confirmed it. (4) If a person paid but the receipt never arrived, may front desk Staff add them by hand after seeing the receipt, or only the Administrator? Today only the Administrator can (team.md, E-35). |
| Affects | REQ-F-22 to REQ-F-26 Expiry and renewal rules; REQ-F-52 Gym account actions allowed by PIN; REQ-NF-48 Only PIN holders change the PIN (was REQ-F-53); REQ-NF-39 Audit log of gym actions |
| Feature | 3.4 Authorization, Academic Terms and Renewal, 3.10 Gym Account, PIN and Permissions, 8.1 Audit |
| Why we ask | The proposal says the gym validates these rules. The team replaced per-person roles with one gym account and a PIN (SRS Overview, role table). The gym must confirm it fits how they work. |
| Answer | |
| Answered by | |
| Date | |

### G-25: Contact number for people who cannot register

| Field | Value |
|---|---|
| Question | Which phone number should the app show to people whose Authorization Number or student number does not match, so they can get help? Whose number is it? |
| Affects | REQ-F-72 Same message for invalid or claimed number; REQ-F-73 Show a contact number; REQ-F-76 Message for athletes not in the roster |
| Feature | 3.2 Paid Member Registration, 3.3 Athlete Registration |
| Why we ask | The app shows this number every time a registration lookup fails. |
| Answer | |
| Answered by | |
| Date | |

### G-26: Summer memberships

| Field | Value |
|---|---|
| Question | The team assumes the WooCommerce store only sells memberships while a term is running (the store controls this, not the app), and that there is no summer membership unless a summer term is configured. Is that right? If memberships are sold in summer, what are the start and end dates of that period? |
| Affects | REQ-F-21 Administrator edits academic terms; REQ-F-22 Authorization expires at term end |
| Feature | 3.4 Authorization, Academic Terms and Renewal |
| Why we ask | An order belongs to the term that contains its payment date. An order dated outside every term is rejected by the import (REQ-F-22). Without a summer term, accounts stay expired between terms. |
| Answer | |
| Answered by | |
| Date | |

### G-29: Who holds the PIN

| Field | Value |
|---|---|
| Question | Who in the administration will know the PIN of the gym account? |
| Affects | REQ-F-52 Gym account actions allowed by PIN; REQ-NF-48 PIN stored hashed, attempts limited, only PIN holders change it (includes old REQ-F-53) |
| Feature | 3.10 Gym Account, PIN and Permissions |
| Why we ask | The PIN unlocks the roster, terms, imports, schedules and the audit log. Analytics are open to every role. Front desk staff must not know it. |
| Answer | |
| Answered by | |
| Date | |

### G-30: Term report of roster changes (optional)

| Field | Value |
|---|---|
| Question | Does the gym want a report each term with the roster changes taken from the audit log? A: no. B: yes. |
| Affects | REQ-NF-39 Audit log of gym actions |
| Feature | 4.2 Reports, 8.1 Audit |
| Why we ask | The audit log already records every roster change with time and IP address. A report is optional and adds work. |
| Answer | |
| Answered by | |
| Date | |

### G-32: The 60 minutes, coming back, and check-out

| Field | Value |
|---|---|
| Question | (1) Is the 60-minute use per visit or per day? (2) May a person who already used 60 minutes come back the same day? A: yes, a new 60-minute session (today's design). B: no, the door shows 'already used 60 minutes today'. C: yes, and every entry is recorded. (3) If a person enters several times inside the same hour, should the statistics count each entry or one visit? (4) Open, from a CTI idea: do you want a check-out, so the app knows how many people are inside at each moment and how long each person stays? If yes, Staff would do it at the desk from one list. |
| Affects | REQ-F-33, REQ-F-36, REQ-F-37, REQ-F-38, REQ-F-41, REQ-F-48, REQ-F-61 |
| Feature | 3.6 Check In and Facility Session, 3.7 Gym ID and Occupancy |
| Why we ask | Today, after the 60 minutes end, a new Check In opens a new session, there is no daily limit, and a Check In inside an active session returns that session (REQ-F-37, REQ-F-38). In the CTI meeting, CTI said that without a rule for people who come back, the 60 minutes changes nothing at the door, and that a real count of people inside needs a check-out. Nobody is asked to leave after 60 minutes; that stays outside the system. CTI minutes, section 3.13. |
| Answer | |
| Answered by | |
| Date | |

## Data, privacy and safety records

### G-21: Safety records the gym needs

| Field | Value |
|---|---|
| Question | Which safety records should the system keep? Mark all that apply: waivers, emergency contacts, required documents, medical warnings, none. |
| Affects | REQ-F-60 Store waivers and safety records |
| Feature | 3.12 Membership and Safety Records |
| Why we ask | The proposal stores these only if the gym needs them. Each one adds sensitive data that needs access limits and retention rules. |
| Answer | Waivers and emergency contacts only. The system stores a waiver acceptance with full name, email and an emergency contact (name and phone). Name and email come from the payment record or the roster. No street address, no documents and no medical warnings. Staff see the waiver and emergency contact from the Staff dashboard. Open since the CTI meeting: is accepting on screen enough, or does the director need a drawn signature or a signed paper? With on-screen acceptance nothing is uploaded; only the acceptance is stored. A signature or a paper brings back document storage, size limits, a check that the file is valid, and more backup space. The director says what he needs legally. CTI minutes, section 3.22. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-03: How long data is kept (merges G-12)

| Field | Value |
|---|---|
| Question | How long must each type of data be kept: photos from past terms, waivers, emergency contacts, medical warnings, Check In history, audit log? Is there a UPRM rule for this, and how long are the paper records kept today? |
| Affects | REQ-NF-04 Discard photos from earlier terms; REQ-NF-05 Retention rules by data type; REQ-NF-39 Audit log of Staff actions |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal, 8.1 Audit |
| Why we ask | The default today is to discard old photos unless UPRM requires keeping them. Without periods, the system cannot delete anything on schedule. In the CTI meeting, CTI said the reports the gym wants decide what data is kept and for how long. Open: in the CTI meeting, CTI said nobody asks for the audit log until an incident happens. CTI did not speak about how long entries are kept. The end-of-term rule for the audit log stays as decided unless the gym wants a longer period. |
| Answer | Partly answered. Audit log: each entry is kept until the end of the term in which it happened (decided 2026-10-14). IP addresses in the log are personal data and follow the same rule. Every other period is unknown; the gym and UPRM answer. No provisional values. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

Also asked in cti.md: M-15 (whether FERPA or another UPR policy applies).

### G-24: Privacy notice

| Field | Value |
|---|---|
| Question | Who writes and approves the privacy notice in Spanish and English that users see before giving personal data? |
| Affects | REQ-NF-25 Privacy notice before collecting data |
| Feature | 6.3 Security, 7 Internationalization and Localization Requirements |
| Why we ask | The system cannot collect photos or other personal data without this notice. The team can draft it, but someone at UPRM must approve it. |
| Answer | The team drafts the notice in Spanish and English, and the gym approves it. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

## Content

### G-17: English version of gym texts

| Field | Value |
|---|---|
| Question | Who writes the English version of rules, notices, closures and facility information? A: the gym. B: the team translates and the gym approves. |
| Affects | REQ-F-58 Gym texts in Spanish and English |
| Feature | 3.11 Facility Information, Schedules and Notices, 7 Internationalization and Localization Requirements |
| Why we ask | Every text the gym publishes needs both versions. With A, publishing a notice takes the gym two texts each time. |
| Answer | B for the initial texts: the team translates and the gym approves. Notices published after December are asked in G-27. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

### G-27: English for notices after December

| Field | Value |
|---|---|
| Question | After December, who writes the English version of new notices? If nobody does, the app shows the Spanish text. Is that acceptable? |
| Affects | REQ-F-58 Gym texts in Spanish and English |
| Feature | 3.11 Facility Information, Schedules and Notices |
| Why we ask | The team translates the initial texts. Notices published later need someone to write the English version. |
| Answer | |
| Answered by | |
| Date | |

### G-28: Athletes-only periods

| Field | Value |
|---|---|
| Question | Which schedule periods are for athletes only? |
| Affects | REQ-F-82 Paid members cannot Check In during athletes-only periods; REQ-F-83 Notice when a period starts within the session; REQ-F-55 (b) Mark a slot as athletes only (was REQ-F-84) |
| Feature | 3.6 Check In and Facility Session, 3.11 Facility Information, Schedules and Notices |
| Why we ask | During these periods paid members cannot do Check In. A User whose 60-minute session overlaps the start of a period sees its start time; the session is not cut. |
| Answer | |
| Answered by | |
| Date | |

## Testing at the gym

### G-08: Location tests inside the gym

| Field | Value |
|---|---|
| Question | Can the team test phone location inside and around the gym? On which days and at what hours? |
| Affects | REQ-NF-28 Location boundary set with tests |
| Feature | 6.4 Other Quality Attributes, 3.6 Check In and Facility Session |
| Why we ask | The Check In boundary and the accepted accuracy must be measured at the gym on iPhone and Android. Without access, these values stay unknown. |
| Answer | Yes. The team can test inside and around the gym whenever it wants, for Capstone purposes. |
| Answered by | Carlos Pepin (team), gym to confirm |
| Date | 2026-10-13 |

## Also in team.md

- E-06 (answered): the Gym ID shows the minutes left and a moving clock.
- E-11 (answered): users reset their password by email.
- E-13 (answered): the one-device rule applies only to Users, not to the gym account.
- E-30 (open): whether the Authorization Number is unique across orders.
