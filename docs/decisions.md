# Open Questions

The current decisions are in `docs/context.md` and the requirements in `docs/requirements/SRS.md`.

## CTI

| # | Question | Blocks | Answer |
|---|---|---|---|
| M-01 | Does the VM have a public IP or is it only reachable from the campus network? Users may be on mobile data. | SRS 2.3, REQ-NF-26 | |
| M-02 | Are containers allowed? Docker or Podman? Which one comes with Ubuntu 26 and with Rocky 10? | SRS 2.4 | |
| M-03 | Who sets up the subdomain and the HTTPS certificate? Can it be a single name for the PWA and the API? | SRS 2.4 (single origin, Vercel out), REQ-NF-12 | |
| M-04 | What process and what data does CTI require to evaluate the VM (operating system, CPU, memory, disk, network, who manages the server and the application, who maintains the changes)? How long does it take? | SRS 2.5 | |
| M-05 | Can we get early access to the VM to run the prototype there? | SRS 2.5 | |
| M-06 | Is there storage or snapshots for backups, or do backups go outside the VM? | REQ-NF-06 | |
| M-07 | Is there SMTP or a relay from the VM? With what sender address (for example @uprm.edu) and who sets up SPF and DKIM? If there is none, is an external provider allowed? | REQ-F-06, REQ-F-12, REQ-F-15, REQ-NF-35 | |
| M-08 | What security, network and monitoring requirements does CTI set before approving? | SRS 6.3, REQ-NF-31 | |
| M-09 | Does CTI accept Laravel with PostgreSQL in containers, or does it require MySQL? Is it a preference or a requirement to approve the VM? | REQ-F-17, REQ-F-36, REQ-NF-02 | |
| M-10 | If we use Laravel, would CTI give guidance or support, even if it does not maintain the application? | SRS 2.5 | |
| M-11 | Are external services allowed for the prototype with student data? What rules apply to photos, emergency contacts and student numbers? Who approves? | REQ-NF-09 | |
| M-12 | Can the team use the WooCommerce API? Are there restrictions on automating access (API or webhooks)? | REQ-F-32 | |
| M-13 | Where can student data be stored: VM disk, CTI storage or an approved external service? Is the disk encrypted and who has access? | REQ-NF-20, REQ-NF-23 | |
| M-14 | Where can backups go outside the VM, and how long are they kept? | REQ-NF-06 | |
| M-15 | Does FERPA or another UPR policy apply to gym data? Who do we confirm it with (Registrar, compliance officer)? | REQ-NF-04, REQ-NF-05, REQ-NF-47 | |
| M-16 | If the team manages the VM, does CTI accept students having administrator access to a server with real student data? | REQ-NF-23 | |
| M-17 | Does CTI have rules about copying real WooCommerce data to personal computers for testing? | REQ-NF-07 | |

## Gym (Athletic Activities)

| # | Question | Blocks | Answer |
|---|---|---|---|
| G-01 | Who looks after the system after December (accounts, roles, technical support)? It is defined later, but CTI will ask about it when evaluating the VM. Also goes to CTI. | SRS 2.5, REQ-NF-23, REQ-NF-31 | |
| G-02 | Can the paid member change the payment email when creating the account, or does the account always use the WooCommerce one? | REQ-F-11 | |
| G-03 | What retention rules apply to photos, waivers, emergency contacts, safety data, Check Ins and audit? | REQ-NF-04, REQ-NF-05, REQ-NF-39 | |
| G-04 | How is an account recovered when a user loses their phone? What do staff do? | REQ-F-05 | |
| G-05 | How many members are there and how many simultaneous Check Ins do you expect at the busiest hours? | REQ-NF-15 | |
| G-06 | Which devices do staff use (phones, computer at the front desk)? | SRS 2.3, REQ-F-44 | |
| G-07 | What do you do if the system stops working? Is there a manual backup procedure? | REQ-NF-31 | |
| G-08 | Can we do location tests inside the gym, and at what times? | REQ-NF-28 | |
| G-09 | Validate access and renewal rules, staff permissions, Check In exceptions, privacy and retention. | REQ-F-22 to REQ-F-27, REQ-F-46, REQ-F-52, REQ-NF-05 | |
| G-10 | Roster: what data is captured for each athlete (student number, name, institutional email, sport, term, photo)? Are the lists on paper or in a spreadsheet? Can they be imported all at once? | REQ-F-49, REQ-F-51 | |
| G-11 | Where does the department keep the athlete lists, forms and photos today? Who has access? | REQ-NF-07, SRS 4.4 | |
| G-12 | Is there a UPRM policy on photos, emergency contacts and medical notices? How long are they kept today? | REQ-NF-04, REQ-NF-05, REQ-F-60 | |
| G-13 | Who designates the Staff members with access to the roster tool: the Administrator or the department? | REQ-F-49, REQ-F-53 | |
| G-14 | Is a report or periodic review of the athletes Staff entered needed, since they are preapproved? | REQ-F-50 | |
| G-15 | When a paid member becomes an athlete (or the other way around), which email stays on the account? | REQ-F-20 | |
| G-16 | What identification do Staff accept in Staff-assisted Check In? | REQ-F-46 | |
| G-17 | Who writes the English version of rules, notices, closures and information? | REQ-F-58 | |
| G-18 | Who provides the start and end dates of each semester, and who enters them into the system? | REQ-F-21 | |
| G-19 | What does the Authorization Number look like: length, whether it is random, whether it is single use? Also goes to CTI. | REQ-F-10 | |
| G-20 | What session corrections can Staff make? | REQ-F-48 | |
| G-21 | Which safety records does the department require (waivers, emergency contacts, documents, medical warnings)? | REQ-F-60 | |
| G-22 | If an authorization is removed (refund, cancellation) during an active session, does the session continue or end? | REQ-F-27 | |
| G-23 | Who can request deleting an account or its data, and what must be retained? | REQ-F-09 | |
| G-24 | Who writes and approves the privacy notice in Spanish and English? | REQ-NF-25 | |

