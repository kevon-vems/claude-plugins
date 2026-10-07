import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { commitsOf, dirtyOf, firstLine, ghiBody, ghiTitle, isClear, issueNumberOf, repoOf, threadsOf } from '../hooks/wrapup.ts'
import type { Report } from '../types'

const report = (over: Partial<Report> = {}): Report => ({
  place: '4740-wrapup', branch: 'claude/4740-wrapup', issue: 4740, dirty: [], unpushed: [], upstream: true, threads: [], unread: [], ...over,
})

test('git output is read into files and commits', () => {
  expect(dirtyOf(' M a.ts\r\n?? b/c.ts\n')).toEqual(['a.ts', 'b/c.ts'])
  expect(dirtyOf('')).toEqual([])
  expect(commitsOf('abc123 first one\ndef456 second\n')).toEqual([
    { sha: 'abc123', subject: 'first one' },
    { sha: 'def456', subject: 'second' },
  ])
})

test('a thread keeps its first readable line', () => {
  expect(firstLine('<!-- pr-review -->\n\n**nit:** rename `x`\nmore')).toBe('nit: rename x')
  expect(firstLine('y'.repeat(200)).length).toBe(160)
})

test('only unresolved threads are kept', () => {
  const json = JSON.stringify({
    data: { repository: { pullRequest: { reviewThreads: { nodes: [
      { isResolved: true, comments: { nodes: [{ path: 'a.ts', line: 1, body: 'done', url: 'u1' }] } },
      { isResolved: false, comments: { nodes: [{ path: 'b.ts', line: null, body: 'still open', url: 'u2' }] } },
    ] } } } },
  })
  expect(threadsOf(json)).toEqual([{ path: 'b.ts', line: undefined, text: 'still open', url: 'u2' }])
})

test('repo, issue number and clear state', () => {
  expect(repoOf('https://github.com/acme/app/pull/4818')).toEqual({ owner: 'acme', repo: 'app' })
  expect(issueNumberOf('https://github.com/acme/app/issues/4820\n')).toBe(4820)
  expect(isClear(report())).toBe(true)
  expect(isClear(report({ pr: { number: 1, state: 'OPEN', title: 't', url: 'u' } }))).toBe(false)
  expect(isClear(report({ pr: { number: 1, state: 'MERGED', title: 't', url: 'u' } }))).toBe(true)
  expect(isClear(report({ dirty: ['a'] }))).toBe(false)
})

