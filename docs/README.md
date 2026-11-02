# How to find things in this project

This page maps the repository: what each folder holds, what the IDs in the documents mean, and where to start reading. How to run the code is in the [README at the root](../README.md).

## Where to start

| You are | Read first | Then |
|---|---|---|
| New to the project | [context.md](context.md), sections 1 and 2: what changed since the proposal and why | [SRS](requirements/SRS.md), sections 1 and 2 |
| Grading the project | [SRS](requirements/SRS.md): every requirement with its priority and status | [architecture.md](design/architecture.md), then the issues in the `Midterm report` and `Final report` milestones |
| Drawing screens | [screen-map.md](design/screen-map.md): every screen and who uses it | [wireframe-guide.md](design/wireframe-guide.md), section for your issue |
| Writing code | The issue you picked: it names its requirements and what it depends on | [api-conventions.md](design/api-conventions.md) and the design document for that feature (table below) |

## What each folder holds

| Path | What is in it |
|---|---|
| [requirements/SRS.md](requirements/SRS.md) | The requirements. Each one has an ID, a priority and a status. Appendix A is the glossary of terms like Authorization Number, facility session and Gym ID |
| [context.md](context.md) | What changed since the proposal, the stack and why, team rules, what CTI said |
| [decisions/](decisions/) | Questions and their answers. One file per group that answers them: [team.md](decisions/team.md), [gym.md](decisions/gym.md), [cti.md](decisions/cti.md) |
| [design/](design/) | How the system is built. Diagrams are drawn in Mermaid inside each file, and GitHub shows them as pictures |
| [meetings/](meetings/) | Minutes of meetings outside the team |
| [setup/](setup/) | How to set up tools, like the Claude Code skills |
| [capstone_proposal/](capstone_proposal/) | The proposal and its five original diagrams (`diagrams/`). `v0/` is the submitted version and never changes |

### Design documents

| Feature | Document | Diagrams |
|---|---|---|
| Containers, servers, proxy | [architecture.md](design/architecture.md) | 5 |
| Tables and database rules | [data-model.md](design/data-model.md) | 4 |
| Registration, renewal, authorization states | [registration-flows.md](design/registration-flows.md) | 9 |
| Check In, session, Gym ID, occupancy | [check-in-flows.md](design/check-in-flows.md) | 11 |
| Gym account, PIN, terms, roster, import | [admin-flows.md](design/admin-flows.md) | 17 |
| Every screen and how people move between them | [screen-map.md](design/screen-map.md) | 7 |
| What each wireframe must show | [wireframe-guide.md](design/wireframe-guide.md) | |
| Error format and routes for the API | [api-conventions.md](design/api-conventions.md) | |
| Design notes moved out of older SRS versions | [design-notes.md](design/design-notes.md) | |

Every design document ends the same way: "Design decisions to confirm", "Gaps and questions", and "Traceability", which lists the requirements each diagram covers.

## What the IDs mean

| ID | Meaning | Defined in |
|---|---|---|
| `REQ-F-12` | Functional requirement: something the system does | [SRS](requirements/SRS.md), section 3 |
| `REQ-NF-12` | Non-functional requirement: speed, privacy, security, language | [SRS](requirements/SRS.md), sections 4 to 8 |
| A requirement ID you cannot find | It was merged into another one or removed | [SRS](requirements/SRS.md), Appendix B |
| `F-12`, `NF-12` | Short form of the two above, used in lists like "REQ-F-41, F-42" | Same as above |
| `E-12` | A team decision or a question the team answers | [team.md](decisions/team.md) |
| `P-01` | A question for the professor or advisors | [team.md](decisions/team.md), "Questions for the professor or advisors" |
| `G-12` | A question for the gym (Athletic Activities) | [gym.md](decisions/gym.md) |
| `M-01` | A question for CTI | [cti.md](decisions/cti.md) |
| `REG-1` | A design decision in the registration flows | [registration-flows.md](design/registration-flows.md), "Design decisions to confirm" |
| `SM-1` | A design decision in the screen map | [screen-map.md](design/screen-map.md), "Design decisions to confirm" |
| `D1` | A design decision inside one design document. Each document counts from D1, so D3 in architecture.md and D3 in check-in-flows.md are different items | The "Design decisions to confirm" section of the same document |
| `X1` | A message box inside one diagram, explained in the note under that diagram | The same diagram |
| `N-01` | Screen for someone not signed in | [screen-map.md](design/screen-map.md), section 8 |
| `U-01` | Screen for a User (paid member or athlete) | Same |
| `C-01` | Screen shared by every role, like the occupancy card | Same |
| `S-01` | Screen for Staff | Same |
| `A-01` | Screen for an Administrator | Same |
| `#12` | A GitHub issue or pull request. The number links to it on GitHub | GitHub |
| `Proposal:175` | Line 175 of the proposal, `capstone_proposal/main.tex` | The proposal |

## Words that mark how sure something is

In the SRS:

| Word | Meaning |
|---|---|
| Clear | The requirement can be built and tested now |
| Pending | Information is missing. The cell says who answers and the question ID |
| MVP, Secondary, Stretch | Priority in the proposal |
| High, Medium, Low | Final priority. High and Medium are committed for December, and High is built first. Low is built only if everything else is done and tested |

In the design and decision documents:

| Word | Meaning |
|---|---|
| Decided | The team chose it. The decision has an ID, usually an `E-` |
| Proposed | A suggestion that still needs a yes from the team, the gym or CTI |
| Pending, To confirm | Nobody has answered yet. The line says who must answer |

## How a piece of work traces back

An issue lists the requirement IDs it builds at the end (`Requirements: REQ-F-33`). Search the [SRS](requirements/SRS.md) for that ID to read the requirement. The SRS row names the decisions behind it (`E-`, `G-`, `M-`). Search the [decisions](decisions/) files for those to read the question, the answer, and who answered.
