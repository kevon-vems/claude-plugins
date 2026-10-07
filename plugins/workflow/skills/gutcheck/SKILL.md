---
name: gutcheck
description: Decide whether the work in flight is clear enough to proceed without asking. Under 0.1 uncertainty, go - no permission-seeking, no menu. At or above it, name the ONE fork with a recommendation. Use when the user types /gutcheck, or asks "are you clear", "do you have a path", "can you just go".
---

# /gutcheck - clear enough to go?

A hesitation check, not a planning ritual. It runs against the work already
in flight in this conversation. It never starts new work and never restates
the plan back.

## Settings

Read `## Shared` and `## Gutcheck` in `.claude/skill-settings.md` at the
repo root (`git rev-parse --show-toplevel`). A rule there is followed as if
written here.

No file, or no section: carry on silently. This skill has nothing of
its own to tune, so it never mentions the file.

## The call

Judge the path forward for the current task.

| Uncertainty | Action |
|---|---|
| **< 0.1** | **GO.** One line saying so, then execute. No question, no menu. |
| **>= 0.1** | In SIMPLE terms, name all the forks that are actually blocking, each with a recommendation. |
