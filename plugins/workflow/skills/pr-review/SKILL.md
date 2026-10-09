---
name: pr-review
description: THE PR review skill. Default drives the review loop on one PR - spawn the pr-reviewer agent, fix or reply to findings, re-review - until the verdict is clean or the round cap, then, once CI is green and nothing is open (nits included), ships or asks to ship as the repo's settings allow. Can start by itself the moment a session opens a PR. Bare invocation targets the PR this session is working; a number/URL targets that PR (also how the user restarts a stalled cycle after ruling). "/pr-review all" sweeps every open PR with one posted review round each. Use for any "review this PR", "run the review loop", or catch-up sweep ask.
---

# /pr-review - THE PR review skill

The built-in `/review` prints to chat and the findings evaporate. This
one posts - one review object per PR, inline comments anchored to
lines - and by default it DRIVES THE LOOP: review, fix-or-reply,
re-review, until the verdict is clean or the round cap.

## Settings

Start by reading `.claude/skill-settings.md` at the repo root
(`git rev-parse --show-toplevel`): the `## Shared` section and the
`## PR review` section.

- A value there overrides the default named in this file.
- A rule there is followed as if written here.
- No file, or no section: use the defaults below, and say ONCE, in one
  line, that `.claude/skill-settings.md` can tune this skill and the
  template is in this plugin's `templates/` folder. Never stop because
  the file is missing.

Keys this skill reads, with defaults:

| Key | Section | Default |
|---|---|---|
| `repo` | Shared | `gh repo view` |
| `base branch` | Shared | the repo's default branch |
| `worktree folder` | Shared | whatever `git worktree list` reports |
| `human merges` | Shared | ALL paths |
| `review gated` | Shared | every PR |
| `posting rules` | Shared | none |
| `start on PR open` | PR review | `yes` |
| `open as draft` | PR review | `no` |
| `round cap` | PR review | `3` |
| `cap reset` | PR review | none extra |
| `merge guard` | PR review | `none` |
| `auto-ship` | PR review | `none` (ask) |
| `nits` | PR review | `ask` |
| `prose can gate` | PR review | `no` |
| `body-only paths` | PR review | none |
| `reviewer model` / `low-risk model` | PR review | the agent's own |
| `convention docs` | PR review | `CLAUDE.md`, `AGENTS.md` |
| `doc drift tool` / `doc drift docs` | PR review | none (skip) |
| `test run` | PR review | none |
| `review rule` | PR review | none |

**The repo** is the Shared `repo` value. Bare invocation targets it
regardless of the working directory. `--repo <owner>/<name>` overrides.
Never re-derive the owner from the `gh auth` account.

**Usage**

    /pr-review                  # LOOP on the PR this session is working
    /pr-review 2451             # loop on one PR by number
    /pr-review <url>            # loop on one PR by URL
    /pr-review 2451 --fix-nits  # loop, and fix every nit without asking
    /pr-review all              # SWEEP: one posted review round per open PR
    /pr-review all --dry-run    # build every review, show them, post nothing

Flags (loop): `--fix-nits` forces nit fixing for that PR - both nit
questions below are answered **Fix** without being asked. The user
saying "fix the nits" anywhere in the session does the same, and so
does `nits: fix` in the settings. `nits: leave` answers both
questions **Leave**.
Flags (sweep): `--drafts` includes draft PRs (always on when `open as draft` is `yes`), `--dry-run` posts
nothing. `--repo` retargets either mode.

## The loop (default)

The dev-side half of the review loop, runnable from ANY session. The
usual callers: the session that just opened the PR, and the user
restarting a stalled cycle after ruling on its threads.

**Resolve the PR.** A number or URL names it. Bare invocation targets
the PR of the branch this session did write-work in; no PR in the
session's context is a hard stop - ask which PR, never create one.

**Find the checkout.** `git -C <root> worktree list`, match the PR's
`headRefName`. No local worktree for the branch -> create one with
`git worktree add` on the existing branch, inside the Shared
`worktree folder`. No `worktree folder` set -> ask the user where,
once.

