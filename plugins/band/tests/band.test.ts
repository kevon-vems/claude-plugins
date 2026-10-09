import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { DEFAULTS } from '../hooks/config.ts'
import { ciOf, ciText, issueFor, issueOf, issueOfTitle, lastPr, live, moves, nextFocus, reviewOf, reviewText, runKey, runningOf, sayKey, settled, skillsOf, touchedIssue, worktreeOf } from '../hooks/register.tsx'

test('the PR title names the issue, last number wins', () => {
  expect(issueOfTitle('Show bid totals on the award page (#2528)')).toBe(2528)
  expect(issueOfTitle('Follow-up to #12 (#4771)')).toBe(4771)
  expect(issueOfTitle('Status band refreshes as soon as the branch moves')).toBeUndefined()
})

test('a gh issue command names the issue this session is on', () => {
  expect(touchedIssue('gh issue view 4771 --repo acme/app')).toEqual({ issue: 4771, closed: false })
  expect(touchedIssue('gh issue comment #4771 --body x')).toEqual({ issue: 4771, closed: false })
  expect(touchedIssue('gh issue close 4771')).toEqual({ issue: 4771, closed: true })
  expect(touchedIssue('gh api repos/o/r/issues/4900/comments')).toEqual({ issue: 4900, closed: false })
  expect(touchedIssue('gh issue create --title x', 'https://github.com/acme/app/issues/4901\n')).toEqual({ issue: 4901, closed: false })
  expect(touchedIssue('gh issue create --title x', 'failed')).toBeUndefined()
  expect(touchedIssue('gh issue list --state open')).toBeUndefined()
  expect(touchedIssue('git status')).toBeUndefined()
})

test('the session issue moves to the newest one, and closing it clears it', () => {
  expect(nextFocus(null, { issue: 1, closed: false })).toBe(1)
  expect(nextFocus(1, { issue: 2, closed: false })).toBe(2)
  expect(nextFocus(2, { issue: 2, closed: true })).toBeNull()
  expect(nextFocus(2, { issue: 3, closed: true })).toBe(2)
  expect(nextFocus(2, undefined)).toBe(2)
})

test('a command that moves the branch, PR or issue re-reads the band at once', () => {
  expect(moves('gh pr merge 4891 --squash')).toBe(true)
  expect(moves('gh issue view 4771')).toBe(true)
  expect(moves('git checkout claude/1-x')).toBe(true)
  expect(moves('git worktree remove Worktrees/x')).toBe(true)
  expect(moves('git push -u origin HEAD')).toBe(true)
  expect(moves('cd /c/repo && git status')).toBe(true)
  expect(moves('git status; cd ..')).toBe(true)
  expect(moves('Set-Location C:\\repo')).toBe(true)
  expect(moves('git branch -m claude/5063-band-sync')).toBe(true)
  expect(moves('git -C ../other checkout main')).toBe(true)
  expect(moves('git rebase origin/main')).toBe(true)
  expect(moves('(cd ../other && git status)')).toBe(true)
  expect(moves('pushd ../other')).toBe(true)
  expect(moves('Pop-Location')).toBe(true)
  expect(moves('git status')).toBe(false)
  expect(moves('git log --oneline')).toBe(false)
  expect(moves('dotnet build')).toBe(false)
  expect(moves('echo abcd')).toBe(false)
})

test('CI reads failing, running, passing and none', () => {
  expect(ciOf([])).toBe('none')
  expect(ciOf([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'COMPLETED', conclusion: 'FAILURE' }])).toBe('failing')
  expect(ciOf([{ status: 'IN_PROGRESS' }, { status: 'COMPLETED', conclusion: 'SUCCESS' }])).toBe('running')
  expect(ciOf([{ state: 'PENDING' }])).toBe('running')
  expect(ciOf([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { state: 'SUCCESS' }])).toBe('passing')
  expect(ciOf([{ status: 'COMPLETED', conclusion: 'SKIPPED' }, { status: 'COMPLETED', conclusion: 'SKIPPED' }])).toBe('skipped')
  expect(ciOf([{ status: 'COMPLETED', conclusion: 'SKIPPED' }, { status: 'COMPLETED', conclusion: 'SUCCESS' }])).toBe('passing')
  expect(ciText({ number: 1, state: 'OPEN', ci: 'skipped' })).toBe('CI skipped - nothing ran')
  expect(ciText({ number: 1, state: 'OPEN', ci: 'passing', stale: true })).toBe('CI passing (stale)')
  expect(ciText({ number: 1, state: 'OPEN', ci: 'none', stale: true })).toBe('no CI yet (stale)')
  expect(ciText({ number: 1, state: 'MERGED', ci: 'passing', stale: true })).toBe('CI passing')
})

