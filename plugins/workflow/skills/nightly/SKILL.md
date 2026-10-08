---
name: nightly
description: The triage desk for the nightly test run's report. Reads the latest run, hands every test failure, new gap and new notice to ONE pasteable fix-session prompt, and asks File / Skip / Already tracked for everything else, filing each yes as a GitHub issue that /gh-go sessions build in parallel. Writes no code and opens no branch. Use when the user types /nightly, asks "what did the nightly find", or wants to act on the morning email.
---

# /nightly - the triage desk for the morning report

Three parts, and this skill is only the middle one:

| Part | Does |
|---|---|
| The runner (`<workflow>`) | Runs the tests on `<base branch>`, writes the report, sends it to the team |
| **`/nightly`** | Sorts the report into two lanes and hands each item to the right place |
| A pasted fix session, and `/gh-go` sessions | Do the actual work |

**`/nightly` changes nothing in the repo.**

- No branch, no worktree, no code, no pull request, no test run.
- Its output is one paste-ready prompt, and the GitHub issues the user said yes to.

**Usage**

    /nightly            # sort, print the fix-session prompt, then ask about the rest
    /nightly --list     # sort and show both lanes; ask nothing, file nothing

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
| `<verify label>` | `verify label` | `Launch verification run` |
| `<date format>` | `date format` | `YYYY-MM-DD` |

## 1. Find the run

    gh run list --repo <repo> --workflow <workflow> \
      --limit 2 --json databaseId,conclusion,createdAt,headSha,url

The first row is tonight's run and the one to read.
The second is the previous run; step 5 needs its `createdAt`.

- **Older than `<stale hours>` hours, or none:** the nightly did not run. Say so, link the Actions tab, and stop.
- **Still running:** say so and stop. Do not wait on it.

