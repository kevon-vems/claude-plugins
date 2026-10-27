---
name: nightly
description: The triage desk for the nightly test run's report, and the session that fixes it. Reads the latest run, asks File / Skip / Already tracked for the issue-worthy items, then fixes every test failure, open gap, open notice and untested method right here with parallel sub-agents, on one branch and one pull request. Nothing the report counts is left alone. Use when the user types /nightly, asks "what did the nightly find", or wants to act on the morning email.
---

# /nightly - read the morning report, then fix it

Two parts, and this skill is the second:

| Part | Does |
|---|---|
| The runner (`<workflow>`) | Runs the tests on `<base branch>`, writes the report, sends it to the team |
| **`/nightly`** | Sorts the report, asks about the issue-worthy items, then fixes the rest itself |

**Nothing the report counts is left alone.**
Every open item behind a number in the report is fixed here (Lane A) or asked about (Lane B).
New or old makes no difference: a count nobody works is how a report gets ignored.

**The order is fixed:**

1. Ask every Lane B question and file the yeses (step 6).
2. Then roll straight into Lane A, the fixes (step 7). No pasted prompt, no second session.

**Lane A runs in parallel.**

- One sub-agent per item, all started in one message.
- Every fix lands on ONE branch and ONE pull request.
- No test run beyond the build check in step 7.

**Usage**

    /nightly            # sort, ask about Lane B, then fix Lane A
    /nightly --list     # sort and show both lanes; ask nothing, fix nothing, file nothing

## 0. Read the settings

Read `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`):
the `## Shared` section, then `## Nightly`.
Then read the same two sections from `.claude/skill-settings.local.md` in the MAIN checkout:
`git rev-parse --path-format=absolute --git-common-dir` with the trailing `/.git` removed.
A key in both files takes the local value.

- A value there overrides the default below.
- A rule there is followed as if written here.
- A key marked required with no value: name the key and `.claude/skill-settings.md`, then stop.
- Any other key missing: use the default. Say ONCE, in one line, that the template is in the plugin's `templates/nightly.md`.

| Name | Key | Default |
|---|---|---|
| `<repo>` | Shared `repo` | `gh repo view` |
| `<base branch>` | Shared `base branch` | the repo's default branch |
| `<branch prefix>` | Shared `branch prefix` | `claude/` |
| `<human merges>` | Shared `human merges` | every path |
| `<worktree folder>` | Shared `worktree folder` | a sibling folder of the checkout |
| `<build check>` | `build check` | none: the step is skipped, and the report says so |
| `<workflow>` | `workflow` | **required** |
| `<artifact>` | `artifact` | **required** |
| `<stale hours>` | `stale after` | `30` |
| `<log markers>` | `log markers` | `===== BEGIN <NAME> =====` and `===== END <NAME> =====` |
| `<log step>` | `log step` | none: no log fallback |
| `<caught label>` | `caught label` | none: step 2 is skipped |
| `<caught days>` | `caught window` | `30` |
| `<test folder>` | `test folder` | the whole tree |
| `<coverage skip>` | `coverage skip` | none |
| `<test claim>` | `test claim` | the repo's way of naming the test that covers a page or action |
| `<dead code keep>` | `dead code keep file` | none |
| `<dead code proof>` | `dead code proof` | none |
| `<video process>` | `video process` | none: the video issue names no process |
| `<date format>` | `date format` | `YYYY-MM-DD` |

## 1. Find the run

    gh run list --repo <repo> --workflow <workflow> \
      --limit 2 --json databaseId,conclusion,createdAt,headSha,url

The first row is tonight's run and the one to read.
The second is the previous run; step 5 needs its `createdAt`.

- **Older than `<stale hours>` hours, or none:** the nightly did not run. Say so, link the Actions tab, and stop.
- **Still running:** say so and stop. Do not wait on it.

A run started by hand during the day is read the same way as the scheduled one.

Download its artifact:

    gh run download <id> --repo <repo> --name <artifact> \
      --dir <scratchpad>/nightly-<id>

**When this machine cannot download** (the call is refused), read the job log instead.

- Take `nightly-result.json`, `nightly-report.md` and `code-coverage.md` from between the `<log markers>` that the step `<log step>` writes.
- That is enough to sort, never enough to triage: the screenshots and test result files live only in the artifact.
- Lane A still runs, but a failure the log alone cannot explain is reported as blocked, never guessed at.
- **No markers on a red run** means it died before the report. The failed step from the run's jobs list is the whole of Lane A.
- No `<log step>` set: say the artifact could not be read, and stop.

## 2. Count regressions caught

