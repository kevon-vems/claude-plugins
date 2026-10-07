export const PLUGIN = 'band'
export const MARKETPLACE = 'kevon-vems'
export const SETTINGS_FILE = '.claude/skill-settings.md'

export type BandButton = { label: string; run?: string; say?: string }

export type BandConfig = {
  buttons: BandButton[]
  issueBranch: RegExp
  branchPrefix: string
  autoText: string
  handoffRules: string[]
  extraSkills: string[]
}

export const DEFAULTS: BandConfig = {
  buttons: [
    { label: 'Go', say: 'go' },
    { label: 'Ship it', run: 'shipit' },
    { label: 'PR review', run: 'pr-review' },
    { label: 'Gutcheck', run: 'gutcheck' },
    { label: 'GH-Go', run: 'gh-go' },
  ],
  issueBranch: /^(?:[^/]+\/)?(\d+)-/,
  branchPrefix: 'claude/',
  autoText: 'go (auto-continue: start the plan you proposed; anything with its own approval still waits)',
  handoffRules: ['Short lines, bullets, plain words.'],
  extraSkills: [],
}

export function sectionOf(text: string, name: string): [string, string][] {
  const out: [string, string][] = []
  let inside = false
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const head = /^##\s+(.+?)\s*$/.exec(raw)
    if (head) {
      inside = head[1].toLowerCase() === name.toLowerCase()
      continue
    }
    if (!inside) continue
    const m = /^[-*]\s+([^:]+?)\s*:\s*(.*?)\s*$/.exec(raw)
    if (m) out.push([m[1].toLowerCase(), m[2].replace(/^`(.*)`$/, '$1')])
  }
  return out
}

export function buttonOf(value: string): BandButton | undefined {
  const m = /^(.+?)\s*=\s*(.+)$/.exec(value)
  if (!m) return undefined
  const label = m[1].trim()
  const what = m[2].trim()
  if (what.startsWith('/')) return what.length > 1 ? { label, run: what.slice(1) } : undefined
  const say = /^say\s+(.+)$/i.exec(what)
  return say ? { label, say: say[1] } : undefined
}

export function issuePattern(value: string): RegExp | undefined {
  if (!value.includes('{issue}')) return undefined
  const [before, after] = value.split('{issue}', 2).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${before}(\\d+)${after}`)
}

export function configOf(text: string | undefined): BandConfig {
  if (!text) return DEFAULTS
  const entries = sectionOf(text, 'Band')
  const all = (key: string) => entries.filter(([k]) => k === key).map(([, v]) => v).filter(Boolean)
  const one = (key: string) => all(key).pop()
  const buttons = all('button').map(buttonOf).filter((b): b is BandButton => b !== undefined)
  const rules = all('handoff rule')
  const prefix = one('branch prefix')
  return {
    buttons: buttons.length ? buttons : DEFAULTS.buttons,
    issueBranch: issuePattern(one('issue branch') ?? '') ?? DEFAULTS.issueBranch,
    branchPrefix: prefix === undefined ? DEFAULTS.branchPrefix : prefix === 'none' ? '' : prefix,
    autoText: one('auto-continue text') ?? DEFAULTS.autoText,
    handoffRules: rules.length ? rules : DEFAULTS.handoffRules,
    extraSkills: all('extra skill'),
  }
}
