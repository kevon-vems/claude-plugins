import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { beatOf, fleetDir, fleetOf, nameOf, parseBeat, sharedWith, GONE_MS } from '../hooks/fleet.ts'
import type { Beat } from '../types'

const NOW = 10 * 60 * 60 * 1000

function b(id: string, over: Partial<Beat> = {}): Beat {
  return { id, top: `C:/repo/Worktrees/${id}`, worktree: id, state: 'waiting', since: NOW - 60000, at: NOW - 1000, ...over }
}

test('the fleet folder sits under the home folder', () => {
  expect(fleetDir('C:\\Users\\me\\')).toBe('C:/Users/me/.claude/band-fleet')
  expect(fleetDir('/Users/deven')).toBe('/Users/deven/.claude/band-fleet')
})

test('ended and silent sessions drop out, and the ones asking come first', () => {
  const rows = fleetOf([
    b('working', { state: 'working', since: NOW - 5000 }),
    b('ended', { state: 'ended' }),
    b('silent', { at: NOW - GONE_MS - 1 }),
    b('waiting', { since: NOW - 9000 }),
    b('asking', { state: 'asking' }),
  ], NOW, 'waiting')
  expect(rows.map(r => r.id)).toEqual(['asking', 'waiting', 'working'])
  expect(rows.find(r => r.id === 'waiting')?.self).toBe(true)
})

test('two sessions in one worktree are both marked shared; the main checkout never is', () => {
  const rows = fleetOf([
    b('a', { top: 'C:/repo/Worktrees/x' }),
    b('b', { top: 'c:\\repo\\Worktrees\\X\\' }),
    b('c'),
    b('m1', { top: 'C:/repo', worktree: undefined }),
    b('m2', { top: 'C:/repo', worktree: undefined }),
  ], NOW, 'a')
  const shared = Object.fromEntries(rows.map(r => [r.id, r.shared]))
  expect(shared).toEqual({ a: true, b: true, c: false, m1: false, m2: false })
  expect(sharedWith(rows, 'a')).toBe(1)
  expect(sharedWith(rows, 'c')).toBe(0)
  expect(sharedWith(rows, 'nobody')).toBe(0)
})

test('a heartbeat carries the PR and its review verdict', () => {
  const work = { worktree: 'w', branch: 'claude/1-w', issue: 1, pr: { number: 9, state: 'OPEN', ci: 'failing' as const, review: { round: 2, verdict: 'clean' } } }
  expect(beatOf('s', 'C:/repo/Worktrees/w', work, 'asking', 5, 6)).toEqual({
    id: 's', top: 'C:/repo/Worktrees/w', worktree: 'w', branch: 'claude/1-w', issue: 1,
    pr: { number: 9, state: 'OPEN', ci: 'failing', verdict: 'clean' }, state: 'asking', since: 5, at: 6,
  })
})

test('a heartbeat carries the running count and a review left behind by a push', () => {
  const work = { worktree: 'w', branch: 'claude/1-w', pr: { number: 9, state: 'OPEN', ci: 'failing' as const, running: 2, head: 'bbb222', review: { round: 1, verdict: 'clean', sha: 'aaa111' } } }
  expect(beatOf('s', 'C:/repo/Worktrees/w', work, 'waiting', 5, 6).pr).toEqual({ number: 9, state: 'OPEN', ci: 'failing', running: 2, verdict: 'clean', pushedSince: true })
  const fresh = { ...work, pr: { ...work.pr, running: 0, head: 'aaa111ccc' } }
  expect(beatOf('s', 'C:/repo/Worktrees/w', fresh, 'waiting', 5, 6).pr).toEqual({ number: 9, state: 'OPEN', ci: 'failing', verdict: 'clean' })
})

test('a session is named by its branch, then its worktree, then its folder', () => {
  expect(nameOf('jolly-lederberg-e16753', 'claude/5063-band-sync', 'claude/')).toBe('5063-band-sync')
  expect(nameOf('jolly-lederberg-e16753', 'HEAD', 'claude/')).toBe('jolly-lederberg-e16753')
  expect(nameOf(undefined, 'main', 'claude/', 'C:/repo/')).toBe('repo')
  expect(nameOf(undefined, 'main', 'claude/')).toBe('')
})

test('a heartbeat file that is not one is skipped', () => {
  expect(parseBeat('')).toBeUndefined()
  expect(parseBeat('{"id":1}')).toBeUndefined()
  expect(parseBeat(JSON.stringify(b('ok')))?.id).toBe('ok')
})

const fwd = (p: string) => p.replace(/\\/g, '/')

type Disk = Map<string, { text: string; at: number }>

type Gh = () => { code: number; stdout?: string; stderr?: string }

