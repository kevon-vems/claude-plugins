import { atom, read, update } from 'claude-code'
import type { CommandInfo, EngineInterface, Register } from 'claude-code'

import type { Activity, Beat, Handoff, Report, Wrapup, Ci, FleetRow, Pr, Review, Work } from '../types'
import { DEFAULTS, MARKETPLACE, PLUGIN, SETTINGS_FILE, configOf } from './config'
import type { BandButton, BandConfig } from './config'
import { UPDATE_DELAY_MS, due, ownPlugins } from './update'
import { SKILLS_PANE, skillRows, splitSkill } from './skills'
import { THREADS_QUERY, WRAPUP_PANE, commitsOf, dirtyOf, ghiBody, ghiTitle, isClear, issueNumberOf, repoOf, threadsOf } from './wrapup'
import { HANDOFF_PANE, cleanHandoff, handoffPrompt, targetsOf } from './handoff'
import { BEAT_MS, GONE_MS, PRUNE_MS, beatOf, fleetDir, fleetOf, nameOf, parseBeat, pushedSince, sharedWith } from './fleet'

const work = atom({ plugin: 'band', key: 'work' } as const, null)
const focus = atom({ plugin: 'band', key: 'focus' } as const, null)
const pending = atom({ plugin: 'band', key: 'pending' } as const, {})
const fleet = atom({ plugin: 'band', key: 'fleet' } as const, [])
const handoff = atom({ plugin: 'band', key: 'handoff' } as const, null)
const wrapup = atom({ plugin: 'band', key: 'wrapup' } as const, null)
const skillView = atom({ plugin: 'band', key: 'skillView' } as const, null)
const skillPick = atom({ plugin: 'band', key: 'skillPick' } as const, null)

const SCAN_MS = 30 * 1000
const PR_MS = 60 * 1000

type Check = { status?: string; conclusion?: string; state?: string }
type Option = { value: string; label: string }

const FAILED = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'ERROR', 'STARTUP_FAILURE'])

const isFailed = (c: Check) => FAILED.has(c.conclusion ?? '') || FAILED.has(c.state ?? '')
const isRunning = (c: Check) => (c.status !== undefined && c.status !== 'COMPLETED') || c.state === 'PENDING' || c.state === 'EXPECTED'

export function ciOf(checks: Check[]): Ci {
  if (checks.length === 0) return 'none'
  if (checks.some(isFailed)) return 'failing'
  if (checks.some(isRunning)) return 'running'
  return 'passing'
}

export function runningOf(checks: Check[]): number {
  return checks.filter(isRunning).length
}

export function ciText(pr: Pr): string | undefined {
  if (pr.ci === 'none') return pr.state === 'OPEN' ? 'no CI yet' : undefined
  if (pr.ci === 'failing' && pr.running) return `CI failing - ${pr.running} running`
  return `CI ${pr.ci}`
}

export function reviewText(pr: Pr): string | undefined {
  const r = pr.review
  if (!r) return undefined
  const open = r.open && r.open !== '0/0/0' ? ` (open ${r.open})` : ''
  return `review r${r.round} ${r.verdict}${open}${pushedSince(pr) ? ' - pushed since' : ''}`
}

export function isFeature(branch: string | undefined): boolean {
  return !!branch && branch !== 'main' && branch !== 'HEAD'
}

export function settled(prev: Work | null, branch: string): Pr | undefined {
  return prev?.branch === branch && prev.pr && prev.pr.state !== 'OPEN' ? prev.pr : undefined
}

export function lastPr(prev: Work | null, branch: string, stderr: string): Pr | undefined {
  if (/no pull requests? found/i.test(stderr)) return undefined
  return prev?.branch === branch ? prev.pr : undefined
}

