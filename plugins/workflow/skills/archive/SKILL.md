---
name: archive
description: Check whether this session has anything in flight or anything that lives only in its memory, list it if so, and archive itself if not. Use when the user types /archive or asks "are you done, can I archive you".
---

# /archive

Answer two questions honestly, then act.

1. **Is anything still in flight?**
2. **Is anything held only in this conversation that would be lost if it were archived?**

## Settings

Read `## Shared` and `## Archive` in `.claude/skill-settings.md` at the
repo root (`git rev-parse --show-toplevel`). A rule there is followed as
if written here.

No file, or no section: use the checks below. Say once, in one line,
that `.claude/skill-settings.md` can tune it and the template is in the
plugin's `templates/` folder.

- `check`: one line per extra area to check, as `<area> = <how>`.
  Default: none.

## Check, with evidence

Look, do not recall. Run the checks that apply to this session, plus
every `check` the settings add. A check whose tool is not available is
skipped, and named as skipped.

| Area | Check |
|---|---|
| Background work | Running sub-agents, background shells, monitors, scheduled wakeups |
| Notifications | `ReadNotifications`, when available: any unread PR, CI or session messages |
| Git | `git status`, unpushed commits, stashes in this session's checkout or worktree |
| Pull requests | An open PR from this session: CI not green, review not clean, findings open, not merged |
| Linked sessions | Side sessions this session started that are still working |
| Promises | Anything you told the user you would do and have not done |
| Chat-only knowledge | Findings, decisions, drafts, root causes or handoff notes that exist only in this conversation and are not in a commit, PR, issue, memory or file the user can open |
| Scratchpad | Files there the user still needs |

## If anything is found

- Do **not** archive.
- List each item, one line each: **what it is**, and **what would happen to it** (lost, orphaned, left half-done).
- Stop. The user decides.

## If nothing is found

- Say so in one line.
- Call `mcp__ccd_session_mgmt__archive_session` with `session_id: "self"` and a short `reason`.
- That tool not available: say the session is clear to archive, and that the user archives it by hand.
