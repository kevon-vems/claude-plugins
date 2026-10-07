---
name: skills
description: List every skill available on this box with what it does and when to reach for it. Use when the user asks "what skills are there", at the start of a session to orient, or when unsure whether a ritual already exists before improvising one.
---

# /skills - what's on the shelf

(Named `skills`, not `help` - `/help` is a built-in Claude Code command
and a skill cannot shadow it.)

## Settings

Read `## Shared` and `## Skills` in `.claude/skill-settings.md` at the
repo root (`git rev-parse --show-toplevel`). A value there overrides the
default below. A rule there is followed as if written here.

No file, or no section: use the defaults. Say once, in one line, that
`.claude/skill-settings.md` can tune it and the template is in the
plugin's `templates/` folder.

- `skill folder`: one line per folder to enumerate. Default:
  `<root>/.claude/skills/`, plus this plugin's own `skills/` folder (the
  parent of the folder this skill loaded from).
- `pairing`: one line per standing pairing to close with. Default: none.

## Do

1. Enumerate dynamically - never from memory, the list goes stale. For
   each skill folder:

       for f in <skill folder>/*/SKILL.md; do
         # print the frontmatter name + first sentence of description
         awk '/^name:/{n=$2} /^description:/{sub(/^description: /,"");
              print n " -- " $0; exit}' "$f"
       done

2. Present a table: skill | when to use (first sentence of its
   description) | invocation example.

3. Close with the standing pairings the settings list, so the reader
   knows the intended flow, not just the inventory. None set: skip this
   step.

4. If the user asked because they're about to improvise a procedure:
   say which existing skill covers it, or say plainly that none does -
   a missing ritual worth packaging is worth telling the user about.