**Read the user's rulings first.** Any PR-thread reply without the
`<!-- pr-review-agent -->` signature and without the marker is a human
RULING: apply it exactly - fix what it says to fix, drop what it says
to drop. Rulings are never re-litigated with the reviewer.

**It starts when the PR opens** (when `start on PR open` is `yes`).
The moment `gh pr create` returns, the session that opened it starts
this loop: if the host offers PR binding (a `get_status` / `bind_pr`
tool), bind the PR so CI is reported to the session, and spawn round 1
**in the background**. When `open as draft` is `no`, the review runs
while CI does. When it is `yes`, the PR was opened as a draft
(`gh pr create --draft`) and the repo's CI skips drafts, so the review
runs alone; see "Mark ready" below. No question first - opening the PR
is the go. Never poll CI in a loop; with
binding, the CI event is what wakes the session; without it, check
`gh pr checks <n>` once when the review returns.

**Count rounds yourself.** Keep a count of reviewer spawns for this PR
since the user's last input. The user's input is: a typed message, a
click on a question this skill asked, an unsigned human reply on the
PR, and anything listed under `cap reset`. Before each spawn, if the
count already equals `round cap`, do not spawn: go to **Stall**. Do
this even when `merge guard` names a guard; the guard is a second
check, not a replacement.

**Then repeat, until clean or `round cap` rounds without new input from the user:**

1. **Spawn the reviewer agent** (Agent tool, subagent_type
   `workflow:pr-reviewer`) with ONLY the PR number. No framing, no
   focus areas, no reassurances - the agent ignores steering by
   design, and the attempt itself is the anti-pattern. It runs steps 2
   through 8 below and posts the review. Model: when `low-risk model`
   is set and every changed line is a comment, whitespace, display
   text or a `low-risk also` kind, pass that model; else pass
   `reviewer model` when set; else name none.
2. **Verdict clean** -> the loop stops posting, but clean with nits
   open is NOT auto-done. Two cases:
   - **Zero nits open** (`pr-review-open` marker reads `0/0/0`) ->
     "Mark ready" below, then "Ship when both are green".
   - **Nits open** -> list them in chat, one line each, then ASK with
     `AskUserQuestion`, single-select, labels EXACTLY
     `Fix the nits -- PR #<n>` (recommended, first) and
     `Leave the nits -- PR #<n>`. If the user already answered the
     step 3 nit question for this PR, or a flag or `nits` setting
     answers it, do not ask: apply that answer (Fix the nits too ->
     **Fix** below; Leave the nits -> **Leave** below). Otherwise
     never assume the answer; never proceed past this question on
     your own.
     - **Leave** -> "Mark ready" below. No automatic ship. Report the
       review URL, say the PR is clean with nits left, and stop. `/shipit` is the user's
       to type.
     - **Fix** -> fix every open nit in the worktree, commit, push,
       go to 1. A click is the user's input: it resets the round cap,
       and the re-review round it costs is one they chose to spend.
   **No UNREQUESTED post-clean commits.** Each one moves the head off
   the clean review and costs a round - the ask above is the only door.
3. **Verdict blocked** -> blockers and should-fix are ALWAYS in scope.
   Never ask about them; start fixing. The only question is nits, and
   only when the `pr-review-open` marker shows at least one open nit:
   list them in chat, one line each, then ask with `AskUserQuestion`,
   single-select, labels EXACTLY `Fix the nits too -- PR #<n>`
   (recommended, first) and `Leave the nits -- PR #<n>`. Ask once per
   PR, not once per round; the pick holds for that PR for the rest of
   the session. Zero open nits, or a flag or `nits` setting that
   answers it -> no question at all.
   Then, for each gating finding still in scope, in the worktree:
   - **Fix it**, matching the surrounding code, or
   - **Reply in its thread** with why it stands, ending with
     `<!-- pr-review-agent -->` on its own line. Not optional: an
     unsigned reply reads as a human ruling and resets the round cap.
   **Reply, never resolve.** The dev side does not resolve threads -
   a coder-side reply is pushback awaiting a ruling, and the reviewer
   resolves the thread when it rules the finding settled (step 3).
   Nits follow the pick above: **Fix** -> fix every open nit alongside
   the gating ones; **Leave** -> they get one line in the chat report.
