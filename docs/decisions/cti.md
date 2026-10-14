# Questions for CTI

**What:** open questions for CTI about hosting, network, mail, storage, backups and data rules.
**For:** CTI staff who evaluate the VM request.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.

| Total | Answered | Open |
|---|---|---|
| 14 | 0 | 14 |

## Hosting and network

### M-01: Access to the VM from outside campus

| Field | Value |
|---|---|
| Question | Can people reach the VM from the internet, for example from a phone on mobile data? A: yes, it has a public address. B: no, only from the campus network. C: only from campus, but CTI can publish it through a proxy. |
| Affects | REQ-NF-26 Core actions require a network connection |
| Feature | 2.3 Operating Environment, 2.5 Assumptions and Dependencies |
| Why we ask | Users do Check In from their phones, often on mobile data. The SRS assumes the system is reachable from the internet. If the answer is B, users off the campus network cannot sign in or do Check In, and the hosting plan must change. |
| Answer | |
| Answered by | |
| Date | |

### M-02: Containers on the VM

| Field | Value |
|---|---|
| Question | Can we run containers on the VM? A: yes, with Docker. B: yes, with Podman. C: no containers. |
| Affects | None directly. Changes the deployment constraint in 2.4 |
| Feature | 2.4 Design and Implementation Constraints |
| Why we ask | The whole system is planned as `docker-compose`: proxy, PHP, PostgreSQL and scheduled tasks. With C, the deployment must be redesigned on CTI services. Supabase and Vercel are out (team.md, E-07). |
| Answer | |
| Answered by | |
| Date | |

### M-03: Subdomain and HTTPS certificate

| Field | Value |
|---|---|
| Question | Who creates the UPRM subdomain and the HTTPS certificate: A: CTI, or B: the team, with CTI approval? Can the app and the API share one name (app at `/`, API at `/api`)? |
| Affects | REQ-NF-12 All traffic goes over HTTPS |
| Feature | 2.4 Design and Implementation Constraints (single origin), 5.3 Communications Interfaces |
| Why we ask | Phone location only works over HTTPS. The plan uses one name so login cookies work without cross-site rules. If two names are required, the login design changes. |
| Answer | |
| Answered by | |
| Date | |

## VM evaluation and timing

### M-04: What CTI needs to approve the VM (merges M-08)

| Field | Value |
|---|---|
| Question | What does CTI need from us to evaluate and approve the VM, and how long does it take? Please include: the form or process, technical data (operating system, CPU, memory, disk, network), who must manage the server and the application, and any security, network or monitoring conditions the system must meet. |
| Affects | REQ-NF-31 Uptime target and manual procedure |
| Feature | 2.5 Assumptions and Dependencies, 6.3 Security, 6.4 Other Quality Attributes |
| Why we ask | Production in December depends on this approval. Any security or monitoring condition CTI sets becomes a requirement in 6.3 or 6.4. An unknown approval time is the main risk to the December demo. |
| Answer | |
| Answered by | |
| Date | |

### M-05: Early access to the VM

| Field | Value |
|---|---|
| Question | Can the team use the VM, or a test VM, before final approval to run the prototype? If yes, from what date? |
| Affects | None directly |
| Feature | 2.5 Assumptions and Dependencies |
| Why we ask | Today the system runs on team PCs with a tunnel. Early access lets us test the real deployment before December. Without it, the first deployment happens close to the demo. |
| Answer | |
| Answered by | |
| Date | |

## Database

### M-09: PostgreSQL or MySQL

| Field | Value |
|---|---|
| Question | Does CTI accept PostgreSQL in a container? A: yes. B: CTI prefers MySQL but accepts PostgreSQL. C: CTI requires MySQL to approve the VM. |
| Affects | REQ-F-17 One account per roster record or number; REQ-F-36 Check In creates exactly one session (both now hold the database rule of old REQ-NF-02) |
| Feature | 2.4 Design and Implementation Constraints, 3.3 Athlete Registration, 3.6 Check In and Facility Session, 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | The rule of one active session per user uses a PostgreSQL feature (exclusion constraint) that MySQL does not have. With C, these three requirements need a new design. |
| Answer | |
| Answered by | |
| Date | |

## Outgoing mail

### M-07: Sending email from the VM