A regression caught is a real product bug the nightly found.
Its fix PR, or its issue when no fix PR exists, carries `<caught label>`.
One label per bug, so the count is the number of labeled issues and PRs.

    gh search issues --repo <repo> --label <caught label> \
      --include-prs --limit 1000 --json number --jq length
    gh search issues --repo <repo> --label <caught label> \
      --include-prs --created ">=$(date -d '<caught days> days ago' +%F)" \
      --limit 1000 --json number --jq length

Print one line near the top of the output, in both modes.
It goes before the lanes, and after any suite that did not run (step 3):

    Regressions caught by the nightly: <N> in the last <caught days> days, <M> all time

- A query that fails is "not counted", never 0.
- No `<caught label>` set: skip this step and the line.

## 3. Read it

Read the JSON for every list. Never count from the markdown or the email.

| File | Holds |
|---|---|
| `nightly-result.json` | `counts`, `regressed_tests`, `new_failures`, `tests_added`, `tests_removed`, `failed_tests`, `wave_read`, `gaps_total`, `gaps_open`, `gaps_new`, `notices_total`, `notices_open`, `notices_new`, `blind_suites`, `failure_windows`, `baseline_date` |
| `coverage-summary.json` | every uncovered method, with its file and last-commit time |
| `service-coverage.json` | `browser_only` and `writes_without_fast`: methods a browser test reaches, or that write to the database, that no unit-level test touches |
| `doc-changes.json` | `undocumented`: doc surfaces whose code moved since the last run; `triggers`: for each of them, the code files that moved |
| `video-changes.json` | `rebuild`: training videos whose screens' code moved, each with the files in `changed`; `broken`: videos whose script names a test ID that is gone, so they cannot record until fixed; `unresolved`: test IDs the check could not tie to product code |
| `merged-prs.json` | every PR merged since the last run |
| `catalog-build-notes.txt` | catalog build (analyze) failures and warnings, one per line |
| `report-dead-detector-code.txt` | detector functions that never ran tonight, or NOT MEASURED |
| `failures/<run>/` | each failed browser case's `.png`, `.url.txt`, `.body.txt`, `.summary.txt` |
| `*.trx` | every test's outcome and full error |

- A file that is missing was not produced tonight. Say "not checked", never "none".
- `new_failures`, `tests_added`, `tests_removed`, `gaps_new` and `notices_new` are `null` on a first night.
- `gaps_total` and `notices_total` are `null` when the catalog build failed: say "not read".
- `gaps_open` and `notices_open` list every open line, new and old.
  A runner too old to write them: read every line under the report's gap and notice headings instead.
  A total above 0 with no lines read is "not read", never "none".
- `wave_read` is whether tonight's test results were read at all.

**Suites that did not run.**
`blind_suites` holds one entry per suite that ran no test tonight:
`suite`, `tests` (its size when it last ran), `nights` in a row, `last_ran`,
and `line`, the sentence the report and email lead with.
When it is not empty:

- **Print every `line` first**, above the regressions-caught line and any other count, in both modes.
  A pass count from a night a suite missed is not a clean night.
- Each one is a Lane A failure: the suite did not run.

**Failure windows.**
`failure_windows` groups tonight's failures by the date each last passed:
`title`, `last_passed`, `days`, `tests`, and `merges`, the PRs merged to `<base branch>` since (`number`, `title`).

- Wherever a failure is shown, show it under its window's `title`, with the PR numbers from `merges`.
  Those are the merges it could have come from.
- `failure_windows` is `null` when tonight's failures were not read.
- A window's `merges` is `null` when git history was not read.
- Either way, say "not read", never "none".
- A merge with no `number` is shown by its `title`.

`baseline_date` is the night the comparison runs against.
When it is older than the previous run, say so beside `regressed_tests` and `new_failures`.

## 4. Sort into two lanes

### Lane A - fixed here. No issues.

A failing test, a gap, a notice and an untested method are never GitHub issues.
The report is the record: tomorrow's run re-surfaces each one until it is gone.

Lane A has three parts, in this order:

1. **Failures**
   - Every `blind_suites` entry, by its `line`
   - The run is red for a pipeline reason: a failed step, a test run that did not complete, `wave_read: false`, or a line in `catalog-build-notes.txt`
   - `regressed_tests`, then `new_failures`
   - A `tests_removed` test that no merged PR explains (step 5)
2. **Tests to write**
   - Every `gaps_open` line: a page or action that no test named by `<test claim>` covers.
   - Every method in `coverage-summary.json`'s `uncovered`, minus what `<coverage skip>` names.
     One item per file.
   - Every `browser_only` and `writes_without_fast` row in `service-coverage.json`.
     One item per class.
3. **Notices to review:** every `notices_open` line.
   Each is a message, page part or portal that no claiming test reaches.