4. Commit and push the branch, then go to 1. The REVIEWER decides
   whether a fix or a reply resolves a finding - the author never
   grades its own fix.

**Reviewer post denied.** The reviewer's `notes` say a post was denied
by the auto-mode classifier (the safety check that approves or blocks
each action), most often as `Self-Approval` on a clean verdict. Nothing
reached GitHub, so:

- It is **not a round**. It does not count toward the stall cap, and
  its `verdict=blocked` is not a review result: there are no findings
  to fix.
- **Never post the review yourself**, and never re-word or re-route the
  post so the classifier misses it. That is grading your own work, and
  the denial forbids reaching the same outcome another way.
- Say so in chat in one line, then ask with `AskUserQuestion`,
  single-select, labels EXACTLY `Re-run the reviewer -- PR #<n>`
  (recommended, first) and `Stop the loop -- PR #<n>`. Never re-spawn
  without the user's click; the click is what authorizes the retry.
- **Re-run** -> go to 1. **Stop** -> report the PR as unreviewed and
  end.

**Stall.** `round cap` rounds since the user's last input without a
clean release on the current head: stop posting. The cap holds even if
the head carries unreviewed commits - they are named UNREVIEWED in the
summary, never given a bonus round. Closing summary in chat - one line
per unresolved gating finding, linking its thread, or the review
itself on a body-only PR (step 7) where no thread exists - and end.
The user rules by replying to either; their replies reset the cap, and
`/pr-review <n>` restarts the loop.

### Mark ready

Runs when `open as draft` is `yes`, the PR is still a draft, and the
latest review is `verdict=clean` on the current head with its nits
decided: none open, or the user answered **Leave** (a **Fix** pushes
again, so it waits for the re-review). Run `gh pr ready <n>`, then read
`isDraft` back. That event is what starts CI, once, on reviewed code.

- Never mark a draft ready for any other reason, CI included. A draft
  that never reviewed clean stays a draft.
- Not a push: it does not move the head or cost a round.
- Then CI is the other half: continue with "Ship when both are green"
  when nothing is open, or stop at the Leave report.

### Ship when both are green

Runs when the review is `verdict=clean` with `pr-review-open 0/0/0`
on the current head. CI is the other half; whichever lands last
triggers this.

- **CI still running** -> stop and wait for the CI event (or, without
  binding, say CI is still running and stop). When it arrives green,
  re-check the review is still on the head, then go on.
- **CI red** -> fix it like any other finding: in the worktree, commit,
  push, back to step 1. The push moved the head, so it needs a fresh
  review round.
- **Both green** -> by what the PR touches, first match wins:

| PR touches | Action |
|---|---|
| Any path in Shared `human merges` (default: every path) | **Stop.** Say "CI green, review clean, no nits -- ready for `/shipit`". A human merges it |
| Only paths `auto-ship` allows | Run `/shipit --yes` on its own. Its issue question at the end still asks |
| Anything else (`auto-ship: none`, the default) | Ask with `AskUserQuestion`, single-select, labels `Ship it -- PR #<n>` (first) and `Hold -- PR #<n>`. Ship -> `/shipit --yes`. Hold -> stop |

**Nits present means no ship.** Clean with a nit still open never
reaches this section - step 2 above handles it, and only a `0/0/0`
marker lets it through.

## 1. Build the queue (sweep - `/pr-review all`)

    gh pr list --repo <repo> --state open --limit 100 \
      --json number,title,headRefOid,author,isDraft,updatedAt

