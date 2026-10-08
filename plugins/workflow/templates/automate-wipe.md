## Automate-wipe

Read by /automate-wipe. Plain bullets under the keys are rules, followed as if written in the skill. Keys marked `(local)` go in `.claude/skill-settings.local.md`, never in the committed file.

- wipe command: none
  - Required. The script that drops the per-branch catalogs, with `<root>` for the repo root.
- list flag: none
  - Added to the wipe command to show what would go without dropping anything.
- branch catalogs: none (local)
  - Required. One pattern per line: the catalogs the script drops.
- kept catalogs: none (local)
  - One per line: catalogs that match nothing above or are spared on purpose, shown as untouched.
- server: none (local)
  - The database server, named in the report.
