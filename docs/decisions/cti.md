# Questions for CTI

**What:** open questions for CTI about hosting, network, mail, storage, backups and data rules.
**For:** CTI staff who handle the VM request.
**How to use:** write the answer in the Answer row and fill Answered by and Date. Then update the status of each requirement in Affects in `docs/requirements/SRS.md`.
**CTI meeting:** answers below come from the meeting with the CTI contact on 2026-10-22. Minutes: `docs/meetings/2026-10-22-cti-minuta.md`.

| Total | Answered | Partly answered | Open |
|---|---|---|---|
| 15 | 2 | 6 | 7 |

## Hosting and network

### M-01: Access to the VM from outside campus

| Field | Value |
|---|---|
| Question | Can people reach the VM from the internet, for example from a phone on mobile data? A: yes, it has a public address. B: no, only from the campus network. C: only from campus, but CTI can publish it through a proxy. |
| Affects | REQ-NF-26 Core actions require a network connection |
| Feature | 2.3 Operating Environment, 2.5 Assumptions and Dependencies |
| Why we ask | Users do Check In from their phones, often on mobile data. The SRS assumes the system is reachable from the internet. If the answer is B, users off the campus network cannot sign in or do Check In, and the hosting plan must change. |
| Answer | Open. Not answered in the CTI meeting. CTI said the domain is a separate request and that some owners ask for a server with no domain, for internal use. Whether a VM can be reached from the internet was not stated. CTI asked whether Users should connect from outside campus and left that to the gym (gym.md, G-31). The team's own access from off campus needs a VPN (M-16). CTI minutes, sections 3.6 and 3.19. |
| Answered by | |
| Date | |

### M-02: Containers on the VM

| Field | Value |
|---|---|
| Question | Can we run containers on the VM? A: yes, with Docker. B: yes, with Podman. C: no containers. |
| Affects | None directly. Changes the deployment constraint in 2.4 |
| Feature | 2.4 Design and Implementation Constraints |
| Why we ask | The whole system is planned as `docker-compose`: proxy, PHP, PostgreSQL and scheduled tasks. With C, the deployment must be redesigned on CTI services. Supabase and Vercel are out (team.md, E-07). |
| Answer | Yes. CTI delivers a plain Linux machine. Whether to use containers, and installing Docker or Podman, is the team's choice and job. CTI did not name a runtime. CTI minutes, section 3.3. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

### M-03: Subdomain and HTTPS certificate

| Field | Value |
|---|---|
| Question | Who creates the UPRM subdomain and the HTTPS certificate: A: CTI, or B: the team, with CTI approval? Can the app and the API share one name (app at `/`, API at `/api`)? |
| Affects | REQ-NF-12 All traffic goes over HTTPS |
| Feature | 2.4 Design and Implementation Constraints (single origin), 5.3 Communications Interfaces |
| Why we ask | Phone location only works over HTTPS. The plan uses one name so login cookies work without cross-site rules. If two names are required, the login design changes. |
| Answer | Partly answered. The domain is a separate request from the VM. The project owner files a domain ticket on the CTI request page with the name he wants, and CTI assigns the IP. Not discussed: who provides the HTTPS certificate, and whether the app and the API can share one name. CTI minutes, section 3.6. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

### M-18: Ports and firewall

| Field | Value |
|---|---|
| Question | Which ports must be open on the VM for the app (80 and 443), and does opening them or any firewall rule need a request? |
| Affects | REQ-NF-12 All traffic goes over HTTPS |
| Feature | 2.3 Operating Environment, 5.3 Communications Interfaces |
| Why we ask | Ports were not discussed in the CTI meeting. In a side talk about another network, CTI said firewall rules should list single hosts; the team infers that the VM may need its own rule. If 443 is closed, nobody reaches the app. |
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
| Why we ask | Production in December depends on this approval. Any security or monitoring condition CTI sets becomes a requirement in 6.3 or 6.4. CTI described a template clone, typically the same day to about a day depending on urgency, and no approval step. Until CTI confirms there is none, the main risk is the owner filing the ticket in time. |
| Answer | Partly answered. Form: the project owner (the gym director) files a VM ticket on the CTI web page, menu Solicitudes. The team cannot file it. Technical data: the team recommends the size. CTI's usual size for web apps is 2 processors, 4 GB of memory and 40 to 60 GB of disk. Who manages: the owner is the accountable person; CTI does not maintain the server or the application. Time: typically the same day to about a day, depending on urgency. CTI clones a template and gives the first account to the owner. Not stated: the operating system of the template. Not discussed: an evaluation or approval step, and any security, network or monitoring conditions. CTI's usual requests to student projects (an audit log, an installer script, a disaster recovery plan) were not stated as conditions for the VM. CTI minutes, sections 3.3, 3.15 and 3.16. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