test('the GHI names each thread and never a closing keyword', () => {
  const r = report({
    pr: { number: 4819, state: 'OPEN', title: 'band: /wrapup', url: 'u' },
    threads: [{ path: 'a.ts', line: 3, text: 'nit: rename', url: 'https://t/1' }],
  })
  expect(ghiTitle(r)).toBe('Leftovers from PR #4819: band: /wrapup')
  const body = ghiBody(r)
  expect(body).toContain('- `a.ts:3` - nit: rename ([thread](https://t/1))')
  expect(body).toContain('refs #4740')
  expect(/\b(close[sd]?|fix(e[sd])?|resolve[sd]?) #\d/i.test(body)).toBe(false)
})

const PANE = { component: 'Pane', requestId: 'band-wrapup', props: { title: 'Wrap up', isFocused: false, bodyColumns: 120, placement: 'dock' } } as const

type Run = { exitCode: number; stdout?: string; stderr?: string }

function world(on: On, answers: (argv: string[]) => Run) {
  const runs: string[][] = []
  on('session.id', () => ({ value: 'me' }) as never)
  on('session.cwd', () => ({ value: 'C:/repo/Worktrees/4740-wrapup' }) as never)
  on('session.start', (_$, e) => ({ cwd: (e as { cwd: string }).cwd }) as never)
  on('env.get', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('process.run', (_$, e) => {
    const argv = [...(e as { argv: string[] }).argv]
    runs.push(argv)
    const a = answers(argv)
    return { value: { exitCode: a.exitCode, stdout: a.stdout ?? '', stderr: a.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  return { runs }
}

async function settle(clock: { advance: (ms: number) => Promise<void> }) {
  for (let i = 0; i < 50; i++) await clock.advance(0)
}

const THREADS = JSON.stringify({
  data: { repository: { pullRequest: { reviewThreads: { nodes: [
    { isResolved: false, comments: { nodes: [{ path: 'hooks/x.ts', line: 7, body: 'nit: tidy this', url: 'https://t/7' }] } },
  ] } } } },
})

function busy(argv: string[]): Run {
  const s = argv.join(' ')
  if (s.startsWith('git rev-parse --show-toplevel')) return { exitCode: 0, stdout: 'C:/repo/Worktrees/4740-wrapup\n' }
  if (s.startsWith('git rev-parse --abbrev-ref')) return { exitCode: 0, stdout: 'claude/4740-wrapup\n' }
  if (s.startsWith('git status')) return { exitCode: 0, stdout: ' M hooks/register.tsx\n' }
  if (s.startsWith('git log --oneline @{u}..HEAD')) return { exitCode: 0, stdout: 'abc1234 wip\n' }
  if (s.startsWith('gh pr view')) return { exitCode: 0, stdout: JSON.stringify({ number: 4819, state: 'OPEN', title: 'band: /wrapup', url: 'https://github.com/acme/app/pull/4819' }) }
  if (s.startsWith('gh api graphql')) return { exitCode: 0, stdout: THREADS }
  if (s.startsWith('gh issue create')) return { exitCode: 0, stdout: 'https://github.com/acme/app/issues/4820\n' }
  return { exitCode: 1 }
}

test('/wrapup lists what is left, and files one GHI for the open threads', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, busy)
  await $.session.start({ cwd: 'C:/repo/Worktrees/4740-wrapup', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'wrapup', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: '1 uncommitted file' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 unpushed commit' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'PR #4819 open: band: /wrapup' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  hooks/x.ts:7  nit: tidy this' })).toBeDefined()
  await ui.press({ key: 'wrapup-ghi' })
  await settle(clock)
  expect(w.runs.filter(a => a[0] === 'gh' && a[1] === 'issue').length).toBe(0)
  expect(await ui.find({ type: 'Text', text: 'File this GHI? Leftovers from PR #4819: band: /wrapup' })).toBeDefined()
  await ui.press({ key: 'wrapup-ghi-no' })
  await settle(clock)
  expect(await ui.find({ key: 'wrapup-ghi-yes' })).toBeUndefined()
  expect(w.runs.filter(a => a[0] === 'gh' && a[1] === 'issue').length).toBe(0)
  await ui.press({ key: 'wrapup-ghi' })
  await settle(clock)
  await ui.press({ key: 'wrapup-ghi-yes' })
  await settle(clock)
  const create = w.runs.filter(a => a[0] === 'gh' && a[1] === 'issue')
  expect(create.length).toBe(1)
  expect(create[0]).toContain('acme/app')
  expect(await ui.find({ type: 'Text', text: 'Filed #4820' })).toBeDefined()
  expect(await ui.find({ key: 'wrapup-ghi' })).toBeUndefined()
  await ui.unmount()
})

test('a clean branch with no PR is safe to archive', async ($, on) => {
  const clock = mock.clock(on)
  world(on, argv => {
    const s = argv.join(' ')
    if (s.startsWith('git rev-parse --show-toplevel')) return { exitCode: 0, stdout: 'C:/repo\n' }
    if (s.startsWith('git rev-parse --abbrev-ref')) return { exitCode: 0, stdout: 'main\n' }
    if (s.startsWith('git status') || s.startsWith('git log')) return { exitCode: 0, stdout: '' }
    return { exitCode: 1 }
  })
  await $.session.start({ cwd: 'C:/repo', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'wrapup', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: 'Nothing left behind. Safe to archive.' })).toBeDefined()
  await ui.unmount()
})

test('a GitHub read that fails is named, never shown as clear', async ($, on) => {
  const clock = mock.clock(on)
  world(on, argv => {
    const s = argv.join(' ')
    if (s.startsWith('gh pr view')) return { exitCode: 1, stderr: 'HTTP 502' }
    return busy(argv)
  })
  await $.session.start({ cwd: 'C:/repo/Worktrees/4740-wrapup', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'wrapup', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: 'Could not read: the PR. Check by hand.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Nothing left behind. Safe to archive.' })).toBeUndefined()
  await ui.unmount()
})
