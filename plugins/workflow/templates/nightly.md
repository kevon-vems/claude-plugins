## Nightly

Read by /nightly. Repo, base branch, branch prefix and merge rules come from `## Shared`. Plain bullets under the keys are rules, followed as if written in the skill.

- workflow: none
  - Required. The GitHub Actions workflow file that runs the nightly tests and writes the report, e.g. `nightly.yml`.
- artifact: none
  - Required. The name of the artifact that workflow uploads, holding `nightly-result.json` and the other report files.
- stale after: 30
  - Hours. A newest run older than this means the nightly did not run.
- log markers: `===== BEGIN <NAME> =====` and `===== END <NAME> =====`
  - The lines the workflow prints around each report file in its job log. `<NAME>` is the file name.
- log step: none
  - The workflow step that prints the report files into the job log. Used when this machine cannot download the artifact. Default: none, so no log fallback.
- caught label: none
  - The label on a fix PR (or its issue) for a real product bug the nightly caught. Default: none, so the count and the label rule are skipped.
- caught window: 30
  - Days counted in the "last N days" half of the regressions-caught line.
- test folder: none
  - Where tests live, for the removed-test history search and the Lane B look. Default: the whole tree.
- coverage skip: none
  - What to leave out of "methods no test ran": paths, or kinds such as constructors. One line, comma-separated.
- test claim: none
  - How a component names the test that covers it (an attribute, a comment tag). Used in the fix-session prompt for new gaps.
- dead code keep file: none
  - The file that lists detector code kept on purpose, each with a reason.
- dead code proof: none
  - The command that proves a detector delete lost no rows. `<root>` is `git rev-parse --show-toplevel`.
- verify label: Launch verification run
  - The option label the fix session shows before it starts the verification run.
- date format: YYYY-MM-DD
  - How dates are written in the report.