const PR_5056 = [
  { name: 'Secret scan', status: 'COMPLETED', conclusion: 'FAILURE' },
  { name: 'Build and Fast tests', status: 'IN_PROGRESS' },
  { name: 'Pipeline suite and lint', status: 'QUEUED' },
  { name: 'SQL slice', status: 'COMPLETED', conclusion: 'SKIPPED' },
]

test('a failed check never hides the checks still running', () => {
  expect(ciOf(PR_5056)).toBe('failing')
  expect(runningOf(PR_5056)).toBe(2)
  expect(ciText({ number: 1, state: 'OPEN', ci: 'failing', running: 2 })).toBe('CI failing - 2 running')
  expect(ciText({ number: 1, state: 'OPEN', ci: 'failing', running: 0 })).toBe('CI failing')
  expect(ciText({ number: 1, state: 'OPEN', ci: 'running', running: 1 })).toBe('CI running')
})

test('an open PR with no checks says so; a closed one stays quiet', () => {
  expect(ciText({ number: 1, state: 'OPEN', ci: 'none' })).toBe('no CI yet')
  expect(ciText({ number: 1, state: 'MERGED', ci: 'none' })).toBeUndefined()
})

test('the timer skips GitHub only for a merged or closed PR on the same branch', () => {
  const at = (state: string) => ({ worktree: 'w', branch: 'claude/1-x', issue: 1, pr: { number: 1, state, ci: 'passing' as const } })
  expect(settled(at('MERGED'), 'claude/1-x')?.number).toBe(1)
  expect(settled(at('CLOSED'), 'claude/1-x')?.number).toBe(1)
  expect(settled(at('OPEN'), 'claude/1-x')).toBeUndefined()
  expect(settled(at('MERGED'), 'claude/2-y')).toBeUndefined()
  expect(settled({ worktree: 'w', branch: 'claude/1-x' }, 'claude/1-x')).toBeUndefined()
  expect(settled(null, 'claude/1-x')).toBeUndefined()
})

test('the issue: an open PR holds its own, otherwise the issue last touched on this branch wins', () => {
  expect(issueFor({ feature: false, prOpen: false, focus: 7 })).toBe(7)
  expect(issueFor({ feature: false, prOpen: false })).toBeUndefined()
  expect(issueFor({ feature: true, prOpen: true, titled: 1, named: 2, focus: 7 })).toBe(1)
  expect(issueFor({ feature: true, prOpen: true, named: 2, focus: 7 })).toBe(2)
  expect(issueFor({ feature: true, prOpen: true, focus: 7 })).toBe(7)
  expect(issueFor({ feature: true, prOpen: false, titled: 1, named: 2, focus: 7 })).toBe(7)
  expect(issueFor({ feature: true, prOpen: false, titled: 1, named: 2 })).toBe(1)
  expect(issueFor({ feature: true, prOpen: false, named: 2 })).toBe(2)
})

test('a failed PR read keeps the last known PR, so the timer keeps running', () => {
  const pr = { number: 1, state: 'OPEN', ci: 'running' as const }
  const prev = { worktree: 'w', branch: 'claude/1-x', issue: 1, pr }
  expect(lastPr(prev, 'claude/1-x', 'HTTP 502: Bad Gateway')).toEqual(pr)
  expect(lastPr(prev, 'claude/1-x', 'no pull requests found for branch "claude/1-x"')).toBeUndefined()
  expect(lastPr(prev, 'claude/2-y', 'HTTP 502: Bad Gateway')).toBeUndefined()
  expect(lastPr(null, 'claude/1-x', 'HTTP 502: Bad Gateway')).toBeUndefined()
})

test('the latest review marker wins, with its open counts', () => {
  const r = reviewOf([
    'pr-review sha=abc round=1 verdict=blocked',
    'just a comment',
    'pr-review sha=def round=2 verdict=clean\npr-review-open 0/0/2',
  ])
  expect(r).toEqual({ round: 2, verdict: 'clean', open: '0/0/2', sha: 'def' })
  expect(reviewOf(['no marker here'])).toBeUndefined()
  expect(reviewOf(['<!-- pr-review sha=abc1234 round=1 verdict=blocked open=1/2/3 -->'])?.open).toBe('1/2/3')
})

