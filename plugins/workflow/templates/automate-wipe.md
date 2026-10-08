## Automate-wipe

Read by /automate-wipe. Plain bullets under the keys are rules, followed as if written in the skill. Keys marked `(local)` go in `.claude/skill-settings.local.md`, never in the committed file.

- seed project: none
  - Required. Path to the seed tool's project, relative to the repo root.
- seed command: dotnet run --project <seed project> --
  - How to start the seed tool. Arguments go after it.
- list flag: none
  - Required. Prints each disposable catalog as orphan or spared, drops nothing.
- drop flag: none
  - Required. Drops every orphaned disposable catalog.
- reseed args: none
  - Required. Cold-seeds the plain catalog, e.g. `--db <plain catalog> --force`.
- reseed args alternate: none
  - Another way to do the same seed, and what it needs.
- describe args: none
  - Prints what the automation source seeds, without connecting.
- plain catalog: none (local)
  - Required. The one automation catalog that must exist at the end.
- worktree catalog pattern: none (local)
  - Required. How a per-worktree catalog is named, e.g. `<plain catalog>-<slug>-<hash>`, plus any shard suffix.
- probe catalog: none (local)
  - A second disposable catalog family, dropped with its children.
- protected catalogs: none (local)
  - One per line. Catalogs the sweep must never touch. Seeing one in the list output stops the skill.
- server: none (local)
  - The database server, and whether other machines share it.
- active run refusal: none
  - Text and exit code printed when a test run is in flight, and how long a lock is honored.
- lock exit code: none
- not local exit code: none
- bad argument exit code: none
  - Exit codes the seed tool uses. Default: none; the skill reports the code and output and stops.
- schema build command: none
  - Builds the schema package. Run from the checkout root.
- timing: none
  - Expected time for the cold seed, e.g. `about 45s`.
- docs: none
  - Docs for flags and safety rationale. One path per line.
