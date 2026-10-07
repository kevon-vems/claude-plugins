---
name: branch-cleanup
description: Enumerate every branch, worktree and leftover worktree folder in the repo, prove which are merged (including squash-merges), and delete the confirmed-safe ones locally and on the remote in one pass, after one confirmation. Use when the user asks to clean up branches, prune worktrees, or says "branch cleanup time".
---

# /branch-cleanup - prove merged, confirm once, delete both sides

Branch sprawl is mostly LOCAL: leftovers from past sessions, many with no
remote counterpart, several holding a worktree. PRs often get
squash-merged, so `git branch --merged` alone reports most of them as
unmerged. The merge test below is the whole point of this skill - do not
shortcut it.

**Nothing is deleted without the user's confirmation in step 7.**

## Settings

Read `## Shared` and `## Branch cleanup` in `.claude/skill-settings.md`
at the repo root (`git rev-parse --show-toplevel`). A value there
overrides the default below. A rule there is followed as if written here.

No file, or no section: use the defaults. Say once, in one line, that
`.claude/skill-settings.md` can tune it and the template is in the
plugin's `templates/` folder. Never stop because the file is missing.

| Key | Where | Default |
|---|---|---|
| `repo` | Shared | `gh repo view` |
| `base branch` | Shared | the repo's default branch |
| `branch prefix` | Shared | `claude/` |
| `worktree folder` | Shared | not set: only what `git worktree list` reports |
| `generated files` | Shared | none: every dirty file blocks |
| `repos` | Branch cleanup | this checkout only |

Below, `<base>` is the `base branch` and `<root>` is the repo root.

## Repos

Walk every checkout the `repos` setting lists. Default: this checkout
only.

## Step 0 - run from the main checkout

Before anything else, confirm the session is NOT inside a session
worktree:

    git rev-parse --show-toplevel
    git branch --show-current
    git worktree list

The main checkout is the first entry `git worktree list` prints. If the
toplevel is anything else, or the current branch starts with the
`branch prefix` (a session branch), **stop and say so**. A run from
inside a worktree cannot clean up the branch it is standing on, and that
branch is exactly the kind this skill exists to remove.

Do not `cd` out and carry on: the Bash tool puts its working directory
back to the session folder on every call. Removing the folder a session
runs in deletes its files, fails on the folder itself, and leaves that
session refusing every shell call and write. Run the cleanup from a
session started in the main checkout instead. A session's own worktree
goes when the session is archived: the app removes it.

## Step 1 - gather

Per repo:

    git fetch --prune --quiet
    git branch --format='%(refname:short) %(upstream:short)'
    git branch -r
    git worktree list --porcelain

Fetch with `--prune` first: a remote branch deleted on GitHub should not
show up as a live candidate.

## Step 2 - filter to candidates

**Every branch is a candidate.** What disqualifies a branch is failing
the step-3 merge test, not its name. Do not filter on the
`branch prefix`.

A name filter protects merged dead weight by accident.

The protect list is exactly two entries, and it is about ROLE, not
name shape:

- `<base>` - every repo
- **the branch this session is standing on**, from step 0

Nothing else is protected. A long-lived feature branch does not need a
name-based exemption: if it is unmerged, the merge test says so and it
lands in the UNMERGED block on its own.

Then drop any candidate whose PR is OPEN or DRAFT:

    gh pr list --repo <repo> --state all --head <branch> --json number,state,url,title

Open/draft PR moves the branch to report-only with its PR link. Merge
state is irrelevant when a PR is still open.

## Step 3 - the merge test

Run in this order, stop at the first hit. Record WHICH test proved it -
that string goes in the table.

**1. Ancestor.** Cheapest, catches fast-forward and true merges.

    git branch --merged origin/<base>

**2. Patch-id.** Catches rebase and cherry-pick.

    git cherry origin/<base> <branch>

Every line prefixed `-` means every commit already exists in `<base>`
under a different sha. A single `+` line means it does not.

**3. Squash.** Catches the normal squash-merge PR path. `git cherry`
alone will NOT catch a multi-commit squash - the squashed patch has a
different patch-id from any individual commit. Synthesize the equivalent
commit and test that:

    mb=$(git merge-base origin/<base> <branch>)
    tree=$(git rev-parse '<branch>^{tree}')
    synth=$(git commit-tree "$tree" -p "$mb" -m squash-probe)
    git cherry origin/<base> "$synth"

A `-` prefix means the branch's final tree already landed in `<base>`.
That is a squash-merge.

**4. PR state.** `gh` reports the PR as MERGED. Accept as proof even when
tests 1-3 miss (branch was reworked after the merge landed, etc.), but
note in the table that the tip may carry post-merge commits - check
`git log origin/<base>..<branch> --oneline` and report the count.

None of the four hit: **UNMERGED**. Report-only. Never a candidate. Show
its ahead-count and last-commit date so the user can see how stale it is.

## Step 4 - worktree and dirty state

For each candidate holding a worktree:

    git -C <worktree> status --porcelain
    git -C <worktree> stash list

**Files the `generated files` setting lists are never a blocker.** They
are build output, regenerated from source, and a diff there carries no
work. Filter exactly those paths out of the dirty check before judging.
With nothing set, nothing is filtered: every dirty file counts.

