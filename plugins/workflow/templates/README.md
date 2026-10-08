# Settings templates

Each skill in this plugin, and the band, reads one file in the repo it runs in:

    .claude/skill-settings.md

That file holds a `## Shared` section and one section per skill. Each template here is one section: every key, what it does, and its default.

To set a repo up:

1. Create `.claude/skill-settings.md`.
2. Copy in `shared.md`, then the section of each skill you want to tune.
3. Delete every line you do not need. A missing line means the default.

No file at all is fine: every skill runs on its defaults.

Format:

- `- key: value` at the start of a line is a setting.
- An indented bullet under it is a note for people; skills do not read it as a value.
- A key that takes a list is repeated, one line per item.

## Private values: `.claude/skill-settings.local.md`

Some skills need values that must never be published: server names, database names, logins, cloud resource names, internal hostnames.
Those go in a second file, beside the first:

    .claude/skill-settings.local.md

- The repo gitignores it, so it is never committed.
- Same format and the same section names as `skill-settings.md`.
- A skill reads it AFTER `skill-settings.md`; a key in both takes the local value.
- A skill reads it from the MAIN checkout, never a worktree, because a gitignored file is not copied into worktrees:
  `(git rev-parse --path-format=absolute --git-common-dir)` with the trailing `/.git` removed.
- A skill that needs a key from it and finds none names the missing key and the file, then stops. It never guesses a value.
- Each template marks its private keys with `(local)`.
