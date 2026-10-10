---
name: shipit
description: Land the work this session did - record any one-time after-deploy steps in the PR body (when the repo uses that heading), merge its PR after one confirm, remove the local worktree and its branch, delete the remote branch, comment on the linked GitHub issue when it stays open, offer to file one batch issue for any leftover review nits, then ask whether to reassign the issue to its originator (the recommended default), close it, leave it open when it still lists unfinished follow-ups, or hand it to a teammate the settings name. Use when the user says /shipit, "ship it", "land this PR", or the work on an issue is reviewed and done.
---

# /shipit - land the PR this session built, then settle the issue

Called from the session that did the work.
It knows its own branch, its own PR, and the issue it was working from.
So it does NOT go hunting: it uses what the session already has, then VERIFIES that against `gh`.
If the session has no PR in hand, resolve one from the current branch.

## 0. Read the settings

Read `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`):

- the `## Shared` section, then the `## Shipit` section
- a value there overrides the default this skill states
- a rule there is followed as if written here
- no file, or no section: use the defaults below, and say ONCE, in one line, that `.claude/skill-settings.md` can tune this skill and the template is in the plugin's `templates/` folder
- a missing file never stops the skill

Values this skill uses, with their defaults:

| Key | From | Default |
|---|---|---|
| `repo` | Shared | `gh repo view --json nameWithOwner` |
| `base branch` | Shared | the repo's default branch |
| `worktree folder` | Shared | whatever `git worktree list` reports |
| `human merges` | Shared | ALL paths: nothing auto-ships; a person types `/shipit` |
| `posting rules` | Shared | none beyond this skill's own |
| `generated files` | Shared | none |
| `people` | Shared | none (they/them) |
| `merge method` | Shipit | the repo's default (step 4) |
| `required checks` | Shipit | every check on the head |
| `after deploy heading` | Shipit | none: step 2 is skipped |
| `after deploy trigger` | Shipit | none beyond the generic ones in step 2 |
| `deploy after merge` | Shipit | none: this skill never deploys |
| `handoff` | Shipit | none |
| `handoff label` | Shipit | none |
| `handoff comment` | Shipit | `Merged. Back to @{login}.` / `Merged. Over to @{login}.` |
| `close leaves labels` | Shipit | yes |
| `docs` | Shipit | none |

When the settings name docs (`docs:`), read them before step 1.

Below, `<repo>` is the `repo` value and `<root>` is the main checkout: the first entry of `git worktree list --porcelain`.

## The order

Things happen in this order, and the order matters:

1. resolve the PR and check the ground
2. record the PR's one-time after-deploy steps
3. confirm once
4. merge
5. remove the local worktree and its branch
6. delete the remote branch
7. comment on the linked issue
8. ask what to do with the issue, then do it
9. offer one batch issue for any leftover review nits
10. report
11. offer to archive this session

Worktree before remote is deliberate.
Deleting the remote branch first leaves a live worktree pointed at nothing.

**Usage**

    /shipit                # the PR for this session's branch
    /shipit 2479           # by number
    /shipit <url>          # by URL
    /shipit --dry-run      # show every step, change nothing
    /shipit --yes          # skip the confirm gate in step 3

**`--yes` typed by a person skips the confirm**, on any path. Typing it is the human's merge.

**The review loop may call this on its own** as `/shipit --yes`.
It does so only when CI is green and the review is clean with nothing open, nits included (`/pr-review`).
It never does so for a PR touching a `human merges` path.
If this skill finds it was started that way on such a PR anyway, step 3 runs.

`--keep-worktree` leaves the directory and its branch alone (step 6 only deletes the remote).
`--keep-issue` skips steps 7 and 8 entirely; the leftover-nits step (step 9) still runs.

## 1. Resolve, and check the ground

Resolve the PR.
Bare invocation: whatever PR this session has been working on.
Or `gh pr view --json ...` from the current branch when there is none.
Never take it from the host's PR binding (`get_status`, `list_sessions`
`prNumber`): it can be another session's PR. Use the worktree's branch:
`gh pr list --head <branch> --repo <repo> --state all --json number,state`,
preferring the OPEN entry, so a merged or closed PR still reaches the
hard stop below.

    gh pr view <n> --repo <repo> --json \
      number,title,state,isDraft,mergeable,mergeStateStatus,headRefName,\
      headRefOid,baseRefName,url,author,closingIssuesReferences,body,files

    gh pr checks <n> --repo <repo>