- **Drafts are excluded** unless `--drafts`, or `open as draft` is `yes`: then every PR is a draft until its review is clean, so a stalled one is only found by including them. Otherwise a draft is still moving.
- Order **oldest `updatedAt` first**. The stalest PR is the one nobody has
  looked at.
- If the list hits the 100 limit, **say so in chat**. Never truncate the
  queue silently.
- Empty queue: say so and stop.

Steps 2 through 8 below are the REVIEW PROCEDURE. In loop mode the
`workflow:pr-reviewer` agent executes them for its one PR; in sweep
mode this session and its fan-out agents do, as follows.

Print the queue before starting - one line each, number and title - so
what is about to happen is visible.

**One PR in the queue:** run steps 2 through 7 inline, in order.

**Two or more: fan out.** One `general-purpose` sub-agent per PR, all
launched **in parallel** - a single message carrying one Agent call per
PR, so they run concurrently. Each agent owns steps 2 through 5 for its
PR: resolve it, load prior rounds, read the diff and surrounding files,
produce findings. **An agent posts nothing.** It returns structured
data (shape in step 5a). Steps 6 and 7 - thread replies, payload,
post, verify - stay in the **main session**, run per PR as each
agent's result arrives, so the payload rules are enforced in one place
and nothing posts twice.

Each agent's prompt must carry: the repo, its PR number, the
`headRefOid` from the queue listing, the path to this SKILL.md (this
skill's base directory) so the review dimensions and the "never in a
review" rules travel with it, the `## Shared` and `## PR review`
settings text, and the return shape from step 5a.

An agent that dies or returns malformed data marks its PR `failed` in
the closing report. It does not abort the others.

## 2. Resolve the PR

    gh pr view <n> --repo <repo> --json number,title,headRefName,headRefOid,baseRefName,url,author,isDraft,state

Capture `headRefOid`. Every later step keys off that SHA, and step 6
re-reads it before anything is posted - see "Confirm the head has not
moved" for why that is not paranoia.

## 3. Prior rounds - skip, or re-review

Review, fix, re-review, fix is the normal shape. This step is what keeps
round 4 from being a wall of duplicates.

    gh api repos/{owner}/{repo}/pulls/{n}/reviews  --jq '.[] | select(.body | test("pr-review sha=")) | {id, body, submitted_at}'
    gh api repos/{owner}/{repo}/pulls/{n}/comments --jq '.[] | {id, path, line, body, position}'

Three outcomes:

- **Marker matches the CURRENT head SHA** -> **skip this PR.** Nothing has
  changed since it was reviewed. In a sweep, note it and move on.
- **No marker at all** -> first review. Skip to step 4.
- **Marker on an OLDER SHA only** -> **re-review.** Continue below.

### Re-review: carry the prior findings forward

Load every inline comment this skill previously posted. On a **body-only
PR** (step 7) there are none, so load the prior round's review BODY and
carry its findings forward the same way. For each one, decide against
the CURRENT code:

| Prior finding | Action |
|---|---|
| **Resolved** - the fix addresses it | Reply in its thread: one line confirming it is resolved. Then **resolve the thread** (mechanics below). Never re-post it. |
| **Still open** - code unchanged, or the fix does not cover the failure scenario | **Reply in the existing thread.** Say what is still wrong. Do NOT open a new comment on the same line. Leave the thread unresolved. |
| **Moot** - the code it pointed at is gone | **Resolve the thread**, no reply. Do not narrate deletions. |

**Re-grade prose on sight** (unless `prose can gate: yes`). A prior
finding posted at `blocking` or `should-fix` whose fix is prose
("Prose never gates", step 5) is carried forward as a **`nit`**,
whatever severity it was given last round. It stops counting toward
`verdict=blocked` immediately - say so in one line in its thread.
Rounds already spent on it are sunk; do not spend another.

A `position` of `null` on a prior comment means GitHub marked it outdated:
the line moved. That is a hint, not a verdict - read the current code
before calling it resolved.

**Thread replies are separate API calls.** A review's batched `comments`
array cannot carry `in_reply_to`, so replies go one at a time:

    gh api --method POST repos/{owner}/{repo}/pulls/{n}/comments/{comment_id}/replies -f body="..."

**Every thread reply ends with `<!-- pr-review-agent -->` on its own
line.** Invisible when rendered. This skill and the human owner usually
post on the same token, so the reviewer tells agent replies from human
rulings by this signature alone - an unsigned agent reply reads as a
human ruling.

**Resolving a thread is GraphQL-only.** No REST endpoint can do it,
which is why replied-to threads otherwise pile up unresolved on every
PR. Map comment ids to thread ids once per PR:

    gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$pr){ reviewThreads(first:100){ nodes{ id isResolved comments(first:1){ nodes{ databaseId } } } } } } }' -f owner={owner} -f repo={repo} -F pr=<n>

