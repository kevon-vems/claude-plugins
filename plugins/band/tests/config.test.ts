import { expect, test } from 'claude-code/testing'
import { DEFAULTS, buttonOf, configOf, issuePattern, sectionOf } from '../hooks/config.ts'
import { buttonsOf } from '../hooks/register.tsx'
import { due, ownPlugins, UPDATE_MS } from '../hooks/update.ts'

const FILE = [
  '# Skill settings',
  '',
  '## Shared',
  '- button: Not mine = /nope',
  '',
  '## Band',
  '- button: Go = say go',
  '- button: Ship it = /shipit',
  '- button: Broken',
  '- issue branch: `claude/{issue}-`',
  '- branch prefix: claude/',
  '- auto-continue text: go (auto-continue, armed by the owner)',
  '- handoff rule: Short lines.',
  '- handoff rule: Never a dash pair.',
  '- extra skill: deep-research',
  '',
  '## Shipit',
  '- button: Also not mine = /nope',
].join('\r\n')

test('a section is read until the next heading, and only that section', () => {
  const got = sectionOf(FILE, 'band')
  expect(got[0]).toEqual(['button', 'Go = say go'])
  expect(got.some(([, v]) => v.includes('nope'))).toBe(false)
  expect(sectionOf('﻿## Band\n- branch prefix: x/\n  - Default: claude/', 'Band')).toEqual([['branch prefix', 'x/']])
})

test('a button runs a command or says a line; anything else is dropped', () => {
  expect(buttonOf('Ship it = /shipit')).toEqual({ label: 'Ship it', run: 'shipit' })
  expect(buttonOf('Go = say go')).toEqual({ label: 'Go', say: 'go' })
  expect(buttonOf('Broken')).toBeUndefined()
  expect(buttonOf('Empty = /')).toBeUndefined()
  expect(buttonOf('Odd = shipit')).toBeUndefined()
})

test('the issue branch names where the number sits', () => {
  const p = issuePattern('claude/{issue}-')!
  expect(p.exec('claude/4740-band')?.[1]).toBe('4740')
  expect(p.exec('feature/4740-band')).toBeNull()
  expect(issuePattern('claude/')).toBeUndefined()
  expect(issuePattern('a.b/{issue}')!.exec('axb/12')).toBeNull()
})

test('the repo file sets every value it names', () => {
  const c = configOf(FILE)
  expect(c.buttons).toEqual([{ label: 'Go', say: 'go' }, { label: 'Ship it', run: 'shipit' }])
  expect(c.issueBranch.exec('claude/12-x')?.[1]).toBe('12')
  expect(c.issueBranch.exec('12-x')).toBeNull()
  expect(c.branchPrefix).toBe('claude/')
  expect(c.autoText).toBe('go (auto-continue, armed by the owner)')
  expect(c.handoffRules).toEqual(['Short lines.', 'Never a dash pair.'])
  expect(c.extraSkills).toEqual(['deep-research'])
})

test('no file, or a file without a band section, keeps the defaults', () => {
  expect(configOf(undefined)).toBe(DEFAULTS)
  expect(configOf('## Shared\n- repo: a/b')).toEqual(DEFAULTS)
  expect(configOf('## Band\n- branch prefix: none').branchPrefix).toBe('')
})

test('a command button shows only when the command is loaded; until the list is read, all show', () => {
  const all = [{ label: 'Go', say: 'go' }, { label: 'Ship it', run: 'shipit' }, { label: 'GH-Go', run: 'gh-go' }]
  expect(buttonsOf(all, new Set(['shipit'])).map(b => b.label)).toEqual(['Go', 'Ship it'])
  expect(buttonsOf(all, undefined)).toEqual(all)
})

test('self-update picks only this marketplace, at most every few hours', () => {
  const list = JSON.stringify([
    { id: 'band@kevon-vems', scope: 'user' },
    { id: 'workflow@kevon-vems', scope: 'project' },
    { id: 'pdf@claude-plugins-official', scope: 'user' },
    { id: 'odd@kevon-vems' },
  ])
  expect(ownPlugins(list)).toEqual([{ id: 'band@kevon-vems', scope: 'user' }, { id: 'workflow@kevon-vems', scope: 'project' }])
  expect(ownPlugins('not json')).toEqual([])
  expect(due('', 0)).toBe(true)
  expect(due(JSON.stringify({ at: 1000 }), 1000 + UPDATE_MS - 1)).toBe(false)
  expect(due(JSON.stringify({ at: 1000 }), 1000 + UPDATE_MS)).toBe(true)
  expect(due('{"at":"x"}', 5)).toBe(true)
})
