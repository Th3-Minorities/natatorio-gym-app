# Skills setup

Every developer needs these skills. `CLAUDE.md` says when to use each one. This page says how to install them.

Most of them are plugins. The repo declares them in `.claude/settings.json`, so Claude Code offers to install them when you open the folder and trust it. If that does not happen, run the commands below inside Claude Code.

## Plugins

| Skill | Marketplace | Install |
|---|---|---|
| `superpowers` | [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) (built in) | `/plugin install superpowers@claude-plugins-official` |
| `figma` | [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) (built in) | `/plugin install figma@claude-plugins-official` |
| `design` | [knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | `/plugin marketplace add anthropics/knowledge-work-plugins`, then `/plugin install design@knowledge-work-plugins` |
| `engineering` | [knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | `/plugin install engineering@knowledge-work-plugins` (same marketplace as `design`) |
| `ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), MIT | `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail` |
| `humanizer` | [blader/humanizer](https://github.com/blader/humanizer), MIT | `/plugin marketplace add blader/humanizer`, then `/plugin install humanizer@humanizer` |

`humanizer` as a plugin needs Claude Code 2.1.142 or newer. On an older version, run `npx skills add blader/humanizer --global --agent claude-code` in a terminal.

`figma` needs a Figma sign-in the first time. Run `/mcp` and authenticate.

## Skills that are not plugins

### stop-slop

Source: [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop), MIT. The repo root is the skill folder.

```powershell
git clone https://github.com/hardikpandya/stop-slop $HOME\.claude\skills\stop-slop
```

### graphify

Source: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify), Apache-2.0 and MIT. The PyPI package is `graphifyy` (two y). The command is `graphify`.

```powershell
winget install astral-sh.uv
uv tool install graphifyy
graphify install
```

`pipx install graphifyy` works too. Needs Python 3.10 or newer. In PowerShell, run `graphify .` without the leading slash. `graphify-out/` is gitignored: never commit, push, or upload it.

### sdlc-process and unslop

No public source found. Ask Carlos Pepín for the folders and copy them to `~/.claude/skills/`.

## Skills in the repo

`write-issue` lives in `.claude/skills/write-issue/`. Claude Code loads it when you open the folder, so there is nothing to install. It runs before any issue is created or edited, and it follows the rules in `CLAUDE.md`.

## Check

Run `/plugin` and confirm the six plugins show as enabled. Start a new session and check that `graphify`, `stop-slop`, `sdlc-process`, `unslop` and `write-issue` appear in the skill list.
