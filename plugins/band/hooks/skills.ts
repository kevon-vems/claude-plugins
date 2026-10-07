import type { SkillRow } from '../types'

export const SKILLS_PANE = 'band-skills'

export function skillRows(repo: string[], extra: string[]): SkillRow[] {
  const inRepo = new Set(repo)
  return [...new Set([...repo, ...extra])]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, repo: inRepo.has(name) }))
}

export function splitSkill(text: string): { description?: string; body: string } {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { body: text.trim() }
  const d = /^description:\s*(.*)$/m.exec(m[1])?.[1]?.trim().replace(/^(["'])(.*)\1$/, '$2')
  return { description: d || undefined, body: text.slice(m[0].length).trim() }
}
