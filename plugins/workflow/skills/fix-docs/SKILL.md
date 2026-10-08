---
name: fix-docs
description: Sweep the repo's docs for drift against the code and land the corrections as ONE pull request. Use when the user asks to refresh the docs, check whether the help pages still match the product, or types /fix-docs. Reads the product tree, judges whether each change is material, rewrites the drifting docs, and opens a single PR they review. It does NOT file cards, does not email anyone, and does not touch product code.
---

# /fix-docs - the documentation sweep

Find where a doc no longer matches the code, fix the wording, and land it as **one pull request** the user reviews.

## 0. Read the settings

Read `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`):
the `## Shared` section, then `## Fix docs`.
Then read the same two sections from `.claude/skill-settings.local.md` in the MAIN checkout:
`git rev-parse --path-format=absolute --git-common-dir` with the trailing `/.git` removed.
A key in both files takes the local value.

- A value there overrides the default below.
- A rule there is followed as if written here.
- Read every doc `policy docs` names before step 1.
- Neither `sibling docs` nor `topic docs` set: name both keys and `.claude/skill-settings.md`, then stop.
- Any other key missing: use the default. Say ONCE, in one line, that the template is in the plugin's `templates/fix-docs.md`.

| Name | Key | Default |
|---|---|---|
| `<repo>` | Shared `repo` | `gh repo view` |
| `<base branch>` | Shared `base branch` | the repo's default branch |
| `<branch prefix>` | Shared `branch prefix` | `claude/` |
| `<worktree folder>` | Shared `worktree folder` | whatever `git worktree list` reports |
| `<sibling docs>` | `sibling docs` | none |
| `<sibling code>` | `sibling code` | none |
| `<topic docs>` | `topic docs` | none |
| `<doc index>` | `doc index` | none |
| `<out of scope>` | `out of scope` | none |
| `<list command>` | `list command` | none: `git ls-files` over the doc globs |
| `<coverage command>` | `coverage command` | none: step 1b is skipped |
| `<review layer>` | `review layer` | none |
| `<scope examples>` | `scope examples` | none |

Every command runs from the repo root, `git rev-parse --show-toplevel`.

## Where this sits

Two layers can catch drift, and this skill is the second one.

| Layer | Trigger | Output |
|---|---|---|
| PR review (`<review layer>`) | automatic, on a PR that touches the code a doc describes | a drift finding, fixed in that branch |
| **this skill** | the user runs it | **one** pull request over the whole corpus |

- Layer 1 catches drift the moment a diff creates it. When `<review layer>` is none, this skill is the only layer.
- This skill is the deep pass: drift no single recent diff would surface, because the code and the doc were never changed together.

## Where the docs are

| Surface | Path | Reached by |
|---|---|---|
| Per-screen help | `<sibling docs>` | the code file beside it, sharing its name (`<sibling code>`) |
| Guides | `<topic docs>` | the guide's entry in `<doc index>` |

The two surfaces are reached differently.
That matters when you decide what a doc is even about.

- A sibling doc sits BESIDE its screen and shares its name.
- A guide is written by TOPIC. The code it describes is named in `<doc index>`.
- Read a guide's entry before judging it: that list is what someone decided the guide covers.
- No `<doc index>`: the guide's own links and named screens are the only map. Say so in the PR body.
- Docs under `<out of scope>` are skipped.

## Hard rules

- **Never edit product code.** Docs only.
  A real product bug gets one line in chat, not a fix and not an issue.
- **One PR**, on a `<branch prefix><slug>` branch in a worktree under `<worktree folder>`.
  Never many, never a commit straight to `<base branch>`.
- **Be conservative on materiality.**
  - A control moved, restyled, or renamed cosmetically is **not** material.
  - A control removed or added, or a behavior change, **is**.
  - When genuinely unsure, fix it: a borderline correction is cheap, a missed drift is not.
- **Guides and help pages are user-visible copy.** Every Shared `posting rules` line about wording applies to them.
- Write for the reader. No jargon, no code identifiers in prose.

## Run it

### 1. Pick the scope

Ask the user if they have not said. Sensible scopes:

- One feature area (`<scope examples>`, or a folder they name)
- The guides only
- The whole corpus

The whole corpus can be large. Fan out with sub-agents rather than reading it serially.

**List it mechanically, never by hand-globbing.**

- `<list command>` when set.
- Otherwise `git ls-files` over `<sibling docs>` and `<topic docs>`, less `<out of scope>`.

### 1a. Narrow it, if the whole corpus is too much for one pass

Sibling docs whose code is NEWER than the doc are the cheapest candidates.
No stored state, just git. In a POSIX shell, with `<sibling docs>` as the glob and each `<sibling code>` extension in the inner loop:

    for doc in $(git ls-files '<sibling docs>'); do
      base="${doc%<doc extension>}"; code=""
      for c in "$base<code extension 1>" "$base<code extension 2>"; do [ -f "$c" ] && code="$code $c"; done
      [ -z "$code" ] && continue
      d=$(git log -1 --format=%ct -- "$doc"); c=$(git log -1 --format=%ct -- $code)
      [ "$c" -gt "$d" ] && echo "$doc"
    done

- It is a HEURISTIC: a doc older than its code is a place to look, never on its own a finding.
- Say which list you worked from in the PR body, so a reader knows what was not examined.

### 1b. Check what is missing, not just what is wrong

Run `<coverage command>` when set. Otherwise skip this step and say so in one line.

A sweep that only corrects existing pages can never find the page nobody wrote.
This lists screens with no help page and no guide covering them.
That is the one gap re-reading the corpus cannot surface.

Two things it reports, and they are different work:

- **NOTHING** - no help page, no guide. A missing doc.
- **Covered by a guide but with no help page** - reachable through a guide only.
  Often fine for a child screen; a gap for a screen someone lands on.

**Writing a missing page is a bigger ask than fixing a stale one.**
Do not fold it into a drift sweep unasked.
Report the gaps in chat, and let the user say whether this PR fills them.

### 2. Find the drift

For each doc in scope, one sub-agent:

1. Reads the **doc**.
2. Reads the **code it describes**.
   - For a sibling doc, that is the sibling code file.
   - For a guide, it is **the guide's entry in `<doc index>`**, not a guess from the title.
3. Decides **materiality**.
4. If material, rewrites the **complete file**, not a patch.

- Guides absent from `<doc index>` may describe no product code at all (a changelog, an FAQ, a contact page). Do not invent entries for those.
- **A guide whose entry is wrong is itself a finding.**
  If a sweep shows a guide describing code its entry does not name, fix the entry in the same PR.
  Broad patterns are the safe direction.

### 3. Land it

- One worktree branch, one commit per coherent group, one PR.
- Then run the normal review loop: spawn `workflow:pr-reviewer` with only the PR number, fix what gates, and let it rule on any pushback.

## What you never do

- Do not file cards, open issues, or email anyone.
- Do not invent a doc change for an immaterial diff just to show work.
- Do not edit product code, even when the doc is right and the code is wrong.
- Do not push to `<base branch>`.
