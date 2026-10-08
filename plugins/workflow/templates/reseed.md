## Reseed

Read by /reseed. Plain bullets under the keys are rules, followed as if written in the skill. Keys marked `(local)` go in `.claude/skill-settings.local.md`, never in the committed file.

- seed project: none
  - Required. Path to the seed tool's project, relative to the repo root.
- seed command: dotnet run --project <seed project> --
  - How to start the seed tool. Arguments go after it.
- target: dev = Dev / Dev
- target: qa = QA / QA
- target: demo = Demo / Demo
  - Required. One line per valid argument: `<typed> = <destination value> / <source value>`. Nothing else is accepted.
- destination flag: --destination
- source flag: --source
- force flag: --force
  - Forces a cold seed. The skill adds it only on a foreign or missing backup, or when asked.
- describe flag: --describe
  - Prints what a source seeds without connecting. Used to read back the result.
- local targets file: none
  - Gitignored file the destination is resolved from. Copied from the main checkout when a worktree lacks it.
- schema build command: none
  - Builds the schema package the seed tool deploys. Run from the checkout root.
- lock exit code: none
- lock override: none
  - Env var or file that bypasses the run lock. The skill never sets or deletes it.
- not local exit code: none
- bad argument exit code: none
  - Exit codes the seed tool uses. Default: none; the skill reports the code and output and stops.
- timing: none
  - Expected run times, cold and restore, e.g. `about 45s cold, about 5s restore`.
- target note: none
  - `<typed> = <text>`. Said once before seeding that target. Not a gate.
- pipeline target: none
  - `<typed> = <required source>`. The test pipeline's own catalog; any other source gets a warning first.
- catalog: none (local)
  - `<typed> = <database name>`. Only used to name the catalog in the report.
- docs: none
  - Docs for flags, recipes and safety rationale. One path per line.
