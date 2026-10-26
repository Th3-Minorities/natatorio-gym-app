# Meeting minutes: CTI hosting meeting

- Date: 2026-10-22
- Length: about 70 minutes
- Attended: the CTI contact; a CTI coworker, for about a minute on another matter; three team members. As far as the team knows, the gym director (the project owner) and the professor were not there.
- Purpose: learn how to get and use a CTI virtual machine (VM) for the gym check-in app, and hear what CTI expects from student projects.

CTI is the UPRM IT office that will host the app. The team asked its questions first; then CTI asked about the design. Topics follow the order they came up. Where the recording was unclear, the text says so. Each "For the project" line is the team's proposal after the meeting, not a decision.

## 3. What was said, by topic

### 3.1 CTI background and stack advice

CTI said a central administration group, not CTI, is migrating the UPR portal (PHP on a custom framework). CTI adopted Laravel for its own new migration, mainly for the learning curve and because it is a known framework that fit the specifications, and has suggested it to other projects (the group's name was garbled). For a new system CTI recommended Linux, Apache and MySQL and left the framework to the team, and later the database and containers too (3.3).

For the project: Laravel and PostgreSQL stay.

### 3.2 Ownership and maintenance after delivery

- CTI said the long-term question, how the system keeps running after delivery, is for the project owner and not the team. CTI named the professor and the department.
- CTI said it does not have people to adopt the project (a team member may have finished that sentence). The owner must set a plan: "Tienen que establecer un plan". CTI's examples were hiring students or letting the system die; CTI has seen many good projects die because nobody followed up. The team reads this as a limit on CTI's staff, not a refusal.
- CTI said that after a December delivery the team is gone, and part of the deployment work (install, configure, create accounts, adjust, orient users) falls on the owner. He should know it now and ask the team now for what he needs, for example a user manual and an administrator manual.
- CTI said the owner is held accountable if something goes wrong, including for the accounts he authorizes. The team said the owner is the gym director, the client.
- CTI said there are always systems and procedures: the team builds the system and writes the procedure guides, and following them is the gym's job.

For the project: G-01 stays open for the owner, the professor or the department. Its answer also decides REQ-NF-23 and who runs the install command of REQ-F-88. Manuals wait on the director (3.23); a hand-over step in the acceptance test (#32) is proposed.

### 3.3 VM request, timing, size and what the VM comes with

- CTI said the professor or the project owner files a ticket on the CTI web page, under the Solicitudes tab, where one request type is virtual machines: "tiene que ser él porque él va a ser la persona responsable". CTI meant whoever takes charge of the system. The director knows the CTI contact and can call with doubts.
- CTI said the team should recommend the size from what it expects to need. The usual web app size is 2 processors, 4 GB of memory and 40 to 60 GB of disk, but the team defines its needs.
- CTI asked whether users will upload documents. The team said yes; 3.22 narrowed that.
- On timing CTI hedged: typically the same day to about a day, depending on urgency. CTI clones a template, adjusts it if needed, and gives the first account and its credentials to the owner.
- CTI said it delivers a plain vanilla Linux (the word was garbled) and that containers are the team's call. On the database, MariaDB or Post[gres] (cut off), the phrase was "lo que damos a la discreción del grupo".
- CTI said a second backup disk must be agreed with whoever creates the server (3.16). The team infers it belongs in the VM request.
- CTI is moving its own servers from Ubuntu to Rocky. CTI did not say which operating system this VM gets.
- CTI and the director already work on a meal ticket app for athletes, built and paused while the food concessionaire waits for equipment.
- Nobody discussed an evaluation or approval step, conditions, early use, ports or cost.

For the project: M-02 and M-09 are answered (the team chooses); M-04 is partly answered; M-05 was not asked. Documents that assume a CTI evaluation should say none was described, to confirm. The team writes the VM, domain and VPN request texts, with a size and a growth estimate, for the director to file; #31 waits on them.

### 3.4 Team access to the server: SSH, sudo and VPN

- The team asked about SSH and sudo. CTI said it normally creates an account with sudo and gives it to the director, who passes it to the team or creates another account for them. In CTI's view the director is the owner.
- A team member said, in a garbled sentence that may have been a question, that the team can reach the VM without being on the university network. CTI answered that reaching the server from off campus needs a VPN, which the director requests with a VPN ticket or an email listing the team's emails. CTI always needs the owner's request and holds him accountable for the accounts he authorizes. This VPN is for the team; CTI did not say users need one (3.19).
- Nobody discussed whether students holding sudo on a server with safety data is acceptable, or removing that access at delivery.

For the project: M-16 is answered for the process only. REQ-NF-23 stays pending, because students with sudo can read all data.

### 3.5 Outgoing mail

- The team said the app must send mail, for example after a lost password. CTI said the team defines it and that sending is easy: run a mail service on Linux. CTI suggested Postfix as easier to set up than the default (sendmail; the word was garbled).
- CTI said that to send in the university's name the team coordinates with CTI, and CTI adds the machine to the allowed senders on its mail gateway; the Postfix relay setting points to the gateway. One sentence was unclear: either the team tells CTI which machine to authorize, or CTI already knows it. Either way CTI described a short step.
- CTI said building the email is the team's job. A no-reply sender at the server's name is common practice, and that account need not exist since it never receives mail. A cut-off sentence seemed to say the director could ask for a specific address. The team said replies should not be needed.
- Nobody discussed SPF and DKIM, the gateway address, or when CTI authorizes the VM.

For the project: M-07 is answered in principle; the authorization is pending. The outside provider of E-61 stays as the fallback, and M-11 stays open. Since E-62, "(fallback)" after REQ-F-77 in M-07 is out of date.

### 3.6 Domain and IP

- CTI said the domain is a ticket separate from the VM, because some people move only a domain and others want a server with no domain, for internal or private use. CTI only needs the name the director wants, and CTI assigns the IP.
- CTI did not say whether a VM can be reached from outside campus.
- Nobody discussed the HTTPS certificate, one name for the app and the API, or a separate name for the gym dashboard.

For the project: M-03 is answered for the name only. Team inference: a VM may have no public name unless a domain is requested. The dashboard's own address (REQ-NF-10, E-65) may need a second name or a path.

### 3.7 Database and storage

- The team asked whether the database, photos and documents can stay on the VM disk. CTI said the team decides.
- CTI recommended a growth estimate (file size per user, number of users, how often files arrive) and a cleanup plan, such as deleting automatically each year or each semester, because without cleanup the disk fills. Documents in particular need thought from the start.
- CTI said the team must set upload size and format limits in the upload routine, for example PHP's maximum upload size.
- Later CTI asked whether accounts are deleted or only deactivated. The team's short answer was garbled and most likely meant soft delete. CTI said that is the team's decision, but then the database keeps growing over 5 to 10 years, so estimate the rate. CTI did not expect performance trouble.
- Nobody discussed disk encryption or CTI storage services.

For the project: M-13 is partly answered. Proposed: a growth estimate and a cleanup plan for REQ-NF-04 and REQ-NF-05, and a PHP limit equal to the 10 MB planned for the proxy (#57, still open). Team question: did soft delete mean roster rows (E-93) or accounts (REQ-F-09)?

### 3.8 Interruption: firewall rule

A CTI coworker came in about a firewall rule that covered a whole network range as if it were one host. The CTI contact said it was an error, that rules should list hosts and not a whole network, and that it cannot be removed yet without cutting off researchers. It had nothing to do with this project.

For the project: team inference from this side talk: the VM may need its own firewall rule. Ports go on the questions for CTI.

### 3.9 Accounts and authentication

The team said those were all its questions. CTI then asked whether users get local credentials or an outside authenticator, and separated authentication from authorization. The team said a paid member gets an Authorization Number by email after paying. CTI restated, and the team confirmed, that the account is local and unrelated to the UPRM account, because paid members can be anyone. CTI gave no view on SAML.

For the project: no change.

### 3.10 Paid member registration and WooCommerce

- The team said the payment flow on the gym's page exists today and sends the Authorization Number automatically. A team member said the app will connect to WooCommerce and WordPress "by API"; the rest was cut off. The current plan has the MVP import Export Orders files by hand.
- CTI asked whether the store is on the campus site or on another WordPress. The team said it runs on the athletic department's own WordPress. CTI did not say whether it manages that site. The team said it had talked with the director; CTI pointed out the director is not a technical contact. A teammate objected in a garbled line and CTI agreed, but what CTI agreed to is unclear. Nobody named a technical contact.
- CTI said the team should be clear on how data moves: WordPress sends it (probably with work on the WordPress side), or the app asks the store's API who paid. The team said this was not clear yet and that it thinks it is the second.
- The team said the number works as proof because only the payer gets it, by email.

For the project: M-12 stays open. Proposed: ask CTI whether it manages that WordPress, and ask the gym for a technical contact (REQ-F-32, Stretch). #25 keeps its blocker, a real Export Orders example. The proof by email matches E-09 and the lookup limits (REQ-F-71 to REQ-F-75). Team question: what did "by API" mean?

### 3.11 Roster and athletes

- The team said athlete lists are on paper. One teammate said the gym receives the list as an Excel file and prints it; another said the gym agrees with going digital but did not know where the list comes from. Nobody has checked the Excel claim with the gym.
- CTI suggested an Excel or CSV upload to reduce human error. A printed list probably comes from a digital one (probably the registrar, or a coach after recruiting), so find the source and format and let the gym upload that same file: "Es una recomendación que te dejo ahí." For updates CTI thought the simplest way is to upload the list as received and let the system skip people who already exist. CTI said to ask the gym how they update the lists each semester.
- For people missing from a new list, CTI gave two options: overwrite, where the list is law and missing people are removed, or keep them and remove them by hand, for example a graduate the gym still treats as an athlete: "eso es decisión de ellos". CTI expects the team to take both options to the gym. The team had first said they would be removed.
- The team said athletes register with the student number and get an email at the linked address. CTI restated that the email exists only because the roster was loaded first, and suggested asking on what date the gym gets the lists (example: after the third day of classes), so athletes know not to try earlier.
- CTI asked what happens when a student stops being an athlete mid-semester. The team said the account stays without the athlete permission. CTI asked whether that is a new account or a status change, and who marks it, and how an athlete is added mid-term without a list; to the last, the team only said yes. The team thinks only the gym can answer these.
- CTI gave a scenario where the dean extends the benefit to the band. A teammate asked, in a garbled line, whether the university's list is only a yes or no athlete mark. CTI said the simplest way is to upload band members like athletes, with band as the sport, which needs no code; but CTI was almost sure the gym will want statistics that separate real athletes, and that needs separate markers. The team suggested a whitelist.

For the project: follow-up gym questions on G-10: source, format, an email per student (REQ-F-51 needs one), date, updates, missing people, mid-term changes and other groups. Proposed: upload of the received file under REQ-F-49, as its own task out of #21, blocked on the gym; skipping existing records waits on the gym. The message in #23 also covers a roster not loaded yet.

### 3.12 Reports, statistics and data retention

The team named usage peaks for athletes and paid members, and arrivals per hour. CTI said the reports decide what data must be kept, and asked for how long. A teammate said four entries in one hour should not count four times; CTI said four entries mean four exits and that CTI does not know whether that matters to the gym, so ask them. The team mentioned the gym's wish to look up how to use a machine.

For the project: the gym sets the reports and the retention (G-03); G-05 also feeds the growth estimate. Machine instructions are covered (REQ-F-55 (d), #28).

### 3.13 Occupancy, check-out and the 60-minute rule

- The team said a person who returns inside the 60 minutes cannot Check In again, and a later Check In starts a new block. CTI walked through a return to the door, said the system would show the person as already inside, and said everyone who enters always has to Check In.
- The team said the 60 minutes come from the gym's page and today work as an honor system: when the gym is full, staff ask long stayers to leave. The team wanted the app to do the same, with a notice such as "15 minutes left". A teammate understood the limit is not per day, but said the director must be asked.
- CTI asked whether a person who used 60 minutes may come back, and said a check-out would make more sense, to know how long each person stayed. A teammate said the team had thought of an in-app check-out; CTI suggested it be at the door.
- CTI said that as designed "el lazo de 60 minutos realmente no tiene ningún efecto" unless something happens: without a check-out the data is only entry times, and a person who comes back inside the window gets in anyway. CTI asked whether something should happen, so the team does not find out mid-development. Sending people out after 60 minutes, CTI said, has nothing to do with the system.
- CTI said the question for the gym is whether a returning person is let in. If not, the door screen warns. Letting everyone in, always with a Check In, and keeping the usage data is also valid.
- CTI said that to count the people inside at each moment "estás obligado a tener el checkout"; Check Ins alone give use by hour. The team said users will not check out. CTI said the desk staff would, on one simple screen, "Si es que a ellos les interesa." CTI presented it as a possible scenario.
- A team member said no check-out is recorded now; it is unclear whether that meant the gym today or the design. The design only has "end early" as a correction.

For the project: the gym decides re-entry, per visit or per day, and the check-out. REQ-F-33, REQ-F-36, REQ-F-37, REQ-F-38, REQ-F-41 and REQ-F-48 change only after it answers, and #17 notes that re-entry is undecided. The "15 minutes left" notice has no requirement and is not planned.

### 3.14 Roles and the shared gym account

- CTI said at minimum an administrator runs the platform, creates accounts and assigns permissions. The team listed admin, staff and user, and said the staff have a shared account; it is unclear whether that was the gym's wish or the team's design.
- CTI asked whether that is how the gym wants it, and said an account and a role are different things. Asked why, a team member said: "Porque siento que si les asignamos varias cuentas para hacer lo mismo realmente no va a tener" (cut off). That was the only reason given, and it was that member's own feeling. Nobody said the gym asked for it.
- CTI said it was improvising: with a shared account nobody knows who is behind the machine, and the gym may want to know who did each Check In, who was at the door, or use the platform for staff attendance. So each person would sign in. "Son ideas."
- CTI said the admin account only exists to create the first real user and give that person the admin role. The director should sign in as himself, so the log shows it was him, since there can be more than one admin. Following that procedure is the gym's job once the team writes it in the manual. CTI did not call this point an idea, as it did the staff point.
- CTI suggested roles can be a column on the users table, with an admin screen that changes them.

For the project: the largest open design question (G-09). Options, with no recommendation: the shared account and PIN; personal sign-in for Staff and Administrators; or a shared Staff account with personal sign-in for Administrators. Personal sign-in would change REQ-F-52, REQ-F-88, REQ-F-89, REQ-NF-39 and the PIN screens, more than a person-week of work. #16 builds the shared account until the gym answers.

### 3.15 Audit log

CTI called it the bitácora; the requirements call it the audit log (REQ-NF-39).

- CTI said it always asks every project for a log of everything that happens. CTI did not say whether that is a condition for the VM.
- CTI said nobody asks for that tracking until there is an incident, and only the admin should see it. "Un admin no puede modificar la bitácora, eso está prohibido." No interface may let anyone, the admin included, change an entry. The admin can search it by person and by date range and export it to CSV or Excel, with no delete or modify button. CTI called it part of the app's security.
- CTI recommended one standard structure: a Linux timestamp, the user, an action (add user, modify, delete, backup, login, logout) and a free comment. CTI also recommended recording the IP address in every entry, calling it important because the app could be attacked.

For the project: the design already logs account, time, IP, device, browser and before and after values. New from CTI, all Proposed: no edit or delete for anyone, search, export, and login, logout and backup events. The log screen moves out of #27. Search by person needs personal sign-in (3.14). Open: is the end of the term (G-03, E-46) long enough for a late incident?

### 3.16 Backups, disaster recovery and the installer

- CTI said it always asks for a disaster recovery plan (corruption, a hacked system, hardware failure): how often data is backed up, which data, and how to recover, in clear written steps.
- CTI said it normally asks the student groups it works with for an installer script that turns a plain Linux machine into the running app with the first account created. After a disaster you run it on a new machine and restore the backup. It also covers a change of operating system, which for CTI's own Ubuntu to Rocky move is not an in-place migration.
- The team asked where backups can be kept. CTI: "Eso es decisión de ustedes." CTI gave three options. A second disk on the same server, agreed with whoever creates it, which CTI likes least. A button on the admin screen that downloads the database and photos as one tar.gz file to the admin's computer, which CTI called very easy. A scheduled secure copy to a separate server, with its credentials entered in the app: the most elegant, but rarely built because almost nobody asks for a second server; CTI said that one is the administrator's decision.
- The team worried that nobody would do a manual backup. CTI said the team sets up the system and the procedure guides, and if the gym does not follow them, that is not a problem for the team.
- CTI's minimum recommendation is the download (one phrase was garbled, but the rest describes it), every afternoon or on Fridays. In CTI's view losing up to about a week of data is not much, as long as a backup exists.
- CTI said it understands the team must agree a backup and restore procedure with the director. Nobody on the team answered, so this is CTI's expectation, not a team commitment.
- Nobody discussed CTI snapshots or storage (neither offered nor ruled out), how long copies are kept, or encryption.

For the project: M-06 is partly answered; no method is chosen. Proposed: a written plan and a tested restore under REQ-NF-06, keeping "outside the VM" unless an on-VM option is chosen, and an installer that ends with the install command of REQ-F-88. A download requirement waits on the method; a downloaded backup puts all personal data on the admin's computer. Backups move out of #31.

### 3.17 Design practice: drawing each role's screens

CTI suggested drawing each role's screens, as CTI does on small whiteboards: boxes, buttons, text and sort order, so the client sees what is missing.

For the project: this matches the wireframes (#40 to #45), to show at the gym meeting.

### 3.18 Security remarks, collected

CTI's security points are in 3.4, 3.7, 3.8, 3.14, 3.15, 3.16, 3.19 and 3.22. Nobody discussed HTTPS, disk encryption, privacy law, SPF and DKIM or monitoring.

### 3.19 Off-campus access and allowed networks

- CTI said the gym might not want connections from outside campus, for security, so ask them. If they care, the admin needs a screen to set the allowed networks.
- CTI asked whether users are supposed to connect from off campus and said it did not know: it depends on how the gym wants it.
- CTI did not say users need a VPN, nor whether the VM can be reached from the internet.

For the project: M-01 stays open. A campus-only rule would block Check In on mobile data (REQ-NF-16, REQ-NF-26, REQ-F-33). No screen until the gym answers.

### 3.20 What the user does: the PWA

CTI asked whether users sign in or only show an ID at the door. A garbled team answer most likely meant users must be signed in. The team said it is a PWA on the phone, and confirmed CTI's restatement: a responsive web app, not a native one.

For the project: no change.

### 3.21 Registration screen: one number field, and numbers that match nothing

- CTI suggested starting with two choices: new user or sign in.
- The team said a new user picks athlete or paid member. CTI said it would not do it that way, while saying it was thinking on the spot, and suggested one generic registration number field (receipt number or student number), with the system checking the athlete list and then the receipts. CTI said this depends on number formats it does not know, and left it with the team, unsure it made sense to them. A remark that most likely came from the CTI side said nothing is wrong with the current choice; the single field only cuts steps.
- When the number matches nothing, CTI said to show instructions on whom to talk to and what to do, for example for a person whose receipt never arrived. CTI said the director must decide whether front desk staff may add that person by hand after seeing the receipt, or only the director.

For the project: a team choice that depends on the gym's number formats. A 6-digit number could be mistaken for a student number, and REQ-F-76 and the lookup limits (REQ-F-71) would need rework. #22 does not adopt it. Today only the Administrator grants by hand (E-35, REQ-F-87); a new gym question asks about Staff.

### 3.22 Waiver, documents and photos

- CTI asked which document users upload. The team said a liability waiver the director wants users to read and accept. Asked whether that means accept or sign, the team gave an unclear answer.
- CTI said that if accepting means reading on screen and pressing submit: "Ahí no tengo subir documentos. Lo que guardo es la aceptación." The team then defines what data proves who accepted, which takes almost no space.
- CTI said that if the director wants a hand-signed paper, someone must scan it and the team must set formats and size limits; a document also brings storage, backup and checks that the file is valid. CTI said the team must ask the director what he needs legally, a document or an authorization.
- CTI offered a signature drawn on the phone as another option, more complex but more professional. CTI was unsure it works in a web page, then guessed JavaScript could do it. A teammate said they had done it before.
- The team said users take their own photo. CTI said that, if it were up to CTI, it would be a staff task, then said a phone photo is fine if the director accepts it, and that the real issue is the procedure the gym sets.
- CTI and the team agreed that at Check In the staff screen shows the stored photo to compare with the person, and the system says so if the person is already inside. CTI suggested staff raise a flag on a mismatch, and that the team define how. A teammate was unsure what happens when a user changes phone.

For the project: G-21 asks on screen, signature or paper. REQ-F-60 stands for on-screen acceptance, with a proposal to store who accepted and when. REQ-F-13 stays open on the photo. REQ-F-03 already covers a phone change, to confirm. No issue for a signature, a paper upload or a mismatch flag until the gym answers.

### 3.23 Manuals, procedures, next steps and delivery

- CTI suggested user and administrator manuals if the owner asks, with the first-account procedure in the manual. CTI did not mention a developer manual.
- The team said its next step is to meet the director. CTI called the VM part trivial and urged the team to use that meeting to go through every scenario in detail, because a change to the database structure mid-development is very bad.
- The team said delivery is in December. CTI offered further help. The team said it would contact CTI again, to clear up questions and for the requests.

For the project: manuals wait on the director's answer. A developer manual is the team's call.

## Action items

- Team, with the director: go through every scenario before the database tables are final.
- Team: tell the director what falls on him after December.
- Team: write the VM size recommendation with a growth estimate, and settle the second disk before the VM request.
- Director, with texts from the team: file the VM, domain and VPN requests, then pass the sudo account to the team.
- Team, with CTI: set up the mail relay once the VM and domain exist, and agree the sender.
- Team, with the gym: find the technical contact for the athletic department's WordPress.
- Team: ask CTI what the meeting left open: internet access, HTTPS certificate, operating system, disk encryption, privacy rules, SPF and DKIM, ports, any evaluation step, snapshots, student sudo at delivery, and whether CTI manages the department's WordPress.
- Team, with the director: agree the backup and restore procedure. Team: decide whether to deliver the installer and the disaster plan.
- Owner, professor or department: plan who looks after the system after December. CTI has no people to adopt or maintain it, and nobody has been named.
- Team: agree what was meant by "by API", soft delete, staff doing the check-out and "a shared staff account" before any document changes on that basis.

## Key dates

- November 1: end of Phase 2 in the plan (#50), which includes the database tables (#13). Personal sign-in, a check-out or a roster group mark could change tables, so the director meeting should come first.
- December: delivery. The team leaves after it, so whatever it hands over must be ready by then.
