## Fix docs

Read by /fix-docs. Branch, worktree and repo settings come from `## Shared`. Plain bullets under the keys are rules, followed as if written in the skill.

- sibling docs: none
  - Glob for docs that sit beside the code file they describe and share its name, e.g. `src/**/*.readme.md`. Set this or `topic docs`; the skill stops with neither.
- sibling code: none
  - The code file extensions a sibling doc describes, e.g. `.tsx, .tsx.test`. The doc's own extension is stripped and each of these tried.
- topic docs: none
  - Glob for guides written by topic rather than beside one screen.
- doc index: none
  - A file mapping each guide to the code it covers. Default: none; each guide's own links are the only map.
- out of scope: none
  - Paths under the doc globs that are never swept (test-support docs). One line, comma-separated.
- list command: none
  - A command that lists every doc surface. Default: `git ls-files` over the doc globs. `<root>` is `git rev-parse --show-toplevel`.
- coverage command: none
  - A command that lists screens with no doc at all. Default: none; that step is skipped.
- review layer: none
  - What in PR review already catches drift in one diff, if anything.
- scope examples: none
  - A feature folder or two to offer when asking the user for a scope.
- policy docs: none
  - Docs to read before step 1. One path per line.
