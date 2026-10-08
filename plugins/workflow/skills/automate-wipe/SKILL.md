---
name: automate-wipe
description: Drop every per-branch test catalog off the shared database server with one script. Plain SQL, no build, no seed. Use when the user types /automate-wipe, asks to clean up the automate databases, or the database list has filled with per-branch test catalogs.
---

# /automate-wipe - drop the per-branch test catalogs

Every branch that runs tests gets its own catalog.
They pile up on the shared server.
This skill drops them. That is all it does.

    /automate-wipe

No arguments.

## 0. Read the settings

Read `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`):

- the `## Shared` section, then the `## Automate-wipe` section
- then the same sections of `.claude/skill-settings.local.md` in the MAIN checkout:
  `(git rev-parse --path-format=absolute --git-common-dir)` with the trailing `/.git` removed
- a local value wins over a committed one
- a plain bullet in a section is a rule, followed as if written here
- a required key with no value: name the key and the file it belongs in, then stop

| Key | File | Default | Required |
|---|---|---|---|
| `wipe command` | committed | none | yes |
| `list flag` | committed | none | no |
| `branch catalogs` | local | none | yes |
| `kept catalogs` | local | none | no |
| `server` | local | none | no |

## 1. What it touches

Build this table from the settings and show it before running:

| Catalog | After |
|---|---|
| each `branch catalogs` pattern | dropped |
| each `kept catalogs` line | **untouched** |
| every other catalog | **untouched** |

No build, no seed, no restore.

## 2. Run it

Run `wipe command` from the repo root.
`<root>` in it is `git rev-parse --show-toplevel`.

With `list flag` set, add it first when the user asks what would go; it drops nothing.

- **The script refuses while a test run holds a fresh run lock.**
  It names the locks. Wait for the run to finish. Never delete a lock file.
- **A catalog something is still connected to refuses the drop.**
  The script reports it as skipped, with the database's reason, and moves on. Do not force it.

## 3. Report the result

The names it dropped, and any it skipped, straight from the script's output.