| Field | Value |
|---|---|
| Question | How can the system send email in production? A: through a CTI mail server or relay. B: there is none, but an external mail provider is allowed. C: no outgoing mail. For A or B: what sender address do we use (for example an `@uprm.edu` address), and who sets up the SPF and DKIM records? |
| Affects | REQ-F-06 Password reset by email link; REQ-F-15 Athlete account created after email link; REQ-F-75 Owner recovers a claimed number with the password reset; REQ-F-77 In-person athlete registration (fallback); REQ-NF-35 Emails in the user's language |
| Feature | 5.3 Communications Interfaces, 3.1 Accounts and Sign In, 3.2 Paid Member Registration, 3.3 Athlete Registration |
| Why we ask | Outgoing mail is now needed for two things: athlete registration (the account is created only after the athlete opens a link sent by email) and password reset. The paid member email is no longer verified, so REQ-F-12 was removed. With C, there is no password reset, and front desk staff must register each athlete in person after checking identification, only for athletes already in the roster (REQ-F-77). The team has not chosen an external mail provider; with B, student names and emails go through a third party, which needs approval (M-11). Please answer soon. |
| Answer | |
| Answered by | |
| Date | |

## Storage, backups and server access

### M-13: Where student data is stored

| Field | Value |
|---|---|
| Question | Can the database, student photos and documents stay on the VM disk? Is that disk encrypted? Does CTI offer other storage we should use instead? |
| Affects | REQ-NF-20 Private storage for photos and documents |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal, 6.3 Security |
| Why we ask | The current design keeps all data on the VM, with no external service. If the disk is not encrypted, the team must decide whether to encrypt files itself. |
| Answer | |
| Answered by | |
| Date | |

### M-06: Backups outside the VM (merges M-14)

| Field | Value |
|---|---|
| Question | Where can we keep backups of the database and photos outside the VM, and for how long? A: VM snapshots made by CTI. B: CTI storage or another UPRM server. C: an approved external service. |
| Affects | REQ-NF-06 Backups and a tested restore |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | A backup kept only on the VM is lost with the VM. REQ-NF-06 stays Pending until we know the place and how long copies are kept. |
| Answer | |
| Answered by | |
| Date | |

### M-16: Administrator access to the server

| Field | Value |
|---|---|
| Question | CTI does not manage the server. Who may have administrator access to it? A: team students, with no conditions. B: team students, with conditions (state them). C: only UPRM staff. |
| Affects | REQ-NF-23 No routine developer access to safety data |
| Feature | 6.3 Security, 2.5 Assumptions and Dependencies |
| Why we ask | A server administrator can read all data, including emergency contacts. REQ-NF-23 says developers have no routine access to that data. If students run the server, that requirement must change or someone else must run it. |
| Answer | |
| Answered by | |
| Date | |

Also asked in gym.md: G-01 (who looks after the system after December).

## Data rules and privacy

### M-11: Approval for external services

| Field | Value |
|---|---|
| Question | Who approves sending student data (names, emails, student numbers, photos, emergency contacts) to a service outside UPRM? Is any external service allowed during the prototype? |
| Affects | REQ-NF-09 No external services without approval |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal, 2.4 Design and Implementation Constraints |
| Why we ask | Today the rule is: no student data in external services without approval, and nobody is named to approve. The answer decides whether an external mail provider (M-07 B) or external backup (M-06 C) is possible. |
| Answer | |
| Answered by | |
| Date | |

### M-15: FERPA and UPR policy

| Field | Value |
|---|---|
| Question | Does FERPA or another UPR policy apply to gym data (student number, athlete status, photo, Check In history, emergency contacts)? Which UPRM office can confirm it, for example the Registrar or a compliance office? |
| Affects | REQ-NF-47 Comply with applicable laws and policies; REQ-NF-04 Discard photos from earlier terms; REQ-NF-05 Retention rules by data type |
| Feature | 8.3 Legal, Intellectual Property and Privacy, 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | We found signs that FERPA applies to UPR, but no confirmation, and we do not know if gym data counts as an education record. The answer sets the rules for retention, access and the privacy notice. |
| Answer | |
| Answered by | |
| Date | |

Also asked in gym.md: G-03 (retention periods).

### M-17: Real WooCommerce data on team computers (merges E-15)

| Field | Value |
|---|---|
| Question | Can the team copy real WooCommerce order records to its own computers to test the import? A: no, only on a UPRM machine or the VM. B: yes, within CTI limits (number of records, which machines, how long). C: CTI has no rule; the team sets limits with the gym's permission. |
| Affects | REQ-NF-07 Real data only for integration tests |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | Development uses fake data. One test with real records is needed to check the import. REQ-NF-07 stays Pending until we know the limits. |
| Answer | |
| Answered by | |
| Date | |

## WooCommerce

### M-12: WooCommerce API access

| Field | Value |
|---|---|
| Question | Can the team read orders through the WooCommerce API or webhooks? What limits apply to automated access? |
| Affects | REQ-F-32 Sync with WooCommerce through the API |
| Feature | 3.5 WooCommerce Import |
| Why we ask | The MVP imports Export Orders files by hand. The API is Stretch scope, so an unanswered question only blocks Stretch work. |
| Answer | |
| Answered by | |
| Date | |

Also asked in gym.md: G-19 (Authorization Number format). Answer there if CTI manages the store.