test('a review of an older commit says the PR was pushed since', () => {
  const review = { round: 1, verdict: 'clean', sha: 'a54ef3f5' }
  expect(reviewText({ number: 1, state: 'OPEN', ci: 'passing', head: 'a54ef3f5c0ffee', review })).toBe('review r1 clean')
  expect(reviewText({ number: 1, state: 'OPEN', ci: 'passing', head: '8e6530babce3', review })).toBe('review r1 clean - pushed since')
  expect(reviewText({ number: 1, state: 'OPEN', ci: 'passing', review })).toBe('review r1 clean')
  expect(reviewText({ number: 1, state: 'OPEN', ci: 'passing' })).toBeUndefined()
})

test('a linked worktree is named by its folder, wherever it lives; the main checkout is not', () => {
  expect(worktreeOf('C:/repo/Worktrees/4740-band', 'C:/repo/.git/worktrees/4740-band', 'C:/repo/.git')).toBe('4740-band')
  expect(worktreeOf('C:\\repo\\Worktrees\\4740-band\\', 'C:/repo/.git/worktrees/4740-band', 'C:/repo/.git')).toBe('4740-band')
  expect(worktreeOf('D:/anywhere/feature-x', 'C:/repo/.git/worktrees/feature-x', 'C:/repo/.git')).toBe('feature-x')
  expect(worktreeOf('C:/repo', 'C:/repo/.git', 'C:/repo/.git')).toBeUndefined()
  expect(worktreeOf('C:/repo', 'C:\\repo\\.git\\', 'c:/repo/.git')).toBeUndefined()
  expect(worktreeOf('C:/repo', '', '')).toBeUndefined()
})

test('by default the issue comes from a <n>- branch, with or without one prefix', () => {
  const p = DEFAULTS.issueBranch
  expect(issueOf('claude/4740-band', p)).toBe(4740)
  expect(issueOf('4740-band', p)).toBe(4740)
  expect(issueOf('feature/12-x', p)).toBe(12)
  expect(issueOf('claude/band', p)).toBeUndefined()
  expect(issueOf('main', p)).toBeUndefined()
})

test('the skills list holds only repo skills and named extras that are loaded', () => {
  const commands = [
    { name: 'shipit', description: '', source: 'user' as const },
    { name: 'gh-go', description: '', source: 'user' as const },
    { name: 'pdf', description: '', source: 'plugin' as const, plugin: 'anthropic-skills' },
    { name: 'deep-research', description: '', source: 'plugin' as const, plugin: 'anthropic-skills' },
    { name: 'model', description: '', source: 'builtin' as const },
  ]
  const got = skillsOf(commands, ['shipit', 'gh-go', 'not-loaded'], ['deep-research'])
  expect(got.map(o => o.value)).toEqual(['deep-research', 'gh-go', 'shipit'])
})

test('every skill of a named plugin is listed under its short name', () => {
  const commands = [
    { name: 'workflow:archive', description: '', source: 'plugin' as const, plugin: 'workflow' },
    { name: 'workflow:reseed', description: '', source: 'plugin' as const, plugin: 'workflow' },
    { name: 'pdf', description: '', source: 'plugin' as const, plugin: 'anthropic-skills' },
    { name: 'reseed', description: '', source: 'user' as const },
  ]
  const got = skillsOf(commands, ['reseed'], [], ['workflow'])
  expect(got).toEqual([
    { value: 'workflow:archive', label: 'archive' },
    { value: 'reseed', label: 'reseed' },
  ])
})

test('a queued entry expires after half an hour', () => {
  expect(live({ 'run:shipit': 0, 'say:go': 1000 }, 30 * 60 * 1000 + 500)).toEqual({ 'say:go': 1000 })
})

test('keys ignore a leading slash, case and spacing', () => {
  expect(runKey('/shipit')).toBe(runKey('shipit'))
  expect(sayKey(' Go ')).toBe(sayKey('go'))
})

const gitDirs = (top: string) =>
  /[\\/]Worktrees[\\/]/.test(top) ? `C:/repo/.git/worktrees/${top.split(/[\\/]/).pop()}\nC:/repo/.git` : 'C:/repo/.git\nC:/repo/.git'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120 } } as const

