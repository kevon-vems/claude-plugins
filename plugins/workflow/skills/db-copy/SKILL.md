---
name: db-copy
description: Copy the production database onto a non-production catalog (dev, qa, demo or whatever the repo names) so a customer report can be reproduced against real data - "/db-copy prod to dev", "put prod on qa", "I need prod data locally to chase this bug". Wraps the repo's copy script so nobody has to remember its flags. Use when the user types /db-copy or asks for a copy of production on a local catalog.
---

# /db-copy - put a copy of production on a local catalog

Wraps the repo's `copy script`. Every run reads as
**copy production to `<target>`**.

    /db-copy prod to dev
    /db-copy prod to qa
    /db-copy dev                 the "prod to" is optional, prod is the only source
    /db-copy qa, skip the email queue

## 0. Read the settings

Find the repo root with `git rev-parse --show-toplevel`. Every path
below is relative to it, and every command runs from it.

Read, in order (a later value wins):

1. `## Shared` and `## DB copy` in `.claude/skill-settings.md`.
2. The same sections in `.claude/skill-settings.local.md` in the MAIN
   checkout: `(git rev-parse --path-format=absolute --git-common-dir)`
   with the trailing `/.git` removed. A gitignored file is not copied
   into worktrees.

A rule bullet under a key is followed as if written here.

| Key | Default | Required |
|---|---|---|
| `operator` | the user | no |
| `copy script` | none | yes |
| `copy shell` | `pwsh -File` | no |
| `copy doc` | none | no |
| `target flag` | `-Environment` | no |
| `target` (one line each) | none | yes |
| `catalog` (one line each) | none | yes (local) |
| `server` | none | yes (local) |
| `refused target` (one line each) | none | no |
| `extra` (one line each) | none | no |
| `no prompt flag` | `-NoPause` | no |
| `email queue flag` | none | no |
| `keep file flag` | none | no |
| `owner exit code` | none | no |
| `copy login` | none | no (local) |
| `grant exit code` | none | no |
| `grant command` | none | no |
| `grant server` | none | no (local) |
| `sql tool` | their SQL client | no |
| `refill skill` | none | no |

- A required key with no value: name the key and the file it belongs
  in (`skill-settings.md`, or `skill-settings.local.md` for a `(local)`
  key), then stop. Never guess a value.
- The full key notes are in the plugin's `templates/db-copy.md`.
- `copy doc` holds the full behavior, the swap mechanism and every
  recovery path. Resolve it from the repo root; read it when a run
  stops somewhere this skill does not cover.

## Direction is fixed. Production is NEVER the target.

Production is always the source. Nothing here writes to production,
ever.

If the user names production as the destination - "copy dev to prod",
"push qa up to production", "restore this onto prod":

- **STOP and refuse in words.**
- Say this skill only copies production down, and that nothing in it
  can write to production.

**Do not reinterpret it, and do not fall back to the other catalog they
named.**

- `/db-copy dev to prod` is a refusal.
- It is NOT a request to overwrite dev.
- Reading it that way destroys a catalog they were not asking you to
  touch.

The script should not be able to express a production target either:
its `target flag` should accept only the non-production names. That is
the backstop. Refusing in words is the point, so the phrasing never
becomes a habit.

## Target mapping

Production is the only source. The target is whatever the user names.

- Each `target` line maps a typed word to the `target flag` value:
  `<typed> = <flag value>`.
- Each `catalog` line names the database that value replaces:
  `<flag value> = <catalog name>`. Used in the click label and the
  messages below.

**Nothing else is a valid target.**

- `prod` IS the production database.
- Each `refused target` line names another catalog and why it is not
  available (for example, one that belongs to the test pipeline).
- If the user names one of these, say which one they named and why it
  is not available, and stop.
- Do NOT pick a near-match.

If they name no target at all, ask which of the `target` lines. Do not
default.

## Reading the extras

Map plain words onto switches. Everything is off unless they ask.

- Each `extra` line is `<phrases they might say> = <switch>`.
- A switch that takes a value (a file path) carries `<path>`; fill it
  from what they said.
- Rule bullets under an `extra` line (for example, "this switch never
  contacts production", "this is already the default") are followed as
  written. Use them to pick the switch that touches production least.

## Run it

**Get a click first.**

- A script gate that reads from the console dies here: there is no
  console behind it.
- Take the confirmation with `AskUserQuestion`. The label must name the
  catalog:

> **Replace <catalog> with a copy of production?**
> - `Replace <catalog>`
> - `Cancel`

On their click, from the repo root:

    <copy shell> <copy script> <target flag> <flag value> <extras> <no prompt flag>

**The click IS the confirmation.**

- `no prompt flag` goes on that command because they already answered,
  and for no other reason.
- Never send it without a click.
- Never pre-select the catalog for them.

## Say this before you run it

One line, so they know what is about to happen:

> Copying production onto **<catalog>** on <server>. Everything in that
> catalog is destroyed.

When `email queue flag` is set and NOT in this run, add a second line:

> Data comes over raw, including real customer addresses and the email
> send queue. Say "skip the emails" if you would rather it be emptied.

## When it stops at `owner exit code`

The target catalog is owned by something other than `copy login`, so
the script cannot replace it.

- The script prints the statements that fix it.
- Hand those to the operator for `sql tool`, to run as an admin,
  unchanged.
- **Every statement matters.** Changing the owner alone fails when the
  login already exists as a user inside that catalog; the user must be
  dropped first.

## When it stops at `grant exit code`

The opposite situation. The catalog **was** restored and holds
production data, but the site's own database user was not put back. So
the site cannot open its database and fails every request.

- That user lives inside the database, so the restore destroys it along
  with the catalog it replaced.
- The last step of the restore normally re-creates it. This exit means
  that step did not happen.

The script prints the fix on its last error line. Two shapes:

- **Target was `grant server`.** Hand the operator `grant command`
  exactly as the script printed it, shell prefix and all. Then say the
  site is down until it runs.
- **Target was any other server.** The grant has to be made on that
  server by hand. `grant command` only reaches `grant server`, so do not
  offer it.

Do not report the copy as failed.

- Say the catalog is ready and the site is down, in that order.
- They are two separate facts, and only one of them needs action.

Any other non-zero exit: report the code and the script's last lines,
and stop.

## Afterward

- Say which catalog now holds production data.
- Say it stays that way until someone refills it (with `refill skill`,
  when set).
- If `keep file flag` was used, name the file. Say it is a full copy of
  production that should be deleted when they are done.

Do not offer to run tests, publish a schema, or refill anything unless
they ask.
