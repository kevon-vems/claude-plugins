import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code/testing'
import { AUTO_MS, MAX_AUTO, fromUser, proceedLine, secondsLeft } from '../hooks/autogo.ts'
import { DEFAULTS } from '../hooks/config.ts'

const AUTO_TEXT = DEFAULTS.autoText

test('typing and a band click are the user; the auto-continue and other plugins are not', () => {
  expect(fromUser({ kind: 'composer' })).toBe(true)
  expect(fromUser({ kind: 'bridge' })).toBe(true)
  expect(fromUser({ kind: 'plugin', name: 'band', asUser: true })).toBe(true)
  expect(fromUser({ kind: 'plugin', name: 'band' })).toBe(false)
  expect(fromUser({ kind: 'plugin', name: 'other', asUser: true })).toBe(false)
  expect(fromUser({ kind: 'task-notification' })).toBe(false)
  expect(fromUser(undefined)).toBe(false)
})

test('a turn that ends asking to go ahead is caught', () => {
  expect(proceedLine('Built it.\n\n**Want me to proceed?**')).toBe('Want me to proceed?')
  expect(proceedLine('Done.\nShould I continue with the next slice?')).toBe('Should I continue with the next slice?')
  expect(proceedLine('Plan is ready.\n\nWaiting for your go.')).toBe('Waiting for your go.')
  expect(proceedLine('Ready. Ship it?')).toBe('Ready. Ship it?')
})

test('a choice, an open question or a plain ending is not', () => {
  expect(proceedLine('Proceed with A or B?')).toBeUndefined()
  expect(proceedLine('Which branch should I continue on?')).toBeUndefined()
  expect(proceedLine('Want me to proceed?\n\nAll done.')).toBeUndefined()
  expect(proceedLine('Is the build green?')).toBeUndefined()
  expect(proceedLine('')).toBeUndefined()
})

test('seconds left round up and stop at zero', () => {
  expect(secondsLeft(60000, 0)).toBe(60)
  expect(secondsLeft(60000, 59001)).toBe(1)
  expect(secondsLeft(60000, 70000)).toBe(0)
})

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } } as const

function world(on: On) {
  const prompts: string[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, rateLimits: [] } }) as never)
  on('session.cwd', () => ({ value: 'C:/repo' }) as never)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('command.list', () => ({ value: [] }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('turn.start', (_$, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e) => {
    prompts.push((e as { text: string }).text)
    return { text: (e as { text: string }).text } as never
  })
  return { prompts }
}

const turn = (answer: string, extra: Record<string, unknown> = {}) =>
  ({ answer, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...extra }) as never

test('the countdown runs, then sends the marked go', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.turn.complete(turn('Next slice is ready.\nWant me to proceed?'))
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'Auto-continue in 60s' })).toBeDefined()
  await clock.advance(20000)
  expect(await ui.find({ type: 'Text', text: 'Auto-continue in 40s' })).toBeDefined()
  expect(w.prompts).toEqual([])
  await clock.advance(AUTO_MS)
  expect(w.prompts).toEqual([AUTO_TEXT])
  expect(await ui.find({ key: 'auto-stop' })).toBeUndefined()
  await ui.unmount()
})

test('Stop cancels it, and nothing is sent', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.turn.complete(turn('Want me to proceed?'))
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await ui.press({ key: 'auto-stop' })
  await clock.advance(AUTO_MS * 2)
  expect(w.prompts).toEqual([])
  expect(await ui.find({ key: 'auto-go' })).toBeUndefined()
  await ui.unmount()
})

test('Go now sends a plain go at once', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.turn.complete(turn('Want me to proceed?'))
  const ui = await $.ui.mount({ plugin: 'band', surface: 'desktop', ...BAND })
  await ui.press({ key: 'auto-go' })
  await clock.advance(AUTO_MS * 2)
  expect(w.prompts).toEqual(['go'])
  await ui.unmount()
})

test('a typed message cancels the countdown', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.turn.complete(turn('Want me to proceed?'))
  await $.prompt.submit({ text: 'wait, one thing', origin: { kind: 'composer' }, wait: false } as never)
  await clock.advance(AUTO_MS * 2)
  expect(w.prompts).toEqual(['wait, one thing'])
})

test('a subagent turn, an aborted turn or a plain ending never arms it', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  await $.turn.complete(turn('Want me to proceed?', { agentId: 'a1' }))
  await $.turn.complete(turn('Want me to proceed?', { reason: 'aborted', isAborted: true }))
  await $.turn.complete(turn('All done.'))
  await clock.advance(AUTO_MS * 2)
  expect(w.prompts).toEqual([])
})

test('it stops after three in a row, until a typed message', async ($, on) => {
  const clock = mock.clock(on)
  const w = world(on)
  for (let i = 0; i < MAX_AUTO + 1; i++) {
    await $.turn.complete(turn('Want me to proceed?'))
    await clock.advance(AUTO_MS + 1000)
  }
  expect(w.prompts).toEqual([AUTO_TEXT, AUTO_TEXT, AUTO_TEXT])
  await $.prompt.submit({ text: 'keep going', origin: { kind: 'composer' }, wait: false } as never)
  await $.turn.complete(turn('Want me to proceed?'))
  await clock.advance(AUTO_MS + 1000)
  expect(w.prompts).toEqual([AUTO_TEXT, AUTO_TEXT, AUTO_TEXT, 'keep going', AUTO_TEXT])
})
