## Band

Read by the band plugin. Every line is optional.

- button: Go = say go
- button: Ship it = /shipit
- button: PR review = /pr-review
- button: Gutcheck = /gutcheck
- button: GH-Go = /gh-go
  - One line per button. `= /name` runs that command; `= say <text>` sends the text as you. A command button shows only when that command is loaded. The lines above are the defaults.
- issue branch: claude/{issue}-
  - Where the issue number sits in a branch name; `{issue}` marks it. With no line, the band takes a number then a hyphen, after at most one prefix (`claude/123-x`, `123-x`).
- branch prefix: claude/
  - Dropped from the branch name shown on the band. `none` shows the full name. Default: `claude/`.
- handoff rule: Short lines, bullets, plain words.
  - One line per rule /handoff adds to the prompt it writes.
- extra skill:
  - One line per skill from outside this repo to list in the band's Skills menu, e.g. `- extra skill: deep-research`.
