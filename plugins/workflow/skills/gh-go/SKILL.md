---
name: gh-go
description: Pick up the next unassigned open GitHub issue (newest first unless the settings file says otherwise), name the session after it, check its claims against the tree, flag any overlap with work already in flight, summarize it in one sentence, and ask whether to start working it. Use when the user types /GH-Go or /gh-go, or asks "what's next", "grab the newest issue", or "give me something to work on".
---

# /GH-Go - grab the next unassigned issue

One job: surface the next issue nobody has taken, name the tab after
it, prove it is still real, prove nobody else is already in those files,
say what it is in a sentence, and ask whether to start. It does NOT
start work on its own.

## Step 0 - read the settings

Read `.claude/skill-settings.md` at the repo root
(`git rev-parse --show-toplevel`): the `## Shared` section, then the
`## GH-Go` section.

- A value there overrides the default named below.
- A rule there is followed as if it were written in this skill.
- Read any doc the settings file names for this skill before Step 4.
- No file, or no section: use the defaults below. Say ONCE, in one line,
  that `.claude/skill-settings.md` can tune this skill and the template
  is in the plugin's `templates/` folder. Never stop because the file is
  missing.

Names used below:

| Name | Where it comes from | Default |
|---|---|---|
| `<issue repo>` | `issue repo` in `## GH-Go` | Shared `repo`, else `gh repo view` |
| `<pick order>` | `pick order` in `## GH-Go` | `newest` |
| `<base branch>` | Shared `base branch` | the repo's default branch |
| `<branch prefix>` | Shared `branch prefix` | `claude/` |
| `<worktree folder>` | Shared `worktree folder` | every worktree `git worktree list` reports |

## Step 1 - find it

Run this from the repo root. `<sort>` is `created-desc` when
`<pick order>` is `newest`, `created-asc` when it is `oldest`:

    gh issue list --repo <issue repo> --state open --search "no:assignee sort:<sort>" --limit 1 --json number,title,body,labels,createdAt,url

If nothing comes back, say "No unassigned open issues" in one line and stop.

## Step 2 - name the session

Rename the session before showing anything, so the tab says which issue
is on the table, not which skill opened it. If this session has a
`set_session_title` tool, call it with `session_id` `self` and the title
`#<number> <short slug>`, where the slug is a few words from the issue
title - `#123 bid list selection`.

The desktop app replaces a title it generated without asking. A title
the user typed themselves makes the app ask them to approve the new one,
and the call waits on that answer. Let it wait; do not retry, and do not
skip the rename.

No such tool: skip this step without comment.

## Step 3 - summarize

Read the title and body. Write **one sentence** in plain language saying
what the issue asks for - not a restatement of the title, not a bullet
list, not a plan.

Skip the **Done when** list - see "'Done when' is not the scope"
below.

Hold the sentence. Nothing is shown until Step 4 has run.

## Step 4 - verify the issue before offering it

**An issue is a report, not a fact.** It was written from a symptom,
often weeks ago, sometimes by a session that named a file path it never
opened. Check the claim against the tree before asking the user to spend
a branch on it.

This is reading, not running: minutes of grep, `git log` and a query.
**Never a deploy, never a full test run,** and never anything the
settings file lists under `never run`. If settling it truly needs a
running environment, that is the "Can't tell from here" verdict, not a
reason to launch one.

Work the checks in this order and stop as soon as the claim stands or
falls:

1. **Has it already been fixed?** `git log --since=<createdAt>` over the
   paths and symbols the issue names, plus the PRs merged since. An
   issue filed the week before its fix landed reads exactly like a live
   bug.
2. **Does everything it names actually exist and say what it claims?**
   Open the files, settings and symbols. A named path that is not there,
   or that already does the right thing, IS the finding.
3. **Does the data back it?** A claim about a column, a flag, a row
   count or a schema is read live with the tool the settings file names
   under `data query`, following that key's rules. Never memory, never
   a doc. No `data query` configured: skip this check, and if the claim
   rests on data, that part is "Can't tell from here".
4. **Does the repro hold as far as reading gets you?** Follow the steps
   through the code path they describe. Name the line where it diverges
   from the report.

Artifact beats code-read: the screenshot on the issue, a pasted log, a
test run's output folder, a failing case id. Use one when it exists.

Land on exactly one verdict, each carrying its own evidence:

| Verdict | Means | Must name |
|---|---|---|
| **Confirmed** | The claim holds today | the file and line, or the query result |
| **Already fixed** | It was true, and is not now | the commit or PR that fixed it |
| **Wrong in part** | Symptom real, detail wrong | which detail, and what is actually true |
| **Can't tell from here** | Needs a person or a running env | what single thing would settle it |

**Never report a verdict you did not earn.** "I don't see it in code
search" is not Already-fixed; it is Can't-tell. Guessing here is worse
than not checking, because the verdict is what the user spends their
branch on.

## Step 4b - check what is already in flight

A verdict says the bug is real. It does not say the branch is free.
Other sessions may be mid-change right now, and two branches editing the
same file is a merge fight nobody planned. Read the board before
offering the issue.