Each node's first-comment `databaseId` is the REST id of the thread's
root comment - key the map on that. Over 100 threads: page with
`after`. Then, for each thread judged resolved or moot (reply first
when one is due):

    gh api graphql -f query='mutation($t:ID!){ resolveReviewThread(input:{threadId:$t}){ thread{ isResolved } } }' -f t=<thread-id>

Never resolve a still-open finding's thread, and never resolve an
unfixed nit's - an unresolved thread is how the user sees what is left.

Post the replies first, then the new review in step 7. Only findings that
are genuinely **new this round** go in the batched review.

## 4. Read the change

    gh pr diff <n>                       # the diff under review
    gh pr view <n> --json files          # paths + additions/deletions
    gh pr view <n> --comments            # existing discussion, do not repeat it

Read whole files around any hunk you intend to comment on. A diff hunk is
not enough context to call a bug.

### Round 1 reads everything. Later rounds read the delta.

Round 1 is the thorough pass, and nothing below trims it.

On a **re-review**, the prior marker names the SHA that was already
reviewed, so read that delta rather than the whole PR again:

    git -C <root> diff <prior-marker-sha>..<headRefOid>

Re-reading a whole PR to grade a six-line fix is the single largest
avoidable cost in this loop - a round-2 pass on a small fix can cost as
much as round 1 did on the whole PR.

What a delta round must still cover, because the delta alone is not the
blast radius:

- Every file carrying an **open thread**, whether or not it changed. That
  is the finding you are ruling on.
- Every **caller of anything the delta changed the contract of** - a
  signature, a return shape, a path string, an exported name. A fix that
  breaks a call site outside the delta is exactly what a delta-only read
  misses.

**`clean` is a verdict that requires a full read.** Any other verdict may
come off the delta, but the round that ENDS the loop re-reads the whole
change first. That is the only moment where stopping early is permanent,
so it is the one place the saving is not worth taking.

### Getting those files - leave nothing behind

Two ways in, in this order. **Neither creates a branch, and neither
touches a working tree.** The user may have an IDE open on this repo;
anything left in `git branch` or checked out over their files is churn
they have to clean up by hand.

**1. The local checkout, when it is EXACTLY the head.**

    git -C <root> worktree list            # match the PR's headRefName
    git -C <that worktree> rev-parse HEAD  # must equal headRefOid

Equal -> read the files there. No fetch, no ref, nothing to clean up.
This is the normal loop-mode case: the session that wrote the code
still has the worktree.

**Not equal, or no worktree -> fall through.** Do not read it anyway. A
worktree can sit BEHIND the PR head (pushed from another machine) or
AHEAD of it (unpushed or uncommitted work). Reviewing it then grades
code that is not in the PR, and nothing in the output says so. That is
worse than a stray branch, because it is invisible.

**2. Otherwise, fetch the objects and read them by SHA.**

    git -C <root> fetch -q origin refs/pull/<n>/head
    git -C <root> show <headRefOid>:<path>

The sweep needs this: swept PRs often have head branches that never
existed on this machine.

**Never a destination refspec. Never FETCH_HEAD.**

