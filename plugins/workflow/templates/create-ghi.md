## Create GHI

Read by /create-ghi. Every line is optional. Names and pronouns come
from Shared `people`.

- issue repo: <owner/name>
  - Where the issue is filed. Default: Shared `repo`, else `gh repo view`.
- bug label: bug
  - Label put on a bug. Left off if the repo has no such label. Default: `bug`.
- enhancement label: enhancement
  - Label put on a feature request. Left off if the repo has no such label. Default: `enhancement`.
- environment fields: where it happened (app, area, account), browser or runner, build
  - What the Environment section asks for. Default: as shown.
- always use: <name>
  - A reporter whose bugs always go through this skill, never a write-up of their narrative. One line per person. Default: none.
- Plain bullet rules here are followed as if written in the skill, for example where a reporter's own preferences live.