**Hard stops.** Report and stop; do not work around any of these:

| Condition | Why it stops |
|---|---|
| `state` is not `OPEN` | already merged or closed; say which |
| `isDraft` is true | a draft is still moving. When `open as draft` is `yes`, it never reviewed clean: point to `/pr-review`; marking it ready is the review loop's, not this skill's |
| `mergeable` is `CONFLICTING` | conflicts are the author's call, not this skill's |
| `mergeStateStatus` is `BLOCKED` | a required check or review gate is unmet |
| A required check is failing, still running, or missing on the head | merges wait for green; a red PR merges only by a human's own hand |

**Required checks.**
With no `required checks` setting, every check on the head is required.
A PR with no checks at all is not a stop; say "no checks" in the confirm gate.
With a `required checks` list, each named check must be present and passing.
Any **other failing check** is then not a stop, but it is named in the confirm gate.
Never merge past red checks silently.

**The linked issue** comes from `closingIssuesReferences`: that is what GitHub itself will act on.
If it is empty, scan the PR body for a bare `#NNNN` and treat that as a candidate, clearly marked as a guess.
No issue found at all means steps 7 and 8 do not run; say so and skip them.

**Human-merge paths.** Match the PR's `files` against `human merges`.
Any match on a run the review loop started (not a person) means step 3 runs, `--yes` or not.

Also count review threads nobody resolved:

    gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$pr){ reviewThreads(first:100){ nodes{ isResolved } } } } }' -f owner=<owner> -f repo=<name> -F pr=<n>

Not a stop.
A count in the confirm gate, so an unaddressed `/pr-review` finding does not get merged past without anyone noticing.

## 2. The one-time steps this PR leaves behind

Runs only when the settings name an `after deploy heading`.
With none, skip this step and say nothing about it.

A release tool may collect, from each shipped PR, the steps a deploy left for a human.
It collects only what sits under that exact heading in a PR body.
A step written anywhere else surfaces as a guess, or not at all.
This is the last moment the PR is open, so this is where the heading gets written.

Read the PR's changed files and its body (step 1 already has both).

A PR carries a one-time step when any of these hold:

- its body or comments name SQL to run by hand, a script to run once, or a repair to existing data
- it adds or removes a config setting or a secret that the deploy does not apply on its own
- its body says something must happen "after merge" or "after deploy" under any other heading ("Rollout", "Deploy note", "Not in this PR")
- it matches an `after deploy trigger` the settings list

Grade it once:

| Grade | Means | Action |
|---|---|---|
| **Recorded** | The body has the heading, and it covers every step found | Nothing to write |
| **Missing** | A step was found that the heading does not hold | Draft the section |
| **None** | No step found | Say so in one line |

**Drafting.** Each item names three things:

- **what**: the SQL or command, copied from the PR verbatim
- **where**: which environments need it
- **who**: the person who runs it

Name any one-time script by its path.
Keep the rest of the body as it is: add the section, or add the missing items to the existing one, and move nothing else.
Never write a closing keyword (`Closes #N`, `Fixes #N`, `Resolves #N`) into the body, not even negated.
Reference an issue as `#N` or `Refs #N`.

Show the drafted section in chat before step 3.
The **Merge it** click in step 3 is what writes it; nothing is written before that click.
`--yes` skips step 3, but not this: a **Missing** grade under `--yes` still asks once, with **AskUserQuestion**, before the section is written.

## 3. Confirm once

Show one block in chat, everything that is about to happen.
`--yes` skips this step, except on a run the review loop started for a `human merges` path (step 1).

    PR   #2479  worker: gate the schema-compatibility probe (#2475)
    into main, SQUASH
    checks  4 passing, 0 failing        review threads  2 (unresolved)

    deletes  worktree <path>
             local branch schema-probe-gate
             remote branch origin/schema-probe-gate