export function reviewOf(bodies: string[]): Review | undefined {
  for (const body of [...bodies].reverse()) {
    const m = /pr-review sha=(\w+) round=(\d+) verdict=(\w+)([^>\n]*)/.exec(body)
    if (!m) continue
    const open = /pr-review-open (\d+\/\d+\/\d+)/.exec(body)?.[1] ?? /\bopen=(\d+\/\d+\/\d+)/.exec(m[4])?.[1]
    return { round: Number(m[2]), verdict: m[3], open, sha: m[1] }
  }
  return undefined
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

export function worktreeOf(top: string, gitDir: string, commonDir: string): string | undefined {
  if (!gitDir || !commonDir || norm(gitDir) === norm(commonDir)) return undefined
  return top.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || undefined
}

export type IssueClues = { feature: boolean; prOpen: boolean; titled?: number; named?: number; focus?: number }

export function issueFor(c: IssueClues): number | undefined {
  if (!c.feature) return c.focus
  if (c.prOpen) return c.titled ?? c.named ?? c.focus
  return c.focus ?? c.titled ?? c.named
}

export function issueOf(branch: string, pattern: RegExp): number | undefined {
  const m = pattern.exec(branch)
  return m ? Number(m[1]) : undefined
}

export function issueOfTitle(title: string): number | undefined {
  const all = [...title.matchAll(/#(\d+)/g)]
  return all.length ? Number(all[all.length - 1][1]) : undefined
}

export type Touch = { issue: number; closed: boolean }

export function touchedIssue(command: string, output = ''): Touch | undefined {
  const verbs = [...command.matchAll(/\bgh\s+issue\s+(view|edit|comment|reopen|close|develop|pin)\s+#?(\d+)\b/gi)]
  if (verbs.length) {
    const last = verbs[verbs.length - 1]
    return { issue: Number(last[2]), closed: last[1].toLowerCase() === 'close' }
  }
  if (/\bgh\s+issue\s+create\b/i.test(command)) {
    const made = /github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)/.exec(output)
    return made ? { issue: Number(made[1]), closed: false } : undefined
  }
  const linked = [...command.matchAll(/\/issues\/(\d+)\b/g)]
  return linked.length ? { issue: Number(linked[linked.length - 1][1]), closed: false } : undefined
}

export function nextFocus(prev: number | null, t: Touch | undefined): number | null {
  if (!t) return prev
  if (t.closed) return prev === t.issue ? null : prev
  return t.issue
}

const MOVES = /\bgh\s+(pr|issue)\b|\bgit\s+(-C\s+\S+\s+)?(checkout|switch|worktree|push|merge|pull|branch|rebase)\b|(^|[;&|(]\s*)(cd|pushd|popd)\b|\b(Set|Push|Pop)-Location\b/i

export function moves(command: string): boolean {
  return MOVES.test(command)
}

export function buttonsOf(all: BandButton[], have: Set<string> | undefined): BandButton[] {
  return all.filter(b => b.say !== undefined || (b.run !== undefined && (!have || have.has(b.run))))
}

export function skillsOf(commands: CommandInfo[], mine: string[], extra: string[]): Option[] {
  const wanted = new Set([...mine, ...extra])
  return commands
    .map(c => c.name.replace(/^\//, ''))
    .filter(name => wanted.has(name))
    .filter((name, i, all) => all.indexOf(name) === i)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }))
}

const STALE_MS = 30 * 60 * 1000

export const runKey = (command: string) => `run:${command.replace(/^\//, '').trim()}`
export const sayKey = (text: string) => `say:${text.trim().toLowerCase()}`

export function live(waiting: Record<string, number>, now: number): Record<string, number> {
  return Object.fromEntries(Object.entries(waiting).filter(([, at]) => now - at < STALE_MS))
}

let busy = false
let again = false
let skills: Option[] = []
let cfg: BandConfig = DEFAULTS
let have: Set<string> | undefined
let place = ''
let home: string | undefined
let selfId = ''
let activity: Activity = 'waiting'
let since = 0
let tick = 0
let focusTick = 0
let branchTick = 0
let seenBranch = ''
type Lock = { at: number }
const firing = new Map<string, Lock>()

async function fire($: EngineInterface, b: BandButton): Promise<void> {
  const key = b.run ? runKey(b.run) : b.say ? sayKey(b.say) : ''
  if (!key) return
  let mine: Lock | undefined = firing.has(key) ? undefined : { at: Infinity }
  if (mine) firing.set(key, mine)
  const now = await $.clock.now()
  if (mine) mine.at = now
  else {
    const held = firing.get(key)
    if (held && now - held.at < STALE_MS) return
    mine = { at: now }
    firing.set(key, mine)
  }
  let queued = false
  try {
    if (key in live(await read($, pending), now)) return
    await update($, pending, w => ({ ...live(w, now), [key]: now }))
    queued = true
    if (b.run) await $.command.run({ command: b.run })
    else if (b.say) await $.prompt.submit({ text: b.say, asUser: true })
  } catch (err) {
    $.ui.log(`band: ${key} failed: ${String(err)}`, { to: 'debug' })
  } finally {
    if (queued) await release($, key, now)
    if (firing.get(key) === mine) firing.delete(key)
  }
}

async function release($: EngineInterface, key: string, at: number): Promise<void> {
  if ((await read($, pending))[key] !== at) return
  await update($, pending, w => {
    if (w[key] !== at) return w
    const { [key]: _gone, ...rest } = w
    return rest
  })
}

async function loadConfig($: EngineInterface, top: string): Promise<BandConfig> {
  const text = top ? await $.fs.read(`${top}/${SETTINGS_FILE}`).catch(() => undefined) : undefined
  cfg = configOf(text)
  return cfg
}

async function refresh($: EngineInterface, timer = false): Promise<void> {
  if (busy) {
    again = true
    return
  }
  busy = true
  again = false
  let cwd = ''
  try {
    cwd = await $.session.cwd()
    const git = async (...args: string[]) => {
      const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 10000 })
      return r.exitCode === 0 ? r.stdout.trim() : ''
    }
    const top = await git('rev-parse', '--show-toplevel')
    place = top || cwd
    await loadConfig($, top)
    const mine = top
      ? (await $.fs.list(`${top}/.claude/skills`).catch(() => [])).filter(d => d.kind === 'dir').map(d => d.name)
      : []
    const commands = await $.command.list()
    skills = skillsOf(commands, mine, cfg.extraSkills)
    have = new Set(commands.map(c => c.name.replace(/^\//, '')))
    if (!top) {
      await update($, work, () => null)
      return
    }
    const branch = await git('rev-parse', '--abbrev-ref', 'HEAD')
    if (branch && seenBranch && branch !== seenBranch) branchTick = ++tick
    if (branch) seenBranch = branch
    const feature = isFeature(branch)
    const prev = await read($, work)
    let pr: Pr | undefined = feature && timer ? settled(prev, branch) : undefined
    if (feature && !pr) {
      const r = await $.process.run(
        ['gh', 'pr', 'view', branch, '--json', 'number,state,title,headRefOid,statusCheckRollup,reviews'],
        { cwd, timeoutMs: 20000 },
      )
      if (r.exitCode === 0) {
        const j = JSON.parse(r.stdout) as {
          number: number
          state: string
          title?: string
          headRefOid?: string
          statusCheckRollup?: Check[]
          reviews?: { body?: string }[]
        }
        const checks = j.statusCheckRollup ?? []
        pr = {
          number: j.number,
          state: j.state,
          ci: ciOf(checks),
          running: runningOf(checks),
          head: j.headRefOid,
          issue: issueOfTitle(j.title ?? ''),
          review: reviewOf((j.reviews ?? []).map(x => x.body ?? '')),
        }
      } else {
        pr = lastPr(prev, branch, r.stderr)
      }
    }
    const [gitDir = '', commonDir = ''] = (await git('rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir')).split(/\r?\n/)
    const worktree = worktreeOf(top, gitDir, commonDir)
    const focused = focusTick >= branchTick ? (await read($, focus)) ?? undefined : undefined
    const issue = issueFor({ feature, prOpen: pr?.state === 'OPEN', titled: pr?.issue, named: issueOf(branch, cfg.issueBranch), focus: focused })
    const next: Work | null = worktree || issue || feature ? { worktree, branch, issue, pr } : null
    await update($, work, () => next)
    if (home && selfId) await beat($)
  } catch (err) {
    $.ui.log(`band: refresh failed: ${String(err)}`, { to: 'debug' })
    if (cwd && !(await $.fs.exists(cwd).catch(() => true))) await update($, work, () => null)
  } finally {
    busy = false
    if (again) await refresh($)
  }
}

async function beat($: EngineInterface, state?: Activity): Promise<void> {
  try {
    const now = await $.clock.now()
    if (state !== undefined && state !== activity) {
      activity = state
      since = now
    }
    if (!home || !selfId) return
    const b = beatOf(selfId, place, await read($, work), activity, since, now)
    await $.fs.write(`${fleetDir(home)}/${selfId}.json`, JSON.stringify(b))
  } catch (err) {
    $.ui.log(`band: heartbeat failed: ${String(err)}`, { to: 'debug' })
  }
}

async function scan($: EngineInterface): Promise<FleetRow[]> {
  try {
    if (!home) return []
    const dir = fleetDir(home)
    const now = await $.clock.now()
    const beats: Beat[] = []
    for (const d of await $.fs.list(dir).catch(() => [])) {
      if (d.kind !== 'file' || !d.name.endsWith('.json') || now - d.mtimeMs >= GONE_MS) continue
      const b = parseBeat(await $.fs.read(`${dir}/${d.name}`).catch(() => ''))
      if (b) beats.push(b)
    }
    const rows = fleetOf(beats, now, selfId)
    await update($, fleet, () => rows)
    return rows
  } catch (err) {
    $.ui.log(`band: fleet scan failed: ${String(err)}`, { to: 'debug' })
    return []
  }
}

async function prune($: EngineInterface): Promise<void> {
  try {
    if (!home) return
    const dir = fleetDir(home)
    const now = await $.clock.now()
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    for (const d of await $.fs.list(dir).catch(() => [])) {
      if (d.kind !== 'file' || !/^[\w.-]+\.json$/.test(d.name) || now - d.mtimeMs <= PRUNE_MS) continue
      const path = `${dir}/${d.name}`
      const argv = windows ? ['cmd', '/c', 'del', '/q', path.replace(/\//g, '\\')] : ['rm', '-f', path]
      await $.process.run(argv, { timeoutMs: 10000 })
    }
  } catch (err) {
    $.ui.log(`band: fleet prune failed: ${String(err)}`, { to: 'debug' })
  }
}

async function writeHandoff($: EngineInterface, focus: string): Promise<void> {
  try {
    const r = await $.model.fork({ prompt: handoffPrompt(focus, cfg.handoffRules) })
    const next: Handoff = r.isAnswered
      ? { status: 'ready', text: cleanHandoff(r.text) }
      : { status: 'failed', reason: r.reason === 'nothing-to-fork' ? 'nothing to hand off yet: this session has no reply' : `the model call failed (${r.reason})` }
    await update($, handoff, () => next)
  } catch (err) {
    await update($, handoff, () => ({ status: 'failed', reason: String(err) }))
  }
}

async function sendHandoff($: EngineInterface, sessionId: string, label: string): Promise<void> {
  const ho = await read($, handoff)
  if (ho?.status !== 'ready') return
  try {
    const r = await $.session.send({ to: { sessionId }, text: ho.text })
    if (!r.isDelivered) {
      $.ui.toast(`Not sent: ${r.reason}`)
      return
    }
    await update($, handoff, x => (x?.status === 'ready' ? { ...x, sent: label } : x))
  } catch (err) {
    $.ui.toast(`Not sent: ${String(err)}`)
  }
}

async function gather($: EngineInterface): Promise<void> {
  try {
    const cwd = await $.session.cwd()
    const run = (argv: string[], timeoutMs = 20000) => $.process.run(argv, { cwd, timeoutMs })
    const git = async (...args: string[]) => {
      const r = await run(['git', ...args], 10000)
      return r.exitCode === 0 ? r.stdout : undefined
    }
    const top = (await git('rev-parse', '--show-toplevel'))?.trim()
    if (top) await loadConfig($, top)
    if (!top) {
      await update($, wrapup, () => ({ status: 'failed', reason: 'this session is not in a git checkout' }))
      return
    }
    const unread: string[] = []
    const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD'))?.trim() || undefined
    const status = await git('status', '--porcelain')
    if (status === undefined) unread.push('uncommitted files')
    let upstream = true
    let log = await git('log', '--oneline', '@{u}..HEAD')
    if (log === undefined) {
      upstream = false
      log = await git('log', '--oneline', 'origin/main..HEAD')
      if (log === undefined) unread.push('unpushed commits')
    }
    let pr: Report['pr']
    let threads: Report['threads'] = []
    if (branch && branch !== 'main' && branch !== 'HEAD') {
      const r = await run(['gh', 'pr', 'view', branch, '--json', 'number,state,title,url'])
      if (r.exitCode === 0) {
        pr = JSON.parse(r.stdout) as NonNullable<Report['pr']>
        const where = repoOf(pr.url)
        const t = where
          ? await run(['gh', 'api', 'graphql', '-f', `query=${THREADS_QUERY}`, '-f', `owner=${where.owner}`, '-f', `repo=${where.repo}`, '-F', `pr=${pr.number}`])
          : undefined
        if (t?.exitCode === 0) threads = threadsOf(t.stdout)
        else unread.push('review threads')
      } else if (!/no pull requests? found/i.test(r.stderr)) {
        unread.push('the PR')
      }
    }
    const seen = await read($, work)
    const report: Report = {
      place: (seen?.branch === branch ? seen?.worktree : undefined) ?? top,
      branch,
      issue: (seen?.branch === branch ? seen?.issue : undefined) ?? (branch ? issueOf(branch, cfg.issueBranch) : undefined),
      dirty: dirtyOf(status ?? ''),
      unpushed: commitsOf(log ?? ''),
      upstream,
      pr,
      threads,
      unread,
    }
    await update($, wrapup, () => ({ status: 'ready', report }))
  } catch (err) {
    await update($, wrapup, () => ({ status: 'failed', reason: String(err) }))
  }
}

async function fileGhi($: EngineInterface): Promise<void> {
  const w = await read($, wrapup)
  if (w?.status !== 'ready' || !w.asking || w.filing || w.filed || w.report.threads.length === 0) return
  const r = w.report
  await update($, wrapup, x => (x?.status === 'ready' ? { ...x, asking: false, filing: true } : x))
  let filed: { url: string; number?: number } | undefined
  try {
    const where = r.pr ? repoOf(r.pr.url) : undefined
    const argv = ['gh', 'issue', 'create', ...(where ? ['--repo', `${where.owner}/${where.repo}`] : []), '--title', ghiTitle(r), '--body', ghiBody(r)]
    const res = await $.process.run(argv, { cwd: await $.session.cwd(), timeoutMs: 30000 })
    if (res.exitCode !== 0) throw new Error(res.stderr.trim() || `gh exited ${res.exitCode}`)
    const url = res.stdout.trim().split('\n').pop() ?? ''
    filed = { url, number: issueNumberOf(url) }
  } catch (err) {
    $.ui.toast(`GHI not filed: ${String(err)}`)
  } finally {
    await update($, wrapup, x => (x?.status === 'ready' ? { ...x, filing: false, filed } : x))
  }
}

async function openSkills($: EngineInterface): Promise<void> {
  let top: string | undefined
  const prev = (await read($, skillView))?.picked
  try {
    const cwd = await $.session.cwd()
    const r = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd, timeoutMs: 10000 })
    top = r.exitCode === 0 ? r.stdout.trim() : undefined
    const repo = top ? (await $.fs.list(`${top}/.claude/skills`)).filter(d => d.kind === 'dir').map(d => d.name) : []
    await update($, skillView, () => ({ top, rows: skillRows(repo, cfg.extraSkills) }))
  } catch (err) {
    await update($, skillView, () => ({ top, rows: skillRows([], cfg.extraSkills), failed: String(err) }))
  }
  const rows = (await read($, skillView))?.rows ?? []
  const first = rows.find(r => r.name === prev) ?? rows.find(r => r.repo) ?? rows[0]
  if (first) await pickSkill($, first.name)
  await $.ui.open({ id: SKILLS_PANE, title: 'Skills' })
}

async function openSkillFile($: EngineInterface, top: string, name: string): Promise<void> {
  const path = `${top}/.claude/skills/${name}/SKILL.md`
  const windows = (await $.env.get('OS')) === 'Windows_NT'
  const argv = windows ? ['explorer', path.replace(/\//g, '\\')] : ['open', path]
  try {
    await $.process.run(argv, { timeoutMs: 10000 })
  } catch (err) {
    $.ui.toast(`Could not open ${name}: ${String(err)}`)
  }
}

async function pickSkill($: EngineInterface, name: string): Promise<void> {
  const v = await read($, skillView)
  if (!v) return
  const row = v.rows.find(r => r.name === name)
  if (!row?.repo || !v.top) {
    await update($, skillView, x => (x ? { ...x, picked: name, text: undefined, readFailed: undefined } : x))
    return
  }
  try {
    const text = await $.fs.read(`${v.top}/.claude/skills/${name}/SKILL.md`)
    await update($, skillView, x => (x ? { ...x, picked: name, text, readFailed: undefined } : x))
  } catch (err) {
    await update($, skillView, x => (x ? { ...x, picked: name, text: undefined, readFailed: String(err) } : x))
  }
}

async function deleteSkill($: EngineInterface, top: string, name: string): Promise<void> {
  await update($, skillView, x => (x ? { ...x, confirmDelete: undefined } : x))
  try {
    const r = await $.process.run(['git', 'rm', '-r', '-q', '--', `.claude/skills/${name}`], { cwd: top, timeoutMs: 20000 })
    if (r.exitCode !== 0) {
      $.ui.toast(`Could not delete ${name}: ${(r.stderr || r.stdout).trim()}`)
      return
    }
  } catch (err) {
    $.ui.toast(`Could not delete ${name}: ${String(err)}`)
    return
  }
  await update($, skillView, x => (x ? { ...x, picked: undefined, text: undefined } : x))
  $.ui.toast(`Deleted ${name}. The deletion is staged; commit it on a branch.`)
  await openSkills($)
}

async function selfUpdate($: EngineInterface): Promise<void> {
  try {
    if (!home) return
    const stamp = `${home.replace(/[\\/]+$/, '').replace(/\\/g, '/')}/.claude/band-update.json`
    const now = await $.clock.now()
    if (!due(await $.fs.read(stamp).catch(() => ''), now)) return
    await $.fs.write(stamp, JSON.stringify({ at: now }))
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    const claude = (...args: string[]) => $.process.run(windows ? ['cmd', '/c', 'claude', ...args] : ['claude', ...args], { timeoutMs: 180000 })
    const m = await claude('plugin', 'marketplace', 'update', MARKETPLACE)
    if (m.exitCode !== 0) {
      $.ui.log(`band: marketplace update failed: ${(m.stderr || m.stdout).trim()}`, { to: 'debug' })
      return
    }
    const list = await claude('plugin', 'list', '--json')
    for (const p of ownPlugins(list.exitCode === 0 ? list.stdout : '')) {
      const u = await claude('plugin', 'update', p.id, '--scope', p.scope)
      if (u.exitCode !== 0) $.ui.log(`band: ${p.id} update failed: ${(u.stderr || u.stdout).trim()}`, { to: 'debug' })
    }
  } catch (err) {
    $.ui.log(`band: self-update failed: ${String(err)}`, { to: 'debug' })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await update($, pending, () => ({}))
    selfId = await $.session.id()
    home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    since = await $.clock.now()
    await $.command
      .register({ name: 'handoff', description: 'Write a cold-start prompt for another session, to copy or send. Optional: what to focus on' })
      .catch(err => $.ui.log(`band: /handoff not registered: ${String(err)}`, { to: 'debug' }))
    await $.command
      .register({ name: 'wrapup', description: 'Before archiving: uncommitted files, unpushed commits, PR state and open review threads' })
      .catch(err => $.ui.log(`band: /wrapup not registered: ${String(err)}`, { to: 'debug' }))
    await $.command
      .register({ name: 'skills-panel', description: 'Read the repo skills, open one in the editor, or delete one' })
      .catch(err => $.ui.log(`band: /skills-panel not registered: ${String(err)}`, { to: 'debug' }))
    void refresh($).then(() => beat($, 'waiting')).then(() => scan($))
    void prune($)
    $.clock.after(UPDATE_DELAY_MS, () => void selfUpdate($))
    $.clock.every(BEAT_MS, () => void beat($))
    $.clock.every(SCAN_MS, () => void scan($))
    $.clock.every(PR_MS, () => void refresh($, true))
    return started
  })

  on('classic.CwdChanged', async ($, e, next) => {
    const moved = await next(e)
    void refresh($)
    return moved
  })

  on('turn.start', async ($, e, next) => {
    void beat($, 'working')
    return next(e)
  })

  for (const tool of ['Bash', 'PowerShell']) {
    on('tool.call', { tool }, async ($, e, next) => {
      const ran = await next(e)
      const command = (e as { command?: unknown }).command
      if (typeof command !== 'string') return ran
      const t = ran.deny === undefined && !ran.isError ? touchedIssue(command, ran.text ?? '') : undefined
      if (t) {
        const was = await read($, focus)
        const now = nextFocus(was, t)
        if (now !== was || !t.closed) focusTick = ++tick
        await update($, focus, () => now)
      }
      if (t || moves(command)) void refresh($)
      return ran
    })
  }

  on('turn.complete', async ($, e, next) => {
    void refresh($).then(() => beat($, 'waiting'))
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await beat($, 'asking')
    try {
      return await next(e)
    } finally {
      await beat($, 'working')
    }
  })

  on('session.end', async ($, e, next) => {
    await beat($, 'ended')
    const ended = await next(e)
    if (e.reason === 'clear') {
      selfId = await $.session.id()
      await beat($, 'waiting')
    }
    return ended
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    await update($, handoff, () => ({ status: 'writing' }))
    await scan($)
    await $.ui.open({ id: HANDOFF_PANE, title: 'Handoff' })
    void writeHandoff($, e.args ?? '')
    return { text: 'Writing the handoff in its pane.' }
  })

  on('ui.render', { component: 'Pane', requestId: HANDOFF_PANE }, async ($, e) => {
    const { Box, Button, Markdown, Select, Text } = $.ui.resolve(e)
    const ho = await read($, handoff)
    if (!ho || ho.status === 'writing') return <Text dimColor>Writing the handoff prompt...</Text>
    if (ho.status === 'failed') return <Text color="red">{`No handoff: ${ho.reason}`}</Text>
    const targets = targetsOf(await read($, fleet), cfg.branchPrefix)
    return (
      <Box flexDirection="column" rowGap={1}>
        <Box columnGap={2} alignItems="center" flexWrap="wrap">
          <Button
            key="handoff-copy"
            label="Copy"
            onPress={press =>
              void $.ui.copy({ text: ho.text, surface: press.surface }).then(r => $.ui.toast(r.isCopied ? 'Handoff copied.' : `Not copied: ${r.reason}`))
            }
          />
          {targets.length > 0 ? (
            <Select key="handoff-send" label="Send to" options={targets} onSelect={value => void sendHandoff($, value, targets.find(t => t.value === value)?.label ?? value)} />
          ) : (
            <Text dimColor>No other live session to send to.</Text>
          )}
          {ho.sent ? <Text color="green">{`Sent to ${ho.sent}`}</Text> : null}
        </Box>
        <Markdown key="handoff-text" text={ho.text} />
      </Box>
    )
  })

  on('command.run', { command: 'wrapup' }, async $ => {
    await update($, wrapup, () => ({ status: 'reading' }))
    await $.ui.open({ id: WRAPUP_PANE, title: 'Wrap up' })
    void gather($)
    return { text: 'Checking what this session leaves behind, in its pane.' }
  })

  on('ui.render', { component: 'Pane', requestId: WRAPUP_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const w = await read($, wrapup)
    if (!w || w.status === 'reading') return <Text dimColor>Checking git and GitHub...</Text>
    if (w.status === 'failed') return <Text color="red">{`Could not check: ${w.reason}`}</Text>
    const r = w.report
    const recheck = <Button key="wrapup-recheck" label="Check again" onPress={() => void update($, wrapup, () => ({ status: 'reading' })).then(() => gather($))} />
    const head = `${r.place}${r.branch ? ` on ${r.branch}` : ''}${r.issue ? ` #${r.issue}` : ''}`
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold>{head}</Text>
        {isClear(r) && r.unread.length === 0 ? <Text color="green" bold>Nothing left behind. Safe to archive.</Text> : null}
        {r.unread.length > 0 ? <Text color="yellow" bold>{`Could not read: ${r.unread.join(', ')}. Check by hand.`}</Text> : null}
        {r.dirty.length > 0 ? (
          <Box flexDirection="column">
            <Text color="red" bold>{`${r.dirty.length} uncommitted file${r.dirty.length === 1 ? '' : 's'}`}</Text>
            {r.dirty.slice(0, 10).map(p => <Text key={`d-${p}`}>{`  ${p}`}</Text>)}
            {r.dirty.length > 10 ? <Text dimColor>{`  and ${r.dirty.length - 10} more`}</Text> : null}
          </Box>
        ) : null}
        {r.unpushed.length > 0 ? (
          <Box flexDirection="column">
            <Text color="red" bold>{`${r.unpushed.length} unpushed commit${r.unpushed.length === 1 ? '' : 's'}${r.upstream ? '' : ' (branch not on GitHub)'}`}</Text>
            {r.unpushed.slice(0, 10).map(c => <Text key={`c-${c.sha}`}>{`  ${c.sha} ${c.subject}`}</Text>)}
          </Box>
        ) : null}
        {r.pr ? (
          <Text color={r.pr.state === 'OPEN' ? 'yellow' : 'green'}>{`PR #${r.pr.number} ${r.pr.state.toLowerCase()}: ${r.pr.title}`}</Text>
        ) : null}
        {r.threads.length > 0 ? (
          <Box flexDirection="column">
            <Text color="yellow" bold>{`${r.threads.length} open review thread${r.threads.length === 1 ? '' : 's'}`}</Text>
            {r.threads.map(t => <Text key={`t-${t.url}`}>{`  ${t.path}${t.line ? `:${t.line}` : ''}  ${t.text}`}</Text>)}
          </Box>
        ) : null}
        {w.asking ? (
          <Box flexDirection="column" borderStyle="round" paddingX={1}>
            <Text bold>{`File this GHI? ${ghiTitle(r)}`}</Text>
            <Text>{ghiBody(r)}</Text>
            <Box columnGap={2}>
              <Button key="wrapup-ghi-yes" label="File it" onPress={() => void fileGhi($)} />
              <Button key="wrapup-ghi-no" label="Don't file" onPress={() => void update($, wrapup, x => (x?.status === 'ready' ? { ...x, asking: false } : x))} />
            </Box>
          </Box>
        ) : null}
        <Box columnGap={2} alignItems="center" flexWrap="wrap">
          {r.threads.length > 0 && !w.filed && !w.asking ? (
            <Button key="wrapup-ghi" label={w.filing ? 'Filing...' : 'Draft a GHI for the open threads'} dimColor={w.filing} onPress={() => void update($, wrapup, x => (x?.status === 'ready' && !x.filing ? { ...x, asking: true } : x))} />
          ) : null}
          {w.filed ? <Text color="green">{`Filed ${w.filed.number ? `#${w.filed.number}` : w.filed.url}`}</Text> : null}
          {recheck}
        </Box>
      </Box>
    )
  })

  on('command.run', { command: 'skills-panel' }, async $ => {
    await openSkills($)
    return { text: 'Skills pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: SKILLS_PANE }, async ($, e) => {
    const { Box, Button, Markdown, Select, Text } = $.ui.resolve(e)
    const v = await read($, skillView)
    if (!v) return <Text dimColor>Reading the skills...</Text>
    const picked = v.rows.find(r => r.name === v.picked)
    const skill = v.text !== undefined ? splitSkill(v.text) : undefined
    return (
      <Box flexDirection="column" rowGap={1}>
        {v.failed ? <Text color="yellow" bold>{`Could not list .claude/skills: ${v.failed}`}</Text> : null}
        <Box columnGap={2} alignItems="center" flexWrap="wrap">
          {v.rows.length > 0 ? (
            <Select key="skills-pick" label="Skill" options={v.rows.map(r => ({ value: r.name, label: r.repo ? r.name : `${r.name} (not in this repo)` }))} value={v.picked} onSelect={value => void pickSkill($, value)} />
          ) : v.failed ? null : (
            <Text dimColor>No skills found.</Text>
          )}
          {picked?.repo && v.top ? <Button key="skills-open" label="Open file" onPress={() => void openSkillFile($, v.top!, picked.name)} /> : null}
          {picked?.repo && v.top && v.confirmDelete !== picked.name ? <Button key="skills-delete" label="Delete" onPress={() => void update($, skillView, x => (x ? { ...x, confirmDelete: picked.name } : x))} /> : null}
          <Button key="skills-refresh" label="Refresh" onPress={() => void openSkills($)} />
        </Box>
        {picked?.repo && v.top && v.confirmDelete === picked.name ? (
          <Box columnGap={2} alignItems="center" flexWrap="wrap">
            <Text color="yellow" bold>{`Delete the ${picked.name} skill folder?`}</Text>
            <Button key="skills-delete-yes" label="Yes, delete" onPress={() => void deleteSkill($, v.top!, picked.name)} />
            <Button key="skills-delete-no" label="Cancel" onPress={() => void update($, skillView, x => (x ? { ...x, confirmDelete: undefined } : x))} />
          </Box>
        ) : null}
        {picked && !picked.repo ? <Text dimColor>{`${picked.name} is not in this repo's .claude/skills, so it is not shown or changed here.`}</Text> : null}
        {v.readFailed ? <Text color="red">{`Could not read ${v.picked}: ${v.readFailed}`}</Text> : null}
        {skill?.description ? <Text dimColor>{skill.description}</Text> : null}
        {skill ? <Markdown key="skills-text" text={skill.body} /> : null}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const w = await read($, work)
    const pick = await read($, skillPick)
    const picked = skills.find(s => s.value === pick)?.value ?? skills[0]?.value
    const usage = await $.session.usage()
    const { Box, Button, Select, Text } = $.ui.resolve(e)

    const ctx = usage.context.percent
    const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')?.percentUsed
    const week = usage.rateLimits.find(r => r.kind === 'seven_day')?.percentUsed

    const parts: JSX.Element[] = []
    const sep = (k: string) => <Text key={`s${k}`} dimColor>{'   |   '}</Text>

    if (w) {
      const name = nameOf(w.worktree, w.branch, cfg.branchPrefix)
      if (name) parts.push(<Text key="wt" bold>{name}</Text>)
      if (w.issue) {
        if (parts.length) parts.push(sep('i'))
        parts.push(<Text key="is">{`#${w.issue}`}</Text>)
      }
      if (w.pr) {
        const ciColor = w.pr.ci === 'failing' ? 'red' : w.pr.ci === 'running' ? 'yellow' : w.pr.ci === 'passing' ? 'green' : undefined
        if (parts.length) parts.push(sep('p'))
        parts.push(<Text key="pr">{`PR #${w.pr.number}${w.pr.state === 'OPEN' ? '' : ` ${w.pr.state.toLowerCase()}`}`}</Text>)
        const ci = ciText(w.pr)
        if (ci) parts.push(<Text key="ci" color={ciColor} dimColor={w.pr.ci === 'none'}>{`  ${ci}`}</Text>)
        const review = reviewText(w.pr)
        if (review) {
          const color = w.pr.review?.verdict === 'clean' && !pushedSince(w.pr) ? 'green' : 'yellow'
          parts.push(sep('r'), <Text key="rv" color={color}>{review}</Text>)
        } else {
          parts.push(sep('r'), <Text key="rv" dimColor>no review yet</Text>)
        }
      } else if (w.issue || isFeature(w.branch)) {
        if (parts.length) parts.push(sep('p'))
        parts.push(<Text key="pr" dimColor>no PR</Text>)
      }
    }
    const meter = (key: string, label: string, pct: number | undefined) => {
      if (pct === undefined) return
      if (parts.length) parts.push(sep(key))
      parts.push(<Text key={key} color={pct >= 80 ? 'yellow' : undefined}>{`${label} ${Math.round(pct)}%`}</Text>)
    }
    meter('ctx', 'context', ctx)
    meter('5h', '5-hour', fiveHour)
    meter('wk', 'week', week)
    const now = await $.clock.now()
    const waiting = live(await read($, pending), now)
    const rows = await read($, fleet)
    const shared = sharedWith(rows, selfId)
    if (shared > 0) {
      if (parts.length) parts.push(sep('sh'))
      parts.push(<Text key="sh" color="red" bold>{`worktree shared with ${shared} other session${shared === 1 ? '' : 's'}`}</Text>)
    }

    return (
      <Box flexDirection="column" rowGap={1}>
        {parts.length > 0 ? <Box>{parts}</Box> : null}
        <Box columnGap={2} flexWrap="wrap" alignItems="center">
          {buttonsOf(cfg.buttons, have).map(b => {
            const key = b.run ? runKey(b.run) : b.say ? sayKey(b.say) : ''
            const held = key in waiting
            return (
              <Button
                key={`b-${b.label}`}
                label={held ? `${b.label} (queued)` : b.label}
                dimColor={held}
                onPress={() => void fire($, b)}
              />
            )
          })}
          <Button key="b-skills" label="Manage skills" onPress={() => void openSkills($)} />
          {skills.length > 0 ? (
            <Box key="skills" marginLeft={2} columnGap={1} alignItems="center">
              <Select key="skills" label="Skills" options={skills} value={picked} onSelect={value => void update($, skillPick, () => value)} />
              <Button key="skills-run" label={picked && runKey(picked) in waiting ? 'Run (queued)' : 'Run'} dimColor={!!picked && runKey(picked) in waiting} onPress={() => void (picked && fire($, { label: picked, run: picked }))} />
            </Box>
          ) : null}
          {Object.keys(waiting).length > 0 ? <Text key="busy" dimColor>queued, runs when Claude is free</Text> : null}
        </Box>
      </Box>
    )
  })
}
