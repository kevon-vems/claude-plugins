---
name: create-ghi
description: File a bug report that someone can actually reproduce, by interviewing the reporter one question at a time instead of writing up their narrative. Use when anyone says something is broken and wants it filed, types /create-ghi, or asks for a GitHub issue about a defect. Feature requests do not need this.
---

# /create-ghi - turn "it doesn't work" into a reproduction

Everything below is about **bugs**. A feature request needs none of it:
file it with the `enhancement label` and move on.

    /create-ghi the totals stopped calculating on the budget page

## Step 0 - read the settings

Read `.claude/skill-settings.md` at the repo root
(`git rev-parse --show-toplevel`): the `## Shared` section, then the
`## Create GHI` section.

- A value there overrides the default named below.
- A rule there is followed as if it were written in this skill.
- No file, or no section: use the defaults below. Say ONCE, in one line,
  that `.claude/skill-settings.md` can tune this skill and the template
  is in the plugin's `templates/` folder. Never stop because the file is
  missing.

| Name | Where it comes from | Default |
|---|---|---|
| `<repo>` | `issue repo` in `## Create GHI` | Shared `repo`, else `gh repo view` |
| `bug label` | `bug label` | `bug` |
| `enhancement label` | `enhancement label` | `enhancement` |
| `environment fields` | `environment fields` | where it happened (app, area, account), browser or runner, build |

A label that does not exist on `<repo>` (`gh label list`) is left off;
say so in one line when filing.

## The problem this exists to solve

A typical bad issue is filed from a narrative: the page stopped working,
the totals came out wrong. It has no steps, none of the values they
typed, no expected-versus-actual, and a file path Claude inferred and
presented as fact. Nobody can reproduce it, so nobody can fix it, test
it, or verify it.

**The reporter did nothing wrong.** People report symptoms, because a
symptom is what they experienced. Turning a symptom into a reproduction
is this skill's job.

## Who has to use it

**Anyone the settings file names: always.** For them a bug goes through
this skill, never a write-up of what they said.

**Everyone else: when it helps.** A bug filed by hand is fine when it
already carries a reproduction. Nothing enforces this - see "Why there
is no hook" at the end.

## The six answers

Nothing gets filed until each of these has a real answer or an explicit
`Unknown - not captured`. **Steps and Actual cannot be waived**: a
report missing either one does not get filed at all (see "When to stop
and say so"); `Unknown - not captured` is for the other four.

| Section | What it needs |
|---|---|
| **Steps to reproduce** | Each click or command, in order. Area, page, tab, button |
| **Values used** | The literal values that went in. Dates, amounts, hours, selections |
| **Expected** | The number, message or screen that should have appeared |
| **Actual** | What appeared instead, quoted |
| **Environment** | The `environment fields` |
| **When** | Date and time, and whether it still happens |

The fields are evidence-shaped, not click-shaped, so they work for
anyone: an engineer fills Steps with a setup recipe and a test name, and
Values with the payload.

## How to run it

### 1. Mine everything before asking anything

Every question you can answer yourself is a question the reporter does
not have to.

- **Read the screenshot.** If they pasted an image, pull the values off
  it: field labels, amounts, dates, the error text, the page title, even
  the browser chrome. This is the single highest-value step.
- **Read the log or the stack** they pasted the same way.
- **Use what the session already knows** - the project they have been
  discussing, the area they were in, today's date.

### 2. Ask one question per `AskUserQuestion` call

Not six questions in one call, and never a wall of prose.

**Pre-fill from what you mined, and make confirming a tap:**

> I see $1,000 in the salary field and 07/06/2026 as the start date.
> Is that the line whose total came out wrong?
>   - Yes, that's the one
>   - Different line - let me tell you
>   - Not sure

Every option is a candidate answer, and free text is always available
for the one they actually mean.

### 3. Confirm every inference, never file one

A value read off an image is a **guess until they say yes**. File what
they confirmed. If they never confirm it, it does not go in the issue.

### 4. Three things never go in

1. **A file path, class name, or suspected cause** in an issue someone
   else reported. They cannot confirm it, so it lands as a fact nobody
   checked and points triage at whatever you happened to grep. The
   reporter owns the repro; whoever triages owns the code.
2. **A paraphrased value.** "Some dates in July" is not a value. Their
   number, verbatim, or ask again.
3. **Prose covering a missing answer.** If they truly do not have it,
   the section reads `Unknown - not captured`, so the gap is visible on
   the issue instead of reading as complete.

### 5. Show it before you send it

Print the assembled body in chat and ask for one confirmation. This is
the moment they catch a value you misread.

### 6. File it

Run this in a bash shell (on Windows, Git Bash) - the heredoc is bash
syntax and will not run in PowerShell:

    gh issue create --repo <repo> \
      --label <bug label> --title "<symptom, where it happened>" \
      --body-file - <<'EOF'
    ## Steps to reproduce
    ...
    EOF

Report the URL. Do not assign it, do not close it, and do not start
fixing it in the same breath.

## When to stop and say so

- **It is not a bug.** Works as designed, or they want something new ->
  say so, and offer to file it as an enhancement instead.
- **They cannot answer Steps or Actual.** Without one of those there is
  no report at all, only a mood. Ask again, differently - "walk me
  through what you clicked, starting from the home page" - and if it
  still does not come, say plainly that it cannot be filed yet and
  suggest they capture it next time it happens.

## Why there is no hook

One was written, and it is worth knowing why it is gone rather than
rebuilding it. A `PreToolUse` hook sees a string of shell text, so to
tell a bug filing from a sentence about one it has to answer questions
only a shell can: which `gh` token is a command, where an argument ends
when the body contains quotes and backticks, which body belongs to which
call. Round after round of review each closed one hole and opened its
mirror image - a bypass traded for a refusal of somebody's commit
message, over and over.

The report quality never lived there. It lives in the interview above.
Teach the person, do not guard the command.
