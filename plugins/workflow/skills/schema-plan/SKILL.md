---
name: schema-plan
description: Build a committed phased schema deploy plan from a destructive schema report, through clickable questions with zero further typing. Use when a deploy plan stops on destructive operations with no committed plan, or when the user types /schema-plan. Turns the report into a plan JSON (and, when needed, a tagged expand commit with a backfill) and opens the PR; the deploy itself runs from the repo's deploy tool.
---

# Schema plan wizard

**The operator kicks it off and clicks after that.**

- Every decision is an `AskUserQuestion`.
- Each one is self-contained in the message that asks it.
- Any link they might need goes in chat ABOVE the question.
- Assume they may be on a phone.

The output is what the phased engine already validates:

- one plan JSON in `plan folder`;
- and, only when the change needs an intermediate shape, one tagged
  expand commit.

The wizard invents no new format and no new gate. It fills the existing
contract.

## 0. Read the settings

Find the repo root with `git rev-parse --show-toplevel`. Every path
below is relative to it, and every command runs from it.

Read, in order (a later value wins):

1. `## Shared` and `## Schema plan` in `.claude/skill-settings.md`.
2. The same sections in `.claude/skill-settings.local.md` in the MAIN
   checkout: `(git rev-parse --path-format=absolute --git-common-dir)`
   with the trailing `/.git` removed. A gitignored file is not copied
   into worktrees.

A rule bullet under a key is followed as if written here.

| Key | Default | Required |
|---|---|---|
| `operator` | the user | no |
| `plan contract doc` | none | yes |
| `plan folder` | none | yes |
| `target environment` | none | yes |
| `target label` | none | no |
| `direct publish environments` | none | no |
| `direct publish command` | none | no |
| `report command` | none | yes |
| `expand ref command` | none | yes |
| `expand ref dry run flag` | `-WhatIf` | no |
| `expand ref keep worktree flag` | `-NoPush` | no |
| `engine command` | none | yes |
| `environments file` | none | no |
| `post-deployment script` | none | yes |
| `plan branch` | `<branch prefix><plan-name>-plan` | no |
| `merge command` | `gh pr merge <n> --squash` | no |
| `deploy tool` | none | yes (local) |

- A required key with no value: name the key and the file it belongs
  in (`skill-settings.md`, or `skill-settings.local.md` for a `(local)`
  key), then stop. Never guess a value.
- The full key notes are in the plugin's `templates/schema-plan.md`.

Read `plan contract doc` before authoring anything. It is the
plan-format contract and this skill defers to it.

## Step 1 - get the evidence

If a fresh report-only schema report for the pinned release is already
in this conversation, reuse it. Otherwise run `report command` with
`<ReleaseSha>` filled in.

- It is read-only.
- A phased plan exists to keep the `target environment` database intact
  across a rollout, so that is its only target.
- The engine refuses every other environment. Those in
  `direct publish environments` publish their schema directly, with
  `direct publish command`.
- If a deploy to one of those sent you here, it was wrong to. Say so
  and go back.

When `target label` is set, any destructive-publish click label carries
it (for example `on prod`). A guard may read the label against the
command's own environment and deny a mismatch.

## Step 2 - classify every operation, in chat

Render one table with EVERY operation and data issue from the report.
No question yet. This is the evidence everything below points back to.

| Report line | Class | Phase |
|---|---|---|
| `Create` (any object) | additive | Expand, automatic |
| `Alter` that only adds a nullable or defaulted column | compatible | Expand, via allowlist |
| `Alter`/`Refresh` of a proc, view or function whose OLD callers can still call it | compatible | Expand, via allowlist |
| `Alter` that changes a type, tightens nullability, renames, or breaks an old caller | incompatible | needs an intermediate shape |
| `Drop` of a proc, view, function or index | drop, no rows | Contract |
| `Drop` of a table or column | drop, DATA LOSS | Contract |
| Data issue (new NOT NULL column with no default, narrowing, etc.) | incompatible | needs an intermediate shape |

Two classes carry judgment: **compatible** and **incompatible**.

- The wizard proposes the class.
- The questions below are where the operator rules.

**An object in the database and not in the project** gets its own
sentence:

- it exists only in the target database;
- no diff ever showed it to a reviewer;
- the contract will destroy the only copy.