test('a button pressed twice before its command runs sends it once', async ($, on) => {
  mock.clock(on)
  let runs = 0
  let finish = () => {}
  const held = new Promise<void>(r => { finish = r })
  on('command.run', async (_$, e) => {
    if (e.command === 'shipit') {
      runs++
      await held
    }
    return {}
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  const first = ui.press({ key: 'b-Ship it' })
  const second = ui.press({ key: 'b-Ship it' })
  finish()
  await Promise.all([first, second])
  expect(runs).toBe(1)
  await ui.press({ key: 'b-Ship it' })
  expect(runs).toBe(2)
  await ui.unmount()
})

test('a press held past half an hour no longer blocks the button', async ($, on) => {
  const clock = mock.clock(on)
  let runs = 0
  on('command.run', async (_$, e) => {
    if (e.command === 'shipit') {
      runs++
      await clock.sleep(60 * 60 * 1000)
    }
    return {}
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await ui.press({ key: 'b-Ship it' })
  await ui.press({ key: 'b-Ship it' })
  expect(runs).toBe(1)
  await clock.advance(30 * 60 * 1000)
  await ui.press({ key: 'b-Ship it' })
  expect(runs).toBe(2)
  await clock.advance(2 * 60 * 60 * 1000)
  await ui.unmount()
})

test('a gh pr command mid-turn re-reads the PR without waiting for the turn to end', async ($, on) => {
  let reads = 0
  let saw = () => {}
  const read = new Promise<void>(r => { saw = r })
  on('session.cwd', () => ({ value: 'C:/repo/Worktrees/1-x' }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] === 'git' && argv[1] === 'rev-parse') {
      const out = argv[2] === '--show-toplevel' ? 'C:/repo/Worktrees/1-x' : argv[2] === '--path-format=absolute' ? gitDirs('C:/repo/Worktrees/1-x') : 'claude/1-x'
      return { value: { exitCode: 0, stdout: out, stderr: '' } } as never
    }
    if (argv[0] === 'gh' && argv[1] === 'pr' && argv[2] === 'view') {
      reads++
      saw()
      return { value: { exitCode: 0, stdout: JSON.stringify({ number: 1, state: 'MERGED', statusCheckRollup: [], reviews: [] }), stderr: '' } } as never
    }
    return { value: { exitCode: 1, stdout: '', stderr: '' } } as never
  })
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'Bash', command: 'git status' } as never)
  expect(reads).toBe(0)
  await $.tool.call({ tool: 'Bash', command: 'gh pr ready 1' } as never)
  await read
  expect(reads).toBe(1)
})

test('on main, the band shows the issue the session just opened, and clears it on close', async ($, on) => {
  mock.clock(on)
  on('session.cwd', () => ({ value: 'C:/repo' }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] === 'git' && argv[1] === 'rev-parse') {
      const out = argv[2] === '--show-toplevel' ? 'C:/repo' : argv[2] === '--path-format=absolute' ? gitDirs('C:/repo') : 'main'
      return { value: { exitCode: 0, stdout: out, stderr: '' } } as never
    }
    return { value: { exitCode: 1, stdout: '', stderr: '' } } as never
  })
  on('tool.call', () => ({ result: 'ok' }) as never)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  const settle = async (want: boolean) => {
    for (let i = 0; i < 200; i++) {
      if (!!(await ui.find({ type: 'Text', text: '#4900' })) === want) return
    }
  }
  await $.tool.call({ tool: 'Bash', command: 'gh issue view 4900 --repo acme/app' } as never)
  await settle(true)
  expect(await ui.find({ type: 'Text', text: '#4900' })).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'gh issue close 4900' } as never)
  await settle(false)
  expect(await ui.find({ type: 'Text', text: '#4900' })).toBeUndefined()
  await ui.unmount()
})

type Place = { cwd: string; branch: string; pr?: object }

function checkout(on: On, place: Place) {
  const seen = { prReads: 0 }
  mock.clock(on)
  on('session.cwd', () => ({ value: place.cwd }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    const out = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr } }) as never
    if (argv[0] === 'git' && argv[1] === 'rev-parse') return out(0, argv[2] === '--show-toplevel' ? place.cwd : argv[2] === '--path-format=absolute' ? gitDirs(place.cwd) : place.branch)
    if (argv[0] === 'gh' && argv[1] === 'pr' && argv[2] === 'view') {
      seen.prReads++
      return place.pr ? out(0, JSON.stringify(place.pr)) : out(1, '', `no pull requests found for branch "${place.branch}"`)
    }
    return out(1)
  })
  on('tool.call', () => ({ result: 'ok' }) as never)
  return seen
}

async function shows(ui: { find: (q: { type: 'Text'; text: string }) => Promise<unknown> }, text: string, want = true) {
  for (let i = 0; i < 200; i++) {
    if (!!(await ui.find({ type: 'Text', text })) === want) return
  }
}