- `refs/pull/<n>/head:pr-<n>` creates a local branch that outlives the
  review and shows up in the IDE's branch list. Omitting the `:pr-<n>`
  half is the entire fix - the ref count stays unchanged across the
  fetch.
- `FETCH_HEAD` is ONE file per repo, and this step runs in PARALLEL
  sub-agents against the same repo. An IDE's background fetch rewrites
  it unprompted too. `headRefOid` is the only stable handle; the
  fetched objects persist whether or not a ref points at them.

In a sweep this step runs inside the per-PR sub-agent (step 1 fan-out).
Reviewing many PRs inline burns the session's context on diffs it will
never need again - that is why the fan-out exists.

## 5. Review

Cover, in this order, only what the diff touches:

| Dimension | Looking for |
|---|---|
| **Correctness** | logic that produces a wrong result for a nameable input |
| **Silent failure** | swallowed exceptions, ignored return codes, empty catch |
| **Security** | injection, authz gaps, secrets, unvalidated input crossing a trust edge |
| **Contracts** | broken invariant, nullability, API shape change without callers updated |
| **Convention** | the repo's own rules - the docs `convention docs` names |
| **Comment rot** | a comment the diff just made false - **always `nit`** |
| **Doc drift** | a doc of a `doc drift docs` kind whose claim the diff just made false - **always `nit`** |

**Verify before posting.** A comment on a PR is public and permanent. Each
finding needs a concrete failure scenario - specific input or state, and
the wrong output it produces. Cannot name one? Drop it. "This looks
fragile" is not a finding.

**A fix that introduces a new bug is a new finding**, not a reply. Judge
round N's code on its own terms.

### Doc drift - gate on the tool BEFORE reading any doc

Help docs are the one dimension with a **mechanical precondition**. No
`doc drift tool` in the settings -> **this dimension is skipped**. With
one, run it first, from the repo root, with `<base>` set to the PR's
base, and let it decide whether this dimension applies at all.

Its output names the doc surfaces this diff changed the code behind
**and did not update**. Empty, or the command unavailable, means **this
dimension is done** - post nothing, read no docs. That gate is what makes
doc review affordable on every PR, so do not skip it and go browsing for
docs yourself.

For each surface it names:

- Read the doc and the code the diff actually changed.
- **Be conservative on materiality.** A control moved, restyled, or renamed
  cosmetically is NOT drift. A control removed or added, or a behavior
  change, IS. A doc that is merely older than its code is not evidence.
- The finding names the doc, quotes the claim that is now false, says what
  the code does instead, and gives the corrected wording.
- Severity is **`nit`**, always. Never `blocking`, never `should-fix` - a
  stale sentence does not stop a merge, and gating on one buys a whole
  extra review round to change a paragraph. See "Prose never gates" below.

**You never write the fix.** The author session edits the doc in its own
branch, or replies why the claim still stands, and you rule on that like any
other pushback. Proposing wording in the finding is not authoring; opening a
commit is.

This is one typed category with a hard precondition, deliberately. It is not
a standing license to review documentation.

### Prose never gates

(Default. `prose can gate: yes` turns it off; then grade prose like code.)

**A finding whose entire fix is PROSE is `nit`. Always. No exceptions.**

Prose means: a code comment, a docstring, an XML doc comment, a
markdown file, a README, a help or portal page, a commit-message or
PR-description claim. If the only edit that closes the finding is
words a human reads, it is a nit.

**The test is what the FIX touches, not how wrong the words are.** A
comment that is actively misleading is still a nit. A doc that
describes a button that no longer exists is still a nit. The pull is to
argue that THIS one is bad enough to gate - it never is, because the
cost of gating is a full review round, and a round that exists to
re-read a paragraph is the exact churn this rule was written to stop.

The one thing that is NOT prose: code that is wrong and happens to
carry a comment about it. Grade the code at its own severity. The
comment is incidental and does not make the finding gate, nor does it
shield it.