Anything remaining - modified source, untracked files, stashes =>
**BLOCKED**. Show what is dirty inline, in the row:
`BLOCKED - 3 modified, 1 untracked`. The user judges from the table
without running a second command. A blocked row is never offered for
deletion in that run.

When the ONLY dirty paths were filtered generated files, the row is a
normal candidate. Note it in the row so the discard is visible, not
silent: `worktree + local (discards regenerated <file>)`.

## Step 5 - orphaned worktrees

Separate section, separate table. Detached-HEAD worktrees have no
branch, so the branch tests do not apply. For each, report the commit,
its subject, and whether it is reachable from `origin/<base>`:

    git merge-base --is-ancestor <sha> origin/<base>

Reachable + clean => offer for removal in the same confirm pass.
Not reachable => report the sha and warn that removing it orphans those
commits.

Worktrees whose directory is already gone: report the count and offer
`git worktree prune`. Do not run it unprompted.

**A worktree a guard will not let you inspect** (a hook blocks commands
naming its path, `git status` included): report it with what is
knowable from the parent repo (`git worktree list`,
`git merge-base --is-ancestor`), state that the dirty check could not
run, and ask with AskUserQuestion (naming the exact path) rather than
retrying.

## Step 5b - leftover folders

Only when the `worktree folder` setting is set. Not set: skip this step
and say so in one line.

The worktree folder collects folders git no longer knows about: a
removal that failed on a locked handle, a session that died mid-setup,
a stray copy. `git worktree list` cannot see them, so check the disk.

List every direct child of the worktree folder and drop the ones
`git worktree list` registers. For each one left over:

    find <path> ! -type d | head -1

- **Nothing printed** => an empty folder (empty subfolders at most).
  Candidate row, proved by `empty folder`, deletes `empty folder`.
- **Anything printed** => report-only, never a row. Show the file count
  and the top two folder levels it holds so the user can see what it
  is. It may be a partial removal holding unsaved work, or another
  repo's checkout parked there. Deleting it is the user's call, by hand.

## Step 6 - the table

One table, all repos, numbered continuously so the user can answer with
numbers.

| # | repo | branch | proved by | worktree | deletes |
|---|---|---|---|---|---|

- **proved by**: `ancestor` / `patch-id` / `squash` / `PR #123 MERGED`
- **worktree**: the path, or `--`
- **deletes**: exactly what the action removes, spelled out -
  `local + remote`, `local only`, `remote only`, `worktree + local`,
  `worktree + local + remote`, `empty folder`

Below the table: BLOCKED rows, UNMERGED rows, and the report-only list,
each in its own short block. Never mix them into the candidate table -
the numbered rows must be safe to pick blind.

## Step 7 - confirm once

Ask for the numbers. Accept `1,3,5`, ranges, `all`, or `none`. One
confirmation covers local, worktree, and remote for the selected rows,
because the `deletes` column already stated what each row does.

Do not proceed on silence and do not infer a greenlight from an unrelated
message.

## Step 8 - execute

Per selected row, as ONE chained command. Chain it with `&&` - do not
emit these as separate lines and do not run the row under `set +e`. The
ordering rule below is only real if the shell enforces it:

    git checkout -- <generated paths> \
      && git worktree remove <path> \
      && git branch -D <branch> \
      && git push origin --delete <branch>

- `checkout` covers ONLY the step-4 filtered generated files, so removal
  is clean; drop that link when the row filtered none
- `worktree remove` takes no `--force`; a failure is a report, not a retry
- `-D` not `-d`: a squash-merge fails `-d` by design
- the final `push --delete` runs only when the row said remote; drop that
  link from the chain otherwise

`-D` is safe here ONLY because step 3 proved the content landed. Never
reach for `-D` on a row the merge test did not clear.

If `git worktree remove` fails, the chain stops there by construction and
the branch survives - which is the point. Never delete a branch out from
under a live worktree. Report the failure and move to the next row.

**A row that removed cleanly still needs its directory checked.** On
Windows `worktree remove` deletes the contents and the bookkeeping, then
the final `rmdir` fails if anything holds a handle on the folder, and git
does not report it. Per removed row:

    test -d <path> && find <path> -type f | head -1

Nothing printed with the folder still there is an empty husk, so `rm -rf`
it. A file path printed means removal was partial: leave the folder alone
and report it. Only an empty husk is safe to delete, and only because
`worktree remove` already proved the tree was clean.

**An `empty folder` row (step 5b)** re-checks right before it deletes,
because another session may have started using the folder since:

    test -z "$(find <path> ! -type d | head -1)" && rm -rf <path>

**This has gone wrong in practice:** the commands were run as an
unchained sequence under `set +e`, `worktree remove` failed on a locked
directory, and the branch was deleted anyway. It was recoverable only
because the branch was provably merged. Chain the row.

**When the permission classifier blocks a row**, retry it ONCE, then
stop. It can be nondeterministic: identical `git branch -D` calls have
passed and then been blocked, a verbatim retry included. Repeated
retries are noise. Collect the remaining rows into a single chained
command, print it in one `bash` block for the user to run, and report
which rows landed.

Report results as a short list: what was deleted, what failed and why.
Re-run `git worktree list`, `git branch -a` and, when the
`worktree folder` is set, `ls <worktree folder>` at the end and show the
resulting state so the user sees the outcome, not a claim about it.