- Every open item goes in, new or old. Mark the new ones new; skip none of the old ones.
- An untested method that nothing reaches is fixed by deleting it, not by testing it.
  The triage says which.
- Group failures that share a first error line from the `.trx`.
  Hundreds of tests on one certificate error are one item.

### Lane B - everything else. One question each.

- A `tests_removed` test that a merge explains (step 5): **no question**, one line in the report naming the PR.
- **Doc pages whose code moved**: ONE item for the whole list.
- **Training videos** (`video-changes.json`): ONE item for every `rebuild`, `broken` and `unresolved` entry together.
  - Ask even when only `broken` or only `unresolved` has entries.
  - The look reads each `broken` script and confirms its test IDs are gone from the tree.
  - The look grades each video (below). Only a **Redo** or a broken script makes File it the recommendation.
- **Detector code that ran on nothing** (`report-dead-detector-code.txt`): one item per detector module.
  - NOT MEASURED is not "none": say so and ask nothing.
  - The issue names each function and its lines, and the approach:
    - a rule bans the shape: delete it;
    - the shape is gone but unbanned: add the rule, then delete;
    - otherwise: add it to `<dead code keep>` with a reason.
  - Prove each delete with `<dead code proof>`: it must show that no detector lost rows.
  - No `<dead code keep>` or `<dead code proof>` set: the issue says so, and leaves the approach to the reader.

### Grade every video before asking

A video costs far more to rebuild than a doc page costs to fix.
Code that moved is not, by itself, a reason to rebuild.

For each video, read its script: what each step shows, and what the narration says.
Then read what changed in each of its `changed` files, from the previous run's start (step 5) to tonight's run.

| Grade | When | Examples |
|---|---|---|
| **Redo** | A viewer following the video now gets stuck or misled | a button, menu or step it uses is gone, renamed or moved; the flow has a new required step; the narration now says something false; a screen it shows looks clearly different |
| **Not yet** | It still works, but looks a little dated | a small layout shift, a new optional field, a changed icon or color |
| **No** | Nothing the video shows or says changed | a refactor, a test ID, styling or text on a part of the page the video never shows or reads |

- A **broken** script is fixed either way, and that costs no build. The video itself gets its own grade.
- An **unresolved** video is graded from its script and the product code. Unsure is **Not yet**, and says so.
- Grade by what the video shows, never by the size of the diff.
- The question names each video with its grade and a one-line reason.
- No Redo and no broken script: recommend **Skip**. The issue is filed only on a person's click.

### Check the sort against the report

Every row in the report's numbers table that counts open work must match the items behind it in a lane.

- A row above 0 with no lane item, or a count that does not match its items, is a hole in this sort.
- Print it in one line at the top of the output, above the lanes, naming the row.
  Never pass over it.
- A count that holds things nobody should work on is a bug in the counter.
  Fixing the counter is a Lane A item.

`--list` shows the count line and both lanes as tables here and stops.

## 5. Explain every removed test first

A test in `tests_removed` ran last night and is gone tonight.
Either a merge removed or renamed it on purpose, or something lost it.
Check for the merge, from the repo root (`git rev-parse --show-toplevel`):

    git fetch origin <base branch>
    git log --oneline --since="<previous run's start>" origin/<base branch> -S "<method name>" -- <test folder>

- The previous run's start is the second row's `createdAt` from step 1.
  Starting there, not at its finish, keeps a merge that landed mid-run inside the window.
- `merged-prs.json` names the PRs in that window.
- A merge explains it: Lane B, one line naming the PR, no question.
- No merge: it is a lost test, and goes in Lane A.

## 6. Lane B: ask, then file

Every question comes before any Lane A work starts.
When Lane B is empty, say so in one line and go to step 7.

For each item, before asking:

1. **Look.** Open the file and the method, and search `<test folder>` for the class name.
   The question rests on what is there, not on the report.
2. **Check for duplicates:**

       gh issue list --repo <repo> --state open --search "<class or page> in:title"

3. **Recommend one answer**, and put it first.

Ask with `AskUserQuestion`, up to four items per call, three options each:

| Option | Means |
|---|---|
| **File it** | Create the issue now |
| **Skip** | Nothing; tomorrow's report re-surfaces it if it still holds |
| **Already tracked** | Name the open issue; file nothing |

On **File it**:

    gh issue create --repo <repo> --title "<plain title>" \
      --body-file <scratchpad>/nightly-issue-<n>.md

- **Title** says what is missing, in plain words ("Cover help ticket withdrawal with fast tests"), never "Nightly finding".
- **Body**: what the report showed, what the look found (`file:line`), the recommended approach, and the nightly run URL.
- **Doc items** say the work is a `/fix-docs` pass.
  They list every page with its `triggers` beneath it, so the issue shows which code moved.
  The reader never mistakes the list for doc edits.
