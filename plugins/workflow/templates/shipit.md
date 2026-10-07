## Shipit

Read by /shipit. Every line is optional. It also reads `## Shared`: `repo`, `base branch`, `worktree folder`, `human merges`, `posting rules`, `generated files`, `people`.

- merge method: repo default
  - `squash`, `merge` or `rebase`. Default: the one method the repo allows; when it allows several, /shipit asks.
- required checks: all
  - One line per check name that must be present and passing before a merge. Default: every check on the head must pass; other failing checks are only named when a list is given.
- after deploy heading: none
  - The exact PR-body heading where one-time after-deploy steps go, e.g. `## After deploy`. /shipit writes missing steps under it before merging. Default: none, the step is skipped.
- after deploy trigger:
  - One line per extra sign that a PR leaves a one-time step (a folder, a file type, a setting kind). Used only with a heading. Default: the generic signs in the skill.
- deploy after merge: none
  - A command to offer after the merge. /shipit always asks before running it, and skips it when the tool is missing. Default: none, /shipit never deploys.
- handoff:
  - One line per teammate the issue can be handed to, as `<label> = <github login>`, e.g. `QA = some-login`. At most two are offered. Default: none.
- handoff label: none
  - A label added when the issue is reassigned after the merge. Default: none.
- handoff comment: Merged. Back to @{login}. | Merged. Over to @{login}.
  - The comment posted on reassignment: first for the originator, second for a handoff. Default: as shown.
- close leaves labels: yes
  - `yes` leaves assignees and labels alone when /shipit closes an issue. Default: yes.
- docs:
  - One line per doc in this repo that /shipit reads before it starts, e.g. a commit policy. Default: none.
- One plain bullet per house rule /shipit follows as if it were written in the skill.