test('on a branch with no PR, the band follows the session to a new issue', async ($, on) => {
  checkout(on, { cwd: 'C:/repo/Worktrees/1-x', branch: 'claude/1-x' })
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'git push -u origin HEAD' } as never)
  await shows(ui, '#1')
  expect(await ui.find({ type: 'Text', text: '#1' })).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'gh issue view 2' } as never)
  await shows(ui, '#2')
  expect(await ui.find({ type: 'Text', text: '#2' })).toBeDefined()
  await ui.unmount()
})

test('with an open PR, reading another issue leaves the PR issue on the band', async ($, on) => {
  checkout(on, { cwd: 'C:/repo/Worktrees/1-x', branch: 'claude/1-x', pr: { number: 9, state: 'OPEN', title: 'Fix (#1)', statusCheckRollup: [], reviews: [] } })
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'gh issue view 2' } as never)
  await shows(ui, 'PR #9')
  expect(await ui.find({ type: 'Text', text: '#1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '#2' })).toBeUndefined()
  await ui.unmount()
})

test('an issue touched on the old branch does not follow onto a new branch', async ($, on) => {
  const place: Place = { cwd: 'C:/repo/Worktrees/1-x', branch: 'claude/1-x' }
  checkout(on, place)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'gh issue view 7' } as never)
  await shows(ui, '#7')
  expect(await ui.find({ type: 'Text', text: '#7' })).toBeDefined()
  place.branch = 'claude/2-y'
  await $.tool.call({ tool: 'Bash', command: 'git switch claude/2-y' } as never)
  await shows(ui, '#2')
  expect(await ui.find({ type: 'Text', text: '#2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '#7' })).toBeUndefined()
  await ui.unmount()
})

test('a folder change with no shell command re-reads the band', async ($, on) => {
  const place: Place = { cwd: 'C:/repo/Worktrees/1-x', branch: 'claude/1-x' }
  checkout(on, place)
  on('classic.CwdChanged', () => ({}) as never)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
  await shows(ui, '1-x')
  place.cwd = 'C:/repo/Worktrees/2-y'
  place.branch = 'claude/2-y'
  await $.classic.CwdChanged({ old_cwd: 'C:/repo/Worktrees/1-x', new_cwd: 'C:/repo/Worktrees/2-y' } as never)
  await shows(ui, '2-y')
  expect(await ui.find({ type: 'Text', text: '2-y' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '#2' })).toBeDefined()
  await ui.unmount()
})

test('the band shows a CI failure with the count still running, and a nested worktree by its branch', async ($, on) => {
  checkout(on, {
    cwd: 'C:/repo/Worktrees/repo/jolly-lederberg-e16753',
    branch: 'claude/5063-band-sync',
    pr: { number: 5056, state: 'OPEN', title: 'Band (#5063)', headRefOid: 'bbb222', statusCheckRollup: PR_5056, reviews: [{ body: '<!-- pr-review sha=aaa111 round=1 verdict=clean -->' }] },
  })
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'gh pr checks 5056' } as never)
  await shows(ui, '  CI failing - 2 running')
  expect(await ui.find({ type: 'Text', text: '  CI failing - 2 running' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '5063-band-sync' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '#5063' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'review r1 clean - pushed since' })).toBeDefined()
  await ui.unmount()
})

test('a branch with no issue number and no PR still shows, with no PR', async ($, on) => {
  checkout(on, { cwd: 'C:/repo/Worktrees/repo/jolly-lederberg-e16753', branch: 'claude/jolly-lederberg-e16753' })
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
  await shows(ui, 'no PR')
  expect(await ui.find({ type: 'Text', text: 'jolly-lederberg-e16753' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'no PR' })).toBeDefined()
  await ui.unmount()
})

test('the repo settings file sets the buttons and the issue pattern', async ($, on) => {
  checkout(on, { cwd: 'C:/repo/Worktrees/x', branch: 'work/T-31-x' })
  on('fs.read', (_$, e) => {
    if ((e as { path: string }).path.replace(/\\/g, '/') !== 'C:/repo/Worktrees/x/.claude/skill-settings.md') throw new Error('missing')
    return { value: '## Band\n- button: Hello = say hi\n- issue branch: work/T-{issue}-\n- branch prefix: work/\n' } as never
  })
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
  await shows(ui, '#31')
  expect(await ui.find({ type: 'Text', text: '#31' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'T-31-x' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: 'Hello' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: 'Ship it' })).toBeUndefined()
  await ui.unmount()
})