Nits still get posted - they are how the user sees what is left. They
just never set `verdict=blocked`. Whether they get fixed is the user's
call, asked once at the clean verdict (loop step 2) - or later, when
`/shipit` offers to batch leftover nits into one issue. The loop never
fixes a nit nobody chose to fix.

### Never in a review

- No praise padding. A strengths section of one line, or none.
- Every `review rule` in the settings, and every Shared `posting rule`.

## 5a. Sub-agent return shape (sweep only)

Each fan-out agent returns exactly this, as its final message - data,
not prose:

    {
      "pr": 2451,
      "verdict": "review" | "skip (head already reviewed)" | "failed (<reason>)",
      "head_sha": "<the headRefOid it actually reviewed>",
      "round": 2,
      "prior": [
        { "comment_id": 123, "path": "...", "line": 42,
          "status": "resolved" | "still-open" | "moot",
          "reply": "<one-line reply body, for resolved and still-open>" }
      ],
      "summary_body": "<the review body per the shapes in step 6>",
      "comments": [
        { "path": "src/foo.ts", "line": 42, "side": "RIGHT",
          "severity": "blocking" | "should-fix" | "nit",
          "body": "**Correctness.** ..." }
      ]
    }

- `head_sha` is what step 6's head-moved check compares against. An
  agent that cannot say what SHA it read returns `failed`.
- `prior` is empty on a first review. `moot` entries carry no reply.
- The main session posts in queue order as results arrive: replies from
  `prior` first (step 3's API call), then the thread resolutions -
  every `resolved` and `moot` entry gets its thread resolved via step
  3's GraphQL mechanics - then the batched review (steps 6
  and 7). It never edits an agent's findings beyond payload mechanics -
  a finding it disagrees with is dropped and named in the closing
  report, not rewritten.

## 6. Build the payload

### Confirm the head has not moved

    gh pr view <n> --repo <repo> --json headRefOid --jq .headRefOid

Compare against the `headRefOid` captured in step 2. **Different: throw
this review away.** Do not post it, do not stamp a marker with either SHA.
Record the PR as `re-queued (head moved)` and either re-review it from
step 2 or name it in the closing report as unreviewed.

This is not hypothetical. A sweep spends real time per PR, and the
author is often working while it runs: a commit can land between
reading the diff and building the payload.

Posting anyway is worse than not reviewing at all: the review describes
one SHA, the marker claims another, and **step 3 then skips the
re-review that would have caught it**. The duplicate-suppression turns
into silent suppression of the only round that mattered.

Write `review-<n>.json` to the scratchpad with the **Write tool**, not
a shell redirect or `Out-File` / `Set-Content` - those can write a BOM
(byte-order mark) on Windows, and `gh api --input` rejects it.

    {
      "commit_id": "<headRefOid>",
      "event": "COMMENT",
      "body": "<summary>",
      "comments": [
        { "path": "src/foo.ts", "line": 42, "side": "RIGHT",
          "body": "**Correctness.** ..." }
      ]
    }

Rules that make the API accept it:

- `event` is **always `COMMENT`**. The token's account is usually the PR
  author, and GitHub rejects `APPROVE` / `REQUEST_CHANGES` on your own
  PR with a 422.
- `line` must be a line **present in the diff on the RIGHT side**. A line
  outside the diff 422s the whole call and nothing posts.
- A finding on untouched code goes in the **body**, with `file:line`
  written out. Do not force it inline.
- Multi-line span: add `start_line` alongside `line`.
- Order comments by severity, worst first.
- `comments` carries **new findings only**. Carried-forward ones went out
  as thread replies in step 3.

Body shape, first round:

    ## Review

    **Blocking (n)** / **Should fix (n)** / **Nits (n)**

    <the blocking ones spelled out, plus anything out-of-diff>

    <!-- pr-review-open <b>/<s>/<n> -->
    <!-- pr-review sha=<short-sha> round=1 verdict=<clean|blocked> -->

