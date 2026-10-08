---
name: release-notes
description: Turn a finished production deploy into changelog entries and a team email. Lists the one-time steps the shipped PRs left for a human, classifies the merged PRs that actually shipped, emits a SQL script that inserts them into the product's changelog table as DRAFTS, and drafts the internal heads-up email. Use after a production deploy finishes, when the user types /release-notes or asks for release notes or the changelog for what just shipped.
---

# /release-notes - from a finished deploy to draft changelog entries and a team email

Four outputs, in this order:

1. A checklist of the one-time steps the shipped PRs left for a human.
2. A classified list of what shipped that a user can see.
3. A SQL script inserting those items into the changelog table as **drafts**.
4. An internal email draft telling the team what shipped and what is waiting for review.

The changelog already exists in the product.
This skill does not invent one; it feeds the one the product has.
Where that changelog shows up (admin authoring, an in-app page, a public page, an email blast): `changelog surfaces`.

Deploys run from `deploy source`, never from a session.
This skill runs after one finishes and derives everything itself.

## 0. Read the settings

Two files, both optional, in this order:

1. `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`).
2. `.claude/skill-settings.local.md` in the MAIN checkout. A gitignored file is not copied into worktrees, so resolve the main checkout first (see "The main checkout" below).

From each, read the `## Shared` section, then the `## Release notes` section.

- A key in both files takes the local value.
- A value overrides the default this skill states.
- A rule there is followed as if written here.
- No file, or no section: use the defaults, and say ONCE, in one line, that the settings files can tune this skill and the template is in the plugin's `templates/release-notes.md`.
- **A required key with no value: name the key and the file it belongs in, then stop.** Never guess a value.
- Read every doc `docs` names before step 1.

Values this skill uses. `(local)` keys belong in `skill-settings.local.md`.

| Key | From | Default |
|---|---|---|
| `repo` | Shared | `gh repo view --json nameWithOwner` |
| `base branch` | Shared | the repo's default branch |
| `people` | Shared | none (they/them) |
| `docs` | Release notes | none |
| `deploy source` (local) | Release notes | none: the user names the deploy that finished |
| `user-facing app` | Release notes | the app signed-in users use (usually the website) |
| `background apps` (local) | Release notes | none |
| `after deploy heading` | Release notes | `## After deploy` |
| `flag state command` | Release notes | none: ask the user each flag's production state |
| `flag notes` (local) | Release notes | none |
| `changelog surfaces` (local) | Release notes | none |
| `changelog table` (local) | Release notes | **required** |
| `changelog columns` (local) | Release notes | read from `schema project` |
| `status values` (local) | Release notes | read from `schema project`; no draft value found means stop |
| `category values` (local) | Release notes | read from `schema project` |
| `press category` (local) | Release notes | none: step 3's second question is skipped |
| `audience values` (local) | Release notes | none: no audience column is set |
| `unique index` (local) | Release notes | read from `schema project` |
| `users table` (local) | Release notes | **required** |
| `schema project` | Release notes | none |
| `slug rule` | Release notes | the rule in step 4 |
| `review tool` (local) | Release notes | none |
| `changelog reviewer` | Release notes | the operator |
| `operator` | Release notes | the person `git config user.name` names |
| `operator profile` | Release notes | none: ask the operator's product email and signature once |
| `release log folder` | Release notes | **required** |
| `release log template` | Release notes | none: create an empty folder |
| `log file` | Release notes | none: step 6 is skipped |
| `apply script` | Release notes | none: step 4b hands over the path and stops |
| `apply login` (local) | Release notes | none |
| `apply setup` (local) | Release notes | none |
| `email template` | Release notes | none: plain, simple HTML |
| `recipients` | Release notes | none: ask the operator |
| `send command` | Release notes | none: hand the file over; the operator sends it |
| `product name rule` | Release notes | none |