Every ship ends by offering to archive the session (step 11).
When the worktree is this session's own (step 5), the worktree line reads `worktree <path> - this session's own; archiving the session at the end removes it`.

    issue    #2475 (OPEN)  - "Closes" link, so the merge CLOSES it
             no comment when the merge closes it, and you pick what
             happens next

    after deploy  2 steps, MISSING - the drafted section above is
                  added to the PR body before the merge
                  (or: 1 step, recorded / none found)

The issue line must state plainly whether the merge will auto-close it.
That is the single most surprising thing this skill does, and it decides whether step 7 runs at all.

The after-deploy line shows only when step 2 ran.

Then confirm with **AskUserQuestion**, exactly two options, no others:

- **Merge it** - proceed to step 4
- **Stop** - end here; change nothing, report what was left undone

Any answer but "Merge it" ends the skill.
Never proceed on silence.

**The confirm is an AskUserQuestion, not a chat prompt.**
Two options, answered in one click, with no room for a "go" that meant something else.
A merge deserves one.

## 4. Merge

**Missing after-deploy steps go in first.**
Write the full new body to the scratchpad with the **Write tool**, then:

    gh pr edit <n> --repo <repo> --body-file <scratchpad>/pr-<n>-body.md

Read it back and check the heading is there before merging.
Editing the body does not move the head commit, so `--match-head-commit` below still holds.

**The merge method.**
A `merge method` setting (squash, merge or rebase) wins.
With none, use the repo's default:

    gh repo view <repo> --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed

- exactly one allowed: use it
- more than one allowed: ask once with **AskUserQuestion**, one option per allowed method, before step 3 (under `--yes` too); show the pick in the confirm block

Then:

    gh pr merge <n> --repo <repo> --<method> \
      --match-head-commit <headRefOid from step 1>

**`--match-head-commit` is not optional.**
It pins the merge to the exact SHA the confirm gate described.
A push that lands between step 1 and here makes the merge FAIL rather than quietly shipping commits nobody looked at.
On a mismatch, start over from step 1: the new head has not been through the gate.
`/pr-review` carries the same guard for the same reason.

Do not pass `--delete-branch`.
It tries to delete the LOCAL branch too, which fails while a worktree still holds it.
It may also check out a different branch under the session.
Both deletions are handled below, in the right order.

If `gh` refuses without a commit subject, pass `--subject "<PR title> (#<n>)"` verbatim: the title stands as its author wrote it.

Verify before continuing, because merging is not proof of merging:

    gh pr view <n> --repo <repo> --json state,mergedAt,mergeCommit

`state` must read `MERGED`.
Anything else and the rest of this skill does not run: a branch deleted after a failed merge loses the work.

**Deploy.** This skill never deploys on its own.
If the settings name a `deploy after merge` step, show it and ask with **AskUserQuestion** (**Run it** / **Skip**) before running it.
A tool it names that is not on this machine is skipped, with one line saying so.

## 5. Worktree and local branch

**Resolve the directory from the branch, never from the name.**
The directory and the branch routinely differ: a folder named `toast-channels` can hold `fix/toast-errormessages`.

    git -C <root> worktree list --porcelain

No worktree holds the branch: delete the local branch if it exists (`git -C <root> branch -D <branch>`), then go to step 6.

**Is it this session's own worktree?**
Compare the worktree's path with this session's own working directory (the folder the session was started in, not wherever a `cd` last went).
Same folder, or the worktree sits above it: it is the session's own.
Never run `worktree remove` on it.

Why:

- the session holds that folder open, so Windows deletes every file in it and then fails on the folder
- any guards that read their rules from inside it then refuse every shell call and every write
- the session cannot leave first: the shell tool puts its working directory back on every call, and the app may refuse to move a worktree session's folder

What works is archiving the session (step 11).
The app stops the session, which lets go of the folder, and then takes the worktree back itself.
So for the session's own worktree, this step only clears the branch:

1. The dirty check below, unchanged. Dirty means the worktree stays and step 11 does not run.
2. Clean: discard any `generated files`, detach the worktree from its branch, then delete the branch:

        git -C <worktree> checkout -- <generated files> \
          ; git -C <worktree> switch --detach \
          && git -C <root> branch -D <branch>

   Drop the `checkout` link when there was nothing to discard.
   The folder keeps its files on the merged commit until step 11.

Then go to step 6.
Any other worktree is not held by this session, so remove it as below.

**Dirty check**, and it is a stop, not a prompt:

    git -C <worktree> status --porcelain
    git -C <worktree> stash list

Files the settings list as `generated files` never block.
Filter them out, then say in the report that they were discarded.
Anything else remaining, or any stash, means **the worktree stays**.
Name what is dirty, finish the remaining steps, and report it.
Uncommitted work is never deleted to complete a cleanup.

Clean, so remove it as ONE chained command:

    git -C <worktree> checkout -- <generated files> \
      ; git -C <root> worktree remove <worktree> \
      && git -C <root> branch -D <branch>

- the `checkout` link covers only the filtered generated files; drop it when there was nothing to discard
- chained with `&&` on purpose: if `worktree remove` fails, the branch survives. Never delete a branch out from under a live worktree.
- `-D` not `-d`: a squash or rebase merge fails `-d` by design, and `-D` is safe here only because step 4 verified `MERGED`
- `worktree remove` takes no `--force`. A failure is a report, not a retry.

**Then prove the directory is gone.**
`worktree remove` deletes the contents and the bookkeeping.
But on Windows the final `rmdir` fails whenever anything holds a handle on the folder, and git does not report it.
The empty shell stays behind, and they accumulate:

    test -d <worktree> && find <worktree> -type f | head -1

- prints nothing and the folder is still there: an empty husk, so `rm -rf` it
- prints a file path: STOP. Removal was partial. Name what survived and leave the folder alone.
- folder already gone: nothing to do

Only an empty husk is safe to delete, and only because `worktree remove` already proved the tree was clean.
Never widen this to a folder that still holds files.

## 6. Delete the remote branch

    git -C <root> push origin --delete <branch>
    git -C <root> fetch --prune

Do this even when the repo deletes branches on merge.
Already gone is a success, not a failure: GitHub, or someone in its UI, deleted it.

## 7. Comment on the issue

Only when step 1 found one, and only when the issue will stay open.
A closing issue gets no comment: the PR on its timeline is the record.
Skip this step when the merge already closed it through a closing link, or when step 8 will end in **Close it**.
Run step 8's question first if that is not yet settled.

Short, factual, and it is the record someone reads six months from now:

    gh issue comment <issue> --repo <repo> --body-file <scratchpad>/issue-<issue>-comment.md

Shape:

    Shipped in #2479, squash-merged to main as `a1b2c3d`.

    <one or two lines on what actually landed, in product terms>

    Branch `schema-probe-gate` is deleted.

Rules for the body:

- No restating the diff. The PR link carries that.
- No closing keyword, not even negated.
- Every rule in `posting rules`.

If the issue is a guess from a bare `#NNNN` rather than a real closing link, say that in the comment: `Linked by mention, not by a closing keyword.`

