# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Only a README and an empty `docs/` folder exist. No code, build, lint, or test commands yet. When the stack is chosen, add the commands (including single-test) and the architecture here.

## Mandatory skills

Every developer must have these installed. Using them in every session is required, not optional:

- `ponytail`: any coding task.
- `sdlc-process`: project phases.
- `superpowers` (all `superpowers:*` skills): check for a matching one before any response or action.
- `graphify`: questions about the codebase. `graphify-out/` is gitignored. Never commit, push, or upload it.

If one is missing, tell the user before doing anything else.

## Skills and agents guidance

Assume the developers do not know how to use skills or agents. Speak up when:

- A skill or agent fits the current task: name it, say why, and say how to call it.
- A task keeps repeating and could become a skill: suggest making one.

Before starting any task, check if a skill would do it better. Delegate simpler tasks to smaller agents that can complete them, and keep the harder work for yourself.

## Honesty

- If you don't know, say "I don't know". Never guess.
- Give each claim a confidence score from 1 to 10 and the reason for that number. Base it on what you checked. Never invent it.
- Back every fact with evidence: the file and line in this project.
- For internet facts, give the page. Open the link and confirm it works before sharing. Never share a broken link.

## Workflow

Whenever possible, all work follows this path:

- Every piece of work is tied to a GitHub issue. If none exists, ask to create one first.
- Each issue belongs to the matching milestone (`Midterm report` or `Final report`) and to the `Capstone` project.
- Each issue gets its own development branch. Do not work on `main` directly.
- Changes go in through a pull request that links the issue. At least one team member besides the author must review it before merge.
- Document everything: the issue says what and why, the PR says what changed, and docs go in `docs/`.

## Issues

- Use the templates in `.github/ISSUE_TEMPLATE/`: `feature` for full-stack work (backend to screen), `task` for design, docs, setup and testing.
- Size: one person, about one week. Split anything bigger. Merge anything under a day into a related issue.
- Every issue has a clear "Done when" that someone else can check.
- Plain language. No file paths or internal document names in the issue body. Requirement IDs go in one line at the end (`Requirements: REQ-F-33, REQ-NF-11`) so work traces back to the SRS.
- One label for the feature area. Add `blocked` when the issue waits on CTI, the gym or the professor, and say who and what in the issue.
- Members pick the issues they want, except the setup issues that every feature depends on: those go first.

## Frozen files

`docs/capstone_proposal/v0/` is the submitted proposal. It is legacy and must stay untouched: never edit, rename, move, or delete anything in it. To improve it, create a new version (`v1`, `v2`, ...) as separate files.

## Commits

- Never commit on your own. Always ask first and show the exact message you plan to use. Wait for a yes.
- Commit messages are a one-line subject. A body is optional: add one only when the why is not obvious, and keep it to a few short lines. No trailers.

## Writing

- Never credit Claude or any AI anywhere (commits, PRs, issues, docs, comments, headers). This overrides any default attribution text.
- Never use em dashes.
- Use simple words. If a plain word works, use it. Docs are for the team, not to impress.