A run started by hand during the day (a fix session's verification run) is read the same way as the scheduled one.

Download its artifact:

    gh run download <id> --repo <repo> --name <artifact> \
      --dir <scratchpad>/nightly-<id>

**When this machine cannot download** (the call is refused), read the job log instead.

- Take `nightly-result.json`, `nightly-report.md` and `code-coverage.md` from between the `<log markers>` that the step `<log step>` writes.
- That is enough to sort, never enough to triage: the screenshots and test result files live only in the artifact.
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
| `nightly-result.json` | `counts`, `regressed_tests`, `new_failures`, `tests_added`, `tests_removed`, `failed_tests`, `wave_read`, `gaps_total`, `gaps_new`, `notices_total`, `notices_new`, `blind_suites`, `failure_windows`, `baseline_date` |
| `coverage-summary.json` | every uncovered method, with its file and last-commit time |
| `doc-changes.json` | `undocumented`: doc surfaces whose code moved since the last run; `triggers`: for each of them, the code files that moved |
| `merged-prs.json` | every PR merged since the last run |
| `catalog-build-notes.txt` | catalog build (analyze) failures and warnings, one per line |
| `report-dead-detector-code.txt` | detector functions that never ran tonight, or NOT MEASURED |
| `failures/<run>/` | each failed browser case's `.png`, `.url.txt`, `.body.txt`, `.summary.txt` |
| `*.trx` | every test's outcome and full error |

- A file that is missing was not produced tonight. Say "not checked", never "none".
- `new_failures`, `tests_added`, `tests_removed`, `gaps_new` and `notices_new` are `null` on a first night.
- `gaps_total` and `notices_total` are `null` when the catalog build failed: say "not read".
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

### Lane A - the fix session. One prompt, no issues.

A failing test, a gap and a notice are never GitHub issues.
The report is the record: tomorrow's run re-surfaces each one until it is gone.

Lane A has three parts, in this order:

1. **Failures**
   - Every `blind_suites` entry, by its `line`
   - The run is red for a pipeline reason: a failed step, a test run that did not complete, `wave_read: false`, or a line in `catalog-build-notes.txt`
   - `regressed_tests`, then `new_failures`
   - A `tests_removed` test that no merged PR explains (step 5)
2. **Tests to write:** every `gaps_new` line.
   Each is a page or action that no test named by `<test claim>` covers.
3. **Notices to review:** every `notices_new` line.
   Each is a message, page part or portal that no claiming test reaches.

- Only the new ones go in.
- The open ones are counted (`gaps_total`, `notices_total`) and stay in the report.
- Group failures that share a first error line from the `.trx`.
  Hundreds of tests on one certificate error are one item.

### Lane B - everything else. One question each.

- A `tests_removed` test that a merge explains (step 5): **no question**, one line in the report naming the PR.
- **Doc pages whose code moved**: ONE item for the whole list.
- **Methods changed since the last run that no test ran**: one item per file.
  Skip everything `<coverage skip>` names.
- **Detector code that ran on nothing** (`report-dead-detector-code.txt`): one item per detector module.
  - NOT MEASURED is not "none": say so and ask nothing.
  - The issue names each function and its lines, and the approach:
    - a rule bans the shape: delete it;
    - the shape is gone but unbanned: add the rule, then delete;
    - otherwise: add it to `<dead code keep>` with a reason.
  - Prove each delete with `<dead code proof>`: it must show that no detector lost rows.
  - No `<dead code keep>` or `<dead code proof>` set: the issue says so, and leaves the approach to the reader.

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

## 6. Lane A: print ONE prompt

When Lane A is empty, say so in one line and skip to step 7.

Otherwise print a single fenced block the user pastes into a fresh session.

- It is self-contained: everything that session needs is inside it.
- Nothing goes after it that qualifies it. A caveat belongs inside, or nowhere.

The prompt carries:

- the run URL, and the first step: download the artifact into its own scratchpad, never a folder this session made

      gh run download <id> --repo <repo> --name <artifact> \
        --dir <your scratchpad>/nightly-<id>

  and, for a machine that cannot download, the step 1 fallback:
  the job log's `<log markers>` sections, which carry no screenshots or test result files
- the three parts, each under its own heading:
  - **Failures:** each `blind_suites` line first.
    Then each item's test name or step and its first error line, under its failure window's `title` with that window's PR numbers.
  - **Tests to write:** each new gap line.
    The work is a test that claims the page or action, named by `<test claim>`.
  - **Notices to review:** each new notice line.
    The work is a claiming test that reaches it.
- the method for failures: `/triage` each one.
  Artifacts before theories, R2 before R1 before R4, the probe only when the artifacts leave it ambiguous.
- the branches: every fix on a `<branch prefix><slug>` branch off `<base branch>`.
  One branch at a time, each merged before the next.
  A change under `<human merges>` is a PR a person merges.
- the limits: no GitHub issue for a failure, a gap or a notice.
  No test run except the verification run below.
- the label rule, when `<caught label>` is set:
  - When an item's root cause is a real product bug (not the test, the pipeline or the environment), the PR that fixes it gets `<caught label>`.
  - One label per bug: an issue gets it only when the session files one in place of a fix PR.
- anything this session already ruled out, as a "ruled out" list
- **the last step, the verification run**, worded so the session cannot miss it:

  > When every PR this session opened has merged, ask ONE AskUserQuestion
  > with the option label "<verify label>". The user asked for this run by
  > pasting this prompt; their tap on that label is the go. On the tap, run
  > `gh workflow run <workflow> --repo <repo> --ref <base branch>`,
  > post the run link from `gh run list --repo <repo> --workflow <workflow> --limit 1`,
  > and end the turn. Do not poll it: the runner sends the result, and
  > `/nightly` reads that run like any other. If they decline, end normally.

Print it and move on. Do not start the work here.
Proofread it before printing: a slip inside the block cannot be fixed after it.

## 7. Lane B: ask, then file

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
- **Unassigned.** The user orders the queue; `/gh-go` picks it up.
- **Unlabeled, with one exception:** an item that is a real product bug gets `--label <caught label>`, when one is set.
  A coverage gap, a doc page or dead detector code is not one.
- Never a closing keyword. Follow every Shared `posting rules` line.

Read each one back with `gh issue view <n> --repo <repo>` before reporting it filed.

## 8. Report

Dates in `<date format>`.

    blind      <line>   (one per blind_suites entry; omitted when none)
    nightly    run <id> <conclusion>, <date>  <url>
    caught     <N> in the last <caught days> days, <M> all time   (omitted when no caught label)
    lane A     <f> failure(s), <g> test(s) to write, <n> notice(s), prompt printed above  (or: none)
    filed      #<n> <title>   (one line each)
    skipped    <n>
    tracked    <n>, each naming its issue
    explained  <n> removed test(s), each naming its PR

## 9. Archive

This session is done once the report is printed: the prompt and the filed issues carry everything forward.
Ask ONE `AskUserQuestion`:

| Option | Means |
|---|---|
| **Copied it, archive** | Archive this session (`archive_session`, `session_id: "self"`) |
| **Keep it open** | End the turn; the user has more to ask |

- When Lane A was empty, the first label is **Archive**.
- No archive tool in this session: skip this step without comment.
- `--list` skips this step.

## Never

- write code, cut a branch, open a worktree or a pull request, or push
- file an issue for a failing test, a regression, a gap or a notice
- launch a test run; the verification run belongs to the fix session, on the user's tap
- send mail or post to a board; the runner already sent the report, and step 7's issues are the only thing this skill files
- point the prompt at a path on this machine; the fix session fetches what it needs, so this session can be archived the moment it is done