function world(on: On, disk: Disk, id = 's1', gh?: Gh) {
  const writes: Array<{ path: string; beat: Beat }> = []
  const runs: string[][] = []
  on('session.id', () => ({ value: id }) as never)
  on('session.cwd', () => ({ value: 'C:/repo/Worktrees/4740-fleet' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('env.get', (_$, e) => ({ value: ({ USERPROFILE: 'C:\\Users\\me', OS: 'Windows_NT' } as Record<string, string>)[(e as { name: string }).name] }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('fs.write', (_$, e) => {
    const w = e as { path: string; text: string }
    const path = fwd(w.path)
    if (path.includes('/band-fleet/')) writes.push({ path, beat: JSON.parse(w.text) })
    disk.set(path, { text: w.text, at: NOW })
    return { value: undefined } as never
  })
  on('fs.list', (_$, e) => {
    const dir = fwd((e as { path: string }).path)
    if (!dir.endsWith('band-fleet')) return { value: [] } as never
    const value = [...disk.entries()]
      .filter(([p]) => p.startsWith(`${dir}/`))
      .map(([p, f]) => ({ name: p.slice(dir.length + 1), kind: 'file', size: f.text.length, mtimeMs: f.at, isLink: false }))
    return { value } as never
  })
  on('fs.read', (_$, e) => {
    const f = disk.get(fwd((e as { path: string }).path))
    if (!f) throw new Error('missing')
    return { value: f.text } as never
  })
  on('process.run', (_$, e) => {
    const argv = [...((e as { argv: string[] }).argv)]
    runs.push(argv)
    const out = (code: number, stdout = '') => ({ value: { exitCode: code, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv.includes('--show-toplevel')) return out(0, 'C:/repo/Worktrees/4740-fleet\n') as never
    if (argv.includes('--path-format=absolute')) return out(0, 'C:/repo/.git/worktrees/4740-fleet\nC:/repo/.git\n') as never
    if (argv.includes('--abbrev-ref')) return out(0, 'claude/4740-fleet\n') as never
    if (gh && argv[0] === 'gh' && argv[1] === 'pr' && argv[2] === 'view') {
      const r = gh()
      return { value: { ...out(r.code, r.stdout ?? '').value, stderr: r.stderr ?? '' } } as never
    }
    return out(1) as never
  })
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: {} }) as never)
  on('turn.start', (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('session.end', () => ({ sessionId: id }) as never)
  on('session.start', (_$, e) => ({ cwd: (e as { cwd: string }).cwd }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  return { writes, runs }
}

const START = { cwd: 'C:/repo/Worktrees/4740-fleet', surface: 'desktop' } as never
const DIR = 'C:/Users/me/.claude/band-fleet'

async function settle(clock: { advance: (ms: number) => Promise<void> }) {
  for (let i = 0; i < 50; i++) await clock.advance(0)
}

test('a session writes its heartbeat, and its state follows the turn and the question', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w = world(on, new Map())
  await $.session.start(START)
  await settle(clock)
  const states = () => w.writes.map(x => x.beat.state)
  expect(w.writes[0]?.path).toBe(`${DIR}/s1.json`)
  expect(w.writes.at(-1)?.beat).toMatchObject({ id: 's1', worktree: '4740-fleet', issue: 4740, state: 'waiting' })
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  await settle(clock)
  expect(states().at(-1)).toBe('working')
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which?', header: 'Pick', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }] } as never)
  expect(states().slice(-2)).toEqual(['asking', 'working'])
  await $.session.end({ reason: 'other' } as never)
  expect(states().at(-1)).toBe('ended')
})

test('an old heartbeat file is pruned at start; a fresh one stays', async ($, on) => {
  const clock = mock.clock(on, { now: NOW + 48 * 3600000 })
  const disk: Disk = new Map([
    [`${DIR}/old.json`, { text: JSON.stringify(b('old')), at: NOW }],
    [`${DIR}/new.json`, { text: JSON.stringify(b('new')), at: NOW + 48 * 3600000 - 1000 }],
  ])
  const w = world(on, disk)
  await $.session.start(START)
  await settle(clock)
  const dels = w.runs.filter(r => r[0] === 'cmd')
  expect(dels).toEqual([['cmd', '/c', 'del', '/q', 'C:\\Users\\me\\.claude\\band-fleet\\old.json']])
})

test('the band warns when another live session shares this worktree', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const disk: Disk = new Map([
    [`${DIR}/other.json`, { text: JSON.stringify(b('other', { top: 'C:/repo/Worktrees/4740-fleet', worktree: '4740-fleet', state: 'asking' })), at: NOW }],
  ])
  world(on, disk)
  await $.session.start(START)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } } as never)
  expect(await ui.find({ type: 'Text', text: 'worktree shared with 1 other session' })).toBeDefined()
  await ui.unmount()
})

const ghPr = (state: string) => ({ code: 0, stdout: JSON.stringify({ number: 77, state, title: 'Fleet (#4740)', statusCheckRollup: [], reviews: [] }) })
const noPr = { code: 1, stderr: 'no pull requests found for branch "claude/4740-fleet"' }
const prReads = (runs: string[][]) => runs.filter(r => r[0] === 'gh' && r[1] === 'pr').length

test('a PR opened while the session sits idle reaches the heartbeat within a minute', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  let answer: ReturnType<Gh> = noPr
  const w = world(on, new Map(), 's1', () => answer)
  await $.session.start(START)
  await settle(clock)
  expect(w.writes.at(-1)?.beat.pr).toBeUndefined()
  answer = ghPr('OPEN')
  await clock.advance(60 * 1000)
  await settle(clock)
  expect(w.writes.at(-1)?.beat.pr).toMatchObject({ number: 77, state: 'OPEN' })
})

test('once the PR is merged, the timer stops asking GitHub but still reads git', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w = world(on, new Map(), 's1', () => ghPr('MERGED'))
  await $.session.start(START)
  await settle(clock)
  const before = prReads(w.runs)
  const gits = w.runs.filter(r => r.includes('--abbrev-ref')).length
  await clock.advance(3 * 60 * 1000)
  await settle(clock)
  expect(prReads(w.runs)).toBe(before)
  expect(w.runs.filter(r => r.includes('--abbrev-ref')).length).toBeGreaterThan(gits)
})

test('a gh pr command mid-turn rewrites the heartbeat before the turn ends', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  let answer: ReturnType<Gh> = noPr
  const w = world(on, new Map(), 's1', () => answer)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }) as never)
  await $.session.start(START)
  await settle(clock)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  await settle(clock)
  answer = ghPr('OPEN')
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' } as never)
  await settle(clock)
  expect(w.writes.at(-1)?.beat).toMatchObject({ state: 'working', pr: { number: 77 }, issue: 4740 })
})