## 8. Ask what happens to the issue

Re-read state and the body first.
The merge may already have moved it, and the body is where leftover work is written down:

    gh issue view <issue> --repo <repo> --json state,author,assignees,labels,body

Show that state and the originator's `author.login` in the question.
"Already closed by the merge" changes which answer makes sense.
The originator is the issue author returned by GitHub.
It is never the PR author, the current assignee, or a hard-coded account.
If GitHub returns no author login, report that the originator handoff is unavailable and do not substitute someone else.

**The options.** `AskUserQuestion`, the first option first and marked **(Recommended)** every time:

- **Reassign to originator (Recommended)** - return it to the GitHub user who opened the issue
- **Close it** - the work is done and nobody needs to verify it
- one option per `handoff` line in the settings: **Give it to <label> (<login>)**

AskUserQuestion holds at most four options, so at most two `handoff` lines are offered.
With no `handoff` lines, the question has two options.

### When the issue still lists follow-ups

An issue whose body still names work this PR did not do is not finished, and closing it buries the rest.
Read the body for **unfinished follow-up items**:

- unchecked task-list boxes (`- [ ]`) that the merged PR did not do, or
- a section that names remaining work in so many words: "follow-up", "phase 2", "remaining", "still to do", "out of scope for this PR"

A checked box, a line the merge completed, and a nit already headed for the step-9 batch issue are all finished.
Judge against what actually landed, not against the wording.

If any survive, the option set changes:
**Leave it open** takes the recommended slot and **Close it** drops out.

- **Leave it open (Recommended)** - follow-ups remain; the issue stays open and assigned where it is
- **Reassign to originator**
- the `handoff` options, as above

