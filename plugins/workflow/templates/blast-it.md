## Blast it

Read by /blast-it. Every line is optional. It also reads `## Shared`: `people`.

Keys marked `(local)` hold values that must never be published. Put them in `.claude/skill-settings.local.md` (gitignored, read from the main checkout), under the same `## Blast it` heading. See `README.md`, "Private values". Prefer pointing a committed key at a file the repo already keeps private over copying its contents into the local file.

- style guide: none
  - The brand guide: colors, type, the product name rule. Read every run.
- team file: none
  - The ONLY source of colleagues' addresses, reach and availability. Default: ask for every address.
- sender: git config user.name
  - How to find who this machine belongs to, e.g. a machine-to-person map. Never whoever the session talked about.
- sender profile: none
  - The sender's file holding voice, signature, the audience rule and per-person rules. `<sender>` stands for the person.
- signature: none (local)
  - The exact sign-off, one line per line, separated by ` | `. Default: as `sender profile` gives it; else the sender's name alone.
- template:
  - One line per kind of email, as `<kind> = <path>`, e.g. `status update = email-templates/status.html`. Default: none, plain HTML.
- brand chrome: the template's header, colors, panels and sign-off
  - What to keep from a template when the email is an informational note.
- never draft into: none
  - Folders a one-off email must never be written to, e.g. tracked project folders.
- mail tool: the session's mail connector
  - Where an unsent mail draft is created.
- product name rule: none
  - How the product's name is written in copy a reader sees.
- One plain bullet per house rule /blast-it follows as if it were written in the skill.
