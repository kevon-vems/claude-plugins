import type { FleetRow } from '../types'
import { nameOf } from './fleet'

export const HANDOFF_PANE = 'band-handoff'
export const MAX_HANDOFF = 10000

export function handoffPrompt(focus: string, rules: string[]): string {
  const lines = [
    'Write a cold-start prompt that hands this work to a fresh Claude Code session.',
    'Reply with the prompt alone: no preamble, no closing note, no code fence around it.',
    'Cover, in this order, only what the next session needs:',
    '- the goal, in one or two lines',
    '- where the work lives: repo, branch, worktree path, issue and PR numbers',
    '- what is done and verified, and what is not',
    '- the next step, stated as an action',
    '- decisions made and rules the user set that the next session must keep',
    '- traps already hit, so they are not hit again',
    ...rules,
  ]
  const f = focus.trim()
  if (f) lines.push(`Focus the handoff on: ${f}`)
  return lines.join('\n')
}

export function cleanHandoff(text: string): string {
  const t = text.trim().replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1')
  return t.length <= MAX_HANDOFF ? t : `${t.slice(0, MAX_HANDOFF - 3).trimEnd()}...`
}

export type Target = { value: string; label: string }

export function targetsOf(rows: FleetRow[], prefix: string): Target[] {
  return rows
    .filter(r => !r.self)
    .map(r => {
      const name = nameOf(r.worktree, r.branch, prefix, r.top)
      const issue = r.issue ? ` #${r.issue}` : ''
      return { value: r.id, label: `${name}${issue} (${r.state})` }
    })
}
