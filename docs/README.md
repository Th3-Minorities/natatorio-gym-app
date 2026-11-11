# Guide to this project

Start here if you are new to the project or if you are grading it.

## What the project is

We are building an app for the UPRM Weight Gym that you open on your phone and can install. The [project website](https://th3-minorities.github.io/natatorio-gym-app/) says what it does and what we have built so far.

Three groups are involved:

- The gym, run by UPRM's Department of Athletic Activities. They own the project and answer questions about how the gym works.
- CTI, UPRM's technology office. They will give us the server the app runs on.
- The team: three students in the Capstone course, who design and build the app.

## Words you will see

| Word | What it means |
|---|---|
| Requirement | One thing the app must do, written as a rule. All of them are in one document, the SRS |
| SRS | Software Requirements Specification: the document with every requirement |
| Proposal | The project plan we submitted at the start of the course |
| Check In | What a person does in the app when they arrive. It only works inside the gym, and it opens a visit. The visit ends when Staff check the person out, or on its own 2 hours after Check In |
| Gym ID | The digital gym card the app shows. Staff look at it to let a person in |
| Authorization Number | A code (6 or 7 characters so far, letters allowed) a member gets by email when they pay for the gym. They type it to register in the app |
| Roster | The list of student athletes allowed in the gym this term |
| Term | A semester, with its start and end dates |
| Milestone | The two GitHub milestones, `Midterm report` and `Final report`. Each one groups the issues due on that date |

The SRS has a longer glossary at the end (Appendix A).

## Where to start

- To understand the project: read the "What changed since the proposal" part of the [project context](context.md). Then read the first two sections of the [SRS](requirements/SRS.md).
- To grade the project: the [SRS](requirements/SRS.md) lists every requirement and how important it is. The [architecture](design/architecture.md) shows how the system is built. The issues on GitHub, grouped by milestone, show what is done and what is left.
- To draw screens: the [screen map](design/screen-map.md) lists every screen and who uses it. The [wireframe guide](design/wireframe-guide.md) says what each drawing must show.
- To write code: start from your GitHub issue. It says which requirements it builds and what must be done first. Then read the design document for that part of the app (list below).

## Where each thing is

All documents are in the `docs` folder.

| What you are looking for | Where it is |
|---|---|
| What the app must do | [SRS](requirements/SRS.md) |
| What changed since the proposal, and why | [Project context](context.md) |
| Questions we asked and the answers we got | [The team's questions](decisions/team.md), [the gym's questions](decisions/gym.md), [CTI's questions](decisions/cti.md) |
| Summaries of meetings with the gym or CTI | [Announcements](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/categories/announcements) |
| The proposal and its original drawings | [capstone_proposal folder](https://github.com/Th3-Minorities/natatorio-gym-app/tree/main/docs/capstone_proposal). The `v0` folder inside is the version we submitted, kept as it was |
| How to set up the tools we use | [setup guide](setup/skills.md) |
| How to run the code | The [README at the top of the repository](https://github.com/Th3-Minorities/natatorio-gym-app#readme) |
| Each test case for objectives 1 to 3 and its result | [Test plan](testing/test-plan.md) |
| The saved test results and screenshots | [Test evidence](testing/evidence/summary.md) |
| Results of the browser tests of each flow, from its first screen to its last | [Flow test results](testing/flow-results.md) |
| The manual accessibility checks of each screen | [Accessibility checklist](accessibility-checklist.md) |

### How each part of the app works

| Part of the app | Document |
|---|---|
| Servers and how the pieces connect | [Architecture](design/architecture.md) |
| What the database stores | [Data model](design/data-model.md) |
| Registering and renewing each term | [Registration flows](design/registration-flows.md) |
| Check In, how a visit ends, the Gym ID, how full the gym is | [Check In flows](design/check-in-flows.md) |
| Staff and administration tasks | [Administration flows](design/admin-flows.md) |
| Every screen and how people move between them | [Screen map](design/screen-map.md) |
| What each screen drawing must show | [Wireframe guide](design/wireframe-guide.md) |
| Where each finished wireframe is in Figma | [Wireframes](design/wireframes.md) |
| Rules every backend address follows | [API conventions](design/api-conventions.md) |
| Design values, texts, dates and shared pieces of the screens, and the rules every screen follows | [Frontend base](design/frontend-base.md) |
| Older notes moved out of the SRS | [Design notes](design/design-notes.md) |

Each design document ends with three lists: decisions still waiting for a yes, open questions, and which requirements each diagram covers.

## For developers: where the code is

The backend (Laravel, in PHP) keeps the data and the rules. The frontend (React) is what people see: the User app on the phone and the dashboard on the front desk computer. Both run in containers, so one command starts everything on any computer.

| What you are looking for | Where it is |
|---|---|
| The addresses the app calls, like `/api/health` | `backend/routes/api.php` |
| The code that answers each address | `backend/app/Http/Controllers/` |
| The data types, like a user | `backend/app/Models/` |
| The tables in the database | `backend/database/migrations/`. Fake data for testing is in `factories/` and `seeders/` next to it |
| Every text of the app in Spanish and English | `frontend/src/i18n/` |
| Backend tests | `backend/tests/` |
| The screens | `frontend/src/` |
| Frontend tests | Next to each screen in `frontend/src/` (`*.test.tsx`). Browser tests in `frontend/e2e/`, the path tests in `frontend/e2e-paths/`, and the evidence screenshots in `frontend/e2e-evidence/` |
| The containers: proxy, PHP, database | `docker-compose.yml` and the `docker/` folder |
| The checks GitHub runs on every pull request | `.github/workflows/` |
| The templates for new issues | `.github/ISSUE_TEMPLATE/` |

### How a feature gets built

1. Pick an issue. It says what to build, what must exist first (`Depends on`), and how to know it is done (`Done when`).
2. Read the design document for that part of the app, from the table above.
3. Make a branch for the issue, named with its number, like `13-database`.
4. Write the code and its tests. Run the tests and the style check before you push.
5. Open a pull request that says `Closes #` and the issue number. GitHub runs the checks.
6. Another team member reviews it. When it is approved and the checks pass, it is merged into `main`.

## Codes you will see

The documents use short codes so they can point to each other.

| Code | What it is | Where to find it |
|---|---|---|
| `REQ-F-12` | A requirement about something the app does | [SRS](requirements/SRS.md), section 3 |
| `REQ-NF-12` | A requirement about how well it does it: speed, privacy, security, language | [SRS](requirements/SRS.md), sections 4 to 8 |
| `F-12`, `NF-12` | The same codes, shortened inside lists | [SRS](requirements/SRS.md) |
| `E-12` | A question the team answered, or a decision the team made | [The team's questions](decisions/team.md) |
| `P-01` | A question for the professor | [The team's questions](decisions/team.md), near the end |
| `G-12` | A question for the gym | [The gym's questions](decisions/gym.md) |
| `M-01` | A question for CTI | [CTI's questions](decisions/cti.md) |
| `REG-1` | A design choice about registration | [Registration flows](design/registration-flows.md), near the end |
| `SM-1` | A design choice about the screens | [Screen map](design/screen-map.md), near the end |
| `D1` | A design choice inside one document. Each document starts again at D1, so D3 in one document is not D3 in another | Near the end of the same document |
| `X1` | A message the app shows, drawn inside one diagram | The note under that diagram |
| `N-01` | A screen for someone who is not signed in | [Screen map](design/screen-map.md), section 8 |
| `U-01` | A screen for a member or athlete | Same |
| `S-01` | A screen for front desk staff | Same |
| `A-01` | A screen for the administration | Same |
| `C-01` | A screen everyone sees, such as how full the gym is | Same |
| `#12` | A GitHub issue or pull request | Click it, or search the number on GitHub |
| `Proposal:175` | Line 175 of the proposal | [Proposal](https://github.com/Th3-Minorities/natatorio-gym-app/blob/main/docs/capstone_proposal/main.tex) |

If you cannot find a requirement code, it may have been merged into another one or removed. Appendix B of the SRS lists those.

## Words that say how sure something is

| Word | What it means |
|---|---|
| Decided | The team chose it. It points to the decision, usually an `E-` code |
| Proposed | A suggestion. It still needs a yes from the team, the gym or CTI |
| Pending, To confirm | Nobody has answered yet. The text says who must answer |
| Clear | (SRS) We have everything we need to build it |
| High, Medium, Low | (SRS) How important it is. High and Medium must be done by December. Low only if there is time left |
| MVP, Secondary, Stretch | (SRS) How important the proposal said it was. MVP means the smallest version that works |

## Following a task back to its reasons

1. A GitHub issue ends with a line like `Requirements: REQ-F-33`.
2. Search the SRS for that code to read the requirement.
3. The requirement's row names the questions behind it, such as `E-12` or `G-12`.
4. Search the questions files for that code to read the question, the answer, and who answered.
