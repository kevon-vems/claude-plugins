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