## Team

| # | Question | Blocks | Answer |
|---|---|---|---|
| E-01 | Does "complete" for December mean meeting the 5 objectives, with the Administrator tools and analytics? | SRS 1.3, all | |
| E-02 | The scope table lists roster, permissions, schedules, closures and analytics as Secondary (`main.tex:305`), but Objectives 4 and 5 give them acceptance criteria (`main.tex:177, 184-190`). Are those Secondary items committed? | REQ-F-49 to REQ-F-65 | |
| E-03 | Is the final priority (must, should, may) of each requirement approved? | All | |
| E-04 | Does the roster tool move up to the MVP? Without a roster athletes cannot register. | REQ-F-49 | |
| E-05 | Is polling every 20 to 30 seconds confirmed, and is the Objective 3 criterion rewritten to measure after an update? | REQ-F-42, REQ-F-43 | |
| E-06 | What do the Gym ID "live indicators" show without real time? | REQ-F-40 | |
| E-07 | Is Supabase out of the plan confirmed (it was Proposed), and is the new version of the proposal written? | SRS 2.4 | |
| E-08 | Does v1 of the proposal correct "institutional login" (`main.tex:120`) and "institutional email verification" (`main.tex:386`)? | REQ-F-02 | |
| E-09 | Is the paid member's email verified? With the same link flow as the athlete, before creating the account? | REQ-F-12 | |
| E-10 | Is giving the same response whether or not the student number is in the roster confirmed? | REQ-F-16 | |
| E-11 | Do we want self-service password recovery? It requires outgoing mail. | REQ-F-06 | |
| E-12 | Are the sign-in attempt limit and the inactivity timeout included? With what values? | REQ-F-07, REQ-F-08 | |
| E-13 | Does the single device rule apply to Staff and Administrator? | REQ-F-03 | |
| E-14 | Does the Administrator keep the management of athlete authorizations alongside designated Staff? How does the Objective 4 criterion end up? | REQ-F-54 | |
| E-15 | What are the limits for using real WooCommerce data: how many records, on which machines, for how long? | REQ-NF-07 | |
| E-16 | How do we keep the classroom location configuration from reaching production? | REQ-NF-29 | |
| E-17 | Who measures location accuracy at the gym, and with which phones (iPhone with Safari and Android with Chrome)? | REQ-NF-28 | |
| E-18 | Who has an iPhone to test cookies and the session inside the installed PWA? | REQ-F-03, REQ-F-66 | |
| E-19 | Do the install button and the iPhone help text go into the MVP? | REQ-F-66 | |
| E-20 | Which photo types and maximum size are accepted? | REQ-NF-24 | |
| E-21 | What performance metric and value must the PWA meet? | REQ-NF-16 | |
| E-22 | What date and time format is used in each language? | REQ-NF-38 | |
| E-23 | Who is in charge of the backend? | SRS 2.5 | |
| E-24 | First backend work: login with Sanctum and a Check In that creates a single session, with a simultaneous requests test. Who does it and who reviews it? | REQ-F-36, REQ-NF-42 | |
| E-25 | While there is no VM, does the backend run on the PC with a tunnel? | SRS 2.5 | |
| E-26 | Who opens the issue, assigns milestone and project, and creates the branch and the PR for these changes? | REQ-NF-45 | |
| E-27 | Do we add these lines to `.gitignore`: `.env`, `.env.*`, `!.env.example`, `/data/real/`, `*.sql`? (`.env` is already there) | REQ-NF-07, REQ-NF-18 | |
| E-28 | When is protection of `main` turned on (first required PR, then 1 approved review)? | REQ-NF-45 | |
| E-29 | When do the other two members get write access? | REQ-NF-45 | |
| E-30 | Should `decisions.md` be versioned? Today it is in `.gitignore`. | This file | |

## Professor or advisor (Fernando Torre and Prof. Wilson Rivera)

| # | Question | Blocks | Answer |
|---|---|---|---|
| P-01 | What is the rubric and what are the dates of the midterm report and the final report? | SRS 1.3 | |
| P-02 | Do they ask for an SRS, an updated proposal or both? | SRS 1.1 | |
| P-03 | Does the stack change from the proposal need approval? | SRS 2.4 | |
| P-04 | Do we have to declare the use of AI tools in the course? | None in the SRS | |
| P-05 | Which Capstone policy applies to code ownership and license? | REQ-NF-46 | |