Reading only. Never message another session, never touch its branch or
its worktree.

1. **Who is working.** If this session has a `list_sessions` tool, call
   it. Every row whose `isRunning` is true, plus anything active in the
   last day. A title is usually `#<number> <slug>`, and that number is
   the issue the session holds. A row carrying a `prNumber` whose
   `prState` is still `OPEN` is live work even when the session itself
   is idle. No such tool: skip to the next check.
2. **What is checked out.** `git worktree list` from the repo root. Every
   worktree in `<worktree folder>` is a branch somebody is holding, and
   the branch name carries the issue number.
3. **What those branches touch.** For an open PR:

       gh pr diff <number> --repo <issue repo> --name-only

   For a branch with no PR yet, from the repo root:

       git diff --name-only <base branch>...<branch>

   A branch with no commits yet touches nothing. Say that, rather than
   guessing its scope from the title.
4. **Compare.** Set those paths against the files Step 4 opened to settle
   the claim, which are the files a fix would land in.

Grade it once:

| Grade | Means |
|---|---|
| **Collision** | A file this fix must change is already changed on a live branch |
| **Adjacent** | Different files, same feature or same code path, so one merge is likely to break the other |
| **Clear** | No live branch goes near it |

An issue number that already shows up in a session title or a branch
name is a Collision on its own: somebody has it.

**A grade is evidence, same as a verdict.** Name the session or branch
and the shared file. "Feels related" is Clear.

## "Done when" is not the scope

Many issues carry a **Done when** list. It is the filer's guess at how
someone would confirm the fix, written before anyone looked. It is not
the work.

Two kinds of bullet are never scope and never widen the branch:

- **Test coverage** - "an integration test covers this", "add a case
  for X". Test coverage is its own work, tracked apart from the fix. A
  fix branch is never blocked on a test that does not exist yet.
- **Try it in an environment** - "viewed and tested in staging", "QA
  signs off". Whether a change gets hands-on testing, and where, is the
  tester's call. The filer does not make it and neither does this skill.

A bullet that instead states a BEHAVIOR the product must have is a
claim, not a deliverable. Verify it in Step 4 like any other claim in
the body: if it holds and the fix section missed it, it belongs in the
one-sentence summary; if it contradicts the fix section, that is
Wrong-in-part.

Scope comes from the problem statement and the fix section. Say nothing
about the Done-when list when summarizing, and do not carry it into the
plan or the PR.

## Step 5 - show it

Show exactly this and nothing more:

    #<number> - <title>
    <one-sentence summary>
    <verdict> - <the evidence, one line>
    <url>

Add the labels on their own line only if there are any.

On **Collision** or **Adjacent**, add one more line naming the other
work and what they share:

    Overlap - #456 (<branch prefix>456-payment-guards) also edits
    src/services/billing.py

Say nothing about overlap when the grade is Clear.

## Step 6 - ask

**Collision or Adjacent is discussed first, and nothing is assigned
until it is settled.** Show the overlap, say in one line what would
break if both land, then ask:

| Option | Meaning |
|---|---|
| **Work it anyway** | The user has ruled the two can coexist. Fall through to the start question below. |
| **Skip it** | Leave it unassigned and fetch the next one in `<pick order>` - Step 2, then 4, 4b, 5. |
| **Not now** | Stop. Say nothing further. |

Answer whatever they ask about the overlap before moving on. The
assignment waits on their word, not on a clean grade.

On a **Clear** grade, go straight to the question below.

Use `AskUserQuestion` with one question: start this one, or not.

| Option | Meaning |
|---|---|
| **Start #<number>** | Assign it to you, then begin the normal work flow - worktree in `<worktree folder>`, branch `<branch prefix><slug>`, PR. |
| **Skip it** | Fetch the next unassigned issue in `<pick order>`, rename the session to it (Step 2), verify it (Step 4), show it in the same format, ask again. |
| **Not now** | Stop. Say nothing further. |

**The verdict orders the options.** Confirmed leads with Start.
Already-fixed and Wrong-in-part lead with Skip, because the issue as
written is not the work. Can't-tell leads with Start only if the first
thing the branch does is settle the question.

A dead or wrong issue still gets no write from this skill. Closing it,
or correcting it in a comment, is the user's call and their separate ask.

On **Start**, assign it first so nobody else picks it up:

    gh issue edit <number> --repo <issue repo> --add-assignee @me

Then follow the ordinary rules - branch and worktree per the Shared
keys, the rules in `## GH-Go`, and the repo's own instructions; plan
before code; PR when done. A Wrong-in-part issue that the user starts
anyway is worked from the verified truth, not from the issue text.

## What this skill never does

- Never offers an issue it has not checked.
- Never offers an issue without reading what is already in flight.
- Never messages another session, and never touches another session's
  branch or worktree.
- Never edits, comments on, or closes an issue beyond the assignment above.
- Never starts writing code before the Step 6 answer lands.
- Never files a new issue.
