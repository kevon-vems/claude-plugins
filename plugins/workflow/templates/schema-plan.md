## Schema plan

Read by /schema-plan. Plain bullets under the keys are rules, followed as if written in the skill. Keys marked `(local)` go in `.claude/skill-settings.local.md`. Paths are relative to the repo root (`git rev-parse --show-toplevel`).

- operator: the user
  - Who clicks the questions and owns the merge.
- plan contract doc: none
  - Required. The doc that defines the plan JSON format. Read before authoring anything.
- plan folder: none
  - Required. Where plan JSON files live, e.g. `db/deploy-plans/`.
- target environment: none
  - Required. The one environment phased plans deploy to, as the engine names it, e.g. `Production`.
- target label: none
  - Words a destructive-publish click label must carry, e.g. `on prod`. Default: none.
- direct publish environments: none
  - Environments that publish their schema directly and never take a plan, one line, comma-separated.
- direct publish command: none
  - Command that publishes one direct environment. `<Env>` stands for its name.
- report command: none
  - Required. Read-only destructive report for the target. `<ReleaseSha>` stands for the release commit, e.g. `deploy/prod/publish-schema.ps1 -Ref <ReleaseSha> -ReportOnly`.
- expand ref command: none
  - Required. Builds, tags and pushes the expand commit. `<ReleaseSha>`, `<plan-name>` and `<report lines>` are filled in.
- expand ref dry run flag: -WhatIf
  - Added to `expand ref command` for the free preview run.
- expand ref keep worktree flag: -NoPush
  - Added for Path B, so the worktree stays for the intermediate shape.
- engine command: none
  - Required. Validates a committed plan without publishing. `<plan-worktree>`, `<Env>` and `<plan-name>` are filled in.
- environments file: none
  - File that declares which applications each environment runs.
- post-deployment script: none
  - Required. The script that runs on every publish, where backfills go.
- plan branch: <branch prefix><plan-name>-plan
  - The review branch for the plan JSON.
- merge command: gh pr merge <n> --squash
  - How the plan PR is merged on the operator's click. Never with `--delete-branch`.
- deploy tool: none (local)
  - Required. Name or URL of the tool that runs the deploy and picks up a merged plan, plus how fast it pulls the base branch.
