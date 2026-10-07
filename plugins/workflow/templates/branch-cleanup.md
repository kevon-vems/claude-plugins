## Branch cleanup

Also reads these `## Shared` keys: `repo`, `base branch`, `branch prefix` (a current branch with this prefix stops the run), `worktree folder` (scanned for leftover empty folders; not set means that scan is skipped), `generated files` (dirty paths that do not block a worktree removal; default none).

- repos: this checkout only
  - One line per extra checkout path to walk in the same pass. Default: this checkout only.
- Add plain bullet rules for anything a guard in this repo blocks (paths you cannot inspect, commands that need a click).
