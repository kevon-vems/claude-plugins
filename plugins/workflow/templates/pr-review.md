## PR review

Read by the `pr-review` skill and the `pr-reviewer` agent. Every line is optional.
Also read: `## Shared` keys `repo`, `base branch`, `worktree folder`, `human merges`, `review gated`, `posting rules`, `people`.

- start on PR open: yes
  - `yes`: the session that opens a PR starts the review loop at once, with no question. `no`: the loop starts only when asked. Default: `yes`.
- round cap: 3
  - Review rounds allowed since the user's last input before the loop stops and summarizes. Default: `3`.
- cap reset:
  - One line per extra thing that counts as the user's input and resets the cap. Always counted: a typed message, a click on a question the skill asked, an unsigned human reply on the PR. Default: none extra.
- merge guard: none
  - Name a hook that blocks a merge until the review is clean, if the repo has one. `none`: the skill keeps its own round cap and never assumes anything else will stop a merge. Default: `none`.
- auto-ship: none
  - Paths where a PR that is review-clean, CI-green and nit-free may run `/shipit --yes` on its own. `none`: the skill asks first. `all except human merges`: any PR touching nothing in Shared `human merges`. Default: `none`.
- nits: ask
  - `ask`: ask once per PR whether to fix open nits. `fix`: always fix them. `leave`: never fix them. Default: `ask`.
- prose can gate: no
  - `no`: a finding whose whole fix is words a human reads (comment, docstring, markdown, help page) is always a `nit`. `yes`: graded like code. Default: `no`.
- body-only paths:
  - One line per path prefix. A PR whose every changed file sits under these gets ONE review with every finding in its body: no inline comments, no thread replies. Default: none.
- reviewer model:
  - Model for the `pr-reviewer` agent. Default: the agent's own.
- low-risk model:
  - Model for the reviewer when every changed line is a comment, whitespace or display text. Default: none (use `reviewer model`).
- low-risk also:
  - One line per extra kind of change that still counts as low risk (for example a test id attribute). Default: none.
- convention docs: CLAUDE.md, AGENTS.md
  - The repo's own rule docs the Convention dimension reviews against. Default: `CLAUDE.md` and `AGENTS.md` at the repo root, when present.
- doc drift tool:
  - A command that lists doc pages the diff changed the code behind and did not update. `<base>` is replaced with the base SHA. Default: none (the Doc drift dimension is skipped).
- doc drift docs:
  - One line per kind of doc the Doc drift dimension covers (for example `*.readme.md`). Default: none.
- test run: <path> = <command>
  - One line per path whose tests the reviewer runs when the diff touches it, in a checkout at exactly the PR head. A failing test is a `blocking` finding. Default: none (no tests run).
- review rule:
  - One line per house rule for what a review must never contain, or how it must format something. Default: none beyond the skill's own.
