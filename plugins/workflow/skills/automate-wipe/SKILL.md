---
name: automate-wipe
description: Clear every leftover per-worktree test-automation and probe catalog off the local database server and leave one plain automation catalog behind. Use when the user types /automate-wipe, asks to clean up the automate databases, or the database list has filled with per-worktree automation catalogs.
---

# /automate-wipe - clear the automation catalog clutter

Every worktree that runs tests can provision its own catalog, named after the worktree.
The worktree goes away; the catalog does not.
They pile up on the database server until someone clears them.

This skill drops the ones nobody owns any more, then seeds one clean plain automation catalog.

    /automate-wipe

No arguments. There is nothing to choose.

## 0. Read the settings

- Resolve two roots:
  - **this checkout**: `git rev-parse --show-toplevel`.
  - **the main checkout**: `git rev-parse --path-format=absolute --git-common-dir`, with the trailing `/.git` removed.
- Read `## Shared` and `## Automate-wipe` from `.claude/skill-settings.md` in this checkout.
- Then read the same two sections from `.claude/skill-settings.local.md` in the MAIN checkout.
  - It is gitignored, so a worktree never has its own copy.
  - A key in both files takes the local value.
- A value there overrides the default below.
- A plain bullet under a key is a rule, followed as if written here.
- A **required** key with no value: name the key and the file it belongs in, then stop. Never guess a value.

| Key | Default | What it is |
|---|---|---|
| `seed project` | **required** | Path to the seed tool's project, relative to the repo root |
| `seed command` | `dotnet run --project <seed project> --` | How to start the seed tool. Arguments go after it |
| `list flag` | **required** | Prints each disposable catalog as orphan or spared, drops nothing |
| `drop flag` | **required** | Drops every orphaned disposable catalog |
| `reseed args` | **required** | Arguments that cold-seed the plain catalog, e.g. `--db <plain catalog> --force` |
| `reseed args alternate` | none | Another way to do the same seed, and what it needs |
| `describe args` | none | Arguments that print what the automation source seeds, without connecting |
| `plain catalog` (local) | **required** | The one automation catalog that must exist at the end |
| `worktree catalog pattern` (local) | **required** | How a per-worktree catalog is named, including any shard suffix |
| `probe catalog` (local) | none | A second disposable catalog family, dropped with its children |
| `protected catalogs` (local) | none | Catalogs the sweep must never touch. One per line |
| `server` (local) | none | The database server, and whether other machines share it |
| `worktree folder` | from `## Shared` | Where worktrees live. A checkout under it is not the main checkout |
| `active run refusal` | none | The text and exit code the tool prints when a test run is in flight, and how long a lock is honored |
| `lock exit code` | none | Exit code for "this checkout holds the run lock" |
| `not local exit code` | none | Exit code for "the connection is not a local server" |
| `bad argument exit code` | none | Exit code for a bad argument or a missing schema package |
| `schema build command` | none | Builds the schema package. Run from this checkout's root |
| `timing` | none | Expected time for the cold seed |
| `docs` | none | Docs for flags and safety rationale. One path per line |

## End state

| Catalog | After |
|---|---|
| `plain catalog` | **present, freshly seeded** |
| A `worktree catalog pattern` match whose checkout is gone | dropped |
| A `worktree catalog pattern` match whose checkout is still on disk | **kept** |
| `probe catalog` and its orphaned children | dropped |
| Every `protected catalogs` entry, and anything else | **untouched** |

- The last row must be enforced by the seed tool's own selection, not by care.
- The tool should select only the plain and per-worktree automation names, and the probe names.
- Any other catalog cannot match, so no flag and no argument can reach it.
- If the `list flag` output ever names a `protected catalogs` entry: **stop** and report it. Do not run the drop.

## What counts as an orphan

- A per-worktree catalog is spared when the checkout that made it still exists.
- The tool should work out each live checkout's catalog name with the same code that created the name. Nothing re-implements the naming.
- A catalog matching a live name, or one of its shard variants, is kept.
- Two names are always dropped: the `plain catalog` and the `probe catalog`.
  - They belong to the main checkout.
  - Step 3 puts the plain one straight back.

**The keep-set only sees this machine's worktrees.**

- If the `server` setting says other machines share it, say so before step 2.
- A catalog seeded by a checkout on another machine reads as an orphan here and is dropped.

## Run it from the MAIN checkout

**The main checkout, never a worktree.** This is the one thing that can go wrong.

- The seed tool names its target after the worktree whenever it runs from one.
- Run step 3 from a worktree and it recreates one of the very catalogs step 2 just deleted.
- That leaves no plain catalog at all.

Check before running:

- `git rev-parse --show-toplevel` must equal the main checkout root from step 0.
- It must not be a path under the `worktree folder`.
- If it is: say so, and run every command below from the main checkout root instead.

### Step 1 - look first

    <seed command> <list flag>

- Prints one line per catalog, orphan or spared, and exits.
- It drops nothing, takes no run lock, and is safe while a test run is in flight.
- Read it back to the user before step 2 whenever the spared list matters to them.

### Step 2 - drop the orphans

    <seed command> <drop flag>

- Names the catalogs it spared, then drops the rest.
- This includes the `plain catalog`; step 3 puts it back.
- If nothing is orphaned it says so and exits 0. That is a normal outcome, not a failure.

### Step 3 - put the plain one back

    <seed command> <reseed args>

- The force part of `reseed args` is required here, not optional.
  - Step 2 dropped the catalog but may have left the tool's backup and change marker alone.
  - Without force, the run can take a restore shortcut off a marker that no longer describes anything on disk.
- Say the `timing` value, if set.
- `reseed args alternate`, if set, does the same job. Use it only when its stated needs are met.

## When it refuses

| Symptom | Meaning | Do this |
|---|---|---|
| `active run refusal` | A test run is in flight somewhere on this machine | **Stop.** Report the lock paths it named. Do not delete a lock file |
| `lock exit code` | This checkout holds the run lock | Report the lock line and stop |
| `not local exit code` | The connection points somewhere that is not a local server | The local-only guard, working. No override exists |
| `bad argument exit code` | Bad argument, or the schema package is missing | Run `schema build command` from this checkout's root, then retry. None set: report and stop |

No exit codes set: report the exit code and the tool's own output, and stop.

Two separate checks make this safe to run casually. They cover different hazards:

- **The active-run check** refuses outright rather than pulling a catalog out from under a *running* test run.
  - A stale lock ages out on its own, per `active run refusal`.
- **The orphan rule** covers the larger case the lock cannot see: a checkout that is idle right now but still in use.
  - An idle worktree writes no lock file.
  - Without the orphan rule, its catalog would be dropped and cost it a cold re-seed.

## Report the result

Say what was dropped and what was spared, by count and by name. Then confirm the plain catalog is back:

    Dropped 8 orphans, spared 2 live checkouts. <plain catalog> reseeded (45s).

A clean exit is not proof on its own.
If the user is about to use the catalog, read back what landed:

    <seed command> <describe args>

- The describe run should open no connection.
- Hand the user the sign-in or account they need. Do not make them look it up.

## Related

- Refilling a manual catalog instead: `/reseed`.
- Flags and safety rationale: the `docs` setting.
