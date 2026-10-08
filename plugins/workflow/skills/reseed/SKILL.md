---
name: reseed
description: Refill a local database catalog from a named scenario set - "reseed demo" before a walkthrough, "reseed dev qa" to put the QA scenarios into Dev. Takes a destination and an optional source; the source defaults to the destination. Use when the user types /reseed, asks to refill or refresh Dev, QA or Demo, or says a demo catalog is spent.
---

# /reseed - put fresh data in a local catalog

Wraps the repo's seed tool.
Every run reads as **seed `<destination>` from `<source>`**.
The two are independent.

    /reseed <destination> [source]

    /reseed demo            seed the Demo catalog from the Demo scenarios
    /reseed dev             seed Dev from the Dev scenarios
    /reseed dev qa          seed Dev from the QA scenarios
    /reseed qa automate     seed manual QA from the automation fixtures

The examples use the default target names. The `target` settings decide the real ones.

**The second argument is optional and defaults to the first.**
`reseed dev` and `reseed dev dev` are the same command.

## 0. Read the settings

- Resolve two roots:
  - **this checkout**: `git rev-parse --show-toplevel`.
  - **the main checkout**: `git rev-parse --path-format=absolute --git-common-dir`, with the trailing `/.git` removed.
- Read `## Shared` and `## Reseed` from `.claude/skill-settings.md` in this checkout.
- Then read the same two sections from `.claude/skill-settings.local.md` in the MAIN checkout.
  - It is gitignored, so a worktree never has its own copy.
  - A key in both files takes the local value.
- A value there overrides the default below.
- A plain bullet under a key is a rule, followed as if written here.
- A **required** key with no value: name the key and the file it belongs in, then stop. Never guess a value.
- No file and no section is fine for every key that has a default.

| Key | Default | What it is |
|---|---|---|
| `seed project` | **required** | Path to the seed tool's project, relative to the repo root |
| `seed command` | `dotnet run --project <seed project> --` | How to start the seed tool. Arguments go after it |
| `target` | `dev = Dev / Dev`, `qa = QA / QA`, `demo = Demo / Demo` | One line each: `<typed> = <destination value> / <source value>`. Any `target` line in the settings replaces the whole default list. The only valid arguments |
| `destination flag` | `--destination` | Flag that names where the data goes |
| `source flag` | `--source` | Flag that names which scenario set to seed |
| `force flag` | `--force` | Flag that forces a cold seed |
| `describe flag` | `--describe` | Flag that prints what a source seeds without connecting |
| `local targets file` | none | Gitignored file the destination is resolved from. Copied from the main checkout when missing |
| `schema build command` | none | Builds the schema package the seed tool deploys. Run from this checkout's root |
| `lock exit code` | none | Exit code for "a test run holds the run lock" |
| `lock override` | none | Env var or file that bypasses the run lock. Named so the skill never touches it |
| `not local exit code` | none | Exit code for "destination is not a local server" |
| `bad argument exit code` | none | Exit code for a bad argument or a missing targets file |
| `timing` | none | Expected run times, cold and restore, said up front |
| `target note` | none | `<typed> = <text>`. Said once before seeding that target |
| `pipeline target` | none | `<typed> = <required source>`. The test pipeline's own catalog |
| `catalog` (local) | none | `<typed> = <database name>`. Used only to name the catalog in the report |
| `docs` | none | Docs for flags, recipes and safety rationale. One path per line |

## Argument mapping

- Accept any casing and normalize.
- The `target` lines are the only valid values.
- Send the destination and source values exactly as the settings spell them, even when the tool matches case-insensitively. The printed banner then matches the docs.
- Anything else is an error.
  - Do NOT guess a near-match.
  - Say what was passed, list the valid targets, and stop.

## Run it

From the repo root (`git rev-parse --show-toplevel`):

    <seed command> <destination flag> <D> <source flag> <S>

**No force flag by default.**

- When the tool keeps a fresh backup, a plain run restores from it.
- That wipes whatever the last session did and returns the catalog to its seeded state.
- That is what "refill Demo before a walkthrough" wants, and it is much faster than a cold seed.
- Add the force flag only when:
  - the run reports a foreign or missing backup, or
  - the user explicitly asks to prove the cold path.

**No confirmation prompt.**

- The user owns these local catalogs. Replacing the contents is the point of the command.
- If the tool prints its target and pauses before writing, that pause is the check.

## What to expect

- Say the `timing` value, if set.
- **A remote or cloud destination is refused** by the tool's local-only guard, if it has one. No flag overrides it.
- Follow every rule under `## Reseed` about what does or does not block a run.

## When it refuses

| Exit | Meaning | Do this |
|---|---|---|
| `lock exit code` | A test run holds this checkout's run lock | Report the lock line and STOP. Do not delete the lock. Do not use the `lock override`. If the named process is dead, say so and let the user clear it |
| `not local exit code` | Destination is not a local server | Report it. This is the guard working; there is no override |
| `bad argument exit code` | Bad argument, or no `local targets file` | See below |

No exit codes set: report the exit code and the tool's own output, and stop.

**The `local targets file` is gitignored.**

- A fresh worktree does not have one, so the destination cannot resolve.
- Copy it from the same path under the MAIN checkout.

**The schema package must be built.**

- If the run reports it missing, run `schema build command` from this checkout's root.
- No `schema build command` set: report the message and stop.

## Verify, then report

A clean exit is not the same as the right data.
After the run, read back what landed:

    <seed command> <describe flag> <source flag> <S>

- Say it concretely: record counts, or the specific thing the user was about to use.
- The describe flag should open no connection.
- Whatever it prints (sign-ins, test accounts, coverage), hand the user the one they need. Do not make them look it up.
- Name the catalog from the `catalog` setting, if set.

## Know what you are overwriting

- **A demo catalog consumes itself.** Walking through a demo spends its beats until the next reseed. Reseeding before a walkthrough is the normal path.
- **Say each `target note` once**, before seeding that target.
  - It is information, not a gate.
- **A `pipeline target` belongs to the test pipeline.**
  - Seeding it from any source but its required one leaves the test suite pointed at data its fixtures do not describe.
  - Say so before running that combination.

## Detail

Flags, recipes and the safety rationale: the `docs` setting.
