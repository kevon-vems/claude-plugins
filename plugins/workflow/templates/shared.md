## Shared

Read by every skill in this plugin, and by the band. Every line is optional. A missing line means the default shown.

- repo: gh repo view
  - `owner/name` on GitHub. Default: what `gh repo view --json nameWithOwner` reports for this checkout.
- base branch: the repo's default branch
  - The branch PRs merge into.
- branch prefix: claude/
  - Put in front of every branch a skill creates. `none` for no prefix.
- worktree folder: whatever `git worktree list` reports
  - Where new worktrees go, e.g. `<root>/Worktrees/`. `<root>` is `git rev-parse --show-toplevel` of the main checkout.
- issue in PR title: no
  - `yes`: a PR opened for a GitHub issue carries `#<number>` in its title.
- human merges: ALL paths
  - Paths where a person must merge. One line, comma-separated, `except` allowed (`src/ except src/tests/`). Default: every path, so nothing auto-ships.
- review gated: every PR
  - Paths where a clean review is required before a merge. Same form as `human merges`.
- generated files: none
  - Build output a skill may discard when it finds it dirty. One line, comma-separated.
- posting rules: none
  - One line per rule for anything posted to GitHub (PR bodies, reviews, replies, issues). Repeat the key for each rule.
- people: none
  - One line per person: name, GitHub login, pronouns, and whose replies count as rulings. Anyone not listed is they/them.