Body shape, re-review:

    ## Review -- round <n>

    Since <short-sha of the prior round>:
    **Resolved (n)** / **Still open (n)** / **New (n)**

    <the still-open ones named in one line each, linking their threads>
    <the new blocking ones spelled out>

    <!-- pr-review-open <b>/<s>/<n> -->
    <!-- pr-review sha=<short-sha> round=<n> verdict=<clean|blocked> -->

The marker line is required, and `round` increments. Step 3 depends on
it, and a `merge guard`, when the repo has one, may depend on `verdict`:

- `verdict=blocked` - ANY finding at `blocking` or `should-fix`
  severity is open this round, new or still-open prior. The review
  loop keeps running.
- `verdict=clean` - nothing gating is open. Nits NEVER set blocked.
- `<!-- pr-review-open <b>/<s>/<n> -->` - its OWN line, above the
  verdict marker. Findings still OPEN after this round at `blocking` /
  `should-fix` / `nit`, prior rounds included. Required. The loop reads
  it to know which findings are still open, including whether any nits
  remain for the user's fix-or-leave choice, so a body without it hides
  that. Count what is open, not what you posted.
  **Never put the counts inside the verdict marker.** That marker's
  shape is a contract with every parser that has ever read it, and an
  older copy that ends its pattern at the closing `-->` cannot match a
  marker carrying a trailing field: it then reports the PR as having NO
  review round and demands rounds forever. A reader may parse
  liberally, but the emitter stays strict, because the reader you break
  is the one running from a checkout you did not update.

Nothing found and nothing outstanding: post the body alone with an empty
`comments` array. **A round that clears every prior finding is the most
useful thing this skill posts** - say so plainly.

## 7. Post, verify, next

    gh api --method POST repos/{owner}/{repo}/pulls/{n}/reviews --input <scratchpad>/review-<n>.json

`--dry-run` stops here: print the body, the inline comments, and any thread
replies it would have sent, post nothing, continue to the next PR.

### Body-only, when every changed file is under `body-only paths`

No `body-only paths` in the settings -> every PR posts normally. With
some, a PR whose diff is entirely under them posts ONE review: the
marker plus every finding written out in the body, with `file:line` on
each. **No inline comments and no thread replies** on these PRs.

Those are paths nobody reads line by line, so comments pinned across
their lines are clutter with no reader. One review the user can open if
they want to is not.

Everything the loop needs still has somewhere to live, which is why this
is body-only rather than marker-only:

- **Carry-forward** reads the prior round's review BODY instead of prior
  inline comments. Same three verdicts per finding (resolved, still
  open, moot); say which in this round's body, since there is no thread
  to reply in.
- **A human ruling** is a reply on the review itself, and it resets the
  round cap the same way a thread reply does.
- **The marker** posts as always. A merge guard reads its verdict off
  the review body and has no other source, so a review that posted
  nothing would leave every merge asking.

Mixed diff - one file outside those paths - posts normally, inline
comments and all. The carve-out is all-or-nothing, so there is never a
judgment call about which half of a finding set to publish.

**On 422:** the usual cause is a `line` outside the diff. Move that finding
to the body and retry once. A second failure is recorded as `failed` for
that PR and the sweep continues - never drop findings silently, and never
abort the remaining PRs because one broke.

Read it back before moving on - posting is not proof it landed:

    gh api repos/{owner}/{repo}/pulls/{n}/reviews --jq '.[-1] | {id, state, body}'

## 8. Closing report

One table, one row per PR in the queue:

| PR | Title | Round | Resolved | Still open | New | Result |

`Result` is `posted` / `skipped (head already reviewed)` / `skipped
(draft)` / `re-queued (head moved)` / `failed (<reason>)`, with the review
URL on posted rows.

Then, and only then, name anything that needs the user: PRs that failed,
findings moved to the body because they fell outside the diff, a truncated
queue, and any PR where the same finding has now survived `round cap`
rounds - that one is not landing, and repeating it again will not help.

**The findings themselves stay on the PRs.** Do not re-print them in chat.
