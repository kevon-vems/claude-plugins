## GH-Go

Read by /gh-go. Every line is optional. Branch, worktree and repo
settings come from `## Shared`.

- issue repo: <owner/name>
  - Where issues are picked from. Default: Shared `repo`, else `gh repo view`.
- pick order: newest
  - `newest` or `oldest` unassigned open issue first. Default: `newest`.
- data query: none
  - The tool, and how to call it, for checking a data claim (a column, a row count, a schema) live. Add plain bullet rules under it for how it may be used. Default: none, so the data check is skipped.
- never run: none
  - Extra things the verify step must never launch, one per line, on top of a deploy and a full test run. Default: none beyond those two.
- doc: <path>
  - A doc to read before verifying, such as the repo's branch or worktree policy. One line per doc. Default: none.
- Plain bullet rules here are followed as if written in the skill, for example how branches and worktrees are cut when work starts.