**Where the table shape comes from.**
Read the changelog's columns, types, lengths, enum values and unique index from the settings.
Any of those not set there: read it from `schema project` (the repo's database project) and the enums the product code declares.
Neither gives the draft status value: name `status values` and `.claude/skill-settings.local.md`, then stop.

## The main checkout

Resolve it once, before step 0 reads the local file:

```powershell
(git rev-parse --path-format=absolute --git-common-dir) -replace '/\.git/?$', ''
```

Below, `<root>` is that path, in forward-slash form.

**Use `<root>`, with forward slashes, for every script path in a command.** Three ways to get this wrong:

- `${CLAUDE_PROJECT_DIR}` is a permission-matching placeholder, not a shell variable.
  PowerShell expands it to nothing, and the call dies on a path starting at `/`.
  `$env:CLAUDE_PROJECT_DIR` is not set either. Neither belongs in a command.
- A permission allowlist matches a command by its path text.
  A backslash path does not match a forward-slash entry, so the call stalls on a prompt.
- `git rev-parse --show-toplevel` resolves the CURRENT checkout.
  Called from a worktree it returns the worktree's folder, which the allowlist is not keyed on, so it stalls the same way.
  `--git-common-dir` points at the main `.git` from anywhere, which is why it is the one above.

## The three things this never does

- **Every row is a draft.** The `draft` value of `status values`, nothing else.
  - Not published.
  - Not scheduled either: a scheduled row is finished copy with a future date that something promotes on its own.
  - Someone else (`changelog reviewer`) validates the copy, edits it in `review tool` and publishes it.
  - Publishing is often also what makes an entry eligible for an email blast. A script that wrote anything but a draft would be a script that decided to email customers.
- **Never applies the SQL without a click.** It writes the file, shows the path, and asks. Step 4b has the one sanctioned path and the shape of the question.
- **Never announces what did not ship.** A skipped app, a skipped schema change, or a website step that did not run all mean those changes are still pending.

If nothing user-visible shipped, say exactly that and produce nothing.
An empty release is a normal outcome, not a failure to find material.

## 1. The range

**The `user-facing app`'s commits define the range.**
The changelog is what a signed-in user sees, and that is this app.
If its deploy was skipped or failed, there is nothing to announce: stop here.

The range is **previous-live to now-live**.

- The deploy already happened, so production now carries the tip of `base branch`, and `<live-sha>..origin/<base branch>` is empty.
- The end of the last release is the start of this one.
- It is recorded in the first line of the most recent `changelog-YYYY-MM-DD.sql` in `release log folder`:

```bash
head -1 <most-recent>.sql
```

**No prior file, or its header is missing: ask the operator where to start.**
Do not guess a starting sha and do not fall back to a date.
A wrong start either re-announces what users already read or silently drops a release.

When `base branch` is squash-merged, every commit subject carries its PR number:

```bash
git log --pretty=format:%s <previous-live-sha>..<now-live-sha>
```

Read the PRs that look user-facing:

```bash
gh pr view <number> --repo <repo> --json title,body,labels
```

**A background app's change counts only if** that app was actually deployed in this run AND the change is visible to a user.
For a mail app, visible means a message they receive.
`background apps` names them.

## 1b. The one-time steps

Before any changelog work, list what someone has to run by hand now that this release is live.
This step reads **every** PR in the range, internal ones included: a data repair usually rides on a PR the changelog drops.

A PR records its steps under a heading of exactly `after deploy heading`.
Take everything from that heading to the next `##` heading or the end of the body:

```bash
gh pr view <number> --repo <repo> --json number,title,body
```

**A PR without the heading can still carry a step.**
When its body talks about a one-time repair, a script to run once, or SQL to run by hand:

- list it as a **possible** step, marked as a guess
- quote the lines that made it one
- never promote a guess to a step without the operator saying so

Show one checklist in chat, grouped by PR, before step 2:

    After deploy - 2 steps from 1 PR, 1 possible
    #101  Fix the order date rollover (#88)
      - [ ] Repair the order dates. Production. The operator, by hand.
            <the SQL, verbatim, formatted to be read>
    #107  (possible) "run the backfill once per database"

- **Copy each step verbatim.** Do not shorten the SQL or reword the command; the operator runs what the PR author wrote.
- **Never run a step.** Production writes are a human's. The one sanctioned production write in this skill is the changelog file (step 4b).
- Not a query to "check" a step either: the checklist hands the steps over; it does not verify them.
- **None found is said in one line**, and the skill moves on.

## 2. Classify

Every PR lands in exactly one bucket.
The categories are the product's (`category values`), not invented here:

| Bucket | Category | Channel |
|---|---|---|
| New capability a user can reach | the feature category | Changelog |
| Existing thing now works better | the improvement category | Changelog |
| Existing thing was broken | the bug-fix category | Changelog |
| Internal | dropped, silently | none |

**A feature flag that is OFF in production keeps its feature OUT of the changelog entirely.**

- Not "shipped, behind a flag": out.
- Nobody can see it, so announcing it describes something that does not exist for the reader.
- It earns its entry the day the flag is turned on.

**A flag that is ON is stated plainly, on the item it gates.**
A reader who sees an announcement assumes the thing is visible.

**Read the flag's state from production, never from the code and never from a PR description.**

- Run `flag state command`, with the now-live sha where it takes one.
- No command set: ask the operator for each flag's production state. Never infer it.
- Why not the code: a default in code is usually only what a MISSING row is seeded with. Once the row exists nothing rewrites it, so code and production drift the moment anyone toggles a switch.
- Two ways that happens without a commit: a human flips one in an admin screen, or a safety breaker trips one off on its own.
- `flag notes` names the repo's known cases.

**Categories other than the three above are never derived from a deploy.**

- A public press release (`press category`) has a different audience and a different bar.
- Reference content (an FAQ, say) is something nobody deployed.
- Step 3 can promote an item to `press category`, but only on a click.

**Drop internal work without listing it.**
Pipeline, tests, hooks, docs, refactors, build config, and anything admin-only.
When `audience values` has no admin value, that is by design: an admin-only change is internal and is not announced in the changelog.

**Audience.** When `audience values` is set, set the audience column to the parts of the product the change is actually reachable from.
When in doubt, the value meaning "everyone".

## 3. The questions

The operator prunes a proposed list. They never sort raw commits.

**Multi-select is correct here.** Picking copy authorizes nothing.

Write each candidate in reader's words, not the commit subject.
"You can now export any report to a spreadsheet" beats "Add CSV export to ReportGrid (#412)".

> **Which of these belong in the changelog?**
> - one option per candidate, all pre-selected

Then, only if `press category` is set and something plausibly qualifies:

> **Does any of this rise to a public press release?**
> - one option per candidate, none pre-selected / `None of these`

A press release uses `press category`, lands where `changelog surfaces` says press releases land, and is stored with the "everyone" audience whatever the change touches.
Most deploys produce none.

## 4. The SQL

One file, one `INSERT` per selected item.

**Write it to `release log folder`**, named `changelog-YYYY-MM-DD.sql`, whoever is running the deploy.

- That folder is the release record for the whole team, not one person's work.
- Step 1 reads the newest file's header there, so the record must live in ONE place or the range chain breaks.
- Writing there is a sanctioned operator write even when the operator does not own the folder.
- First run: create it from `release log template`.
- **Never write it into `schema project`.** That project is the schema; these are rows.

Rules the script must follow:

- **Status is the draft value.** No exceptions, no flag to change it.
- **The publish date is the deploy date**, not null.
  - It does not gate visibility; it is the date the entry carries.
  - Setting it now means the changelog reads correctly the moment someone publishes.
- **Any blast columns stay at "not sent, not skipped".** Blast intent is the reviewer's call.
- **The author is the OPERATOR**: the person running this deploy (`operator`).
  - Never the owner of the folder the file lands in, and never copied from the shape below.
  - It is the truthful record of who drafted the entries; `changelog reviewer` publishes either way.
  - The email comes from `operator profile`, in the form `users table` matches on.
  - The lookup finds no product account for the operator: the `THROW` fires. Ask in chat; never substitute someone else's account.
- **The author is looked up, never pasted.** Match on the column and the form `users table` names.
  - A column with a binary or case-sensitive collation matches nothing when the literal's case differs, and the lookup quietly yields NULL.
  - Prefer the column the product itself resolves users by.
- **The slug matches what the site would generate**, since the site is what will link to it. Default `slug rule`:
  - lowercase
  - ASCII letters and digits kept
  - every other run of characters becomes a single `-`
  - trimmed of leading and trailing `-`
  - cut to the slug column's length
  - an empty result becomes `release`
- **Copy fits its column.** Read each text column's length.
  Write inside it; do not truncate to it. A sentence cut mid-word reads as a defect to whoever reviews it.
- **A skipped slug says so.**
  - The slug is unique (`unique index`), so every insert is guarded on the slug alone.
  - A guard that skips must `PRINT` which slug it skipped and why.
  - Silence is the failure mode: the email reports what the file contains, and an insert that quietly did nothing makes that report wrong.
- **Match on the slug, never on slug plus title.**
  - A title comparison looks like a sharper collision check and is not.
  - This skill's own design has a human EDIT each draft. Re-applying the file after that edit sees a changed title on a row it created itself, and a `THROW` there aborts every later item over a workflow that went exactly as intended.
  - The residual case is a genuinely new entry whose title happens to slug to something already taken. That is what the `PRINT` is for.
  - The site may resolve such a clash by appending `-2`. A script cannot: it does not know what else landed in production since it was written.
- **First line is the range**, so the next release knows where to start:
  `-- Range: <previous-live-sha>..<now-live-sha>`
- **Unicode literals (`N''`), apostrophes doubled.** The body column holds HTML.
- **Formatted to be read.** One column per line, one value per line.

The shape, for SQL Server. Names in angle brackets come from the settings or the schema:

```sql
-- Range: 3225d76dc..a1b2c3d4e

DECLARE @Author UNIQUEIDENTIFIER =
(
    SELECT <user id column>
    FROM <users table>
    WHERE <user lookup column> = N'<OPERATOR-EMAIL, in the stored form>'
);

IF @Author IS NULL
    THROW 50000, 'No user matched the email literal above. Check its case and form.', 1;

IF EXISTS (SELECT 1 FROM <changelog table> WHERE <slug> = 'export-any-report')
    PRINT 'SKIPPED export-any-report: slug already exists. Nothing inserted for it.';

IF NOT EXISTS (SELECT 1 FROM <changelog table> WHERE <slug> = 'export-any-report')
INSERT INTO <changelog table>
(
    <slug>,
    <title>,
    <category>,
    <audience>,
    <summary>,
    <body>,
    <status>,
    <publish date>,
    <author>,
    <created>
)
VALUES
(
    'export-any-report',
    N'Export any report',
    <improvement value>,
    <everyone value>,
    N'You can now export any report to a spreadsheet.',
    N'<p>You can now export any report to a spreadsheet.</p>',
    <draft value>,
    '2026-08-10T00:00:00',
    @Author,
    SYSUTCDATETIME()
);
```

Drop the `<audience>` line when `audience values` is not set.

Tell the operator the path, and that nothing has been applied yet.

## 4b. Apply it, on a click

`apply script` is the ONE way this file reaches production.

- When `apply login` is set, the script runs as that login, which can write the changelog and read the users table and nothing else.
  So the worst a wrong file can do is put a bad draft in front of the reviewer.
- **Never a general production query tool, never a database CLI by hand, never a connection string assembled in the moment.**
  Those are how a scoped write becomes an unscoped one.
- No `apply script` set: hand over the path and stop.

Ask, with `AskUserQuestion`, and **name the file in the label**. A generic "Apply" authorizes nothing:

> **Apply `changelog-2026-08-30.sql` to production?**
> - `Apply changelog-2026-08-30.sql` - inserts N drafts
> - `Leave it for me to run`

Then call the script from the main checkout, in forward-slash form (see "The main checkout"):

```powershell
& <root>/<apply script> -InputFile <the path>
```

The argument name is whatever `apply script` documents; `-InputFile` is the default.

- **Report what the script printed, including every `PRINT` line.** A skipped slug is the one outcome the email would otherwise get wrong.
- If the operator declines, hand over the path and stop. Do not re-ask.

**A missing credential on a first run is setup, not a failure.**
`apply setup` says what a person runs once to provision it.
Say it once and move on.

## 5. The email

Internal, to the team.
The customer-facing announcement is the changelog itself, so this email is the heads-up, not the announcement.

- Formatted **HTML**, from `email template`.
- **Signed by the OPERATOR**, exactly as `operator profile` defines it.
  Never the owner of the folder the draft lands in: that location says nothing about who is speaking.
- Saved beside the SQL as `email-release-YYYY-MM-DD.html`.

It covers, in this order:

1. **What shipped, as features and fixes.** Two sections, New and Fixed, each item in the words a user would use.
2. **The changelog review.** Name `changelog reviewer`, ask them to review the drafts in `review tool`, edit anything that does not read right, and publish.

Rules for the email:

- **Admin-only work belongs in this email**, even though step 2 keeps it out of the changelog.
  - The changelog is what a customer reads; the email is what the team reads, and a new admin screen is squarely the team's business.
  - Dropping it from both is how a release that shipped four things gets announced as one.
- **Never list which applications were deployed.** No service table, no per-app lines, no shas. The team does not need it, and it buries the release under plumbing.
- **Never mention how the deploy went unless the operator asks.** A retry, an outage, a rolled-back setting, a step that needed a second attempt: none of it belongs here. It is a release note, not an incident report.
- **Assume the changelog entries are drafts and hand them to the reviewer**, whether or not this run wrote any SQL. Nothing reaches a customer until they publish.

**Claude sends it, on the operator's word.**

- Follow the draft-and-send loop `operator profile` sets out, if it sets one.
- Otherwise: draft it, surface it RENDERED so it is read the way a recipient will see it, iterate in chat, send only when the operator says to.
- Never in the same turn that first shows the draft, and never on silence.
- Recipients come from `recipients`, never typed from memory.
- The send goes through `send command`. No command set: hand the file over; the operator sends it.
- Never through a mail client API that strips inline styles, classes or images: a templated email arrives stripped of everything that made it one.
- Report what the send command printed. Its output is the record of the send; never claim a send it did not report.

## 6. Log it

Append one line to the `## Log` of `log file`:

- the date
- what shipped
- how many draft entries were created
- how many one-time steps step 1b handed over, naming their PRs

Applying the SQL gets its own line, naming the count inserted and any slug the script skipped.

No `log file` set: skip this step and say so in one line.

## Rules

- The safety is three layers:
  - draft status on every row
  - a login that can write nothing but the changelog (when `apply login` is set)
  - a click that names the file before it is applied
- Never restate a PR body as changelog copy. A PR is written for a reviewer.
- Follow `product name rule` in every string a reader sees.
- Never an em-dash or en-dash in the SQL or the email file; use a single hyphen.
