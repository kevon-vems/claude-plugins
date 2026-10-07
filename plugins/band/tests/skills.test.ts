import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { skillRows, splitSkill } from '../hooks/skills.ts'

test('repo skills and marked ones are listed once, sorted, with their source', () => {
  expect(skillRows(['shipit', 'gutcheck'], ['simplify', 'shipit'])).toEqual([
    { name: 'gutcheck', repo: true },
    { name: 'shipit', repo: true },
    { name: 'simplify', repo: false },
  ])
})

test('a skill file splits into its description and body', () => {
  expect(splitSkill('---\r\nname: x\r\ndescription: "Ship the PR"\r\n---\r\n\r\n# Ship\nbody')).toEqual({ description: 'Ship the PR', body: '# Ship\nbody' })
  expect(splitSkill('# No front\n')).toEqual({ body: '# No front' })
})

const PANE = { component: 'Pane', requestId: 'band-skills', props: { title: 'Skills', isFocused: false, bodyColumns: 120, placement: 'dock' } } as const
const fwd = (p: string) => p.replace(/\\/g, '/')

function world(on: On, listFails = false) {
  const runs: string[] = []
  const writes: string[] = []
  on('session.id', () => ({ value: 'me' }) as never)
  on('session.cwd', () => ({ value: 'C:/repo' }) as never)
  on('session.start', (_$, e) => ({ cwd: (e as { cwd: string }).cwd }) as never)
  on('env.get', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    runs.push(argv.join(' '))
    const ok = argv.join(' ').startsWith('git rev-parse --show-toplevel') || argv[1] === 'rm'
    return { value: { exitCode: ok ? 0 : 1, stdout: ok ? 'C:/repo\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('fs.list', (_$, e) => {
    const p = fwd((e as { path: string }).path)
    if (!p.endsWith('.claude/skills')) return { value: [] } as never
    if (listFails) return { deny: 'EACCES' } as never
    return { value: [
      { name: 'shipit', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      { name: 'README.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false },
    ] } as never
  })
  on('fs.read', (_$, e) => {
    if (fwd((e as { path: string }).path).endsWith('.claude/skills/shipit/SKILL.md')) return { value: '---\ndescription: Land the PR\n---\n# Shipit\nSteps.' } as never
    throw new Error('ENOENT')
  })
  on('fs.write', (_$, e) => {
    writes.push(fwd((e as { path: string }).path))
    return { value: undefined } as never
  })
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  return { runs, writes }
}

async function settle(clock: { advance: (ms: number) => Promise<void> }) {
  for (let i = 0; i < 50; i++) await clock.advance(0)
}

test('the pane opens on the first repo skill and deletes it only after the confirm', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.session.start({ cwd: 'C:/repo', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'skills-panel', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect((await ui.find({ key: 'skills-pick' }))?.props?.value).toBe('shipit')
  expect(await ui.find({ type: 'Text', text: 'Land the PR' })).toBeDefined()
  expect((await ui.find({ key: 'skills-text' }))?.props?.text).toBe('# Shipit\nSteps.')
  await ui.press({ key: 'skills-delete' })
  await settle(clock)
  expect(w.runs.filter(r => r.startsWith('git rm'))).toEqual([])
  await ui.press({ key: 'skills-delete-yes' })
  await settle(clock)
  expect(w.runs.filter(r => r.startsWith('git rm'))).toEqual(['git rm -r -q -- .claude/skills/shipit'])
  expect(w.writes.filter(p => p.includes('.claude/skills'))).toEqual([])
  await ui.unmount()
})

test('a listing that fails is named, not shown as no skills', async ($, on) => {
  const clock = mock.clock(on)
  world(on, true)
  await $.session.start({ cwd: 'C:/repo', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'skills-panel', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect(JSON.stringify(await ui.drawn())).toMatch(/Could not list \.claude\/skills: [^"]*EACCES/)
  expect(await ui.find({ type: 'Text', text: 'No skills found.' })).toBeUndefined()
  await ui.unmount()
})