Quote the surviving items in the question, verbatim and one per line.
The choice is made against the actual text, not a count.

The user can still close it through **Other**.
That is their call, not a default.

#### Leave it open

Nothing to run, with one exception.
If the merge auto-closed the issue, reopen it, because the follow-ups are the reason it stays open:

    gh issue reopen <issue> --repo <repo>

Assignees and labels are untouched.
Add nothing else: the step-7 comment is already on the timeline, and the follow-ups are already in the body.
Report it as `left open - <n> follow-up(s) remain`.

### Close it

    gh issue close <issue> --repo <repo>

Already closed by the merge: nothing to run. Say so; do not re-close.

Do not touch assignees or labels (`close leaves labels`), unless the settings say otherwise.
Add no comment, here or in step 7: a closed issue is done.

The question above is the whole authorization, so run this only on an explicit **Close it**.
Never close on silence, and never on an answer to a different question.
A merge is never the way an issue gets closed by this skill; this step is.

### Reassign it - originator or a handoff

**Reopen first if the merge closed it.**
A closing link fires on merge and takes the issue out from under the reassignment.
This is the step that trips:

    gh issue reopen <issue> --repo <repo>

Then reassign, adding the `handoff label` when the settings name one, in one call:

    gh issue edit <issue> --repo <repo> \
      --add-label "<handoff label>" \
      --add-assignee <author.login | handoff login> \
      --remove-assignee <every current assignee>

- Drop `--add-label` when there is no `handoff label`.
- **Reassign means replace.** Remove the existing assignees so the issue sits in exactly one person's queue. Report who was removed.
- For **Reassign to originator**, use the `author.login` read before the question. Do not rely on a remembered login.
- Add a second short comment naming the destination, so the timeline shows it, from `handoff comment`. Default: `Merged. Back to @<author.login>.` for the originator, `Merged. Over to @<login>.` for a handoff.

Read it back. Posting is not proof it landed:

    gh issue view <issue> --repo <repo> --json state,assignees,labels

## 9. Leftover nits - the batch issue

Nits never gate the review loop, so merging past them is routine.
This step keeps them from vanishing with the PR.
They get ONE batch issue, filed with the user's approval, or one line each in the report.

List the PR's unresolved review threads:

    gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$pr){ reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ path line body url } } } } } } }' -f owner=<owner> -f repo=<name> -F pr=<n>

Keep the `isResolved: false` ones; over 100 threads, page with `after`.
When the review loop released `verdict=clean` before the merge, nothing gating is open.
What remains unresolved is the leftover nits, plus any finding the user ruled could stand, which is worth the record too.

Threads are not the only place a nit hides.
The reviewer sometimes lists a nit only in its review-body prose, with no inline comment or thread.
Pull the latest review body and fold in anything nit-severity from there too:

    gh api repos/<repo>/pulls/<n>/reviews