## Step 3 - pick the path

**Every plan gets an expand commit.**

- The engine's expand preflight reports WITH drops included.
- It refuses any non-Create operation the plan does not allowlist.
- A `DROP` can never be allowlisted.
- So an expand ref whose schema already removed the old objects can
  never publish.
- The expand ref must carry the OLD shapes and the new ones, side by
  side, exactly as `plan contract doc` says.

The two paths:

- **Path A - mechanical.** No incompatible items. The expand commit is
  the release plus the old shapes restored verbatim (Step 5). No design
  decisions, no questions.
- **Path B - intermediate shape needed.** At least one incompatible
  item. Each one gets a design decision (Step 4) on top of the same
  restore work.

Say which path applies and why, in two lines. This is a decision the
report already made, not a question.

## Step 4 - one question per incompatible item (Path B only)

Each item gets its own `AskUserQuestion`, recommended option first.

The message above the question shows:

- the exact report line;
- when a backfill is proposed, the full backfill SQL, formatted to be
  read (one clause per line).

For a **new NOT NULL column with no default** (the common case):

> **`OrderLines.WarehouseId` arrives NOT NULL with no default, so
> the ALTER fails on a table with rows. How should it land?**
> - `Add it nullable now, backfill, tighten at contract (Recommended)`
> - `Add it with a default value instead`
> - `Hold this change out of the release`

Other shapes:

- **Type change or rename:** offer the expand-side dual shape (old and
  new side by side), or holding it back.
- **Incompatible proc change:** offer keeping the old proc alive through
  expand, or holding back.

A backfill is proposed only when its source is derivable from the
schema (a joinable foreign key path, a constant). If it is not
derivable, say so and ask what fills it. That is product knowledge, not
a guess.

`Hold this change out of the release` means the wizard stops and
reports. Pulling one change back out of the base branch is release
surgery: the operator's call, never done silently.

## Step 5 - author the expand commit

**Path A is one command:** `expand ref command`.

- It restores every dropped object, commits, tags, pushes the tag, and
  removes its own worktree and branch.
- Pass the report lines VERBATIM: both the `DROP ...` operations and the
  data-issue sentences.
- It prints `expandSchemaRef`.
- Run it with `expand ref dry run flag` first. That shows which file
  each object resolves to and which commit removed it. It costs nothing
  and creates nothing.

It refuses rather than guessing, and each refusal names what to do:

- **A restore would drop lines the release added.** The release changed
  that file for more than this one object. Put the old object back into
  the current file by hand and leave the rest as the release has it.
- **An object has no `.sql` file anywhere.** That is the database-only
  class from Step 2. It has no commit to restore from. Script its DDL
  from the target database into a new file on the expand commit. Expand
  keeps carrying it; the contract is still what destroys it.

Two things the command does not do, both Path B, both on top of the
commit it built:

- Edit the table `.sql` to the intermediate shape decided in Step 4
  (nullable column, kept old object, dual shape).
- Add backfills to `post-deployment script`, IDEMPOTENT: guarded so a
  re-publish is a no-op (`WHERE <col> IS NULL`, `IF NOT EXISTS`). That
  script runs on EVERY publish, so an unguarded statement is a bug.

For Path B, run the command with `expand ref keep worktree flag`.

- It keeps its worktree and branch, so there is a checkout to add the
  intermediate shape and the backfill to.
- It prints the exact commands to commit there, move the tag, push it
  and clean up.

**The tag sha is `expandSchemaRef`.**

- Once the scratch branch is gone, the commit is on no branch.
- Git's tag auto-following then has nothing to hang it on, so a plain
  `git fetch` will not bring it down.
- Any tree that must resolve this ref needs `git fetch --tags` first.

**The expand commit is a deploy artifact, not review work.**

- It is NEVER merged.
- The base branch already carries the final shape. Merging the expand
  shape would walk the schema backward.

**It is anchored by a TAG, never by a leftover branch.**

- The engine never reads a branch. The plan stores a raw sha, resolved
  as a commit, and the contract check REJECTS a ref that names a
  branch.
- The ref-holder's only job is keeping the commit reachable so git
  cannot garbage-collect it.
- A tag does that without a phantom branch that every future branch
  cleanup must re-prove and re-report.