- **Video items** have three lists, each video by its title and script path:
  - **Rebuild**: each **Redo** video, with its reason and its `changed` files beneath it.
  - **Fix the script first**: each `broken` video with the test IDs that are gone. It cannot record until then. A broken video not graded Redo gets its script fixed and rehearsed, with no build.
  - **Check by hand**: each `unresolved` video with its test IDs. The check could not see what they point at.
  - **Not rebuilding**: each **Not yet** and **No** video, with its grade and reason, so the reader sees each one was weighed.
  - The work follows `<video process>`. With none set, the issue says so.
- **Unassigned.** The user orders the queue; `/gh-go` picks it up.
- **Unlabeled, with one exception:** an item that is a real product bug gets `--label <caught label>`, when one is set.
  A coverage gap, a doc page or dead detector code is not one.
- Never a closing keyword. Follow every Shared `posting rules` line.

Read each one back with `gh issue view <n> --repo <repo>` before reporting it filed.

## 7. Lane A: fix it here, in parallel

When Lane A is empty, say so in one line and skip to step 8.
Otherwise start at once. The user's `/nightly` is the go; do not ask first.

### Set up once

- ONE worktree in `<worktree folder>`, on ONE branch `<branch prefix>nightly-<date>` off `origin/<base branch>`.
  Every sub-agent works in that worktree. None cuts its own branch.
- Sub-agents read the artifact folder from step 1. Pass them its full path.

### Round 1: triage, all at once

Start one sub-agent per Lane A item, every one in the SAME message so they run together.
A group of failures that share a first error line is one item.

Each triage agent:

- runs `/triage <Suite.Test>` against the artifact folder;
  artifacts before theories, R2 before R1 before R4, the probe only when the artifacts leave it ambiguous;
- for a gap or a notice, finds the page or action and the test that should claim it, named by `<test claim>`;
- for an untested method, finds what calls it: nothing means delete it; otherwise names the test tier that should cover it, and the test;
- changes NO file;
- returns: the root cause, whether it is a real product bug, the fix, and every file the fix touches.

### Round 2: fix, all at once

Sort the triage results by the files they touch.

- Items whose files do not overlap: one fix agent each, every one in the SAME message.
- Items that share a file: ONE agent takes them in order, so two agents never write the same file.

Each fix agent:

- edits only the files its triage named, inside the shared worktree;
- never commits, never stages, never pushes;
- returns the files it changed and one line per item on what it did.

An item a fix agent cannot finish is reported as blocked, with why. It is not filed as an issue.

### Check, then one pull request

1. Read the whole diff yourself. Any change outside the files the triage named is undone.
2. Run `<build check>`. A red build is fixed before anything is committed.
3. Stage by name, commit once, push the branch.
4. Open ONE pull request against `<base branch>`.
   - The body lists every item, under Failures, Tests to write and Notices to review, with its run URL.
   - When `<caught label>` is set and any item is a real product bug, the PR gets `--label <caught label>`.
   - A change under `<human merges>` is a PR a person merges.
   - Never a closing keyword. Follow every Shared `posting rules` line.
5. Start the review loop on it (`/pr-review`), as for any PR.

## 8. Report

Dates in `<date format>`.

    blind      <line>   (one per blind_suites entry; omitted when none)
    nightly    run <id> <conclusion>, <date>  <url>
    caught     <N> in the last <caught days> days, <M> all time   (omitted when no caught label)
    lane A     <f> failure(s), <g> test(s) to write, <n> notice(s), PR #<n>  (or: none)
    blocked    <item>: <why>   (one line each; omitted when none)
    filed      #<n> <title>   (one line each)
    skipped    <n>
    tracked    <n>, each naming its issue
    explained  <n> removed test(s), each naming its PR
    videos     <r> redo, <y> not yet, <n> no change seen, <b> broken, <u> unresolved   (or: not checked)

## 9. Archive

Only when Lane A was empty: the filed issues carry everything forward.
Ask ONE `AskUserQuestion`:

| Option | Means |
|---|---|
| **Archive** | Archive this session (`archive_session`, `session_id: "self"`) |
| **Keep it open** | End the turn; the user has more to ask |

- When Lane A had work, this session holds the PR: skip this step without comment.
- No archive tool in this session: skip this step without comment.
- `--list` skips this step.

## Never

- start Lane A before every Lane B question is answered
- cut more than one branch, or let a sub-agent commit, stage or push
- let two sub-agents write the same file at once
- file an issue for a failing test, a regression, a gap or a notice
- launch a test run beyond `<build check>`
- send mail or post to a board; the runner already sent the report
