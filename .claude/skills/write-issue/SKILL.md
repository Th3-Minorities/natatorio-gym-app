---
name: write-issue
description: Use before creating or editing any GitHub issue in this repo (Capstone, natatorio gym app). Checks that someone who did not write the issue can understand it, uses the templates in .github/ISSUE_TEMPLATE, and sets the label, milestone and project.
---

# write-issue

Draft the issue in chat first. Create or edit it on GitHub only after the user approves the text.

Repo: `Th3-Minorities/natatorio-gym-app`. Project: `Capstone`.

## Rules and where they come from

Each rule has a source. If you add a rule, add its source or mark it "Team decision".

| Rule | Source |
|---|---|
| The title says what the issue is about at a glance. | GitHub Docs, Quickstart for Issues |
| The description explains the purpose (the why), not only the task. | GitHub Docs, Quickstart for Issues |
| Bugs: steps to reproduce, expected result, actual result. Put them under "What". | GitHub Docs, Quickstart for Issues |
| Work too big for one issue is split into smaller issues or a task list. | GitHub Docs, Planning and tracking work |
| Break items into smaller, more precise items until one person can finish one in a sprint. | Scrum Guide, Product Backlog |
| The issue must be understood by the people doing the work and the people receiving it. | Scrum Guide, Transparency |
| Whoever takes the issue has the last word on its size. The author's size is an estimate, and the draft says so. | Scrum Guide, Product Backlog |
| "Done" is a shared understanding, not the author's private idea. Every issue has a "Done when" that someone else can check. | Scrum Guide, Definition of Done; Team decision, CLAUDE.md |
| Use `.github/ISSUE_TEMPLATE/feature.md` for full-stack work (backend to screen) and `task.md` for design, docs, setup and testing. | Team decision, CLAUDE.md |
| Size: one person, about one week. Split anything bigger. Merge anything under a day into a related issue. | Team decision, CLAUDE.md |
| Plain language, English, no file paths or internal document names in the body. Requirement IDs go in one last line: `Requirements: REQ-F-33, REQ-NF-11`. | Team decision, CLAUDE.md |
| One label for the feature area. Add `blocked` only when the issue waits on CTI, the gym or the professor, and say who and what in the issue. | Team decision, CLAUDE.md |
| The milestone is `Midterm report` or `Final report`, and the issue belongs to the `Capstone` project. | Team decision, CLAUDE.md |
| Never cite a file that is not published in the repo (transcripts, personal notes, analysis, agent reports). | Team decision |
| Never credit Claude or any AI. Never use em dashes. Use simple words. | Team decision, CLAUDE.md |

Existing issues also link their parent and their blockers in lines like `Part of: #11` and `Depends on: ...`. Do the same when the issue has either.

## Steps

1. Run `gh label list --repo Th3-Minorities/natatorio-gym-app` and `gh issue list --repo Th3-Minorities/natatorio-gym-app --state all --search "<keywords>"`. Reuse an existing label. Do not create labels. Check for a duplicate and for a parent issue.
2. Pick the template. Fill every section. Keep every "Done when" line of the template that applies. Remove one only when it clearly does not apply, and say so in the draft.
3. Size check: more than about eight scope items usually means more than a week. Then offer to split it, or say in the draft that it is probably too big for one person.
4. Cold-read check: reread only the title and the What and Why sections as if you had never seen the project. If you cannot say what the issue is, why it exists and when it is done, rewrite it.
5. Jargon check: spell out every acronym and internal term once, or replace it with a plain word. This includes tool names such as OPcache, CORS or composer.
6. Run `humanizer`, then `stop-slop` on the prose. Revise below 35/50. Code, commands and issue numbers stay unchanged. Tell the user if you could not run either skill.
7. Show the user the title, the body, the label, the milestone and the project. Wait for a yes.
8. Create it. Write the body to a file with the Write tool, so it is UTF-8 without a BOM (in Windows PowerShell 5.1, `Set-Content -Encoding utf8` and `Out-File` add one). Check the file for em and en dashes. Then:

   ```
   gh issue create --repo Th3-Minorities/natatorio-gym-app --title "<title>" --body-file <file> --label <area> --milestone "<Midterm report|Final report>" --project Capstone
   ```

9. Confirm with `gh issue view <number> --json labels,milestone,projectItems` that the label, the milestone and the project are set. If `--project` fails, the token may lack the `project` scope: tell the user to run `gh auth refresh -s project`.

Editing an existing issue follows the same rules. Show the new text and wait for a yes before `gh issue edit`.

## Already decided

- Type label: none. `feature` and `task` are template names, not labels. Use one area label from the repo, for example `setup`, `database` or `check-in`.
- "Another member approved it in a PR" stays as the last check in every "Done when".
