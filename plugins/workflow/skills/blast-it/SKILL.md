---
name: blast-it
description: Summarize the work of THIS session into an email to the team, built on the repo's house email templates, drafted to the scratchpad and sent only on an explicit yes. Use when the user says /blast-it, "blast it", "email the team about this", or asks for a session summary sent out.
---

# /blast-it - send the team what this session did

The session already knows what it did.
This skill turns that into an email a non-engineer can read, in the house style, and puts it in front of the user before anything leaves the building.

**Usage**

    /blast-it                  # summarize this session
    /blast-it --draft          # stop after the scratchpad file, do not offer to send
    /blast-it <topic>          # narrow it to one thread of the session

## 0. Read the settings

Two files, both optional, in this order:

1. `.claude/skill-settings.md` at the repo root (`git rev-parse --show-toplevel`).
2. `.claude/skill-settings.local.md` in the MAIN checkout: `(git rev-parse --path-format=absolute --git-common-dir)` with the trailing `/.git` removed. A gitignored file is not copied into worktrees.

From each, read the `## Shared` section, then the `## Blast it` section.

- A key in both files takes the local value.
- A value overrides the default this skill states.
- A rule there is followed as if written here.
- No file, or no section: use the defaults, and say ONCE, in one line, that the settings files can tune this skill and the template is in the plugin's `templates/blast-it.md`.
- A missing file never stops the skill.

Values this skill uses. `(local)` keys belong in `skill-settings.local.md`.

| Key | From | Default |
|---|---|---|
| `people` | Shared | none (they/them) |
| `style guide` | Blast it | none |
| `team file` | Blast it | none: ask for every address |
| `sender` | Blast it | the person `git config user.name` names |
| `sender profile` | Blast it | none |
| `signature` (local) | Blast it | from `sender profile`; else the sender's name alone |
| `template` | Blast it | none: plain, simple HTML |
| `brand chrome` | Blast it | the template's header, colors, panels and sign-off |
| `never draft into` | Blast it | none |
| `mail tool` | Blast it | the mail connector this session has |
| `product name rule` | Blast it | none |

Seven steps, in this order.
Steps 1 and 2 come first for a reason: both mistakes this skill exists to prevent were made by writing before reading.

## 1. Read the style before writing a word

Every run, no cache and no memory:

| File | What it decides |
|---|---|
| `style guide` | colors, type, the product name rule |
| `team file` | who exists, their reach, their availability, their address |
| `sender profile` | voice, signature, audience rule, per-person rules |

- The sender is `sender`: whoever this machine belongs to, not whoever the session has been talking about.
- A file not set: skip it and say so in one line.

**Never hand-roll the HTML when a `template` is set.**
The templates are the house style; a generic table with a grey header is not.
This was the first thing that went wrong the day this skill was written.

## 2. Pick the template, then strip what does not apply

`template` maps each kind of email to a file, e.g. a project moving, something launched, something broken, something needed from someone, something escalating.

**Most session summaries are none of those.**
They are an informational note: here is what changed, here is what it means for you.

Take the nearest template for its `brand chrome`, then **delete the project furniture**:

- any status badge, and any `On Track` / `At Risk` wording
- any milestone table
- a header label like `STATUS UPDATE`, replaced with what the email actually is
- section labels that presume a project (`Completed`, `Up Next`)

An info email is not a status update.
Do not invent a milestone to fill a row, and do not call something on track that was never a project.
This was the second thing that went wrong.

No `template` set: write plain, simple HTML, and say once that no house template is configured.

## 3. Write for the least technical reader on the list

If **anyone** who is not an engineer is receiving it, the **whole body** is non-technical.
A blast does not get an exemption because one recipient could follow the detail.
`sender profile` may state this as a standing rule; it holds either way.

Out of the body entirely:

- file and script names, branch names, PR and issue numbers, commit shas
- endpoints, package versions, deployment targets
- how the answer was found

**Per-person rules** in `sender profile` govern a **direct** email to one person.
A blast to several people follows the standing rule instead.

**Voice:**

- Terse. Structure carries the point.
- Intro one or two sentences; closing one.
- Draft at roughly half the length that feels natural, then cut again.
- Any voice rules in `sender profile` win.

**Signature:** `signature`, verbatim.
Never add a line, and never append a title it does not carry.

## 4. Say what is not settled

A summary that only lists wins is a worse summary.
Every run names, in plain language:

- what changed, and what it means for each person receiving it
- what is **not** confirmed yet, and what would confirm it
- what has **not** changed, where someone might reasonably assume it had

If nothing is unconfirmed, say so in a line. Do not pad it.

## 5. Draft to the scratchpad, never the repo

A one-off email is not repo work.
No branch, no commit, no PR, and nothing under `never draft into`.

- Write it to the session scratchpad as `email-<slug>.html`.
- Fill every `{{PLACEHOLDER}}`.
- Delete every optional block that does not apply.
- Hand the file over so it renders.
- Then show the substance in chat as well: the file and the chat are read by different people at different times.

The one exception is an email that is itself a tracked project deliverable.
That is ordinary repo work and does not belong in this skill.

## 6. Recipients

**Never invent an address.**

- `team file` is the only source, and it may not hold everyone.
- Name who is missing and ask.
- No `team file` set: ask for every address.

## 7. Then send, only on an explicit yes

Ask with `AskUserQuestion`, and take the answer literally:

- **Leave it as a file** - hand it over and stop
- **Mail draft** - create it unsent in `mail tool`, addressed or not, for the user to send
- **Send it** - only on an explicit yes that names the recipients

Sending is the one irreversible step in this skill.

- A yes to the draft is not a yes to the send.
- An answer to a different question is not a yes at all.
- `--draft` skips this step and step 6 entirely.

## What this skill never does

- Send without an explicit yes naming who it goes to.
- Guess an address, or reuse one from an unrelated file.
- Put technical detail in a body a non-engineer is receiving.
- Commit the draft, or file it under a project folder.
- Write an em-dash or en-dash into the file. Single hyphen, always.
- Break `product name rule` in copy a reader sees. Addresses, hostnames, code identifiers and cloud resource names are not the product name and do not change.
