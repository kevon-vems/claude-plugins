import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { cleanHandoff, handoffPrompt, targetsOf, MAX_HANDOFF } from '../hooks/handoff.ts'
import type { FleetRow } from '../types'

const row = (id: string, over: Partial<FleetRow> = {}): FleetRow => ({
  id, top: `C:/repo/Worktrees/${id}`, worktree: id, state: 'waiting', since: 0, at: 0, self: false, shared: false, ...over,
})

test('the handoff prompt names what to cover, and the focus when given', () => {
  expect(handoffPrompt('', ['Short lines.'])).toContain('the next step, stated as an action')
  expect(handoffPrompt('', ['Short lines.'])).toContain('Short lines.')
  expect(handoffPrompt('', ['Short lines.'])).not.toContain('Focus the handoff on')
  expect(handoffPrompt('  the review loop ', [])).toContain('Focus the handoff on: the review loop')
})

test('a reply wrapped in a fence is unwrapped, and a long one is cut', () => {
  expect(cleanHandoff('```text\nDo the thing.\n```')).toBe('Do the thing.')
  expect(cleanHandoff('  plain  ')).toBe('plain')
  expect(cleanHandoff('x'.repeat(MAX_HANDOFF + 50)).length).toBe(MAX_HANDOFF)
})

test('send targets are the other live sessions', () => {
  const got = targetsOf([row('me', { self: true }), row('a', { issue: 12, state: 'asking' }), row('b', { worktree: undefined, top: 'C:/repo' })], 'claude/')
  expect(got).toEqual([
    { value: 'a', label: 'a #12 (asking)' },
    { value: 'b', label: 'repo (waiting)' },
  ])
})

const PANE = { component: 'Pane', requestId: 'band-handoff', props: { title: 'Handoff', isFocused: false, bodyColumns: 120, placement: 'dock' } } as const
const fwd = (p: string) => p.replace(/\\/g, '/')

function world(on: On, fork: () => unknown) {
  const copies: string[] = []
  const sends: Array<{ to: unknown; text: string }> = []
  const forks: string[] = []
  const peer = JSON.stringify({ id: 'peer', top: 'C:/repo/Worktrees/4791-skills', worktree: '4791-skills', issue: 4791, state: 'waiting', since: 0, at: 0 })
  on('session.id', () => ({ value: 'me' }) as never)
  on('session.cwd', () => ({ value: 'C:/repo' }) as never)
  on('session.start', (_$, e) => ({ cwd: (e as { cwd: string }).cwd }) as never)
  on('env.get', (_$, e) => ({ value: ({ USERPROFILE: 'C:\\Users\\me', OS: 'Windows_NT' } as Record<string, string>)[(e as { name: string }).name] }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.list', (_$, e) => {
    if (!fwd((e as { path: string }).path).endsWith('band-fleet')) return { value: [] } as never
    return { value: [{ name: 'peer.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] } as never
  })
  on('fs.read', () => ({ value: peer }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.fork', (_$, e) => {
    forks.push((e as { prompt: string }).prompt)
    return { value: fork() } as never
  })
  on('ui.copy', (_$, e) => {
    copies.push((e as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  on('session.send', (_$, e) => {
    const s = e as { to: unknown; text: string }
    sends.push({ to: s.to, text: s.text })
    return { isDelivered: true } as never
  })
  return { copies, sends, forks }
}

async function settle(clock: { advance: (ms: number) => Promise<void> }) {
  for (let i = 0; i < 50; i++) await clock.advance(0)
}

test('/handoff writes the prompt from the transcript, then copies or sends it', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on, () => ({ isAnswered: true, text: 'Pick up #4740 step 4.', usage: {} }))
  await $.session.start({ cwd: 'C:/repo', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'handoff', args: 'the wrapup mod' } as never)
  await settle(clock)
  expect(w.forks[0]).toContain('Focus the handoff on: the wrapup mod')
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect((await ui.find({ key: 'handoff-text' }))?.props?.text).toBe('Pick up #4740 step 4.')
  await ui.press({ key: 'handoff-copy' })
  expect(w.copies).toEqual(['Pick up #4740 step 4.'])
  await ui.select({ key: 'handoff-send', value: 'peer' })
  expect(w.sends.map(x => x.text)).toEqual(['Pick up #4740 step 4.'])
  expect(JSON.stringify(w.sends[0]?.to)).toContain('peer')
  expect(await ui.find({ type: 'Text', text: 'Sent to 4791-skills #4791 (waiting)' })).toBeDefined()
  await ui.unmount()
})

test('a session with nothing to hand off says so', async ($, on) => {
  const clock = mock.clock(on)
  world(on, () => ({ isAnswered: false, reason: 'nothing-to-fork' }))
  await $.session.start({ cwd: 'C:/repo', surface: 'desktop' } as never)
  await settle(clock)
  await $.command.run({ command: 'handoff', args: '' } as never)
  await settle(clock)
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: 'No handoff: nothing to hand off yet: this session has no reply' })).toBeDefined()
  expect(await ui.find({ key: 'handoff-copy' })).toBeUndefined()
  await ui.unmount()
})