**The tag is deleted once the contract phase has completed** in the
target environment, and not before.

- Contract builds the schema from that sha to prove the database has
  not drifted since expand.
- Losing the commit blocks contract permanently.

It does not count against any one-open-branch rule: nothing about it is
ever up for review or merge. The plan branch in Step 7 is this
conversation's ONE review branch.

**Prove the shape before writing the plan.**

- Run the Step 1 report again with `<ReleaseSha>` set to the expand sha.
- Every operation must now classify as additive or
  allowlist-compatible.
- The exact `Alter` strings in that output are the
  `expandAllowedOperations` entries. Copy them VERBATIM, never retype
  them.

## Step 6 - write the plan

`<plan folder>/<plan-name>.json`, per `plan contract doc`:

- `name` - short kebab-case, matches the file name.
- `expandSchemaRef` - the expand tag's sha from Step 5.
- `applicationRef` - the pinned release sha.
- `contractSchemaRef` - the base branch.
  - The plan must exist AT its contract ref, and a sha from before the
    plan merged cannot contain it.
  - The contract re-reports before it applies, so anything that lands
    in between is shown to the operator before it runs.
- No application list.
  - A plan does not name apps, and the wizard does not ask which ones.
  - The contract waits for every application the target environment
    declares in `environments file`.
- `contractObjects` - the destroyed set, VERBATIM from the report.
- `expandAllowedOperations` - the verbatim `Alter` strings from the
  Step 5 expand-sha report. Both paths take them from there.

Write the plan on this conversation's review branch (`plan branch`), in
a worktree, and COMMIT it there first. The engine refuses an untracked
plan even in a dry run.

Then validate without publishing anything:

- Run `engine command` from the plan worktree, using that worktree's
  own copy of the engine, so every path and git check sees the
  committed plan.
- It must print the resolved refs and the contract objects.
- A throw here is a wizard bug to fix before asking anything else.
- One exception: an environment other than `target environment` throws
  by design. That means the command is wrong, not the plan.

## Step 7 - open the PR, then ask for the merge

One PR, on one branch (`plan branch`), carrying the plan JSON and
nothing else. The expand tag from Step 5 is already pushed and is NOT
part of this PR.

**Do not stop here.**

- Ending the turn on "merge it and the deploy picks up" is the wizard
  failing at its one job.
- A session idle on prose has no tap that resumes it.
- A merge in this path may be a human's call. Their CLICK is that call,
  the same evidence every other gate in this flow runs on.
- So the merge itself is the question.

Put the PR link in chat on its own line. Summarize what the plan does
in two or three bullets. Then ask:

> **The plan PR is ready. Merging it puts the plan on the base branch,
> where `deploy tool` picks it up.**
> - `Merge plan PR #<n>`
> - `Hold here`

The label carries the real PR number. The click authorizes THAT merge,
not "a" merge.

**On the merge click:**

- Run `merge command`. Do NOT add `--delete-branch`: the plan branch is
  checked out in a worktree, so the local delete predictably fails, and
  a failure after a merge that already landed must not stall the
  wrap-up.
- Then clean up as a non-fatal step: remove the plan worktree, delete
  the local and remote plan branches. If any of that fails, say so in
  one line and keep going.
- If the operator already merged the PR on GitHub, the state says so.
  Treat it as merged and continue; never re-ask.
- Then say the plan is committed and that the next plan run from
  `deploy tool` picks it up.

**On `Hold here`:** stop, with one line naming the tap they owe and that
`deploy tool` picks the plan up once merged.

## Rules

- **The wizard never ends a turn on prose.** Every turn ends in an
  `AskUserQuestion`, a completed merge, or a reported failure. If the
  next move is the operator's, the question IS the next move.
- One question at a time. Every question self-contained. Links above
  the question, never in labels.
- Report lines, destroyed objects, and allowlist entries are copied
  VERBATIM, never paraphrased or retyped.
- The wizard writes plan JSON, expand-commit schema files, and backfill
  scripts.
  - It never touches app code.
  - It never runs a publish except report-only or dry-run.
  - It never skips the database step of a deploy.
- If the report shows nothing destructive, say the plan is unnecessary
  (additive work publishes directly) and stop.
- If a step FAILS, stop and report it. Do not roll forward.