Take the review with the highest `id` whose body contains `sha=` (the reviewer's `pr-review sha=<sha> round=<n> verdict=<clean|blocked>` marker).
Read its `body` for nit-severity findings called out in the text: not the summary line, the actual per-finding prose.
Each one becomes a line in the same draft, same format as a thread-sourced nit.
It has no thread URL, so link the review itself via its `html_url`.

**None from either source: skip this step.**
One line in the report and move on.

Otherwise draft ONE issue, never one per nit, threads and review-body nits together:

    Title: Nits from PR #2479: worker: gate the schema-compatibility probe
    Body:  - `path:line` - <the finding, first sentence> ([thread](<url>))
           ...one line per nit...

           From the review loop on PR #2479, filed at merge.

Body rules are the step-7 comment rules.
Show the draft in chat, then ask whether to file it.

**Filing needs a yes.**
Draft in chat, ask, then create.
The user says file it, or says skip.
A skip is final for this merge: no re-ask, no parking the draft anywhere.

On a yes, write the body to the scratchpad with the **Write tool** (some shells prepend a byte-order mark when they write a file), then:

    gh issue create --repo <repo> \
      --title "Nits from PR #<n>: <PR title>" \
      --body-file <scratchpad>/nits-<n>.md

Read it back and put the URL in the report:

    gh issue view <new-number> --repo <repo> --json number,url,title

## 10. Report

One block, one line per step, each with its verified result:

    after deploy  2 steps written to the PR body under the heading
                  (or: 1 step, already recorded / none found)
    merged      #2479 -> main, squash a1b2c3d
    worktree    removed <path> (discarded <generated files>)
    local       branch schema-probe-gate deleted
    remote      origin/schema-probe-gate deleted
    issue       #2475 commented, reopened, <handoff label>,
                assigned <login> (removed <old login>)
                (or: #2475 commented, left open - 2 follow-ups remain)
                (or: #2475 closed, no comment)
    nits        3 filed as #2531 <url>   (or: 3 skipped, still in their
                threads / none found)

Drop the after-deploy line when step 2 did not run.

Then, and only then, anything that needs the user, one line each:

- a worktree left in place because it was dirty
- a step that failed
- unresolved review threads that went in with the merge

No parking file, and no follow-up issue beyond the nits issue the user approved in step 9.
Say it, then go to step 11.

When the worktree is this session's own, the worktree line reads `worktree <path> - this session's own; branch detached, removed when the session is archived`.

`--dry-run` prints this same block as the plan, prefixed `WOULD`, and runs nothing past step 1.

## 11. Archive this session

Runs after every ship, `--yes` included, whether or not the session sits in the worktree it shipped.
A session started in the main checkout that built its PR in a separate worktree is just as finished once step 5 removes that worktree.

Skips:

- step 5 found this session's own worktree dirty and left it in place: the skill ends at step 10
- this setup has no session-archive tool: the skill ends at step 10 with one line saying the session can be closed by hand

### 11a. What lives only in this conversation

Archiving ends the conversation, and anything learned only inside it is lost.
Before the archive question, look back over the whole session for findings that exist nowhere but in this conversation:
not in a commit, not in a PR or issue, not in a memory file, not in a repo doc.

Typical finds:

- a root cause worked out but never written down
- a trap in a script or tool
- a fact about the environment
- a ruling the user gave
- a defect spotted in passing

A failing test that the test results already record is never listed.

Print them as their own block, the LAST thing in chat before the question.
Never fold them into the ship summary or a sentence of prose.
The question box covers chat when it opens, so this block is not enough on its own: 11b repeats every item inside the question itself.

    ### Things known only in this conversation

    - **<short name>** - <what it is, in a plain sentence, enough to act
      on without the rest of the transcript>. Goes to: memory file
    - **<short name>** - <...>. Goes to: new issue (<repo doc path>)
    - **<short name>** - <...>. Goes to: new issue

One bullet per finding.
Each bullet stands alone: what was found, where (file, script, function), and why it matters.

There are only two homes: a memory file (when this setup keeps one), or a new issue.
The merge in step 4 left this session no branch, so a fix to a repo doc is not written here: it becomes an issue that names the doc.

When there are none, the block is the header and `- none`.
Never skip the block, `--yes` included.

### 11b. Ask

Ask with **AskUserQuestion**, every time, `--yes` included.
It is never automatic.

**The question carries the items, never a pointer to them.**
The user decides from the box alone, without scrolling:

- The `question` text names every item from 11a, numbered, each with its short name and its home. Example: `Before archiving, 2 things live only here: (1) Reviewer cannot run mod tests -> new issue; (2) Login cannot see procs -> memory file. What next?` With none, it reads `Nothing lives only in this conversation. What next?`
- The **Save them first** option sets `preview` to the full 11a block, every bullet, so focusing the option shows what gets saved.
- No text in the question or its options says "listed above", "the items above" or a bare count. Each of those points somewhere the user cannot see.

The options:

- **Save them first** - shown only when 11a listed something; its description names each item's home ("File 2 issues, write 1 memory file"). Write each one to its home (a memory file follows that memory store's own rules; an issue is filed in `<repo>`), then ask this question again without this option.
- **Archive this session** - the app stops the session, and removes its worktree when it has one; the conversation ends
- **Keep it open** - nothing more happens

On **Archive this session**, call the archive tool with session `"self"` and reason `PR #<n> merged`.
It must be the last call of the skill: nothing after it runs.
If the app refuses (the session is still busy, pinned, or open on screen), say in one line that it can be archived from the sidebar, and stop.

On **Keep it open**, say in one line that the session stays until it is archived from the sidebar (and, when it is the session's own, so does the worktree), and stop.