### M-05: Early access to the VM

| Field | Value |
|---|---|
| Question | Can the team use the VM, or a test VM, before final approval to run the prototype? If yes, from what date? |
| Affects | None directly |
| Feature | 2.5 Assumptions and Dependencies |
| Why we ask | Today the system runs on team PCs with a tunnel. Early access lets us test the real deployment before December. Without it, the first deployment happens close to the demo. |
| Answer | Open. Not asked in the CTI meeting. A VM typically exists the same day to about a day after the owner's ticket, so this may not matter. Confirm with CTI that there is no approval step. |
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
| Answer | A. The database engine is the team's choice. CTI's earlier line of Linux, Apache and MySQL was general advice, not a condition. CTI minutes, sections 3.1 and 3.3. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

## Outgoing mail

### M-07: Sending email from the VM

| Field | Value |
|---|---|
| Question | How can the system send email in production? A: through a CTI mail server or relay. B: there is none, but an external mail provider is allowed. C: no outgoing mail. For A or B: what sender address do we use (for example an `@uprm.edu` address), and who sets up the SPF and DKIM records? |
| Affects | REQ-F-06 Password reset by email link; REQ-F-15 Athlete account created after email link; REQ-F-75 Owner recovers a claimed number with the password reset; REQ-F-77 In-person athlete registration; REQ-NF-35 Emails in the user's language |
| Feature | 5.3 Communications Interfaces, 3.1 Accounts and Sign In, 3.2 Paid Member Registration, 3.3 Athlete Registration |
| Why we ask | Outgoing mail is now needed for two things: athlete registration (the account is created only after the athlete opens a link sent by email) and password reset. The paid member email is no longer verified, so REQ-F-12 was removed. With C, there is no password reset, and front desk staff must register each athlete in person after checking identification, only for athletes already in the roster (REQ-F-77). The team has not chosen an external mail provider; with B, student names and emails go through a third party, which needs approval (M-11). Please answer soon. |
| Answer | Partly answered: A, through the CTI mail gateway. The team runs a mail service on the VM (CTI suggests Postfix) and builds the emails. To send in the university's name, CTI must authorize the VM by adding it to the allowed senders of its mail gateway, and the mail service relays to that gateway. The authorization has not happened yet. Sender: commonly a no-reply address at the server's domain name, which needs no mailbox if nothing is received (CTI's common practice); a cut-off remark suggested the owner may ask for another address. Not discussed: SPF and DKIM, the gateway address, and when the authorization happens. CTI minutes, section 3.5. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

## Storage, backups and server access

### M-13: Where student data is stored

| Field | Value |
|---|---|
| Question | Can the database, student photos and documents stay on the VM disk? Is that disk encrypted? Does CTI offer other storage we should use instead? |
| Affects | REQ-NF-20 Private storage for photos and documents |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal, 6.3 Security |
| Why we ask | The current design keeps all data on the VM, with no external service. If the disk is not encrypted, the team must decide whether to encrypt files itself. |
| Answer | Partly answered. The database, photos and any documents may stay on the VM disk; the team decides. CTI recommended that the team estimate storage growth and plan a cleanup, and said the team must limit upload size and format. Not discussed: disk encryption, and whether CTI offers other storage. CTI minutes, section 3.7. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

### M-06: Backups outside the VM (merges M-14)

| Field | Value |
|---|---|
| Question | Where can we keep backups of the database and photos outside the VM, and for how long? A: VM snapshots made by CTI. B: CTI storage or another UPRM server. C: an approved external service. |
| Affects | REQ-NF-06 Backups and a tested restore |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | A backup kept only on the VM is lost with the VM. REQ-NF-06 stays Pending until we know the place and how long copies are kept. |
| Answer | Partly answered. Where backups go is the team's decision. CTI listed three options: (1) a second disk on the same VM, agreed with whoever creates the server, so the team infers it goes in the VM ticket (the option CTI likes least; it is not outside the VM); (2) a button on the administrator screen that packs the database and the photo folder into one compressed file that the browser downloads to the administrator's computer; (3) a scheduled secure copy to a separate server, which needs a second server request. CTI's minimum recommendation is option 2, every afternoon or on Fridays. CTI's view: losing about a week of data is not much if a backup exists. CTI expects the team to agree the backup and restore procedure with the owner. No option is chosen (team.md, E-109). Not discussed: CTI snapshots or backup storage (not offered, not ruled out) and how long copies are kept. CTI minutes, section 3.16. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

### M-16: Administrator access to the server

| Field | Value |
|---|---|
| Question | CTI does not manage the server. Who may have administrator access to it? A: team students, with no conditions. B: team students, with conditions (state them). C: only UPRM staff. |
| Affects | REQ-NF-23 No routine developer access to safety data |
| Feature | 6.3 Security, 2.5 Assumptions and Dependencies |
| Why we ask | A server administrator can read all data, including emergency contacts. REQ-NF-23 says developers have no routine access to that data. If students run the server, that requirement must change or someone else must run it. |
| Answer | Partly answered for the process. CTI usually creates an account with sudo and gives it to the owner, who passes it to the team or creates another account for them. The owner answers for every account he authorizes. The team's access from off campus needs a VPN, which the owner requests with a VPN ticket or an email that lists the team's emails. Not discussed: whether team members holding sudo on a server with safety data is acceptable (REQ-NF-23), and removing their access at delivery. CTI minutes, section 3.4. |
| Answered by | CTI contact, CTI meeting |
| Date | 2026-10-22 |

Also asked in gym.md: G-01 (who looks after the system after December).

## Data rules and privacy

### M-11: Approval for external services

| Field | Value |
|---|---|
| Question | Who approves sending student data (names, emails, student numbers, photos, emergency contacts) to a service outside UPRM? Is any external service allowed during the prototype? |
| Affects | REQ-NF-09 No external services without approval |
| Feature | 4.3 Data Acquisition, Integrity, Retention, and Disposal, 2.4 Design and Implementation Constraints |
| Why we ask | Today the rule is: no student data in external services without approval, and nobody is named to approve. The answer decides whether an external mail provider (M-07 B) or external backup (M-06 C) is possible. |
| Answer | Open. Not discussed in the CTI meeting. Mail may not need an external service if CTI authorizes the VM on its gateway (M-07). Still open for any other external service. |
| Answered by | |
| Date | |

### M-15: FERPA and UPR policy

| Field | Value |
|---|---|
| Question | Does FERPA or another UPR policy apply to gym data (student number, athlete status, photo, Check In history, emergency contacts)? Which UPRM office can confirm it, for example the Registrar or a compliance office? |
| Affects | REQ-NF-47 Comply with applicable laws and policies; REQ-NF-04 Discard photos from earlier terms; REQ-NF-05 Retention rules by data type |
| Feature | 8.3 Legal, Intellectual Property and Privacy, 4.3 Data Acquisition, Integrity, Retention, and Disposal |
| Why we ask | We found signs that FERPA applies to UPR, but no confirmation, and we do not know if gym data counts as an education record. The answer sets the rules for retention, access and the privacy notice. |
| Answer | Open. Not discussed in the CTI meeting. |
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
| Answer | Open. Not discussed in the CTI meeting. |
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
| Answer | Open. The team told CTI the store runs on the athletic department's own WordPress, where payments are handled. CTI did not say whether it manages that site. No technical contact for it was named (gym.md, G-35). CTI said the team should be clear on how payment data moves: WordPress sends it, or the app asks for it through the API. That is not decided. The MVP stays a file import. CTI minutes, section 3.10. |
| Answered by | |
| Date | |

Also asked in gym.md: G-19 (Authorization Number format). Answer there if CTI manages the store.
